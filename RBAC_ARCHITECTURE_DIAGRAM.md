# 🏗️ MESSOB-FMS RBAC ARCHITECTURE

## SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MESSOB-FMS ARCHITECTURE                          │
│                     Role-Based Access Control System                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND LAYER                                │
│                         (React + Vite + Zustand)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   Login.jsx  │  │ useUserStore │  │ ProtectedRoute│                  │
│  │              │  │              │  │              │                  │
│  │ • Username   │→ │ • login()    │→ │ • Role check │                  │
│  │ • Password   │  │ • logout()   │  │ • Redirect   │                  │
│  │ • Validation │  │ • Persist    │  │              │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│         │                  │                  │                          │
│         └──────────────────┴──────────────────┘                          │
│                            │                                             │
│                            ▼                                             │
│                   ┌─────────────────┐                                    │
│                   │  Role Detection │                                    │
│                   ├─────────────────┤                                    │
│                   │ fleet_manager   │ → Admin                            │
│                   │ fleet_dispatcher│ → Dispatcher                       │
│                   │ fleet_user      │ → Staff                            │
│                   │ driver          │ → Driver                           │
│                   └─────────────────┘                                    │
│                            │                                             │
└────────────────────────────┼─────────────────────────────────────────────┘
                             │
                             │ HTTPS/TLS 1.3
                             │ JSON Payload
                             │
