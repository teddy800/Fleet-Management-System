# 🚀 MESSOB Fleet Management - Quick Reference

## 📍 Service URLs

| Service | URL | Status |
|---------|-----|--------|
| **Frontend** | http://localhost:3000/ | ✅ Running |
| **Odoo Backend** | http://localhost:8069 | ✅ Running |
| **HR Mock Server** | http://localhost:5000 | ✅ Running |
| **GPS Mock Server** | http://localhost:5001 | ✅ Running |

---

## 🔑 Working Credentials

### ✅ Currently Working
```
Username: admin
Password: admin
Role: System Administrator
```

### ⚠️ Configured but NOT in Odoo (Need to create)
```
Dispatchers:
- tigist.haile@mesob.com / Dispatcher@123
- rahel.mekonnen@mesob.com / Dispatcher@123

Staff:
- dawit.bekele@mesob.com / Staff@123
- kebede.worku@mesob.com / Staff@123

Drivers:
- abebe.kebede@mesob.com / Driver@123
- sara.tesfaye@mesob.com / Driver@123
- yonas.girma@mesob.com / Driver@123
- mekdes.alemu@mesob.com / Driver@123
- hana.worku@mesob.com / Driver@123
- tesfaye.mulugeta@mesob.com / Driver@123
- liya.solomon@mesob.com / Driver@123

Mechanic:
- biruk.tadesse@mesob.com / Mechanic@123
```

---

## 🛠️ Quick Commands

### Start All Services
```bash
# Already running in background terminals
# Terminal 7: Odoo Backend
# Terminal 5: Frontend
# Terminal 3: HR Mock Server
# Terminal 4: GPS Mock Server
```

### Stop Services
```powershell
# Use Kiro's process management or:
# Press Ctrl+C in each terminal
```

### Check Service Status
```powershell
# Check if Odoo is running
netstat -ano | findstr :8069

# Check if Frontend is running
netstat -ano | findstr :3000

# Check if Mock servers are running
netstat -ano | findstr :5000
netstat -ano | findstr :5001
```

### View Logs
```powershell
# Odoo logs
type odoo.log

# Frontend logs (in terminal)
# HR/GPS logs (in terminal)
```

---

## 🔧 Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| `odoo_dev.conf` | Odoo configuration | Root directory |
| `frontend/.env` | Frontend environment | frontend/.env |
| `.env.production` | Production config | Root directory |
| `__manifest__.py` | Odoo addon manifest | Root directory |

---

## 🚨 Critical Issues to Fix

### 1️⃣ Create Users in Odoo
```
Go to: http://localhost:8069
Login: admin / admin
Navigate: Settings → Users & Companies → Users
Create: 12 users matching credentials above
Assign: Appropriate security groups
```

### 2️⃣ Configure System Parameters
```
Go to: Settings → Technical → System Parameters
Add:
- mesob.hr_sync_url = http://localhost:5000/api/employees
- mesob.gps_gateway_url = http://localhost:5001/api/vehicles
- mesob.api_key = test-api-key-12345
```

### 3️⃣ Fix Deprecated Routes
```python
# In controllers/*.py files, replace:
type='json'
# With:
type='jsonrpc'
```

---

## 📊 API Endpoints

### Authentication
```
POST /api/mobile/auth/login
POST /web/session/authenticate
GET /web/session/get_session_info
POST /web/session/destroy
```

### Trip Management
```
GET /api/mobile/user/trip-requests
POST /api/mobile/quick-request
GET /api/mobile/driver/assignments
POST /api/mobile/trip/<id>/start
POST /api/mobile/trip/<id>/complete
POST /api/mobile/trip/<id>/update-location
```

### Mock Services
```
# HR Mock
GET http://localhost:5000/health
GET http://localhost:5000/api/employees
GET http://localhost:5000/api/employees/<id>
POST http://localhost:5000/api/sync

# GPS Mock
GET http://localhost:5001/health
GET http://localhost:5001/api/vehicles
GET http://localhost:5001/api/vehicles/<id>
POST http://localhost:5001/api/vehicles/<id>/location
```

---

## 🎯 Testing Workflow

### 1. Test Admin Access
```
1. Go to http://localhost:3000
2. Login with admin/admin
3. Verify dashboard loads
4. Check all menu items accessible
```

### 2. Test API Endpoints
```bash
# Test authentication
curl -X POST http://localhost:8069/web/session/authenticate \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"call","id":1,"params":{"db":"messob_db","login":"admin","password":"admin"}}'

# Test HR mock
curl http://localhost:5000/api/employees

# Test GPS mock
curl http://localhost:5001/api/vehicles
```

### 3. Test Frontend Features
```
1. Login as admin
2. Navigate to Fleet → Manage Fleet
3. Navigate to Dispatch → Approval Queue
4. Navigate to Analytics
5. Test logout
```

---

## 🐛 Troubleshooting

### Frontend won't load
```powershell
# Check if Vite is running
netstat -ano | findstr :3000

# Restart frontend
cd frontend
npm run dev
```

### Backend not responding
```powershell
# Check if Odoo is running
netstat -ano | findstr :8069

# Check logs
type odoo.log

# Restart Odoo (stop and start process)
```

### Login fails
```
1. Check if backend is running (port 8069)
2. Verify database is accessible
3. Check browser console for errors
4. Clear browser cookies/localStorage
5. Try admin/admin credentials
```

### Mock servers not responding
```powershell
# Check if running
netstat -ano | findstr :5000
netstat -ano | findstr :5001

# Restart mock servers
cd mock_servers
python hr_mock_server.py
python gps_mock_server.py
```

---

## 📚 Documentation

- **Full Analysis:** `SYSTEM_ANALYSIS.md`
- **README:** `README.md`
- **Frontend README:** `frontend/README.md`
- **Mock Servers:** `mock_servers/README.md`
- **Deployment:** `deploy_production.sh`

---

## 🎓 Role Capabilities

| Role | Create Requests | Approve Requests | Assign Vehicles | View All Fleet | Manage Users |
|------|----------------|------------------|-----------------|----------------|--------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Dispatcher** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Staff** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Driver** | ✅ | ❌ | ❌ | Own vehicle | ❌ |
| **Mechanic** | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## 💡 Quick Tips

1. **Always use admin/admin for initial testing**
2. **Check browser console for frontend errors**
3. **Check odoo.log for backend errors**
4. **Mock servers provide test data without real integrations**
5. **Frontend auto-saves session in localStorage**
6. **Backend uses cookie-based sessions**
7. **CORS is configured for localhost development**

---

**Last Updated:** May 20, 2026  
**Version:** 1.0
