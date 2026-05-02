# 🔑 MESSOB-FMS CREDENTIALS - QUICK REFERENCE CARD

## INSTANT ACCESS CREDENTIALS FOR DEMO

---

### 🔴 **ADMIN (Full Access)**
```
Username: admin
Password: admin
Role: Fleet Manager
Access: Everything
```

---

### 🟡 **DISPATCHER (Approve & Assign)**
```
Username: tigist.haile@mesob.com
Password: dispatcher123
Role: Fleet Dispatcher
Access: Approve requests, assign vehicles/drivers, view all data
```

---

### 🟢 **STAFF (Request Only)**
```
Username: dawit.bekele@mesob.com
Password: staff123
Role: Fleet User
Access: Create requests, view own requests only
```

---

### 🔵 **DRIVER (8 Available)**
```
Username: abebe.kebede@mesob.com
Password: driver123
License: DL-ETH-001
```

---

## DEMO SCENARIOS

### ✅ **Scenario 1: Staff Creates Request**
1. Login as: `dawit.bekele@mesob.com` / `staff123`
2. Navigate to: My Requests → New Request
3. Fill wizard: Purpose, Vehicle Type, Dates, Locations
4. Submit → Status: Pending
5. ❌ Try to approve own request → **BLOCKED** (No permission)

---

### ✅ **Scenario 2: Dispatcher Approves & Assigns**
1. Login as: `tigist.haile@mesob.com` / `dispatcher123`
2. Navigate to: Approval Queue
3. See ALL pending requests (not just own)
4. Click request → Approve
5. Assign Vehicle: Toyota Corolla (Plate: AA-12345)
6. Assign Driver: Abebe Kebede
7. ✅ Check conflicts → System prevents double-booking

---

### ✅ **Scenario 3: Admin Manages Fleet**
1. Login as: `admin` / `admin`
2. Navigate to: Manage Fleet → Vehicles
3. Create new vehicle
4. Navigate to: User Management
5. Create new user, assign role
6. View audit logs

---

### ✅ **Scenario 4: Test RBAC Enforcement**
```bash
# As Staff (dawit.bekele@mesob.com):
✅ Create request → SUCCESS
❌ View all requests → FAIL (only sees own)
❌ Approve request → FAIL (button hidden)
❌ Access fuel logs → FAIL (403 error)

# As Dispatcher (tigist.haile@mesob.com):
✅ View all requests → SUCCESS
✅ Approve request → SUCCESS
✅ Assign vehicle → SUCCESS
❌ Delete vehicle → FAIL (no permission)
❌ Manage users → FAIL (no permission)

# As Admin (admin):
✅ Everything → SUCCESS
```

---

## HR INTEGRATION TEST

### **Start Mock HR Server**
```bash
python mock_hr_server.py
# Server runs at http://localhost:5000
```

### **Configure Odoo**
```
Settings → System Parameters
Key: mesob.hr_sync_url
Value: http://localhost:5000/api/employees
```

### **Trigger Sync**
```
Settings → Scheduled Actions
Find: "HR Employee Sync"
Click: Run Manually
```

### **Verify**
```
Employees → Drivers
Should see 8 drivers:
- Abebe Kebede (EMP-DRV-001)
- Sara Tesfaye (EMP-DRV-002)
- Yonas Girma (EMP-DRV-003)
- Mekdes Alemu (EMP-DRV-004)
- Biruk Tadesse (EMP-DRV-005) ⚠️ License expiring soon
- Hana Worku (EMP-DRV-006)
- Tesfaye Mulugeta (EMP-DRV-007)
- Liya Solomon (EMP-DRV-008)
```

---

## INVENTORY INTEGRATION TEST

### **Allocate Part to Vehicle**
```
1. Login as admin
2. Navigate to: Maintenance → Maintenance Logs
3. Create new maintenance log:
   - Vehicle: Toyota Corolla
   - Type: Repair
   - Description: Brake pad replacement
4. Add inventory allocation:
   - Product: Brake Pads
   - Quantity: 4
5. Save → Stock movement created automatically
```