┌────────────────────────────▼─────────────────────────────────────────────┐
│                         AUTHENTICATION LAYER                             │
│                        (Odoo Session + JWT)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  POST /web/session/authenticate                                          │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ {                                                             │        │
│  │   "db": "messob_db",                                          │        │
│  │   "login": "tigist.haile@mesob.com",                          │        │
│  │   "password": "dispatcher123"                                 │        │
│  │ }                                                             │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                            │                                             │
│                            ▼                                             │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ Odoo Authentication                                           │        │
│  │ • Validate credentials (bcrypt)                               │        │
│  │ • Create session                                              │        │
│  │ • Return user data + roles                                    │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                            │                                             │
└────────────────────────────┼─────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      AUTHORIZATION LAYER (RBAC)                          │
│                    (security.xml + ir.model.access.csv)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      ROLE HIERARCHY                               │  │
│  │                                                                   │  │
│  │              ┌─────────────────────────┐                         │  │
│  │              │   Fleet Manager (Admin) │                         │  │
│  │              │   group_fleet_manager   │                         │  │
│  │              │   • Full CRUD           │                         │  │
│  │              │   • User Management     │                         │  │
│  │              │   • System Config       │                         │  │
│  │              └───────────┬─────────────┘                         │  │
│  │                          │ inherits                              │  │
│  │                          ▼                                       │  │
│  │              ┌─────────────────────────┐                         │  │
│  │              │   Fleet Dispatcher      │                         │  │
│  │              │   group_fleet_dispatcher│                         │  │
│  │              │   • Approve Requests    │                         │  │
│  │              │   • Assign Resources    │                         │  │
│  │              │   • View All Data       │                         │  │
│  │              └───────────┬─────────────┘                         │  │
│  │                          │ inherits                              │  │
│  │                          ▼                                       │  │
│  │              ┌─────────────────────────┐                         │  │
│  │              │   Fleet User (Staff)    │                         │  │
│  │              │   group_fleet_user      │                         │  │
│  │              │   • Create Requests     │                         │  │
│  │              │   • View Own Data       │                         │  │
│  │              │   • Track Trips         │                         │  │
│  │              └─────────────────────────┘                         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API CONTROLLER LAYER                             │
│                      (controllers/fleet_api.py)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ Permission Check Example:                                     │        │
│  │                                                               │        │
│  │ def approve_trip_request(self, request_id):                   │        │
│  │     # Check dispatcher permissions                            │        │
│  │     is_dispatcher = request.env.user.has_group(               │        │
│  │         'mesob_fleet_customizations.group_fleet_dispatcher'   │        │
│  │     ) or request.env.user.has_group(                          │        │
│  │         'mesob_fleet_customizations.group_fleet_manager'      │        │
│  │     )                                                          │        │
│  │     if not is_dispatcher:                                     │        │
│  │         return {                                              │        │
│  │             'success': False,                                 │        │
│  │             'error': 'Insufficient permissions'               │        │
│  │         }                                                      │        │
│  │     # ... proceed with approval                               │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ Data Filtering Example:                                       │        │
│  │                                                               │        │
│  │ def _list_trip_requests(self):                                │        │
│  │     if is_dispatcher:                                         │        │
│  │         # Dispatcher sees ALL requests                        │        │
│  │         records = request.env['mesob.trip.request']           │        │
│  │             .search_read([], FIELDS)                          │        │
│  │     else:                                                      │        │
│  │         # Staff sees ONLY own requests                        │        │
│  │         employee = request.env['hr.employee'].search([        │        │
│  │             ('user_id', '=', request.env.uid)                 │        │
│  │         ], limit=1)                                            │        │
│  │         records = request.env['mesob.trip.request']           │        │
│  │             .search_read([                                     │        │
│  │                 ('employee_id', '=', employee.id)             │        │
│  │             ], FIELDS)                                         │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA ACCESS LAYER                               │
│                        (Odoo ORM + PostgreSQL)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    ACCESS CONTROL MATRIX                          │  │
│  │                  (ir.model.access.csv)                            │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ Model              │ Base │ User │ Dispatcher │ Manager │         │  │
│  ├────────────────────┼──────┼──────┼────────────┼─────────┤         │  │
│  │ Trip Request       │  R   │ R,C  │   R,W,C    │  CRUD   │         │  │
│  │ Trip Assignment    │  R   │  R   │   R,W,C    │  CRUD   │         │  │
│  │ Fuel Log           │  R   │  R   │   R,W,C    │  CRUD   │         │  │
│  │ Maintenance Log    │  R   │  R   │     R      │  CRUD   │         │  │
│  │ GPS Log            │  R   │  R   │   R,W,C    │  CRUD   │         │  │
│  │ Fleet Alert        │  R   │  R   │   R,W,C    │  CRUD   │         │  │
│  │ Geofence           │  R   │  -   │    R,W     │  CRUD   │         │  │
│  │ HR Employee        │  R   │  R   │     R      │  CRUD   │         │  │
│  │ Inventory Alloc    │  R   │  R   │     R      │  CRUD   │         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  Legend: R=Read, W=Write, C=Create, D=Delete                             │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                                │
│                         (Odoo Models)                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ Business Rule Enforcement:                                    │        │
│  │                                                               │        │
│  │ BR-1: Only dispatchers can approve                            │        │
│  │ ✅ Enforced in: action_approve() method                       │        │
│  │ ✅ Enforced in: API controller permission check               │        │
│  │                                                               │        │
│  │ BR-2: No vehicle double-booking                               │        │
│  │ ✅ Enforced in: _check_conflicts() via SQL                    │        │
│  │ ✅ Checked before: assignment creation                        │        │
│  │                                                               │        │
│  │ BR-3: No driver double-booking                                │        │
│  │ ✅ Enforced in: _check_conflicts() via SQL                    │        │
│  │ ✅ Checked before: assignment creation                        │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      INTEGRATION LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────┐  ┌──────────────────────┐                     │
│  │   HR System          │  │  Inventory System    │                     │
│  │   Integration        │  │  Integration         │                     │
│  ├──────────────────────┤  ├──────────────────────┤                     │
│  │                      │  │                      │                     │
│  │ • Cron Sync (hourly) │  │ • Part Allocation    │                     │
│  │ • Webhook Support    │  │ • Stock Movement     │                     │
│  │ • Deduplication      │  │ • Cross-Linking      │                     │
│  │ • external_hr_id     │  │ • Traceability       │                     │
│  │                      │  │                      │                     │
│  │ Mock HR Server:      │  │ Products:            │                     │
│  │ localhost:5000       │  │ • Air Filter         │                     │
│  │                      │  │ • Brake Pads         │                     │
│  │ 12 Employees:        │  │ • Engine Oil         │                     │
│  │ • 8 Drivers          │  │ • Fuel (Gasoline)    │                     │
│  │ • 4 Staff            │  │                      │                     │
│  └──────────────────────┘  └──────────────────────┘                     │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AUTHENTICATION FLOW DIAGRAM

