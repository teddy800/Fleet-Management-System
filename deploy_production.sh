#!/bin/bash
# MESSOB Fleet Management - Production Deployment Script v2.0

set -e  # Exit on any error

echo "🚀 Starting MESSOB Fleet Management Production Deployment..."

# Check prerequisites
echo "📋 Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 is required but not installed."; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "❌ PostgreSQL client is required but not installed."; exit 1; }
command -v nginx >/dev/null 2>&1 || { echo "❌ Nginx is required but not installed."; exit 1; }

# Load environment variables
if [ -f .env.production ]; then
    echo "📄 Loading production environment variables..."
    export $(cat .env.production | grep -v '^#' | xargs)
elif [ -f .env ]; then
    echo "📄 Loading environment variables..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env.production or .env file not found. Please create one with required variables."
    exit 1
fi

# Validate required environment variables
required_vars=("DB_HOST" "DB_USER" "DB_PASSWORD" "DB_NAME" "DOMAIN_NAME" "ADMIN_PASSWORD")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
    fi
done

# Create necessary directories
echo "📁 Creating directories..."
sudo mkdir -p /var/log/odoo /var/backups/messob-fleet /opt/messob-fleet
sudo chown $USER:$USER /var/log/odoo /var/backups/messob-fleet

# Database backup before deployment
echo "💾 Creating pre-deployment database backup..."
BACKUP_FILE="/var/backups/messob-fleet/pre_deploy_$(date +%Y%m%d_%H%M%S).sql"
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_FILE
gzip $BACKUP_FILE
echo "✅ Backup created: ${BACKUP_FILE}.gz"

# Build frontend
echo "🏗️ Building React frontend..."
cd frontend
npm ci --production
npm run build
cd ..

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip3 install -r requirements.txt

# Update Odoo configuration
echo "🔄 Updating Odoo configuration..."
python3 -c "
import os
import configparser

config = configparser.ConfigParser()
config.read('odoo.conf')

if 'options' not in config:
    config.add_section('options')

# Database configuration
config.set('options', 'db_host', os.getenv('DB_HOST', 'localhost'))
config.set('options', 'db_port', os.getenv('DB_PORT', '5432'))
config.set('options', 'db_name', os.getenv('DB_NAME', 'messob_db'))
config.set('options', 'db_user', os.getenv('DB_USER', 'odoo'))
config.set('options', 'db_password', os.getenv('DB_PASSWORD', ''))

# Security configuration
config.set('options', 'admin_passwd', os.getenv('ADMIN_PASSWORD', ''))
config.set('options', 'session_timeout', '3600')
config.set('options', 'proxy_mode', 'True')

# Performance configuration
config.set('options', 'workers', '4')
config.set('options', 'max_cron_threads', '2')
config.set('options', 'limit_memory_hard', '2684354560')
config.set('options', 'limit_memory_soft', '2147483648')
config.set('options', 'limit_request', '8192')
config.set('options', 'limit_time_cpu', '600')
config.set('options', 'limit_time_real', '1200')

# Logging configuration
config.set('options', 'logfile', '/var/log/odoo/odoo.log')
config.set('options', 'log_level', 'info')
config.set('options', 'log_handler', ':INFO,werkzeug:WARNING,odoo.service.server:INFO')

# Addons path
config.set('options', 'addons_path', '/opt/odoo/addons,$(pwd)')

with open('odoo.conf', 'w') as f:
    config.write(f)
"

# Set secure file permissions
echo "🔒 Setting secure file permissions..."
chmod 600 odoo.conf
chmod 600 .env* 2>/dev/null || true
find . -name "*.py" -exec chmod 644 {} \;
find . -name "*.xml" -exec chmod 644 {} \;
find . -name "*.js" -exec chmod 644 {} \;
find . -name "*.jsx" -exec chmod 644 {} \;

# Generate SSL certificate if not exists
if [ ! -f "/etc/ssl/certs/messob-fleet.crt" ]; then
    echo "🔐 Generating SSL certificate..."
    sudo mkdir -p /etc/ssl/private
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/ssl/private/messob-fleet.key \
        -out /etc/ssl/certs/messob-fleet.crt \
        -subj "/C=ET/ST=Addis Ababa/L=Addis Ababa/O=MESSOB/CN=$DOMAIN_NAME"
    sudo chmod 600 /etc/ssl/private/messob-fleet.key
    sudo chmod 644 /etc/ssl/certs/messob-fleet.crt
fi

# Create systemd service
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/messob-fleet.service > /dev/null <<EOF
[Unit]
Description=MESSOB Fleet Management System
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/python3 $(which odoo) -c $(pwd)/odoo.conf
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$(pwd) /var/log/odoo /tmp

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

# Setup nginx reverse proxy with enhanced security
echo "🌐 Configuring Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/messob-fleet > /dev/null <<EOF
# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;

