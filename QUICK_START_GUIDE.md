# MESSOB Fleet Management System - Quick Start Guide

## Prerequisites
- ✅ Odoo 19 installed at: `C:\Program Files\Odoo 19.0.20260217\`
- ✅ Node.js and npm installed
- ✅ Python 3.8+ installed
- ✅ PostgreSQL database running

---

## Step 1: Start Odoo Backend (Terminal 1)

```bash
# Navigate to your module directory
cd /path/to/mesob_fleet_customizations

# Start Odoo
"C:\Program Files\Odoo 19.0.20260217\server\odoo-bin" -c odoo.conf -d messob_db -u mesob_fleet_customizations

# Or if you have a config file:
"C:\Program Files\Odoo 19.0.20260217\server\odoo-bin" -c odoo.conf
```

**Access Odoo:** http://localhost:8069  
**Login:** admin / admin (or your configured credentials)

---

## Step 2: Install/Update Module in Odoo

1. Go to: **Apps** menu
2. Remove "Apps" filter
3. Search: **"Mesob Fleet"** or **"mesob_fleet_customizations"**
4. Click: **Install** (first time) or **Upgrade** (if already installed)
5. Wait for installation to complete

---

## Step 3: Configure System Parameters

1. Go to: **Settings → Technical → Parameters → System Parameters**
2. Click: **Create**
3. Add these parameters:

| Key | Value |
|-----|-------|
| `mesob.hr_sync_url` | `http://localhost:5000/api/employees` |
| `mesob.api_key` | `your-secret-api-key-here` |

---

## Step 4: Create Test Users (Optional)

1. Go to: **Settings → Users & Companies → Users**
2. Create users for each role:

### Admin User (Already exists)
- Username: `admin`
- Password: `admin`
- Groups: Fleet Manager

### Dispatcher User
- Username: `dispatcher`
- Password: `dispatcher`
- Groups: Fleet Dispatcher

### Staff User
- Username: `staff`
- Password: `staff`
- Groups: Fleet User

### Driver User
- Username: `driver`
- Password: `driver`
- Groups: Fleet User
- **Important:** Create an HR Employee record for this user and check "Is Driver"

---

## Step 5: Start React Frontend (Terminal 2)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

**Access Frontend:** http://localhost:5173  
**Login:** Use any of the users created above

---

## Step 6: Start Mock HR Server (Terminal 3 - Optional)

```bash
# Navigate to project root
cd /path/to/mesob_fleet_customizations

# Start mock HR server
python mock_hr_server.py
```

**Mock HR Server:** http://localhost:5000  
**Endpoint:** http://localhost:5000/api/employees

### Trigger HR Sync Manually
1. Go to Odoo: **Settings → Technical → Automation → Scheduled Actions**
2. Find: **"Sync Employees from HR System"**
3. Click: **Run Manually**
4. Check: **Settings → Users & Companies → Employees** (should see 4 new employees)

---

## Step 7: Start Mock GPS Server (Terminal 4 - Optional)

```bash
# Navigate to project root
cd /path/to/mesob_fleet_customizations

# Start mock GPS server
python mock_gps_server.py
```

This will simulate GPS devices sending location updates to Odoo every 10 seconds.

---

## Step 8: Test the System

### Test 1: Create a Trip Request (Staff Role)
1. Login to frontend: http://localhost:5173/login
   - Username: `staff`, Password: `staff`
2. Click: **Request Vehicle**
3. Fill 4-step wizard:
   - **Step 1:** Purpose, Vehicle Category
   - **Step 2:** Pickup Location, Destination
   - **Step 3:** Passenger Count
   - **Step 4:** Review & Submit
4. Click: **Submit Request**
5. Go to: **My Requests** (should show new request with "Pending" status)

### Test 2: Approve Request (Dispatcher Role)
1. Logout and login as: `dispatcher` / `dispatcher`
2. Go to: **Approval Queue**
3. Find the pending request
4. Click: **Approve** (green checkmark)
5. Request status changes to "Approved"

### Test 3: Assign Vehicle & Driver (Dispatcher Role)
1. Still in **Approval Queue**
2. Find the approved request
3. Click: **Assign** button
4. Select: **Vehicle** and **Driver** from dropdowns
5. Click: **Confirm Assignment**
6. Request status changes to "Assigned"

### Test 4: View GPS Tracking (Dispatcher/Admin Role)
1. Go to: **GPS Tracking**
2. Should show vehicles with:
   - Current location (latitude, longitude)
   - Speed, heading
   - Last update timestamp
3. If mock GPS server is running, locations should update every 10 seconds

### Test 5: View Dashboard (Admin Role)
1. Logout and login as: `admin` / `admin`
2. Go to: **Dashboard**
3. Should see:
   - 8 KPI cards (Total Fleet, Active Trips, etc.)
   - Fleet Performance KPIs
   - Active Alerts
   - Cost Analysis
   - Top Performing Drivers
   - Predictive Maintenance Alerts

### Test 6: Manage Fleet (Admin/Dispatcher Role)
1. Go to: **Manage Fleet**
2. Should see all vehicles with:
   - Status (available, in_use, maintenance)
   - Current odometer
   - Maintenance due indicator
   - Fuel efficiency
   - Utilization rate

