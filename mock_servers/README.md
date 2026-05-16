# 🛰️ Mock Servers for MESSOB Fleet Management

## Overview

These mock servers simulate external HR and GPS systems for testing the fleet management system's integration capabilities.

---

## 📦 What's Included

### 1. **HR Mock Server** (`hr_mock_server.py`)
- **Port:** 5000
- **Purpose:** Simulates an external HR system
- **Features:**
  - Employee list endpoint
  - Individual employee lookup
  - Sync webhook
  - 5 mock employees with realistic data

### 2. **GPS Mock Server** (`gps_mock_server.py`)
- **Port:** 5001
- **Purpose:** Simulates GPS tracking devices
- **Features:**
  - Real-time vehicle location
  - Location history
  - Geofence checking
  - Webhook for device updates
  - 3 mock vehicles with simulated movement

---

## 🚀 Quick Start

### Option 1: PowerShell Script (Recommended)
```powershell
cd c:\Users\HP\odoo-addons\mesob_fleet_customizations\mock_servers
.\start_mock_servers.ps1
```

This will:
- Check Python installation
- Install dependencies if needed
- Start both servers in separate windows
- Show configuration instructions

### Option 2: Manual Start

#### Install Dependencies:
```bash
pip install -r requirements.txt
```

#### Start HR Server:
```bash
python hr_mock_server.py
```

#### Start GPS Server (in another terminal):
```bash
python gps_mock_server.py
```

---

## 🔧 Configuration in Odoo

After starting the servers, configure Odoo to use them:

### Step 1: Go to System Parameters
```
Settings → Technical → System Parameters
```

### Step 2: Add HR Sync URL
- **Key:** `mesob.hr_sync_url`
- **Value:** `http://localhost:5000/api/employees`

### Step 3: Add GPS Gateway URL
- **Key:** `mesob.gps_gateway_url`
- **Value:** `http://localhost:5001/api/vehicles`

### Step 4: Add API Key (Optional)
- **Key:** `mesob.api_key`
- **Value:** `test-api-key-12345`

---

## 📡 API Endpoints

### HR Mock Server (Port 5000)

#### Health Check
```
GET http://localhost:5000/health
```

#### List All Employees
```
GET http://localhost:5000/api/employees
```

Response:
```json
{
  "success": true,
  "count": 5,
  "employees": [
    {
      "external_hr_id": "HR001",
      "name": "Abebe Kebede",
      "email": "abebe.kebede@mesob.com",
      "job_title": "Driver",
      "is_driver": true,
      "status": "active"
    }
  ]
}
```

#### Get Single Employee
```
GET http://localhost:5000/api/employees/HR001
```

#### Trigger Sync
```
POST http://localhost:5000/api/sync
```

---

### GPS Mock Server (Port 5001)

#### Health Check
```
GET http://localhost:5001/health
```

#### List All Vehicles
```
GET http://localhost:5001/api/vehicles
```

Response:
```json
{
  "success": true,
  "count": 3,
  "vehicles": [
    {
      "vehicle_id": "AA-12345",
      "latitude": 9.0320,
      "longitude": 38.7469,
      "speed": 45.5,
      "heading": 180,
      "status": "moving",
      "driver": "Abebe Kebede"
    }
  ]
}
```

#### Get Vehicle Location
```
GET http://localhost:5001/api/vehicles/AA-12345
```

#### Update Vehicle Location
```
POST http://localhost:5001/api/vehicles/AA-12345/location
Content-Type: application/json

{
  "latitude": 9.0320,
  "longitude": 38.7469,
  "speed": 45.5,
  "heading": 180
}
```

#### Get Location History
```
GET http://localhost:5001/api/vehicles/AA-12345/history
```

#### Check Geofence
```
POST http://localhost:5001/api/geofence/check
Content-Type: application/json

{
  "vehicle_id": "AA-12345",
  "geofence": {
    "center_latitude": 9.0320,
    "center_longitude": 38.7469,
    "radius": 5.0
  }
}
```

---

## 🧪 Testing Integration

### Test HR Sync in Odoo

1. Go to **Settings → Technical → Scheduled Actions**
2. Find "HR Employee Sync"
3. Click "Run Manually"
4. Check **HR → Employees** to see synced employees

### Test GPS Tracking

1. Go to **Fleet → GPS Tracking**
2. Click "Fetch GPS Updates"
3. View vehicle locations on map

---

## 📊 Mock Data

### HR Employees (5 total)
- **HR001** - Abebe Kebede (Driver)
- **HR002** - Sara Tesfaye (Driver)
- **HR003** - Biruk Tadesse (Mechanic)
- **HR004** - Tigist Haile (Dispatcher)
- **HR005** - Dawit Bekele (Staff)

### GPS Vehicles (3 total)
- **AA-12345** - Moving (Driver: Abebe Kebede)
- **AA-67890** - Parked (Driver: Sara Tesfaye)
- **AA-11111** - Moving (Driver: Yonas Girma)

---

## 🔍 Troubleshooting

### Port Already in Use
If you get "Address already in use" error:

**Windows:**
```powershell
# Find process using port 5000
netstat -ano | findstr :5000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

### Flask Not Installed
```bash
pip install Flask==3.0.0
```

### Python Not Found
Install Python 3.8+ from: https://www.python.org/downloads/

---

## 🎯 Use Cases

### 1. Development Testing
- Test HR sync without real HR system
- Test GPS tracking without real devices
- Develop integration features

### 2. Demo/Presentation
- Show live GPS tracking
- Demonstrate HR sync
- Realistic data for demos

### 3. CI/CD Testing
- Automated integration tests
- No external dependencies
- Consistent test data

---

## 🛑 Stopping Servers

### If Started with PowerShell Script:
Press any key in the script window

### If Started Manually:
Press `Ctrl+C` in each terminal window

---

## 📝 Notes

- **Development Only:** These are mock servers for testing, not for production
- **No Authentication:** Servers have minimal security for ease of testing
- **Simulated Data:** GPS locations simulate movement, not real tracking
- **In-Memory:** Data resets when servers restart

---

## 🔗 Related Documentation

- Main README: `../README.md`
- HR Sync: `../models/hr_employee.py`
- GPS Tracking: `../models/gps_tracking.py`
- API Controllers: `../controllers/`

---

## ✅ Quick Verification

After starting servers, test with:

```bash
# Test HR Server
curl http://localhost:5000/health

# Test GPS Server
curl http://localhost:5001/health

# Get employees
curl http://localhost:5000/api/employees

# Get vehicles
curl http://localhost:5001/api/vehicles
```

---

**Status:** ✅ Ready to Use  
**Last Updated:** May 16, 2026  
**Version:** 1.0
