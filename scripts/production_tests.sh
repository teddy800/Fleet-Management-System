#!/bin/bash
# MESSOB Fleet Management - Production Testing Suite
# Comprehensive tests to validate production readiness

set -e

echo "🧪 Starting MESSOB Fleet Management Production Testing Suite..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Helper functions
log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Test function wrapper
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    log_test "$test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        log_pass "$test_name"
        return 0
    else
        log_fail "$test_name"
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 SYSTEM REQUIREMENTS TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "🔧 Testing System Requirements..."

run_test "Python 3.8+ installed" "python3 --version | grep -E 'Python 3\.(8|9|10|11|12)'"
run_test "Node.js 16+ installed" "node --version | grep -E 'v(1[6-9]|[2-9][0-9])'"
run_test "PostgreSQL installed" "which psql"
run_test "Nginx installed" "which nginx"
run_test "Git installed" "which git"

# Check system resources
log_test "Sufficient RAM (minimum 4GB)"
TOTAL_RAM=$(free -g | awk 'NR==2{print $2}')
if [ "$TOTAL_RAM" -ge 4 ]; then
    log_pass "RAM: ${TOTAL_RAM}GB available"
else
    log_fail "RAM: Only ${TOTAL_RAM}GB available, minimum 4GB required"
fi

log_test "Sufficient disk space (minimum 20GB)"
AVAILABLE_DISK=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
if [ "$AVAILABLE_DISK" -ge 20 ]; then
    log_pass "Disk: ${AVAILABLE_DISK}GB available"
else
    log_fail "Disk: Only ${AVAILABLE_DISK}GB available, minimum 20GB required"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ DATABASE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "🗄️ Testing Database Configuration..."

run_test "PostgreSQL service running" "systemctl is-active postgresql"
run_test "Database connectivity" "pg_isready -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432}"

log_test "Database exists and accessible"
if psql -h ${DB_HOST:-localhost} -U ${DB_USER:-odoo} -d ${DB_NAME:-messob_db} -c "SELECT 1;" >/dev/null 2>&1; then
    log_pass "Database connection successful"
else
    log_fail "Cannot connect to database"
fi

log_test "Required database tables exist"
REQUIRED_TABLES=("mesob_trip_request" "mesob_trip_assignment" "fleet_vehicle" "hr_employee" "mesob_fuel_log")
MISSING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
    if ! psql -h ${DB_HOST:-localhost} -U ${DB_USER:-odoo} -d ${DB_NAME:-messob_db} -c "SELECT 1 FROM $table LIMIT 1;" >/dev/null 2>&1; then
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
    log_pass "All required tables exist"
else
    log_fail "Missing tables: ${MISSING_TABLES[*]}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 SERVICE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "🚀 Testing Service Configuration..."

run_test "MESSOB Fleet service exists" "systemctl list-unit-files | grep messob-fleet"
run_test "MESSOB Fleet service enabled" "systemctl is-enabled messob-fleet"
run_test "MESSOB Fleet service running" "systemctl is-active messob-fleet"
run_test "Nginx service running" "systemctl is-active nginx"

log_test "MESSOB Fleet listening on port 8069"
if netstat -tuln | grep -q ":8069 "; then
    log_pass "Service listening on port 8069"
else
    log_fail "Service not listening on port 8069"
fi

log_test "Nginx listening on ports 80 and 443"
if netstat -tuln | grep -q ":80 " && netstat -tuln | grep -q ":443 "; then
    log_pass "Nginx listening on ports 80 and 443"
else
    log_fail "Nginx not listening on required ports"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 SECURITY TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "🔐 Testing Security Configuration..."

run_test "Firewall (UFW) active" "ufw status | grep -q 'Status: active'"
run_test "Fail2Ban service running" "systemctl is-active fail2ban"

log_test "SSL certificate exists"
if [ -f "/etc/ssl/certs/messob-fleet.crt" ]; then
    log_pass "SSL certificate found"
    
    # Check certificate validity
    log_test "SSL certificate valid"
    if openssl x509 -in /etc/ssl/certs/messob-fleet.crt -noout -checkend 86400 >/dev/null 2>&1; then
        log_pass "SSL certificate is valid"
    else
        log_warn "SSL certificate expires within 24 hours"
    fi
else
    log_fail "SSL certificate not found"
fi

log_test "Secure file permissions"
SECURE_FILES=(".env" ".env.production" "odoo.conf")
INSECURE_FILES=()

for file in "${SECURE_FILES[@]}"; do
    if [ -f "$file" ]; then
        PERMS=$(stat -c "%a" "$file")
        if [ "$PERMS" != "600" ]; then
            INSECURE_FILES+=("$file:$PERMS")
        fi
    fi
done