### Test 7: Fuel Logs (Admin/Dispatcher Role)
1. Go to: **Fuel Logs**
2. Should see all fuel entries with:
   - Vehicle, driver, date
   - Volume, cost, odometer
   - Fuel efficiency (KM/L)
3. Summary card shows total cost and average efficiency

### Test 8: Maintenance (Admin/Dispatcher Role)
1. Go to: **Maintenance**
2. Two tabs:
   - **History:** All maintenance logs
   - **Schedules:** Upcoming maintenance with overdue badges

---

## Common Issues & Solutions

### Issue 1: Frontend shows "Backend not connected"
**Solution:**
1. Check Odoo is running: http://localhost:8069
2. Check module is installed: Apps → Search "Mesob Fleet"
3. Check Vite proxy is configured: `frontend/vite.config.js`

### Issue 2: Login fails with "Invalid credentials"
**Solution:**
1. Check user exists in Odoo: Settings → Users
2. Check password is correct
3. Check user has correct groups assigned

### Issue 3: "Employee record not found" error
**Solution:**
1. Go to Odoo: Settings → Users & Companies → Employees
2. Create an employee record for the user
3. Link employee to user: Employee form → Related User field

### Issue 4: GPS Tracking shows no data
**Solution:**
1. Check mock GPS server is running: `python mock_gps_server.py`
2. Check API key is configured: Settings → System Parameters → `mesob.api_key`
3. Check GPS logs in Odoo: Fleet → GPS Logs

### Issue 5: HR Sync not working
**Solution:**
1. Check mock HR server is running: `python mock_hr_server.py`
2. Check HR sync URL is configured: Settings → System Parameters → `mesob.hr_sync_url`
3. Trigger sync manually: Settings → Scheduled Actions → "Sync Employees" → Run Manually

---

## Development Workflow

### Making Backend Changes
1. Edit Python files in `models/`, `controllers/`, etc.
2. Restart Odoo or upgrade module:
   ```bash
   "C:\Program Files\Odoo 19.0.20260217\server\odoo-bin" -c odoo.conf -d messob_db -u mesob_fleet_customizations
   ```
3. Refresh browser

### Making Frontend Changes
1. Edit React files in `frontend/src/`
2. Vite will auto-reload (Hot Module Replacement)
3. No need to restart server

### Adding New API Endpoints
1. Add method to `controllers/fleet_api.py` or `controllers/mobile_api.py`
2. Add corresponding function to `frontend/src/lib/api.js`
3. Restart Odoo
4. Use in React components

---

## Running Tests

### Frontend Tests
```bash
cd frontend
npm run test
```

### Backend Tests (if implemented)
```bash
# From Odoo installation directory
python odoo-bin -c odoo.conf -d messob_db --test-enable --stop-after-init -u mesob_fleet_customizations
```

---

## Production Deployment Checklist

- [ ] Configure HTTPS/TLS on Odoo server
- [ ] Set up database backups (PITR enabled)
- [ ] Configure production email server
- [ ] Set up production GPS gateway integration
- [ ] Configure production HR sync URL
- [ ] Set strong API keys for external services
- [ ] Load test with 1000+ concurrent GPS updates
- [ ] Security audit (OWASP Top 10)
- [ ] User acceptance testing with all roles
- [ ] Build frontend for production: `npm run build`
- [ ] Deploy frontend to web server (Nginx, Apache, etc.)

---

## Useful Commands

### Odoo
```bash
# Start Odoo
"C:\Program Files\Odoo 19.0.20260217\server\odoo-bin" -c odoo.conf

# Update module
"C:\Program Files\Odoo 19.0.20260217\server\odoo-bin" -c odoo.conf -d messob_db -u mesob_fleet_customizations

# Install module
"C:\Program Files\Odoo 19.0.20260217\server\odoo-bin" -c odoo.conf -d messob_db -i mesob_fleet_customizations

# Run tests
"C:\Program Files\Odoo 19.0.20260217\server\odoo-bin" -c odoo.conf -d messob_db --test-enable --stop-after-init -u mesob_fleet_customizations
```

### Frontend
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Lint code
npm run lint
```

### Database
```bash
# Backup database
pg_dump messob_db > backup.sql

# Restore database
psql messob_db < backup.sql

# Drop database (careful!)
dropdb messob_db

# Create database
createdb messob_db
```

---

## Support & Documentation

- **Odoo Documentation:** https://www.odoo.com/documentation/19.0/
- **React Documentation:** https://react.dev/
- **Vite Documentation:** https://vitejs.dev/
- **Project Analysis Report:** See `PROJECT_ANALYSIS_REPORT.md`
- **Integration Guide:** See `integration_guide.md`

---

## Next Steps

1. ✅ Complete all tests in Step 8
2. ✅ Review `PROJECT_ANALYSIS_REPORT.md` for detailed analysis
3. ✅ Add sample data (vehicles, drivers, requests) for demo
4. ✅ Customize UI/UX based on user feedback
5. ✅ Add missing features (map widgets, calendar view, notifications)
6. ✅ Prepare for production deployment

**Good luck with your project! 🚀**
