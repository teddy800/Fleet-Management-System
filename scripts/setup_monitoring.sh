#!/bin/bash
# MESSOB Fleet Management - Production Monitoring Setup
# This script sets up comprehensive monitoring for production deployment

set -e

echo "📊 Setting up MESSOB Fleet Management Production Monitoring..."

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 📈 PROMETHEUS SETUP
# ═══════════════════════════════════════════════════════════════════════════════

echo "📈 Setting up Prometheus monitoring..."

# Create prometheus user
sudo useradd --no-create-home --shell /bin/false prometheus 2>/dev/null || true

# Create directories
sudo mkdir -p /etc/prometheus /var/lib/prometheus
sudo chown prometheus:prometheus /etc/prometheus /var/lib/prometheus

# Download and install Prometheus
PROMETHEUS_VERSION="2.45.0"
cd /tmp
wget https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz
tar xvf prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz
sudo cp prometheus-${PROMETHEUS_VERSION}.linux-amd64/prometheus /usr/local/bin/
sudo cp prometheus-${PROMETHEUS_VERSION}.linux-amd64/promtool /usr/local/bin/
sudo chown prometheus:prometheus /usr/local/bin/prometheus /usr/local/bin/promtool
sudo cp -r prometheus-${PROMETHEUS_VERSION}.linux-amd64/consoles /etc/prometheus
sudo cp -r prometheus-${PROMETHEUS_VERSION}.linux-amd64/console_libraries /etc/prometheus
sudo chown -R prometheus:prometheus /etc/prometheus/consoles /etc/prometheus/console_libraries

# Create Prometheus configuration
sudo tee /etc/prometheus/prometheus.yml > /dev/null <<EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "messob_fleet_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - localhost:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'messob-fleet'
    static_configs:
      - targets: ['localhost:8069']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['localhost:9187']

  - job_name: 'nginx-exporter'
    static_configs:
      - targets: ['localhost:9113']
EOF

