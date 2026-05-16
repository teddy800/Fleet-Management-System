# 🔧 Configure Mock Servers in Odoo

## ✅ Mock Servers Are Running!

All servers are now active:

| Server | Status | URL |
|--------|--------|-----|
| **Frontend** | ✅ Running | http://localhost:3000 |
| **Backend (Odoo)** | ✅ Running | http://localhost:8069 |
| **HR Mock Server** | ✅ Running | http://localhost:5000 |
| **GPS Mock Server** | ✅ Running | http://localhost:5001 |

---

## 🔧 STEP-BY-STEP CONFIGURATION

### **Step 1: Login to Odoo**
1. Go to: **http://localhost:8069/web**
2. Login with: `admin` / `admin`

### **Step 2: Enable Developer Mode**
1. Go to: **Settings** (gear icon in top menu)
2. Scroll to bottom
3. Click: **Activate the developer mode**

### **Step 3: Open System Parameters**
1. Go to: **Settings**
2. Click: **Technical** (in left menu)
3. Click: **Parameters** → **System Parameters**

### **Step 4: Add HR Sync URL**
1. Click: **Create** (or **New**)
2. Fill in:
   - **Key:** `mesob.hr_sync_url`
   - **Value:** `http://localhost:5000/api/employees`
3. Click: **Save**

### **Step 5: Add GPS Gateway URL**
1. Click: **Create** again
2. Fill in:
   - **Key:** `mesob.gps_gateway_url`
   - **Value:** `http://localhost:5001/api/vehicles`
3. Click: **Save**

### **Step 6: Add API Key (Optional)**
1. Click: **Create** again
2. Fill in:
   - **Key:** `mesob.api_key`
   - **Value:** `test-api-key-12345`
3. Click: **Save**

---

## 🧪 TEST HR SYNC

### **Option 1: Via Scheduled Actions**
1. Go to: **Settings** → **Technical** → **Automation** → **Scheduled Actions**
2. Search for: "HR Employee Sync"
3. Click on it
4. Click: **Run Manually** button
5. Wait a few seconds
6. Go to: **HR** → **Employees**
7. You should see 5 new employees:
   - Abebe Kebede (Driver)
   - Sara Tesfaye (Driver)
   - Biruk Tadesse (Mechanic)
   - Tigist Haile (Dispatcher)
   - Dawit Bekele (Staff)

### **Option 2: Via Frontend**
1. Go to: **http://localhost:3000**
2. Login with: `admin` / `admin`
3. Go to: **HR Sync** (in admin menu)
4. Click: **Sync Now**
5. Check: **HR** → **Employees**

---

## 🛰️ TEST GPS TRACKING

### **Option 1: Via Scheduled Actions**
1. Go to: **Settings** → **Technical** → **Automation** → **Scheduled Actions**
2. Search for: "GPS Location Fetch"
3. Click on it
4. Click: **Run Manually**
5. Go to: **Fleet** → **GPS Tracking**
6. You should see 3 vehicles with locations:
   - AA-12345 (Moving)
   - AA-67890 (Parked)
   - AA-11111 (Moving)

### **Option 2: Via Frontend**
1. Go to: **http://localhost:3000**
2. Login with: `admin` / `admin`
3. Go to: **GPS Tracking**
4. Click: **Fetch GPS Updates**
5. View vehicles on map

---

## 📊 VERIFY CONFIGURATION

### **Check System Parameters:**
```
Settings → Technical → Parameters → System Parameters
```

You should see:
- ✅ `mesob.hr_sync_url` = `http://localhost:5000/api/employees`
- ✅ `mesob.gps_gateway_url` = `http://localhost:5001/api/vehicles`
- ✅ `mesob.api_key` = `test-api-key-12345`

### **Test Endpoints Directly:**

Open browser and visit:
- **HR Health:** http://localhost:5000/health
- **GPS Health:** http://localhost:5001/health
- **HR Employees:** http://localhost:5000/api/employees
- **GPS Vehicles:** http://localhost:5001/api/vehicles

---

## 🎯 WHAT YOU'LL SEE

### **After HR Sync:**
- 5 new employees in **HR → Employees**
- Each with job title, email, phone
- Drivers have license numbers
- All marked as "active"

### **After GPS Sync:**
- 3 vehicles in **Fleet → GPS Tracking**
- Real-time locations on map
- Speed and heading data
- Last update timestamp
- Moving/Parked status

---

## 🔄 AUTOMATIC SYNC

Once configured, syncs happen automatically:

### **HR Sync:**
- **Frequency:** Every 1 hour
- **Cron Job:** "HR Employee Sync"
- **Action:** Fetches employees from HR system
- **Result:** New/updated employees in Odoo

### **GPS Sync:**
- **Frequency:** Every 5 minutes
- **Cron Job:** "GPS Location Fetch"
- **Action:** Fetches vehicle locations
- **Result:** Updated GPS tracking data

---

## 🛑 STOP MOCK SERVERS

If you need to stop the mock servers:

### **Via Kiro:**
1. Go to background processes
2. Stop HR mock server (Terminal 5)
3. Stop GPS mock server (Terminal 6)

### **Via Command:**
```powershell
# Find processes
Get-Process python | Where-Object {$_.Path -like "*mock*"}

# Stop them
Stop-Process -Name python -Force
```

---

## 🔍 TROUBLESHOOTING

### **Issue: "Connection refused"**
**Solution:** Check mock servers are running:
```bash
curl http://localhost:5000/health
curl http://localhost:5001/health
```

### **Issue: "No employees synced"**
**Solution:** 
1. Check system parameter is correct
2. Check Odoo logs for errors
3. Run sync manually first
4. Verify HR server is responding

### **Issue: "No GPS data"**
**Solution:**
1. Check system parameter is correct
2. Verify GPS server is responding
3. Check vehicle records exist in Odoo
4. Run GPS fetch manually

---

## 📝 QUICK REFERENCE

### **System Parameters:**
```
mesob.hr_sync_url = http://localhost:5000/api/employees
mesob.gps_gateway_url = http://localhost:5001/api/vehicles
mesob.api_key = test-api-key-12345
```

### **Test URLs:**
```
http://localhost:5000/health
http://localhost:5001/health
http://localhost:5000/api/employees
http://localhost:5001/api/vehicles
```

### **Scheduled Actions:**
- HR Employee Sync (hourly)
- GPS Location Fetch (every 5 minutes)

---

## ✅ SUCCESS CHECKLIST

- [ ] All 4 servers running
- [ ] Developer mode enabled in Odoo
- [ ] System parameters configured
- [ ] HR sync tested (5 employees added)
- [ ] GPS sync tested (3 vehicles tracked)
- [ ] Automatic sync working
- [ ] Data visible in frontend

---

**Status:** ✅ All servers running and ready!  
**Next Step:** Configure system parameters in Odoo  
**Time Required:** 5-10 minutes
