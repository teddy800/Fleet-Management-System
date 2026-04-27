#!/bin/bash
# MESSOB Fleet Management - Security Hardening Script
# This script implements critical security measures for production deployment

set -e

echo "🔒 Starting MESSOB Fleet Management Security Hardening..."

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ Environment file not found"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 🛡️ SYSTEM SECURITY HARDENING
# ═══════════════════════════════════════════════════════════════════════════════

echo "🛡️ Hardening system security..."

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install security tools
sudo apt install -y fail2ban ufw unattended-upgrades apt-listchanges

# Configure automatic security updates
sudo dpkg-reconfigure -plow unattended-upgrades

# ═══════════════════════════════════════════════════════════════════════════════
# 🔥 FIREWALL CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

echo "🔥 Configuring firewall..."

# Reset UFW to defaults
sudo ufw --force reset

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if using non-standard)
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow PostgreSQL only from localhost
sudo ufw allow from 127.0.0.1 to any port 5432

# Enable firewall
sudo ufw --force enable

# ═══════════════════════════════════════════════════════════════════════════════
# 🚫 FAIL2BAN CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

echo "🚫 Configuring Fail2Ban..."

# Create Fail2Ban configuration for Nginx
sudo tee /etc/fail2ban/jail.d/nginx.conf > /dev/null <<EOF
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10

[nginx-botsearch]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
EOF

# Create Fail2Ban configuration for Odoo
sudo tee /etc/fail2ban/jail.d/odoo.conf > /dev/null <<EOF
[odoo-auth]
enabled = true
port = 8069
logpath = /var/log/odoo/odoo.log
maxretry = 5
findtime = 600
bantime = 3600
filter = odoo-auth

[odoo-api]
enabled = true
port = 8069
logpath = /var/log/odoo/odoo.log
maxretry = 20
findtime = 300
bantime = 1800
filter = odoo-api
EOF

# Create Fail2Ban filter for Odoo authentication
sudo tee /etc/fail2ban/filter.d/odoo-auth.conf > /dev/null <<EOF
[Definition]
failregex = ^.*Login failed for db:.*login:.*from <HOST>.*$
            ^.*Invalid login attempt from <HOST>.*$
            ^.*Authentication failed for user .* from <HOST>.*$
ignoreregex =
EOF

# Create Fail2Ban filter for Odoo API abuse
sudo tee /etc/fail2ban/filter.d/odoo-api.conf > /dev/null <<EOF
[Definition]
failregex = ^.*ERROR.*<HOST>.*429 Too Many Requests.*$
            ^.*WARNING.*Rate limit exceeded.*<HOST>.*$
ignoreregex =
EOF

# Restart Fail2Ban
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 SSL/TLS HARDENING
# ═══════════════════════════════════════════════════════════════════════════════

echo "🔐 Hardening SSL/TLS configuration..."

# Generate strong DH parameters
if [ ! -f /etc/ssl/certs/dhparam.pem ]; then
    echo "Generating DH parameters (this may take a while)..."
    sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048
fi

# Update Nginx SSL configuration
sudo tee /etc/nginx/conf.d/ssl-hardening.conf > /dev/null <<EOF
# SSL Security Hardening
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-SHA384:DHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA256;
ssl_prefer_server_ciphers off;
ssl_dhparam /etc/ssl/certs/dhparam.pem;

# SSL Session Settings
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_stapling on;
ssl_stapling_verify on;

# Security Headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options DENY always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self';" always;
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ DATABASE SECURITY
# ═══════════════════════════════════════════════════════════════════════════════

echo "🗄️ Hardening database security..."