### **Verify Cross-Linking**
```
Inventory → Products → Brake Pads
→ View allocations
→ See which vehicles used this part
→ Link to maintenance job
```

---

## CONFLICT PREVENTION TEST (BR-2, BR-3)

### **Test Vehicle Double-Booking**
```
1. Login as dispatcher
2. Approve Request #1:
   - Vehicle: Toyota Corolla
   - Driver: Abebe Kebede
   - Time: 2026-05-01 08:00 - 12:00
3. Try to approve Request #2:
   - Vehicle: Toyota Corolla (same)
   - Driver: Sara Tesfaye
   - Time: 2026-05-01 10:00 - 14:00 (overlaps)
4. ❌ System blocks: "Vehicle is already assigned to trip X"
```

### **Test Driver Double-Booking**
```
1. Approve Request #1:
   - Vehicle: Toyota Corolla
   - Driver: Abebe Kebede
   - Time: 2026-05-01 08:00 - 12:00
2. Try to approve Request #2:
   - Vehicle: Honda Civic (different)
   - Driver: Abebe Kebede (same)
   - Time: 2026-05-01 10:00 - 14:00 (overlaps)
3. ❌ System blocks: "Driver is already assigned to trip X"
```

---

## ROLE PERMISSION MATRIX

| Feature | Staff | Dispatcher | Manager |
|---------|-------|------------|---------|
| Create Request | ✅ | ✅ | ✅ |
| View Own Requests | ✅ | ✅ | ✅ |
| View All Requests | ❌ | ✅ | ✅ |
| Approve Request | ❌ | ✅ | ✅ |
| Assign Vehicle | ❌ | ✅ | ✅ |
| View Fuel Logs | ❌ | ✅ | ✅ |
| Create Fuel Log | ❌ | ✅ | ✅ |
| View Maintenance | ❌ | ✅ | ✅ |
| Create Maintenance | ❌ | ❌ | ✅ |
| Delete Vehicle | ❌ | ❌ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |
| View Audit Logs | ❌ | ❌ | ✅ |

---

## SYSTEM URLS

### **Frontend (React)**
```
http://localhost:5173
```

### **Backend (Odoo)**
```
http://localhost:8069
```

### **Mock HR Server**
```
http://localhost:5000/api/employees
```

### **Mock GPS Server**
```
http://localhost:5001/webhook/gps
```

---

## TROUBLESHOOTING

### **Cannot Login**
```
1. Check Odoo is running: http://localhost:8069
2. Verify database: messob_db
3. Reset password: Settings → Users → Reset Password
```

### **HR Sync Not Working**
```
1. Check mock server running: python mock_hr_server.py
2. Verify system parameter: mesob.hr_sync_url
3. Check logs: Settings → Technical → Logging
```

### **Permission Denied**
```
1. Check user groups: Settings → Users → [User] → Groups
2. Verify role assignment: Should have Fleet User/Dispatcher/Manager
3. Re-login to refresh permissions
```

---

## PRESENTATION TIPS

### **Start with Admin**
- Show full system capabilities
- Demonstrate all modules working

### **Switch to Dispatcher**
- Show approval workflow
- Demonstrate conflict prevention
- Show resource assignment

### **Switch to Staff**
- Show request creation
- Demonstrate permission restrictions
- Try to access forbidden features (fails gracefully)

### **Highlight Integrations**
- HR sync (no manual creation)
- Inventory allocation (parts to vehicles)
- GPS tracking (real-time updates)

### **Emphasize Security**
- 3-tier RBAC
- Audit logging
- Conflict prevention
- Password hashing

---

**Print this card for quick reference during demo!**

**Last Updated:** April 28, 2026  
**Version:** 1.0