```
┌──────────┐                                                    ┌──────────┐
│  User    │                                                    │  Odoo    │
│ (Browser)│                                                    │  Server  │
└────┬─────┘                                                    └────┬─────┘
     │                                                               │
     │ 1. Enter username/password                                   │
     │    (e.g., tigist.haile@mesob.com / dispatcher123)            │
     │                                                               │
     │ 2. POST /web/session/authenticate                            │
     │    { db, login, password }                                   │
     ├──────────────────────────────────────────────────────────────>│
     │                                                               │
     │                                    3. Validate credentials    │
     │                                       (bcrypt hash check)     │
     │                                                               │
     │                                    4. Query user groups       │
     │                                       (res.groups)            │
     │                                                               │
     │                                    5. Create session          │
     │                                       (session_id)            │
     │                                                               │
     │ 6. Return user data + roles                                  │
     │<──────────────────────────────────────────────────────────────┤
     │    {                                                          │
     │      uid: 5,                                                  │
     │      name: "Tigist Haile",                                    │
     │      email: "tigist.haile@mesob.com",                         │
     │      roles: ["fleet_dispatcher"],                             │
     │      employee_id: 2                                           │
     │    }                                                          │
     │                                                               │
     │ 7. Store in localStorage (Zustand persist)                   │
     │    + Set role: "Dispatcher"                                  │
     │                                                               │
     │ 8. Redirect to /dashboard                                    │
     │                                                               │
     │ 9. All subsequent API calls include session cookie           │
     │                                                               │
     │ 10. API endpoint checks permissions:                         │
     │     has_group('group_fleet_dispatcher')                      │
     │                                                               │
     │ 11. If authorized → return data                              │
     │     If not → return 403 error                                │
     │                                                               │
```

---

## AUTHORIZATION FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      API REQUEST AUTHORIZATION                           │
└─────────────────────────────────────────────────────────────────────────┘

User Request: POST /api/fleet/trip-requests/123/approve
Session: tigist.haile@mesob.com (uid=5)

     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Extract session from cookie                              │
│    → uid = 5                                                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Load user from database                                   │
│    → request.env.user (res.users, id=5)                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Check group membership                                    │
│    → has_group('mesob_fleet_customizations.group_fleet_dispatcher') │
│    → Query: res_groups_users_rel table                       │
│    → Result: TRUE (user 5 is in group 2)                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Permission granted                                        │
│    → Proceed with approval logic                             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Execute business logic                                    │
│    → trip_request.action_approve()                           │
│    → Update state: pending → approved                        │
│    → Log audit trail (mail.thread)                           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Return success response                                   │
│    → { success: true, message: "Approved" }                  │
└─────────────────────────────────────────────────────────────┘


ALTERNATIVE FLOW (Permission Denied):

User Request: POST /api/fleet/trip-requests/123/approve
Session: dawit.bekele@mesob.com (uid=7, Staff role)

     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 1-2. Extract session, load user (uid=7)                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Check group membership                                    │
│    → has_group('mesob_fleet_customizations.group_fleet_dispatcher') │
│    → Query: res_groups_users_rel table                       │
│    → Result: FALSE (user 7 is NOT in group 2)                │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Permission DENIED                                         │
│    → Return error immediately                                │
│    → { success: false, error: "Insufficient permissions" }   │
└─────────────────────────────────────────────────────────────┘
```

---

## DATA FILTERING FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATA FILTERING BY ROLE                                │
└─────────────────────────────────────────────────────────────────────────┘

Request: GET /api/fleet/trip-requests

┌──────────────────────────────────────────────────────────────────────┐
│ User: tigist.haile@mesob.com (Dispatcher)                            │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ is_dispatcher?     │
                    │ → TRUE             │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Query ALL requests │
                    │ No filter applied  │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Return 100 requests│
                    │ (all users)        │
                    └────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│ User: dawit.bekele@mesob.com (Staff)                                 │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ is_dispatcher?     │
                    │ → FALSE            │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Get employee_id    │
                    │ → employee_id = 3  │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Query with filter: │
                    │ employee_id = 3    │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Return 5 requests  │
                    │ (own only)         │
                    └────────────────────┘
```