# Create PostgreSQL security configuration
sudo tee -a /etc/postgresql/*/main/postgresql.conf > /dev/null <<EOF

# Security Settings
ssl = on
password_encryption = scram-sha-256
log_connections = on
log_disconnections = on
log_failed_connections = on
log_statement = 'ddl'
log_min_duration_statement = 1000
shared_preload_libraries = 'pg_stat_statements'
EOF

# Update pg_hba.conf for better security
sudo cp /etc/postgresql/*/main/pg_hba.conf /etc/postgresql/*/main/pg_hba.conf.backup

sudo tee /etc/postgresql/*/main/pg_hba.conf > /dev/null <<EOF
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             postgres                                peer
local   all             all                                     scram-sha-256

# IPv4 local connections:
host    all             all             127.0.0.1/32            scram-sha-256
host    $DB_NAME        $DB_USER        127.0.0.1/32            scram-sha-256

# IPv6 local connections:
host    all             all             ::1/128                 scram-sha-256

# Deny all other connections
host    all             all             0.0.0.0/0               reject
EOF

# Restart PostgreSQL
sudo systemctl restart postgresql

# ═══════════════════════════════════════════════════════════════════════════════
# 📁 FILE SYSTEM SECURITY
# ═══════════════════════════════════════════════════════════════════════════════

echo "📁 Securing file system..."

# Set secure permissions on configuration files
chmod 600 .env* 2>/dev/null || true
chmod 600 odoo.conf
chmod 700 scripts/
chmod +x scripts/*.sh

# Create dedicated user for Odoo if not exists
if ! id "odoo" &>/dev/null; then
    sudo useradd -r -s /bin/false -d /opt/odoo -m odoo
fi

# Set ownership
sudo chown -R odoo:odoo /var/log/odoo
sudo chown -R odoo:odoo /opt/odoo 2>/dev/null || true

# Secure log files
sudo chmod 640 /var/log/odoo/*.log 2>/dev/null || true

# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 INTRUSION DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

echo "🔍 Setting up intrusion detection..."

# Install and configure AIDE (Advanced Intrusion Detection Environment)
sudo apt install -y aide

# Initialize AIDE database
sudo aideinit

# Create AIDE configuration for MESSOB Fleet
sudo tee /etc/aide/aide.conf.d/messob-fleet > /dev/null <<EOF
# MESSOB Fleet Management System monitoring
/opt/messob-fleet f+p+u+g+s+m+c+md5+sha256
/etc/nginx/sites-available/messob-fleet f+p+u+g+s+m+c+md5+sha256
/etc/systemd/system/messob-fleet.service f+p+u+g+s+m+c+md5+sha256
/usr/local/bin/backup-messob-db.sh f+p+u+g+s+m+c+md5+sha256
/usr/local/bin/monitor-messob-fleet.sh f+p+u+g+s+m+c+md5+sha256
EOF

# Set up daily AIDE check
echo "0 3 * * * root /usr/bin/aide --check" | sudo tee -a /etc/crontab

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 SECURITY MONITORING
# ═══════════════════════════════════════════════════════════════════════════════

echo "📊 Setting up security monitoring..."

# Create security monitoring script
sudo tee /usr/local/bin/security-monitor.sh > /dev/null <<'EOF'
#!/bin/bash

LOG_FILE="/var/log/messob-fleet-security.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Function to log security events
log_security_event() {
    echo "[$DATE] $1" >> $LOG_FILE
    logger "MESSOB-FLEET-SECURITY: $1"
}

# Check for failed login attempts
FAILED_LOGINS=$(grep "authentication failure" /var/log/auth.log | tail -10 | wc -l)
if [ $FAILED_LOGINS -gt 5 ]; then
    log_security_event "HIGH: Multiple failed login attempts detected ($FAILED_LOGINS)"
fi

# Check for suspicious network connections
SUSPICIOUS_CONNECTIONS=$(netstat -tuln | grep -E ":(22|80|443|8069)" | wc -l)
if [ $SUSPICIOUS_CONNECTIONS -gt 100 ]; then
    log_security_event "MEDIUM: High number of network connections ($SUSPICIOUS_CONNECTIONS)"
fi

# Check disk usage
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 95 ]; then
    log_security_event "HIGH: Critical disk usage ($DISK_USAGE%)"
elif [ $DISK_USAGE -gt 85 ]; then
    log_security_event "MEDIUM: High disk usage ($DISK_USAGE%)"
fi

# Check for rootkit indicators
if command -v rkhunter >/dev/null 2>&1; then
    ROOTKIT_CHECK=$(rkhunter --check --sk | grep "Warning" | wc -l)
    if [ $ROOTKIT_CHECK -gt 0 ]; then
        log_security_event "HIGH: Potential rootkit detected ($ROOTKIT_CHECK warnings)"
    fi
fi

# Check SSL certificate expiry
if [ -f "/etc/ssl/certs/messob-fleet.crt" ]; then
    CERT_EXPIRY=$(openssl x509 -in /etc/ssl/certs/messob-fleet.crt -noout -dates | grep "notAfter" | cut -d= -f2)
    CERT_EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_TO_EXPIRY=$(( ($CERT_EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
    
    if [ $DAYS_TO_EXPIRY -lt 7 ]; then
        log_security_event "HIGH: SSL certificate expires in $DAYS_TO_EXPIRY days"
    elif [ $DAYS_TO_EXPIRY -lt 30 ]; then
        log_security_event "MEDIUM: SSL certificate expires in $DAYS_TO_EXPIRY days"
    fi
fi

# Check for unusual process activity
ODOO_PROCESSES=$(pgrep -f "odoo" | wc -l)
if [ $ODOO_PROCESSES -eq 0 ]; then
    log_security_event "HIGH: Odoo process not running"
elif [ $ODOO_PROCESSES -gt 10 ]; then
    log_security_event "MEDIUM: Unusual number of Odoo processes ($ODOO_PROCESSES)"
fi

# Check log file sizes
LOG_SIZE=$(du -m /var/log/odoo/odoo.log 2>/dev/null | cut -f1)
if [ "$LOG_SIZE" -gt 1000 ]; then
    log_security_event "MEDIUM: Large log file detected (${LOG_SIZE}MB)"
fi
EOF

sudo chmod +x /usr/local/bin/security-monitor.sh

# Set up security monitoring cron job
echo "*/15 * * * * root /usr/local/bin/security-monitor.sh" | sudo tee -a /etc/crontab

# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 LOG ROTATION
# ═══════════════════════════════════════════════════════════════════════════════

echo "🔄 Setting up log rotation..."

# Configure log rotation for Odoo
sudo tee /etc/logrotate.d/messob-fleet > /dev/null <<EOF
/var/log/odoo/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 640 odoo odoo
    postrotate
        systemctl reload messob-fleet
    endscript
}

/var/log/messob-fleet-security.log {
    weekly
    missingok
    rotate 12
    compress
    delaycompress
    notifempty
    create 640 root root
}
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# 🚨 SECURITY ALERTS
# ═══════════════════════════════════════════════════════════════════════════════

echo "🚨 Setting up security alerts..."

# Create security alert script
sudo tee /usr/local/bin/security-alert.sh > /dev/null <<'EOF'
#!/bin/bash

# Email configuration
ALERT_EMAIL="${ALERT_EMAIL_RECIPIENTS:-admin@messob.org}"
HOSTNAME=$(hostname)

# Function to send alert
send_alert() {
    local SUBJECT="$1"
    local MESSAGE="$2"
    local PRIORITY="$3"
    
    # Log the alert
    logger "MESSOB-FLEET-ALERT [$PRIORITY]: $SUBJECT - $MESSAGE"
    
    # Send email if configured
    if command -v mail >/dev/null 2>&1; then
        echo "$MESSAGE" | mail -s "[$PRIORITY] MESSOB Fleet Alert: $SUBJECT" "$ALERT_EMAIL"
    fi
    
    # Write to alert log
    echo "[$(date)] [$PRIORITY] $SUBJECT: $MESSAGE" >> /var/log/messob-fleet-alerts.log
}

