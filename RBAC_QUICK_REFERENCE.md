# 🔐 RBAC QUICK REFERENCE GUIDE
## MESSOB Fleet Management System

---

## 👥 WHO CAN DO WHAT?

### 📝 **TRIP REQUESTS**

| Action | Fleet User | Driver | Mechanic | Dispatcher | Manager |
|--------|-----------|--------|----------|------------|---------|
| Create own request | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own requests | ✅ | ✅ | ✅ | ✅ | ✅ |
| View ALL requests | ❌ | ❌ | ❌ | ✅ | ✅ |
| Approve requests | ❌ | ❌ | ❌ | ✅ | ✅ |
| Reject requests | ❌ | ❌ | ❌ | ✅ | ✅ |
| Assign vehicle/driver | ❌ | ❌ | ❌ | ✅ | ✅ |
| Delete requests | ❌ | ❌ | ❌ | ❌ | ✅ |

### 🚗 **VEHICLES**

| Action | Fleet User | Driver | Mechanic | Dispatcher | Manager |
|--------|-----------|--------|----------|------------|---------|
| View available vehicles | ✅ | ✅ | ✅ | ✅ | ✅ |
| View ALL vehicles | ❌ | ✅ | ✅ | ✅ | ✅ |
| Update assigned vehicle | ❌ | ✅ | ✅ | ✅ | ✅ |
| Update any vehicle | ❌ | ❌ | ✅ | ✅ | ✅ |
| Create vehicles | ❌ | ❌ | ❌ | ✅ | ✅ |
| Delete vehicles | ❌ | ❌ | ❌ | ❌ | ✅ |

### 🛠️ **MAINTENANCE**

| Action | Fleet User | Driver | Mechanic | Dispatcher | Manager |
|--------|-----------|--------|----------|------------|---------|
| View maintenance logs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create maintenance | ❌ | ❌ | ✅ | ❌ | ✅ |
| Update maintenance | ❌ | ❌ | ✅ | ❌ | ✅ |
| Delete maintenance | ❌ | ❌ | ❌ | ❌ | ✅ |

### ⛽ **FUEL LOGS**

| Action | Fleet User | Driver | Mechanic | Dispatcher | Manager |
|--------|-----------|--------|----------|------------|---------|
| View fuel logs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create fuel logs | ❌ | ✅ | ✅ | ✅ | ✅ |
| Update fuel logs | ❌ | ✅ | ✅ | ✅ | ✅ |
| Delete fuel logs | ❌ | ❌ | ❌ | ❌ | ✅ |

### 📍 **GPS TRACKING**

| Action | Fleet User | Driver | Mechanic | Dispatcher | Manager |
|--------|-----------|--------|----------|------------|---------|
| View own vehicle GPS | ✅ | ✅ | ❌ | ✅ | ✅ |
| View ALL vehicle GPS | ❌ | ❌ | ❌ | ✅ | ✅ |
| Update location | ❌ | ✅ | ❌ | ✅ | ✅ |
| Delete GPS logs | ❌ | ❌ | ❌ | ❌ | ✅ |

### 👤 **EMPLOYEES**

| Action | Fleet User | Driver | Mechanic | Dispatcher | Manager |
|--------|-----------|--------|----------|------------|---------|
| View own profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| View drivers | ❌ | ❌ | ❌ | ✅ | ✅ |
| View ALL employees | ❌ | ❌ | ❌ | ❌ | ✅ |
| Update employees | ❌ | ❌ | ❌ | ❌ | ✅ |
| Create employees | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete employees | ❌ | ❌ | ❌ | ❌ | ✅ |

### 📊 **ANALYTICS & REPORTS**

| Action | Fleet User | Driver | Mechanic | Dispatcher | Manager |
|--------|-----------|--------|----------|------------|---------|
| View basic KPIs | ✅ | ✅ | ✅ | ✅ | ✅ |
| View full dashboard | ❌ | ❌ | ❌ | ✅ | ✅ |
| Predictive analytics | ❌ | ❌ | ❌ | ❌ | ✅ |
| Export data | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🎭 ROLE DESCRIPTIONS

### 👤 **FLEET USER (Staff)**
**Who:** Regular employees who need transportation  
**Can:** Request trips, view own requests, see available vehicles  
**Cannot:** Approve requests, assign vehicles, access analytics

### 🚗 **FLEET DRIVER**
**Who:** Drivers who operate vehicles  
**Can:** View assigned trips, start/complete trips, update location, log fuel  
**Cannot:** Approve requests, assign vehicles, access full analytics

### 🔧 **FLEET MECHANIC**
**Who:** Maintenance and repair staff  
**Can:** Create/update maintenance logs, service records, view all vehicles  
**Cannot:** Approve trips, assign vehicles, delete records