if [ ${#INSECURE_FILES[@]} -eq 0 ]; then
    log_pass "All sensitive files have secure permissions"
else
    log_fail "Insecure file permissions: ${INSECURE_FILES[*]}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 NETWORK TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "🌐 Testing Network Configuration..."

log_test "HTTP redirects to HTTPS"
if curl -s -I http://localhost | grep -q "301\|302"; then
    log_pass "HTTP redirects to HTTPS"
else
    log_warn "HTTP does not redirect to HTTPS"
fi

log_test "HTTPS responds correctly"
if curl -k -s https://localhost >/dev/null 2>&1; then
    log_pass "HTTPS endpoint responds"
else
    log_fail "HTTPS endpoint not responding"
fi

log_test "Security headers present"
HEADERS=$(curl -k -s -I https://localhost)
REQUIRED_HEADERS=("Strict-Transport-Security" "X-Content-Type-Options" "X-Frame-Options")
MISSING_HEADERS=()

for header in "${REQUIRED_HEADERS[@]}"; do
    if ! echo "$HEADERS" | grep -qi "$header"; then
        MISSING_HEADERS+=("$header")
    fi
done

if [ ${#MISSING_HEADERS[@]} -eq 0 ]; then
    log_pass "All required security headers present"
else
    log_warn "Missing security headers: ${MISSING_HEADERS[*]}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 API TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "🔌 Testing API Endpoints..."

# Health check endpoint
log_test "Health check endpoint"
if curl -f http://localhost:8069/health >/dev/null 2>&1; then
    log_pass "Health check endpoint responds"
else
    log_fail "Health check endpoint not responding"
fi

# Test API authentication
log_test "API authentication required"
if curl -s http://localhost:8069/api/fleet/dashboard | grep -q "error\|unauthorized"; then
    log_pass "API requires authentication"
else
    log_warn "API may not require authentication"
fi

# Test webhook endpoints
log_test "GPS webhook endpoint exists"
if curl -s -X POST http://localhost:8069/webhook/gps/location-update -H "Content-Type: application/json" -d '{}' | grep -q "error\|invalid"; then
    log_pass "GPS webhook endpoint responds"
else
    log_warn "GPS webhook endpoint may not be configured"
fi

log_test "HR webhook endpoint exists"
if curl -s -X POST http://localhost:8069/webhook/hr/employee-sync -H "Content-Type: application/json" -d '{}' | grep -q "error\|invalid"; then
    log_pass "HR webhook endpoint responds"
else
    log_warn "HR webhook endpoint may not be configured"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 MONITORING TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "📊 Testing Monitoring Configuration..."

# Check if monitoring services are installed and running
MONITORING_SERVICES=("prometheus" "node_exporter" "grafana-server")
for service in "${MONITORING_SERVICES[@]}"; do
    if systemctl list-unit-files | grep -q "$service"; then
        run_test "$service service running" "systemctl is-active $service"
    else
        log_warn "$service not installed"
    fi
done

# Test monitoring endpoints
log_test "Prometheus metrics endpoint"
if curl -f http://localhost:9090/metrics >/dev/null 2>&1; then
    log_pass "Prometheus metrics accessible"
else
    log_warn "Prometheus not accessible"
fi

log_test "Node exporter metrics"
if curl -f http://localhost:9100/metrics >/dev/null 2>&1; then
    log_pass "Node exporter metrics accessible"
else
    log_warn "Node exporter not accessible"
fi

log_test "Grafana dashboard"
if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
    log_pass "Grafana dashboard accessible"
else
    log_warn "Grafana not accessible"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 💾 BACKUP TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "💾 Testing Backup Configuration..."

log_test "Backup script exists"
if [ -f "/usr/local/bin/backup-messob-db.sh" ]; then
    log_pass "Backup script found"
    
    log_test "Backup script executable"
    if [ -x "/usr/local/bin/backup-messob-db.sh" ]; then
        log_pass "Backup script is executable"
    else
        log_fail "Backup script is not executable"
    fi
else
    log_fail "Backup script not found"
fi

log_test "Backup directory exists"
if [ -d "/var/backups/messob-fleet" ]; then
    log_pass "Backup directory exists"
else
    log_fail "Backup directory not found"
fi

log_test "Backup cron job configured"
if crontab -l | grep -q "backup-messob-db.sh"; then
    log_pass "Backup cron job configured"
else
    log_warn "Backup cron job not found"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 FUNCTIONAL TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "🧪 Testing Core Functionality..."

# Test database queries
log_test "Trip requests table accessible"
if psql -h ${DB_HOST:-localhost} -U ${DB_USER:-odoo} -d ${DB_NAME:-messob_db} -c "SELECT COUNT(*) FROM mesob_trip_request;" >/dev/null 2>&1; then
    log_pass "Trip requests table accessible"
else
    log_fail "Cannot access trip requests table"
fi

log_test "Vehicle table accessible"
if psql -h ${DB_HOST:-localhost} -U ${DB_USER:-odoo} -d ${DB_NAME:-messob_db} -c "SELECT COUNT(*) FROM fleet_vehicle;" >/dev/null 2>&1; then
    log_pass "Vehicle table accessible"
else
    log_fail "Cannot access vehicle table"
fi

log_test "HR employee table accessible"
if psql -h ${DB_HOST:-localhost} -U ${DB_USER:-odoo} -d ${DB_NAME:-messob_db} -c "SELECT COUNT(*) FROM hr_employee;" >/dev/null 2>&1; then
    log_pass "HR employee table accessible"
else
    log_fail "Cannot access HR employee table"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 📱 FRONTEND TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "📱 Testing Frontend Configuration..."

log_test "Frontend build directory exists"
if [ -d "frontend/dist" ]; then
    log_pass "Frontend build directory exists"
    
    log_test "Frontend assets exist"
    if [ -f "frontend/dist/index.html" ]; then
        log_pass "Frontend index.html exists"
    else
        log_fail "Frontend index.html not found"
    fi
else
    log_fail "Frontend build directory not found"
fi

log_test "Frontend accessible via web"
if curl -s http://localhost | grep -q "html\|DOCTYPE"; then
    log_pass "Frontend accessible via web"
else
    log_fail "Frontend not accessible via web"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 🔗 INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "🔗 Testing External Integrations..."

# Test HR integration
log_test "HR sync configuration"
if [ -n "$HR_SYNC_URL" ]; then
    log_pass "HR sync URL configured"
    
    log_test "HR sync endpoint reachable"
    if curl -f "$HR_SYNC_URL" >/dev/null 2>&1; then
        log_pass "HR sync endpoint reachable"
    else
        log_warn "HR sync endpoint not reachable (may be expected in test environment)"
    fi
else
    log_warn "HR sync URL not configured"
fi

# Test GPS integration
log_test "GPS webhook configuration"
if [ -n "$GPS_WEBHOOK_URL" ]; then
    log_pass "GPS webhook URL configured"
else
    log_warn "GPS webhook URL not configured"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 📈 PERFORMANCE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "📈 Testing Performance..."

log_test "API response time"
START_TIME=$(date +%s%N)
curl -f http://localhost:8069/health >/dev/null 2>&1
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

if [ $RESPONSE_TIME -lt 1000 ]; then
    log_pass "API response time: ${RESPONSE_TIME}ms (good)"
elif [ $RESPONSE_TIME -lt 3000 ]; then
    log_warn "API response time: ${RESPONSE_TIME}ms (acceptable)"
else
    log_fail "API response time: ${RESPONSE_TIME}ms (too slow)"
fi

log_test "Database query performance"
START_TIME=$(date +%s%N)
psql -h ${DB_HOST:-localhost} -U ${DB_USER:-odoo} -d ${DB_NAME:-messob_db} -c "SELECT COUNT(*) FROM mesob_trip_request;" >/dev/null 2>&1
END_TIME=$(date +%s%N)
DB_RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

if [ $DB_RESPONSE_TIME -lt 500 ]; then
    log_pass "Database response time: ${DB_RESPONSE_TIME}ms (good)"
elif [ $DB_RESPONSE_TIME -lt 2000 ]; then
    log_warn "Database response time: ${DB_RESPONSE_TIME}ms (acceptable)"
else
    log_fail "Database response time: ${DB_RESPONSE_TIME}ms (too slow)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TEST SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "📊 PRODUCTION TESTING SUMMARY"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

# Calculate success rate
SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo -e "Success Rate: ${GREEN}${SUCCESS_RATE}%${NC}"
    
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🎉 SYSTEM IS PRODUCTION READY!${NC}"
        EXIT_CODE=0
    else
        echo -e "${YELLOW}⚠️  System is production ready with ${WARNINGS} warnings${NC}"
        EXIT_CODE=0
    fi
else
    echo -e "${RED}❌ ${FAILED_TESTS} TESTS FAILED${NC}"
    echo -e "Success Rate: ${RED}${SUCCESS_RATE}%${NC}"
    echo -e "${RED}🚫 SYSTEM IS NOT PRODUCTION READY${NC}"
    EXIT_CODE=1
fi

echo ""
echo "📋 Recommendations:"

if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}• Fix all failed tests before deploying to production${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}• Address warnings to improve system reliability${NC}"
fi

echo -e "${BLUE}• Run this test suite regularly to ensure continued production readiness${NC}"
echo -e "${BLUE}• Set up automated testing in CI/CD pipeline${NC}"
echo -e "${BLUE}• Monitor system performance and security continuously${NC}"

echo ""
echo "🔧 Troubleshooting:"
echo "• View service logs: sudo journalctl -u messob-fleet -f"
echo "• Check system status: systemctl status messob-fleet"
echo "• Test database: psql -h ${DB_HOST:-localhost} -U ${DB_USER:-odoo} -d ${DB_NAME:-messob_db}"
echo "• Check network: netstat -tuln | grep -E ':(80|443|8069)'"
echo "• View security logs: sudo tail -f /var/log/messob-fleet-security.log"

echo ""
echo "📞 Support:"
echo "• Documentation: README.md, QUICK_START_GUIDE.md"
echo "• Security: PRODUCTION_SECURITY_CHECKLIST.md"
echo "• Integration: INTEGRATION_VERIFICATION_CHECKLIST.md"

exit $EXIT_CODE