# Create alerting rules
sudo tee /etc/prometheus/messob_fleet_rules.yml > /dev/null <<EOF
groups:
  - name: messob_fleet_alerts
    rules:
      - alert: ServiceDown
        expr: up{job="messob-fleet"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MESSOB Fleet service is down"
          description: "The MESSOB Fleet service has been down for more than 1 minute."

      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is above 80% for more than 5 minutes."

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is above 85% for more than 5 minutes."

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 10
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space"
          description: "Disk space is below 10%."

      - alert: DatabaseDown
        expr: up{job="postgres-exporter"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL database is down"
          description: "The PostgreSQL database has been down for more than 1 minute."

      - alert: HighDatabaseConnections
        expr: pg_stat_database_numbackends > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "Database has more than 80 active connections."

      - alert: SlowDatabaseQueries
        expr: pg_stat_activity_max_tx_duration > 300
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Slow database queries detected"
          description: "Database queries are taking longer than 5 minutes."
EOF

sudo chown prometheus:prometheus /etc/prometheus/prometheus.yml /etc/prometheus/messob_fleet_rules.yml

# Create Prometheus systemd service
sudo tee /etc/systemd/system/prometheus.service > /dev/null <<EOF
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/usr/local/bin/prometheus \\
    --config.file /etc/prometheus/prometheus.yml \\
    --storage.tsdb.path /var/lib/prometheus/ \\
    --web.console.templates=/etc/prometheus/consoles \\
    --web.console.libraries=/etc/prometheus/console_libraries \\
    --web.listen-address=0.0.0.0:9090 \\
    --web.enable-lifecycle

[Install]
WantedBy=multi-user.target
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 NODE EXPORTER SETUP
# ═══════════════════════════════════════════════════════════════════════════════

echo "📊 Setting up Node Exporter..."

# Create node_exporter user
sudo useradd --no-create-home --shell /bin/false node_exporter 2>/dev/null || true

# Download and install Node Exporter
NODE_EXPORTER_VERSION="1.6.0"
cd /tmp
wget https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
tar xvf node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
sudo cp node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64/node_exporter /usr/local/bin/
sudo chown node_exporter:node_exporter /usr/local/bin/node_exporter

# Create Node Exporter systemd service
sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
[Unit]
Description=Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ POSTGRES EXPORTER SETUP
# ═══════════════════════════════════════════════════════════════════════════════

echo "🗄️ Setting up PostgreSQL Exporter..."

# Create postgres_exporter user
sudo useradd --no-create-home --shell /bin/false postgres_exporter 2>/dev/null || true

# Download and install PostgreSQL Exporter
POSTGRES_EXPORTER_VERSION="0.13.2"
cd /tmp
wget https://github.com/prometheus-community/postgres_exporter/releases/download/v${POSTGRES_EXPORTER_VERSION}/postgres_exporter-${POSTGRES_EXPORTER_VERSION}.linux-amd64.tar.gz
tar xvf postgres_exporter-${POSTGRES_EXPORTER_VERSION}.linux-amd64.tar.gz
sudo cp postgres_exporter-${POSTGRES_EXPORTER_VERSION}.linux-amd64/postgres_exporter /usr/local/bin/
sudo chown postgres_exporter:postgres_exporter /usr/local/bin/postgres_exporter

# Create PostgreSQL monitoring user
sudo -u postgres psql -c "CREATE USER postgres_exporter WITH PASSWORD 'monitoring_password';" 2>/dev/null || true
sudo -u postgres psql -c "ALTER USER postgres_exporter SET SEARCH_PATH TO postgres_exporter,pg_catalog;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT CONNECT ON DATABASE ${DB_NAME:-messob_db} TO postgres_exporter;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT pg_monitor TO postgres_exporter;" 2>/dev/null || true

# Create PostgreSQL Exporter systemd service
sudo tee /etc/systemd/system/postgres_exporter.service > /dev/null <<EOF
[Unit]
Description=PostgreSQL Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=postgres_exporter
Group=postgres_exporter
Type=simple
Environment=DATA_SOURCE_NAME=postgresql://postgres_exporter:monitoring_password@localhost:5432/${DB_NAME:-messob_db}?sslmode=disable
ExecStart=/usr/local/bin/postgres_exporter

[Install]
WantedBy=multi-user.target
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 NGINX EXPORTER SETUP
# ═══════════════════════════════════════════════════════════════════════════════

echo "🌐 Setting up Nginx Exporter..."

# Enable Nginx status module
sudo tee -a /etc/nginx/sites-available/messob-fleet > /dev/null <<EOF

    # Nginx status for monitoring
    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
EOF

# Create nginx_exporter user
sudo useradd --no-create-home --shell /bin/false nginx_exporter 2>/dev/null || true

# Download and install Nginx Exporter
NGINX_EXPORTER_VERSION="0.11.0"
cd /tmp
wget https://github.com/nginxinc/nginx-prometheus-exporter/releases/download/v${NGINX_EXPORTER_VERSION}/nginx-prometheus-exporter_${NGINX_EXPORTER_VERSION}_linux_amd64.tar.gz
tar xvf nginx-prometheus-exporter_${NGINX_EXPORTER_VERSION}_linux_amd64.tar.gz
sudo cp nginx-prometheus-exporter /usr/local/bin/
sudo chown nginx_exporter:nginx_exporter /usr/local/bin/nginx-prometheus-exporter

# Create Nginx Exporter systemd service
sudo tee /etc/systemd/system/nginx_exporter.service > /dev/null <<EOF
[Unit]
Description=Nginx Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=nginx_exporter
Group=nginx_exporter
Type=simple
ExecStart=/usr/local/bin/nginx-prometheus-exporter -nginx.scrape-uri=http://localhost/nginx_status

[Install]
WantedBy=multi-user.target
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# 🚨 ALERTMANAGER SETUP
# ═══════════════════════════════════════════════════════════════════════════════

echo "🚨 Setting up Alertmanager..."

# Create alertmanager user
sudo useradd --no-create-home --shell /bin/false alertmanager 2>/dev/null || true

# Create directories
sudo mkdir -p /etc/alertmanager /var/lib/alertmanager
sudo chown alertmanager:alertmanager /etc/alertmanager /var/lib/alertmanager

# Download and install Alertmanager
ALERTMANAGER_VERSION="0.25.0"
cd /tmp
wget https://github.com/prometheus/alertmanager/releases/download/v${ALERTMANAGER_VERSION}/alertmanager-${ALERTMANAGER_VERSION}.linux-amd64.tar.gz
tar xvf alertmanager-${ALERTMANAGER_VERSION}.linux-amd64.tar.gz
sudo cp alertmanager-${ALERTMANAGER_VERSION}.linux-amd64/alertmanager /usr/local/bin/
sudo cp alertmanager-${ALERTMANAGER_VERSION}.linux-amd64/amtool /usr/local/bin/
sudo chown alertmanager:alertmanager /usr/local/bin/alertmanager /usr/local/bin/amtool

# Create Alertmanager configuration
sudo tee /etc/alertmanager/alertmanager.yml > /dev/null <<EOF
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@messob.org'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    email_configs:
      - to: '${ALERT_EMAIL_RECIPIENTS:-admin@messob.org}'
        subject: 'MESSOB Fleet Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
EOF

sudo chown alertmanager:alertmanager /etc/alertmanager/alertmanager.yml

# Create Alertmanager systemd service
sudo tee /etc/systemd/system/alertmanager.service > /dev/null <<EOF
[Unit]
Description=Alertmanager
Wants=network-online.target
After=network-online.target

[Service]
User=alertmanager
Group=alertmanager
Type=simple
ExecStart=/usr/local/bin/alertmanager \\
    --config.file /etc/alertmanager/alertmanager.yml \\
    --storage.path /var/lib/alertmanager/ \\
    --web.listen-address=0.0.0.0:9093

[Install]
WantedBy=multi-user.target
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 GRAFANA SETUP
# ═══════════════════════════════════════════════════════════════════════════════

echo "📊 Setting up Grafana..."

# Add Grafana repository
sudo apt-get install -y software-properties-common
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
echo "deb https://packages.grafana.com/oss/deb stable main" | sudo tee -a /etc/apt/sources.list.d/grafana.list
sudo apt-get update
sudo apt-get install -y grafana

# Configure Grafana
sudo tee /etc/grafana/grafana.ini > /dev/null <<EOF
[server]
http_port = 3000
domain = ${DOMAIN_NAME:-localhost}
root_url = https://%(domain)s/grafana/

[security]
admin_user = admin
admin_password = ${GRAFANA_ADMIN_PASSWORD:-admin123}
secret_key = ${GRAFANA_SECRET_KEY:-SW2YcwTIb9zpOOhoPsMm}

[auth.anonymous]
enabled = false

[dashboards]
default_home_dashboard_path = /var/lib/grafana/dashboards/messob-fleet-overview.json

[users]
allow_sign_up = false
allow_org_create = false
auto_assign_org = true
auto_assign_org_role = Viewer
EOF

# Create Grafana dashboard directory
sudo mkdir -p /var/lib/grafana/dashboards
sudo chown -R grafana:grafana /var/lib/grafana

# Create MESSOB Fleet dashboard
sudo tee /var/lib/grafana/dashboards/messob-fleet-overview.json > /dev/null <<'EOF'
{
  "dashboard": {
    "id": null,
    "title": "MESSOB Fleet Management Overview",
    "tags": ["messob", "fleet"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Service Status",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"messob-fleet\"}",
            "legendFormat": "Service Status"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "green", "value": 1}
              ]
            }
          }
        },
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "100 - (avg by(instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
            "legendFormat": "CPU Usage %"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "id": 3,
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100",
            "legendFormat": "Memory Usage %"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8}
      },
      {
        "id": 4,
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "Active Connections"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 SERVICE STARTUP
# ═══════════════════════════════════════════════════════════════════════════════

echo "🔧 Starting monitoring services..."

# Reload systemd
sudo systemctl daemon-reload

# Enable and start services
sudo systemctl enable prometheus node_exporter postgres_exporter nginx_exporter alertmanager grafana-server
sudo systemctl start prometheus node_exporter postgres_exporter nginx_exporter alertmanager grafana-server

# Restart Nginx to enable status module
sudo systemctl reload nginx

# Wait for services to start
sleep 10

# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 MONITORING TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo "🧪 Testing monitoring setup..."

# Test Prometheus
if curl -f http://localhost:9090/-/healthy >/dev/null 2>&1; then
    echo "✅ Prometheus is running"
else
    echo "❌ Prometheus is not responding"
fi

# Test Node Exporter
if curl -f http://localhost:9100/metrics >/dev/null 2>&1; then
    echo "✅ Node Exporter is running"
else
    echo "❌ Node Exporter is not responding"
fi

# Test PostgreSQL Exporter
if curl -f http://localhost:9187/metrics >/dev/null 2>&1; then
    echo "✅ PostgreSQL Exporter is running"
else
    echo "❌ PostgreSQL Exporter is not responding"
fi

# Test Nginx Exporter
if curl -f http://localhost:9113/metrics >/dev/null 2>&1; then
    echo "✅ Nginx Exporter is running"
else
    echo "❌ Nginx Exporter is not responding"
fi

# Test Alertmanager
if curl -f http://localhost:9093/-/healthy >/dev/null 2>&1; then
    echo "✅ Alertmanager is running"
else
    echo "❌ Alertmanager is not responding"
fi

# Test Grafana
if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "✅ Grafana is running"
else
    echo "❌ Grafana is not responding"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 📋 MONITORING DASHBOARD SETUP
# ═══════════════════════════════════════════════════════════════════════════════

echo "📋 Setting up monitoring dashboard access..."

# Update Nginx configuration to proxy Grafana
sudo tee -a /etc/nginx/sites-available/messob-fleet > /dev/null <<EOF

    # Grafana monitoring dashboard
    location /grafana/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Authentication required
        auth_basic "Monitoring Dashboard";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }

    # Prometheus (admin access only)
    location /prometheus/ {
        proxy_pass http://127.0.0.1:9090/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Restrict access
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
    }