---

## CONFLICT PREVENTION FLOW (BR-2, BR-3)

```
┌─────────────────────────────────────────────────────────────────────────┐
│              VEHICLE/DRIVER CONFLICT PREVENTION                          │
└─────────────────────────────────────────────────────────────────────────┘

Dispatcher assigns:
  Vehicle: Toyota Corolla (id=1)
  Driver: Abebe Kebede (id=2)
  Time: 2026-05-01 10:00 - 14:00

     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Check vehicle conflicts (BR-2)                            │
│    SQL Query:                                                │
│    SELECT ta.id, tr.name                                     │
│    FROM mesob_trip_assignment ta                             │
│    JOIN mesob_trip_request tr ON tr.id = ta.trip_request_id  │
│    WHERE ta.state IN ('assigned', 'in_progress')             │
│      AND ta.vehicle_id = 1                                   │
│      AND ta.start_datetime < '2026-05-01 14:00'              │
│      AND ta.stop_datetime > '2026-05-01 10:00'               │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Conflict found?    │
                    └────────┬───────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
               YES                       NO
                │                         │
                ▼                         ▼
    ┌───────────────────────┐   ┌────────────────────────┐
    │ Return error:         │   │ 2. Check driver        │
    │ "Vehicle already      │   │    conflicts (BR-3)    │
    │  assigned to trip X"  │   │    (same SQL logic)    │
    └───────────────────────┘   └────────┬───────────────┘
                                         │
                                         ▼
                                ┌────────────────────┐
                                │ Conflict found?    │
                                └────────┬───────────┘
                                         │
                            ┌────────────┴────────────┐
                            │                         │
                           YES                       NO
                            │                         │
                            ▼                         ▼
                ┌───────────────────────┐   ┌────────────────────────┐
                │ Return error:         │   │ 3. Create assignment   │
                │ "Driver already       │   │    via raw SQL         │
                │  assigned to trip Y"  │   │    (bypass ORM)        │
                └───────────────────────┘   └────────┬───────────────┘
                                                     │
                                                     ▼
                                            ┌────────────────────────┐
                                            │ 4. Update trip request │
                                            │    state = 'assigned'  │
                                            └────────┬───────────────┘
                                                     │
                                                     ▼
                                            ┌────────────────────────┐
                                            │ 5. Update vehicle      │
                                            │    status = 'in_use'   │
                                            └────────┬───────────────┘
                                                     │
                                                     ▼
                                            ┌────────────────────────┐
                                            │ 6. Notify requester    │
                                            │    (mail.thread)       │
                                            └────────────────────────┘
```

---

## AUDIT TRAIL FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUDIT LOGGING (FR-5.3)                           │
└─────────────────────────────────────────────────────────────────────────┘

Every critical action is logged via mail.thread:

┌──────────────────────────────────────────────────────────────────────┐
│ Action: Trip Request Approved                                        │
├──────────────────────────────────────────────────────────────────────┤
│ Timestamp: 2026-04-28 14:30:15                                       │
│ User: tigist.haile@mesob.com (uid=5)                                 │
│ Model: mesob.trip.request                                            │
│ Record: TR-2026-0042                                                 │
│ Changes:                                                             │
│   • state: pending → approved                                        │
│   • approved_at: 2026-04-28 14:30:15                                 │
│   • dispatcher_id: 5                                                 │
│ IP Address: 192.168.1.100                                            │
│ Session ID: abc123def456                                             │
└──────────────────────────────────────────────────────────────────────┘

Logged fields (tracking=True):
  • state (all transitions)
  • assigned_vehicle_id
  • assigned_driver_id
  • dispatcher_id
  • rejection_reason
  • All datetime stamps

Accessible by: Fleet Manager only
Location: Chatter (message history) + Database (mail_message table)
```

---

**This diagram provides a complete visual reference for understanding the RBAC architecture!**

**Last Updated:** April 28, 2026  
**Version:** 1.0