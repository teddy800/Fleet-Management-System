# MESSOB Fleet Management - Production Security Checklist

## 🔒 Critical Security Requirements (MUST COMPLETE)

### SSL/TLS Configuration
- [ ] **SSL Certificate Installed** - Valid SSL certificate from trusted CA
- [ ] **HTTPS Redirect** - All HTTP traffic redirected to HTTPS
- [ ] **TLS 1.2+ Only** - Disable older TLS versions
- [ ] **Strong Cipher Suites** - Use modern, secure cipher suites
- [ ] **HSTS Headers** - Strict-Transport-Security header configured

### Authentication & Authorization
- [ ] **Strong Admin Password** - Change default admin password (min 16 chars, mixed case, numbers, symbols)
- [ ] **Session Timeout** - Set session_timeout = 3600 (1 hour) in odoo.conf
- [ ] **Database Password** - Strong database password (not 'odoo')
- [ ] **API Keys Secured** - Move API keys to environment variables
- [ ] **User Account Review** - Remove/disable unused user accounts

### Database Security
- [ ] **Database Firewall** - PostgreSQL only accessible from application server
- [ ] **Database Encryption** - Enable encryption at rest
- [ ] **Regular Backups** - Automated daily backups with retention policy
- [ ] **Backup Encryption** - Encrypt backup files
- [ ] **Access Logging** - Enable PostgreSQL query logging

### Network Security
- [ ] **Firewall Rules** - Only ports 80, 443, and SSH open to internet
- [ ] **SSH Key Auth** - Disable password authentication for SSH
- [ ] **VPN Access** - Admin access through VPN only
- [ ] **Rate Limiting** - Implement rate limiting on all public endpoints
- [ ] **DDoS Protection** - CloudFlare or similar DDoS protection

### Application Security
- [ ] **CORS Restriction** - Limit CORS to specific frontend domain
- [ ] **Security Headers** - X-Frame-Options, X-Content-Type-Options, CSP
- [ ] **Input Validation** - All user inputs validated and sanitized
- [ ] **SQL Injection Protection** - Use ORM, avoid raw SQL
- [ ] **XSS Protection** - React escaping + CSP headers

---

## ⚠️ Important Security Measures (SHOULD COMPLETE)

### Monitoring & Logging
- [ ] **Security Monitoring** - Set up intrusion detection system
- [ ] **Log Aggregation** - Centralized logging (ELK stack or similar)
- [ ] **Failed Login Alerts** - Alert on multiple failed login attempts
- [ ] **Audit Trail** - Log all administrative actions
- [ ] **Performance Monitoring** - Monitor for unusual activity patterns

### Data Protection
- [ ] **Data Encryption** - Encrypt sensitive data in database
- [ ] **PII Handling** - Proper handling of personally identifiable information
- [ ] **Data Retention** - Implement data retention policies
- [ ] **Backup Testing** - Regular backup restoration tests
- [ ] **Disaster Recovery** - Document disaster recovery procedures

### Infrastructure Security
- [ ] **OS Updates** - Keep operating system updated
- [ ] **Security Patches** - Apply Odoo security patches promptly
- [ ] **Dependency Updates** - Keep Python/Node.js dependencies updated
- [ ] **File Permissions** - Proper file and directory permissions
- [ ] **Service Isolation** - Run services with minimal privileges

---

## 🔧 Configuration Commands

### 1. Generate Strong Passwords
```bash
# Generate admin password
openssl rand -base64 32

# Generate API key
openssl rand -hex 32

# Generate database password
openssl rand -base64 24
```

### 2. Set File Permissions
```bash
# Odoo configuration
chmod 600 odoo.conf
chown odoo:odoo odoo.conf

# Environment file
chmod 600 .env
chown odoo:odoo .env

# Application files
find . -type f -name "*.py" -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;
```

### 3. Configure Firewall (Ubuntu/Debian)
```bash
# Enable firewall
ufw enable

# Allow SSH (change port if needed)
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Deny all other incoming
ufw default deny incoming
ufw default allow outgoing
```

### 4. SSL Certificate (Let's Encrypt)
```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d your-domain.com

# Auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

### 5. Database Security
```bash
# PostgreSQL configuration in /etc/postgresql/*/main/postgresql.conf
listen_addresses = 'localhost'
ssl = on
log_statement = 'mod'
log_min_duration_statement = 1000

# Restart PostgreSQL
systemctl restart postgresql
```

---

## 🚨 Security Incident Response

### Immediate Actions
1. **Isolate System** - Disconnect from network if compromised
2. **Change Passwords** - Change all admin and service passwords
3. **Review Logs** - Check access logs for suspicious activity
4. **Backup Current State** - Create forensic backup before cleanup
5. **Notify Stakeholders** - Inform management and users if needed

### Investigation Steps
1. **Identify Entry Point** - How was the system compromised?
2. **Assess Damage** - What data was accessed or modified?
3. **Document Timeline** - When did the incident occur?
4. **Preserve Evidence** - Keep logs and forensic data
5. **Report Incident** - Follow organizational reporting procedures

### Recovery Actions
1. **Patch Vulnerabilities** - Fix the security hole that was exploited
2. **Restore from Backup** - If data was corrupted
3. **Update Security Measures** - Implement additional protections
4. **Monitor Closely** - Watch for signs of continued compromise
5. **Conduct Post-Mortem** - Learn from the incident

---

## 📋 Security Testing

### Automated Security Scans
```bash
# Install security tools
pip install bandit safety

# Python security scan
bandit -r . -f json -o security_report.json

# Dependency vulnerability scan
safety check --json --output security_deps.json

# Frontend security scan
npm audit --audit-level moderate
```

### Manual Security Tests
- [ ] **SQL Injection** - Test all input fields for SQL injection
- [ ] **XSS Testing** - Test for cross-site scripting vulnerabilities
- [ ] **Authentication Bypass** - Attempt to bypass login mechanisms
- [ ] **Authorization Testing** - Verify role-based access controls
- [ ] **Session Management** - Test session timeout and hijacking

### Penetration Testing
- [ ] **External Scan** - Use tools like Nmap, Nessus for external scan
- [ ] **Web Application Scan** - Use OWASP ZAP or Burp Suite
- [ ] **Social Engineering** - Test staff awareness of phishing
- [ ] **Physical Security** - Test server room and workstation security

---

## 📞 Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| System Administrator | [Name] | [Phone] | [Email] |
| Security Officer | [Name] | [Phone] | [Email] |
| Database Administrator | [Name] | [Phone] | [Email] |
| IT Manager | [Name] | [Phone] | [Email] |

---

## 📚 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Odoo Security Guidelines](https://www.odoo.com/documentation/19.0/administration/security.html)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [React Security Best Practices](https://snyk.io/blog/10-react-security-best-practices/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Last Updated:** $(date)  
**Next Review:** $(date -d "+3 months")  
**Approved By:** [Security Officer Name]