EOF

# Create basic auth for monitoring dashboard
sudo apt-get install -y apache2-utils
echo "admin:$(openssl passwd -apr1 ${MONITORING_PASSWORD:-monitoring123})" | sudo tee /etc/nginx/.htpasswd

# Reload Nginx
sudo systemctl reload nginx

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CUSTOM METRICS SETUP
# ═══════════════════════════════════════════════════════════════════════════════

echo "📊 Setting up custom MESSOB Fleet metrics..."

# Create custom metrics collection script
sudo tee /usr/local/bin/messob-fleet-metrics.sh > /dev/null <<'EOF'
#!/bin/bash

METRICS_FILE="/var/lib/node_exporter/textfile_collector/messob_fleet.prom"
mkdir -p /var/lib/node_exporter/textfile_collector

# Load environment variables
if [ -f /opt/messob-fleet/.env.production ]; then
    export $(cat /opt/messob-fleet/.env.production | grep -v '^#' | xargs)
elif [ -f /opt/messob-fleet/.env ]; then
    export $(cat /opt/messob-fleet/.env | grep -v '^#' | xargs)
fi

# Function to query database
query_db() {
    psql -h ${DB_HOST:-localhost} -U ${DB_USER:-odoo} -d ${DB_NAME:-messob_db} -t -c "$1" 2>/dev/null | xargs
}