# Check for critical security events
if [ -f "/var/log/messob-fleet-security.log" ]; then
    HIGH_ALERTS=$(grep "HIGH:" /var/log/messob-fleet-security.log | tail -5)
    if [ -n "$HIGH_ALERTS" ]; then
        send_alert "High Priority Security Events" "$HIGH_ALERTS" "HIGH"
    fi
fi

# Check service status
if ! systemctl is-active --quiet messob-fleet; then
    send_alert "Service Down" "MESSOB Fleet service is not running on $HOSTNAME" "CRITICAL"
fi

# Check database connectivity
if ! pg_isready -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} >/dev/null 2>&1; then
    send_alert "Database Connectivity" "Cannot connect to PostgreSQL database on $HOSTNAME" "CRITICAL"
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 95 ]; then
    send_alert "Critical Disk Usage" "Disk usage is at $DISK_USAGE% on $HOSTNAME" "CRITICAL"
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEMORY_USAGE -gt 95 ]; then
    send_alert "Critical Memory Usage" "Memory usage is at $MEMORY_USAGE% on $HOSTNAME" "CRITICAL"
fi
EOF

sudo chmod +x /usr/local/bin/security-alert.sh

# Set up security alert cron job
echo "*/5 * * * * root /usr/local/bin/security-alert.sh" | sudo tee -a /etc/crontab

# ═══════════════════════════════════════════════════════════════════════════════
# 🧹 CLEANUP AND FINAL STEPS
# ═══════════════════════════════════════════════════════════════════════════════

echo "🧹 Performing final cleanup..."

# Remove unnecessary packages
sudo apt autoremove -y

# Update package database
sudo updatedb 2>/dev/null || true

# Restart services
sudo systemctl restart nginx
sudo systemctl restart postgresql
sudo systemctl restart messob-fleet

# Test security configuration
echo "🧪 Testing security configuration..."

# Test firewall
sudo ufw status | grep -q "Status: active" && echo "✅ Firewall is active" || echo "❌ Firewall is not active"

# Test Fail2Ban
sudo fail2ban-client status | grep -q "Number of jail:" && echo "✅ Fail2Ban is running" || echo "❌ Fail2Ban is not running"

# Test SSL configuration
if command -v openssl >/dev/null 2>&1; then
    if openssl x509 -in /etc/ssl/certs/messob-fleet.crt -noout -text >/dev/null 2>&1; then
        echo "✅ SSL certificate is valid"
    else
        echo "❌ SSL certificate is invalid"
    fi
fi

# Test service status
if systemctl is-active --quiet messob-fleet; then
    echo "✅ MESSOB Fleet service is running"
else
    echo "❌ MESSOB Fleet service is not running"
fi

echo ""
echo "🎉 Security hardening completed!"
echo ""
echo "📋 Security Summary:"
echo "✅ System packages updated"
echo "✅ Firewall configured (UFW)"
echo "✅ Fail2Ban configured for intrusion prevention"
echo "✅ SSL/TLS hardened"
echo "✅ Database security enhanced"
echo "✅ File system permissions secured"
echo "✅ Intrusion detection configured (AIDE)"
echo "✅ Security monitoring enabled"
echo "✅ Log rotation configured"
echo "✅ Security alerts configured"
echo ""
echo "🔍 Monitor security logs:"
echo "  - System security: tail -f /var/log/messob-fleet-security.log"
echo "  - Security alerts: tail -f /var/log/messob-fleet-alerts.log"
echo "  - Fail2Ban: sudo fail2ban-client status"
echo "  - Firewall: sudo ufw status verbose"
echo ""
echo "⚠️  IMPORTANT: Remember to:"
echo "1. Replace self-signed SSL certificate with valid certificate"
echo "2. Configure email alerts (install and configure mail server)"
echo "3. Set up external monitoring (Prometheus/Grafana)"
echo "4. Perform regular security audits"
echo "5. Keep system and dependencies updated"