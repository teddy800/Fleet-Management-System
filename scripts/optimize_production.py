#!/usr/bin/env python3
"""
MESSOB Fleet Management - Production Optimization Script
Run this after deployment to optimize database and system performance
"""

import os
import sys
import subprocess
import psycopg2
from datetime import datetime

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'messob_db'),
    'user': os.getenv('DB_USER', 'odoo'),
    'password': os.getenv('DB_PASSWORD', 'odoo')
}

def log_message(message):
    """Log message with timestamp"""
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}")

def optimize_database():
    """Optimize PostgreSQL database for production"""
    log_message("🗄️ Optimizing database performance...")
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Create indexes for frequently queried fields
        indexes = [
            # Trip requests - frequently filtered by state and employee
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_request_state ON mesob_trip_request(state)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_request_employee ON mesob_trip_request(employee_id)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_request_dates ON mesob_trip_request(start_datetime, end_datetime)",
            
            # GPS logs - frequently queried by vehicle and timestamp
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_log_vehicle_time ON mesob_gps_log(vehicle_id, timestamp DESC)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_log_timestamp ON mesob_gps_log(timestamp DESC)",
            
            # Fleet vehicles - status and location queries
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fleet_vehicle_status ON fleet_vehicle(mesob_status)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fleet_vehicle_location ON fleet_vehicle(current_latitude, current_longitude)",
            
            # Trip assignments - calendar and conflict queries
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_assignment_dates ON mesob_trip_assignment(start_datetime, stop_datetime)",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_assignment_vehicle ON mesob_trip_assignment(vehicle_id, state)",
            
            # Maintenance logs - vehicle and date queries
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_log_vehicle ON mesob_maintenance_log(vehicle_id, date DESC)",
            
            # Fuel logs - efficiency calculations
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fuel_log_vehicle_date ON mesob_fuel_log(vehicle_id, date DESC)",
        ]
        
        for index_sql in indexes:
            try:
                log_message(f"Creating index: {index_sql.split('idx_')[1].split(' ')[0]}")
                cursor.execute(index_sql)
                conn.commit()
            except psycopg2.Error as e:
                log_message(f"Index creation failed (may already exist): {e}")
                conn.rollback()
        
        # Update table statistics
        log_message("📊 Updating table statistics...")
        cursor.execute("ANALYZE")
        conn.commit()
        
        # Vacuum tables to reclaim space
        log_message("🧹 Vacuuming tables...")
        conn.autocommit = True
        cursor.execute("VACUUM ANALYZE")
        
        cursor.close()
        conn.close()
        log_message("✅ Database optimization completed")
        
    except Exception as e:
        log_message(f"❌ Database optimization failed: {e}")
        return False
    
    return True

def optimize_system():
    """Optimize system settings for production"""
    log_message("⚙️ Optimizing system settings...")
    
    # Optimize PostgreSQL configuration
    pg_config = """
# MESSOB Fleet Management - PostgreSQL Optimization
# Add these to postgresql.conf

# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Checkpoint settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

# Connection settings
max_connections = 100

# Logging
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
"""
    
    with open('/tmp/postgresql_optimization.conf', 'w') as f:
        f.write(pg_config)
    
    log_message("📝 PostgreSQL optimization config written to /tmp/postgresql_optimization.conf")
    log_message("   Please review and add to your postgresql.conf file")
    
    # System limits optimization
    limits_config = """
# MESSOB Fleet Management - System Limits
# Add these to /etc/security/limits.conf

odoo soft nofile 65536
odoo hard nofile 65536
odoo soft nproc 32768
odoo hard nproc 32768
"""
    
    with open('/tmp/system_limits.conf', 'w') as f:
        f.write(limits_config)
    
    log_message("📝 System limits config written to /tmp/system_limits.conf")
    
    return True

def setup_monitoring():
    """Set up basic monitoring"""
    log_message("📊 Setting up monitoring...")
    
    # Create monitoring script
    monitoring_script = """#!/bin/bash
# MESSOB Fleet Management - Basic Monitoring Script
# Run every 5 minutes via cron: */5 * * * * /path/to/monitor.sh

LOG_FILE="/var/log/messob-fleet/monitor.log"
mkdir -p $(dirname $LOG_FILE)

# Check if Odoo is running
if ! pgrep -f "odoo" > /dev/null; then
    echo "$(date): ALERT - Odoo process not running" >> $LOG_FILE
    # Restart service
    systemctl restart messob-fleet
fi

# Check database connectivity
if ! pg_isready -h localhost -p 5432 -U odoo > /dev/null; then
    echo "$(date): ALERT - Database not responding" >> $LOG_FILE
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo "$(date): ALERT - Disk usage at ${DISK_USAGE}%" >> $LOG_FILE
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEMORY_USAGE -gt 90 ]; then
    echo "$(date): ALERT - Memory usage at ${MEMORY_USAGE}%" >> $LOG_FILE
fi

# Check recent GPS updates (should have updates in last 10 minutes)
RECENT_GPS=$(psql -h localhost -U odoo -d messob_db -t -c "SELECT COUNT(*) FROM mesob_gps_log WHERE timestamp > NOW() - INTERVAL '10 minutes'")
if [ $RECENT_GPS -lt 1 ]; then
    echo "$(date): WARNING - No GPS updates in last 10 minutes" >> $LOG_FILE
fi
"""
    
    with open('/tmp/monitor.sh', 'w') as f:
        f.write(monitoring_script)
    
    os.chmod('/tmp/monitor.sh', 0o755)
    log_message("📝 Monitoring script written to /tmp/monitor.sh")
    
    return True

def optimize_frontend():
    """Optimize frontend build for production"""
    log_message("🎨 Optimizing frontend build...")
    
    try:
        # Change to frontend directory
        os.chdir('frontend')
        
        # Install production dependencies only
        log_message("📦 Installing production dependencies...")
        subprocess.run(['npm', 'ci', '--production'], check=True)
        
        # Build for production
        log_message("🏗️ Building production bundle...")
        subprocess.run(['npm', 'run', 'build'], check=True)
        
        # Analyze bundle size
        log_message("📊 Analyzing bundle size...")
        try:
            result = subprocess.run(['du', '-sh', 'dist/'], capture_output=True, text=True)
            if result.returncode == 0:
                log_message(f"Bundle size: {result.stdout.strip()}")
        except:
            pass
        
        os.chdir('..')
        log_message("✅ Frontend optimization completed")
        return True
        
    except subprocess.CalledProcessError as e:
        log_message(f"❌ Frontend optimization failed: {e}")
        return False

def main():
    """Main optimization function"""
    log_message("🚀 Starting MESSOB Fleet Management production optimization...")
    
    success = True
    
    # Database optimization
    if not optimize_database():
        success = False
    
    # System optimization
    if not optimize_system():
        success = False
    
    # Monitoring setup
    if not setup_monitoring():
        success = False
    
    # Frontend optimization
    if not optimize_frontend():
        success = False
    
    if success:
        log_message("✅ All optimizations completed successfully!")
        log_message("📋 Next steps:")
        log_message("   1. Review and apply PostgreSQL config from /tmp/postgresql_optimization.conf")
        log_message("   2. Review and apply system limits from /tmp/system_limits.conf")
        log_message("   3. Set up monitoring cron job with /tmp/monitor.sh")
        log_message("   4. Restart PostgreSQL and Odoo services")
        log_message("   5. Run load tests to verify performance")
    else:
        log_message("❌ Some optimizations failed. Please review the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()