# Collect MESSOB Fleet specific metrics
{
    echo "# HELP messob_fleet_active_trips Number of active trips"
    echo "# TYPE messob_fleet_active_trips gauge"
    ACTIVE_TRIPS=$(query_db "SELECT COUNT(*) FROM mesob_trip_request WHERE state IN ('approved', 'in_progress');")
    echo "messob_fleet_active_trips ${ACTIVE_TRIPS:-0}"

    echo "# HELP messob_fleet_pending_requests Number of pending trip requests"
    echo "# TYPE messob_fleet_pending_requests gauge"
    PENDING_REQUESTS=$(query_db "SELECT COUNT(*) FROM mesob_trip_request WHERE state = 'pending';")
    echo "messob_fleet_pending_requests ${PENDING_REQUESTS:-0}"

    echo "# HELP messob_fleet_available_vehicles Number of available vehicles"
    echo "# TYPE messob_fleet_available_vehicles gauge"
    AVAILABLE_VEHICLES=$(query_db "SELECT COUNT(*) FROM fleet_vehicle WHERE mesob_status = 'available';")
    echo "messob_fleet_available_vehicles ${AVAILABLE_VEHICLES:-0}"

    echo "# HELP messob_fleet_maintenance_due Number of vehicles due for maintenance"
    echo "# TYPE messob_fleet_maintenance_due gauge"
    MAINTENANCE_DUE=$(query_db "SELECT COUNT(*) FROM fleet_vehicle WHERE maintenance_due = true;")
    echo "messob_fleet_maintenance_due ${MAINTENANCE_DUE:-0}"

    echo "# HELP messob_fleet_fuel_efficiency_avg Average fuel efficiency across fleet"
    echo "# TYPE messob_fleet_fuel_efficiency_avg gauge"
    AVG_EFFICIENCY=$(query_db "SELECT COALESCE(AVG(fuel_efficiency), 0) FROM fleet_vehicle WHERE fuel_efficiency > 0;")
    echo "messob_fleet_fuel_efficiency_avg ${AVG_EFFICIENCY:-0}"

    echo "# HELP messob_fleet_total_distance_today Total distance traveled today (km)"
    echo "# TYPE messob_fleet_total_distance_today gauge"
    TOTAL_DISTANCE=$(query_db "SELECT COALESCE(SUM(actual_distance), 0) FROM mesob_trip_assignment WHERE DATE(actual_start_datetime) = CURRENT_DATE;")
    echo "messob_fleet_total_distance_today ${TOTAL_DISTANCE:-0}"

    echo "# HELP messob_fleet_gps_updates_last_hour GPS updates received in last hour"
    echo "# TYPE messob_fleet_gps_updates_last_hour gauge"
    GPS_UPDATES=$(query_db "SELECT COUNT(*) FROM mesob_gps_tracking WHERE timestamp > NOW() - INTERVAL '1 hour';")
    echo "messob_fleet_gps_updates_last_hour ${GPS_UPDATES:-0}"

} > $METRICS_FILE.tmp && mv $METRICS_FILE.tmp $METRICS_FILE
EOF