server {
    listen 80;
    server_name $DOMAIN_NAME;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN_NAME;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/messob-fleet.crt;
    ssl_certificate_key /etc/ssl/private/messob-fleet.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self';" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript application/atom+xml image/svg+xml;

    # Frontend static files
    location / {
        root $(pwd)/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
        
        # Security for static files
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header X-Content-Type-Options nosniff;
        }
    }

    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:8069;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Login endpoint with stricter rate limiting
    location /api/mobile/auth/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://127.0.0.1:8069;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Webhook endpoints
    location /webhook/ {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://127.0.0.1:8069;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Odoo web interface
    location ~ ^/(web|longpolling) {
        proxy_pass http://127.0.0.1:8069;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
        
        # WebSocket support for longpolling
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:8069;
        access_log off;
    }

    # Block access to sensitive files
    location ~ /\.(ht|git|env) {
        deny all;
        return 404;
    }
    
    location ~ \.(conf|log|bak|backup|old)\$ {
        deny all;
        return 404;
    }
}
EOF

# Enable nginx site
sudo ln -sf /etc/nginx/sites-available/messob-fleet /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Create backup script
echo "💾 Setting up automated backups..."
sudo tee /usr/local/bin/backup-messob-db.sh > /dev/null <<'EOF'
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/messob-fleet"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/messob_db_$DATE.sql"

# Load environment variables
if [ -f /opt/messob-fleet/.env.production ]; then
    export $(cat /opt/messob-fleet/.env.production | grep -v '^#' | xargs)
elif [ -f /opt/messob-fleet/.env ]; then
    export $(cat /opt/messob-fleet/.env | grep -v '^#' | xargs)
fi

# Create backup
echo "Creating backup: $BACKUP_FILE"
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Test backup integrity
if gunzip -t $BACKUP_FILE.gz; then
    echo "✅ Backup verified: $DATE"
    
    # Keep only last 7 days of backups
    find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
    
    # Log success
    logger "MESSOB Fleet backup completed successfully: $DATE"
else
    echo "❌ Backup failed verification: $DATE"
    logger "MESSOB Fleet backup failed verification: $DATE"
    exit 1
fi
EOF

sudo chmod +x /usr/local/bin/backup-messob-db.sh

# Set up cron for automated backups
echo "⏰ Setting up automated backups..."
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-messob-db.sh") | crontab -

# Create monitoring script
echo "📊 Setting up monitoring..."
sudo tee /usr/local/bin/monitor-messob-fleet.sh > /dev/null <<'EOF'
#!/bin/bash

# Check if service is running
if ! systemctl is-active --quiet messob-fleet; then
    echo "❌ MESSOB Fleet service is not running"
    logger "MESSOB Fleet service is down"
    exit 1
fi

# Check if port 8069 is listening
if ! netstat -tuln | grep -q ":8069 "; then
    echo "❌ MESSOB Fleet is not listening on port 8069"
    logger "MESSOB Fleet port 8069 not listening"
    exit 1
fi

# Check database connectivity
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME >/dev/null 2>&1; then
    echo "❌ Database is not accessible"
    logger "MESSOB Fleet database connectivity failed"
    exit 1
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo "⚠️ Disk usage is at ${DISK_USAGE}%"
    logger "MESSOB Fleet high disk usage: ${DISK_USAGE}%"
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEMORY_USAGE -gt 90 ]; then
    echo "⚠️ Memory usage is at ${MEMORY_USAGE}%"
    logger "MESSOB Fleet high memory usage: ${MEMORY_USAGE}%"
fi

echo "✅ All checks passed"
EOF

sudo chmod +x /usr/local/bin/monitor-messob-fleet.sh

# Set up monitoring cron
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/monitor-messob-fleet.sh") | crontab -

# Enable and start services
echo "🚀 Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable messob-fleet
sudo systemctl start messob-fleet

# Wait for service to start
echo "⏳ Waiting for service to start..."
sleep 10

# Test service health
if curl -f http://localhost:8069/health >/dev/null 2>&1; then
    echo "✅ Service health check passed"
else
    echo "⚠️ Service health check failed, checking logs..."
    sudo journalctl -u messob-fleet --no-pager -n 20
fi

echo ""
echo "🎉 Production deployment completed successfully!"
echo ""
echo "📋 Post-deployment checklist:"
echo "✅ SSL certificate configured (self-signed)"
echo "✅ Nginx reverse proxy configured"
echo "✅ Systemd service created and started"
echo "✅ Automated backups configured (daily at 2 AM)"
echo "✅ Monitoring script configured (every 5 minutes)"
echo "✅ Security headers configured"
echo "✅ Rate limiting configured"
echo ""
echo "🔧 Next steps:"
echo "1. Replace self-signed certificate with valid SSL certificate"
echo "2. Update DNS to point $DOMAIN_NAME to this server"
echo "3. Test all functionality thoroughly"
echo "4. Configure external HR and GPS integrations"
echo "5. Set up log aggregation (ELK stack)"
echo "6. Configure monitoring dashboard (Grafana)"
echo ""
echo "🌐 Access your application at: https://$DOMAIN_NAME"
echo "📊 Monitor logs: sudo journalctl -u messob-fleet -f"
echo "🔧 Service control: sudo systemctl {start|stop|restart} messob-fleet"
echo "💾 Manual backup: sudo /usr/local/bin/backup-messob-db.sh"
echo "📊 Health check: sudo /usr/local/bin/monitor-messob-fleet.sh"