### 📋 **FLEET DISPATCHER**
**Who:** Operations staff managing daily fleet activities  
**Can:** Approve/reject requests, assign vehicles/drivers, track all vehicles, view analytics  
**Cannot:** Delete records, manage employees, configure system

### 👔 **FLEET MANAGER**
**Who:** Senior management with full oversight  
**Can:** Everything (full access to all features, analytics, and administration)  
**Special:** Only role that can delete records

---

## 🔑 ROLE HIERARCHY

```
Fleet Manager (Full Access)
    ↓ inherits all from
Fleet Dispatcher (Operations Control)
    ↓ inherits all from
Fleet User (Base Access)
    ↑ parallel specialized roles
Fleet Driver          Fleet Mechanic
(Trip Execution)      (Maintenance)
```

---

## 📱 API ACCESS BY ROLE

### Fleet User APIs:
- ✅ `/api/mobile/auth/login`
- ✅ `/api/mobile/user/trip-requests`
- ✅ `/api/mobile/quick-request`
- ✅ `/api/fleet/trip-requests` (own only)

### Driver APIs (+ all User APIs):
- ✅ `/api/mobile/driver/assignments`
- ✅ `/api/mobile/trip/<id>/start`
- ✅ `/api/mobile/trip/<id>/complete`
- ✅ `/api/mobile/trip/<id>/update-location`
- ✅ `/api/mobile/vehicles/nearby`

### Mechanic APIs (+ all User APIs):
- ✅ `/api/fleet/maintenance-logs`
- ✅ `/api/fleet/fuel-logs`

### Dispatcher APIs (+ all above):
- ✅ `/api/fleet/dashboard`
- ✅ `/api/fleet/vehicles`
- ✅ `/api/fleet/trip-requests` (all)
- ✅ `/api/fleet/trip-requests/<id>/approve`
- ✅ `/api/fleet/trip-requests/<id>/reject`
- ✅ `/api/fleet/trip-requests/<id>/assign`
- ✅ `/api/fleet/gps/update`
- ✅ `/api/fleet/vehicles/<id>/location`
- ✅ `/api/fleet/alerts`
- ✅ `/api/fleet/analytics/kpis`

### Manager APIs:
- ✅ **ALL ENDPOINTS** (full access)
- ✅ `/api/fleet/maintenance/predictions`
- ✅ All DELETE operations

---

## 🚨 COMMON ACCESS SCENARIOS

### ✅ **Scenario 1: Employee Requests a Trip**
1. **Fleet User** logs in
2. Creates trip request with details
3. Submits request → State: `pending`
4. **Dispatcher** receives notification
5. **Dispatcher** approves → State: `approved`
6. **Dispatcher** assigns vehicle & driver → State: `assigned`
7. **Driver** starts trip → State: `in_progress`
8. **Driver** completes trip → State: `completed`

### ✅ **Scenario 2: Driver Executes Trip**
1. **Driver** logs in to mobile app
2. Views assigned trips
3. Starts trip (updates location)
4. Updates GPS during journey
5. Logs fuel if needed
6. Completes trip with odometer reading

### ✅ **Scenario 3: Mechanic Performs Maintenance**
1. **Mechanic** logs in
2. Views vehicles needing maintenance
3. Creates maintenance log
4. Updates vehicle status
5. Logs parts used and costs
6. Marks maintenance complete

### ✅ **Scenario 4: Dispatcher Monitors Fleet**
1. **Dispatcher** logs in to dashboard
2. Views all pending trip requests (oldest first)
3. Checks vehicle availability
4. Tracks real-time GPS locations
5. Responds to alerts
6. Reviews daily analytics

### ✅ **Scenario 5: Manager Reviews Performance**
1. **Manager** logs in
2. Views comprehensive dashboard
3. Analyzes KPIs and trends
4. Reviews predictive maintenance
5. Exports reports
6. Makes strategic decisions

---

## 🔒 SECURITY FEATURES

### ✅ Multi-Layer Protection:
1. **Model Access Rights** - Basic CRUD permissions
2. **Record Rules** - Row-level data filtering
3. **API Guards** - Endpoint-level role checks
4. **Business Logic** - Method-level validation

### ✅ Data Isolation:
- Users see **only their own data**
- Drivers see **only assigned vehicles**
- Dispatchers see **all operational data**
- Managers see **everything**

### ✅ Audit Trail:
- All actions logged with user ID
- Timestamps on all records
- State transitions tracked
- Cannot be modified by users

---

## 📞 NEED HELP?

### Assigning Roles:
1. Go to **Settings > Users & Companies > Users**
2. Select user
3. Go to **Access Rights** tab
4. Check appropriate Fleet group(s)
5. Save

### Checking User Permissions:
1. Log in as user
2. Try to access feature
3. If denied, check assigned groups
4. Verify employee record exists
5. Contact administrator if issues persist

---

**Quick Reference Version:** 1.0  
**Last Updated:** May 16, 2026  
**Status:** ✅ PRODUCTION READY