sudo chmod +x /usr/local/bin/messob-fleet-metrics.sh

# Set up cron job for custom metrics
echo "*/2 * * * * root /usr/local/bin/messob-fleet-metrics.sh" | sudo tee -a /etc/crontab

# Run metrics collection once
sudo /usr/local/bin/messob-fleet-metrics.sh

echo ""
echo "🎉 Monitoring setup completed successfully!"
echo ""
echo "📊 Monitoring Services:"
echo "✅ Prometheus: http://localhost:9090"
echo "✅ Grafana: https://${DOMAIN_NAME:-localhost}/grafana (admin/monitoring123)"
echo "✅ Alertmanager: http://localhost:9093"
echo "✅ Node Exporter: http://localhost:9100/metrics"
echo "✅ PostgreSQL Exporter: http://localhost:9187/metrics"
echo "✅ Nginx Exporter: http://localhost:9113/metrics"
echo ""
echo "📈 Key Metrics Being Monitored:"
echo "• System resources (CPU, Memory, Disk)"
echo "• Database performance and connections"
echo "• Web server performance"
echo "• MESSOB Fleet specific metrics (trips, vehicles, fuel)"
echo "• GPS tracking updates"
echo "• Service availability and response times"
echo ""
echo "🚨 Alerting Configured For:"
echo "• Service downtime"
echo "• High resource usage"
echo "• Database issues"
echo "• Disk space warnings"
echo "• Performance degradation"
echo ""
echo "🔧 Management Commands:"
echo "• View service status: sudo systemctl status prometheus grafana-server"
echo "• Restart monitoring: sudo systemctl restart prometheus grafana-server"
echo "• View logs: sudo journalctl -u prometheus -f"
echo "• Test alerts: curl -X POST http://localhost:9093/api/v1/alerts"
echo ""
echo "⚠️  Next Steps:"
echo "1. Configure email server for alerts"
echo "2. Set up external monitoring (UptimeRobot, Pingdom)"
echo "3. Create custom dashboards in Grafana"
echo "4. Set up log aggregation (ELK stack)"
echo "5. Configure backup monitoring"