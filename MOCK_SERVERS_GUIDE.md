# 🛰️ Mock Servers - Quick Start Guide

## ✅ What Are Mock Servers?

Mock servers simulate external systems for testing:
- **HR Mock Server** - Simulates external HR system (employee data)
- **GPS Mock Server** - Simulates GPS tracking devices (vehicle locations)

## ⚠️ Important: Mock Servers Are OPTIONAL

**The fleet management system works perfectly without them!**

Mock servers are only needed if you want to test:
- HR employee synchronization
- GPS tracking integration
- External API webhooks

---

## 🚀 Quick Start

### Option 1: PowerShell Script (Easiest)
```powershell
cd c:\Users\HP\odoo-addons\mesob_fleet_customizations\mock_servers
.\start_mock_servers.ps1
```

### Option 2: Manual Start

#### Terminal 1 - HR Server:
```bash
cd c:\Users\HP\odoo-addons\mesob_fleet_customizations\mock_servers
pip install -r requirements.txt
python hr_mock_server.py
```

#### Terminal 2 - GPS Server:
```bash
cd c:\Users\HP\odoo-addons\mesob_fleet_customizations\mock_servers
python gps_mock_server.py
```

---

## 🔧 Configure in Odoo (After Starting Servers)

1. **Go to:** Settings → Technical → System Parameters
2. **Add these parameters:**

| Key | Value |
|-----|-------|
| `mesob.hr_sync_url` | `http://localhost:5000/api/employees` |
| `mesob.gps_gateway_url` | `http://localhost:5001/api/vehicles` |
| `mesob.api_key` | `test-api-key-12345` |

---

## 🧪 Test Integration

### Test HR Sync:
1. Go to: **Settings → Technical → Scheduled Actions**
2. Find: "HR Employee Sync"
3. Click: "Run Manually"
4. Check: **HR → Employees** (should see 5 new employees)

### Test GPS Tracking:
1. Go to: **Fleet → GPS Tracking**
2. Click: "Fetch GPS Updates"
3. View: Vehicle locations on map

---

## 📊 What You Get

### HR Mock Data (5 Employees):
- Abebe Kebede (Driver)
- Sara Tesfaye (Driver)
- Biruk Tadesse (Mechanic)
- Tigist Haile (Dispatcher)
- Dawit Bekele (Staff)

### GPS Mock Data (3 Vehicles):
- AA-12345 (Moving)
- AA-67890 (Parked)
- AA-11111 (Moving)

---

## 🌐 Server URLs

- **HR Server:** http://localhost:5000
- **GPS Server:** http://localhost:5001
- **HR Health:** http://localhost:5000/health
- **GPS Health:** http://localhost:5001/health

---

## 🛑 Stop Servers

- **PowerShell Script:** Press any key in script window
- **Manual:** Press `Ctrl+C` in each terminal

---

## ❓ Do I Need These?

### ✅ Start Mock Servers If:
- Testing HR employee sync
- Testing GPS tracking
- Developing integration features
- Doing a demo/presentation

### ❌ Don't Need Mock Servers If:
- Just using the fleet management system
- Only managing trips and vehicles
- Not testing external integrations
- Using real HR/GPS systems

---

## 🎯 Current Project Status

### ✅ Currently Running:
1. **Frontend** - http://localhost:3000/ ✅
2. **Backend (Odoo)** - http://localhost:8069/ ✅

### 🔌 Optional (Not Running):
3. **HR Mock Server** - http://localhost:5000 ⚪
4. **GPS Mock Server** - http://localhost:5001 ⚪

**The system works fine with just #1 and #2!**

---

## 📁 Files Created

```
mock_servers/
├── hr_mock_server.py          # HR system simulator
├── gps_mock_server.py         # GPS tracking simulator
├── requirements.txt           # Python dependencies
├── start_mock_servers.ps1     # PowerShell startup script
└── README.md                  # Detailed documentation
```

---

## 🔍 Quick Test

After starting servers:
```bash
# Test HR Server
curl http://localhost:5000/health

# Test GPS Server
curl http://localhost:5001/health
```

---

**Summary:** Mock servers are optional testing tools. Your main system (frontend + backend) is already running and fully functional!

**Need them?** Run `.\start_mock_servers.ps1` in the mock_servers folder.

**Don't need them?** Continue using the system as-is!
