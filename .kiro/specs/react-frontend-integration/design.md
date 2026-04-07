# Design Document: React Frontend Integration

## Overview

The MESSOB Fleet Management System (FMS) frontend is a React 18 + Vite application running at `localhost:3000`. It communicates with an Odoo 19 backend at `localhost:8069` via a Vite dev-server proxy. The integration uses Odoo's JSON-RPC session-based authentication: the browser receives a `session_id` cookie after login, and every subsequent API call must include that cookie.

The root cause of the "Invalid JSON" / "Unexpected token '<'" bug is a broken Vite proxy configuration. Without `cookieDomainRewrite`, Odoo's `Set-Cookie` header sets the domain to `localhost:8069`, which the browser rejects for `localhost:3000`. The `session_id` cookie is never stored, so every API call is unauthenticated, and Odoo returns an HTML login redirect instead of JSON.

This design document covers the fixes and full implementation plan for all integration points.

---

## Architecture

```
Browser (localhost:3000)
  │
  │  fetch("/api/...", { credentials: "include" })
  ▼
Vite Dev Server Proxy  ← cookieDomainRewrite + SameSite rewrite
  │
  │  HTTP + Cookie: session_id=...
  ▼
Odoo 19 (localhost:8069)
  │  controllers/fleet_api.py
  │  controllers/mobile_api.py
  ▼
PostgreSQL (Odoo ORM)
```

```mermaid
sequenceDiagram
    participant B as Browser (3000)
    participant P as Vite Proxy
    participant O as Odoo (8069)

    B->>P: POST /api/mobile/auth/login {username, password}
    P->>O: POST /api/mobile/auth/login (forwarded)
    O-->>P: 200 OK + Set-Cookie: session_id=abc; Domain=localhost
    P-->>B: 200 OK + Set-Cookie: session_id=abc; Domain=localhost; SameSite=Lax
    Note over B: Browser stores session_id cookie for localhost

    B->>P: GET /api/fleet/dashboard (Cookie: session_id=abc)
    P->>O: GET /api/fleet/dashboard (Cookie: session_id=abc)
    O-->>P: 200 OK { success: true, data: {...} }
    P-->>B: 200 OK { success: true, data: {...} }
```

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + Vite 5 |
| State management | Zustand + persist middleware |
| Routing | React Router v6 |
| UI components | shadcn/ui + Tailwind CSS |
| HTTP | Native `fetch` with `credentials: "include"` |
| Backend | Odoo 19 (Python) |
| Database | PostgreSQL (via Odoo ORM) |

---

## Components and Interfaces

### 1. Vite Proxy Fix (`frontend/vite.config.js`)

The proxy must be updated to rewrite cookie domains and strip `SameSite=None; Secure` attributes that prevent the browser from storing the session cookie in a non-HTTPS dev environment.

**Current (broken):**
```js
'/api': { target: 'http://localhost:8069', changeOrigin: true, secure: false }
```

**Required fix:**
```js
'/api': {
  target: 'http://localhost:8069',
  changeOrigin: true,
  secure: false,
  cookieDomainRewrite: "localhost",
  cookiePathRewrite: { "*": "/" },
  configure: (proxy) => {
    proxy.on('proxyRes', (proxyRes) => {
      const setCookie = proxyRes.headers['set-cookie'];
      if (setCookie) {
        proxyRes.headers['set-cookie'] = setCookie.map(c =>
          c.replace(/; SameSite=None/gi, '; SameSite=Lax')
           .replace(/; Secure/gi, '')
        );
      }
    });
  }
}
```

Apply the same fix to the `/web` proxy entry. The `cookieDomainRewrite: "localhost"` rewrites Odoo's `Set-Cookie: Domain=localhost:8069` to `Domain=localhost`, which the browser accepts for `localhost:3000`.

### 2. `api.js` Request Function Fix

The `request()` function must check `Content-Type` before calling `res.json()`. If Odoo returns HTML (session expired), the current code throws an opaque "Unexpected token '<'" error. The fix detects HTML responses and triggers a clean session-expiry redirect.

**Required fix:**
```js
async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // Odoo returned HTML — session expired or unauthenticated
    useUserStore.getState().logout();
    window.location.href = "/login";
    throw new Error("Session expired or backend returned HTML. Please log in again.");
  }

  const data = await res.json();

  // Odoo JSON-RPC session expiry error envelope
  if (data?.error?.code === 100 || data?.error?.message?.includes("Session Expired")) {
    useUserStore.getState().logout();
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) throw new Error(data.error?.message || data.error || "Request failed");
  if (data.success === false) throw new Error(data.error || "Unknown error");
  return data;
}
```

### 3. UserStore (`frontend/src/store/useUserStore.js`)

The `logout()` action must also clear localStorage explicitly to ensure the persisted state is removed even if the Zustand persist middleware has not yet flushed.

**Required addition to `logout()`:**
```js
logout: async () => {
  try { await authApi.logout(); } catch (_) { /* ignore */ }
  localStorage.removeItem("messob-auth");
  set({ user: null, isAuthenticated: false, loginError: null });
},
```

The `partialize` config already excludes `loginError` — this is correct and must be preserved.

### 4. Role Detection Logic

Role priority is enforced in `useUserStore.login()`. The mapping from Odoo groups to frontend roles:

| Odoo Group | Frontend Role |
|---|---|
| `group_fleet_manager` | `Admin` |
| `group_fleet_dispatcher` (no manager) | `Dispatcher` |
| `group_fleet_user` (no dispatcher/manager) | `Staff` |
| `driver` flag (no fleet groups) | `Driver` |
| empty roles array | `Admin` (Odoo superadmin) |

The current implementation in `useUserStore.js` is correct. No changes needed to role detection logic.

### 5. Sidebar Driver Role Fix (`frontend/src/components/shared/Sidebar.jsx`)

The `Driver` role is defined in the store but no `menuItems` entry includes `"Driver"` in its `roles` array. A Driver user sees an empty sidebar. Fix by adding `"Driver"` to the Dashboard and My Requests items:

```js
const menuItems = [
  { name: "Dashboard",       path: "/dashboard",          icon: LayoutDashboard, roles: ["Staff", "Dispatcher", "Admin", "Driver"] },
  { name: "Request Vehicle", path: "/requests/new",       icon: ClipboardList,   roles: ["Staff", "Admin"] },
  { name: "My Requests",     path: "/my-requests",        icon: ClipboardList,   roles: ["Staff", "Admin", "Driver"] },
  // ... rest unchanged
];
```

### 6. ApprovalQueue Double-Approve Fix (`frontend/src/features/dispatch/ApprovalQueue.jsx`)

The approve button in the table row calls `handleApproveImmediate(req)` AND sets `mode` to `"approve"` simultaneously:

```jsx
// BUG: calls handleApproveImmediate AND sets mode="approve"
onClick={() => { setSelectedReq(req); setMode("approve"); handleApproveImmediate(req); }}
```

Fix: the quick-approve button in the table row should only call `handleApproveImmediate`. The `mode="approve"` path is for the dialog flow and should not be triggered from the table row button.

```jsx
// FIX: table row quick-approve — only call handleApproveImmediate
onClick={() => handleApproveImmediate(req)}
```

### 7. MyRequests Employee Record Fix (`frontend/src/features/requests/MyRequests.jsx`)

The backend returns `{ success: false, error: 'Employee record not found' }` when the logged-in user has no `hr.employee` record (e.g., the Odoo admin user). The frontend currently throws this as an error toast. The fix is to handle this gracefully by showing an empty state with an explanatory message instead of an error toast.

```js
const fetchRequests = useCallback(async () => {
  try {
    const res = await tripApi.listMine();
    setRequests(res.trip_requests || []);
  } catch (err) {
    if (err.message?.includes("Employee record not found")) {
      // Admin user without employee record — show empty state, not error
      setRequests([]);
    } else {
      toast.error("Failed to load requests: " + err.message);
    }
  } finally {
    setLoading(false);
  }
}, []);
```

### 8. Maintenance.jsx Full Implementation

The component is currently a placeholder. It must call `maintenanceApi.list()` and `maintenanceApi.schedules()` in parallel and display:
- Maintenance history table (vehicle, type, date, technician, cost, status)
- Upcoming schedules table (vehicle, type, next due date/odometer, overdue indicator)

**Component structure:**
```
Maintenance
├── Header (title + refresh button)
├── Summary cards (total logs, pending, overdue schedules)
├── Tabs: "History" | "Schedules"
│   ├── History tab: Table of maintenance logs
│   └── Schedules tab: Table of maintenance schedules with overdue badge
└── Loading/error states
```

**API calls:**
```js
const [logsRes, schedulesRes] = await Promise.all([
  maintenanceApi.list(),
  maintenanceApi.schedules(),
]);
```

---

## Data Models

### UserStore State Shape

```ts
interface UserState {
  user: {
    id: number;
    name: string;
    email: string;
    role: "Admin" | "Dispatcher" | "Staff" | "Driver";
    employee_id: number | null;
    is_driver: boolean;
    roles: string[];  // raw Odoo group names
  } | null;
  isAuthenticated: boolean;
  loginError: string | null;  // NOT persisted
}
```

### Persisted localStorage Shape (`"messob-auth"`)

```ts
interface PersistedAuth {
  state: {
    user: UserState["user"];
    isAuthenticated: boolean;
    // loginError is excluded by partialize
  };
  version: number;
}
```

### API Response Shapes

**Login response** (`POST /api/mobile/auth/login`):
```ts
{
  success: true,
  user: { id, name, email, employee_id, is_driver, roles: string[] },
  session_id: string
}
```

**Dashboard response** (`GET /api/fleet/dashboard`):
```ts
{
  success: true,
  data: {
    total_vehicles: number,
    available_vehicles: number,
    active_trips: number,
    pending_requests: number,
    maintenance_due: number,
    total_fuel_cost: number,
    completed_trips: number,
    active_drivers: number
  },
  timestamp: string
}
```

**Trip request shape** (from both `/api/fleet/trip-requests` and `/api/mobile/user/trip-requests`):
```ts
{
  id: number,
  name: string,
  purpose: string,
  state: "draft" | "pending" | "approved" | "rejected" | "assigned" | "in_progress" | "completed" | "cancelled",
  employee_name: string,
  vehicle_category: string,
  start_datetime: string,  // ISO 8601
  end_datetime: string,
  pickup_location: string,
  destination_location: string,
  passenger_count: number,
  priority: "urgent" | "high" | "normal" | "low",
  trip_type: string,
  assigned_vehicle: string | null,
  assigned_driver: string | null,
  create_date: string
}
```

**Maintenance log shape** (`GET /api/fleet/maintenance-logs`):
```ts
{
  id: number,
  vehicle_name: string,
  maintenance_type: string,
  state: string,
  date: string,
  technician: string,
  cost: number,
  description: string,
  odometer: number
}
```

**Maintenance schedule shape** (`GET /api/fleet/maintenance-schedules`):
```ts
{
  id: number,
  vehicle_name: string,
  maintenance_type: string,
  interval_km: number,
  interval_days: number,
  last_odometer: number,
  last_service_date: string,
  next_due_odometer: number,
  next_due_date: string,
  is_overdue: boolean
}
```

### HR Integration

The `hr.employee` model is extended by `models/hr_employee.py` with `is_driver`, `driver_license_number`, and `license_expiry_date` fields. The `_upsert_employee` method syncs employees from the mock HR server (`mock_hr_server.py` at `localhost:5000/api/employees`). The frontend has no HR sync UI — admins manage employees via the Odoo backend. The frontend only reads employee data indirectly through the fleet API (driver names, employee names on trip requests).

The critical dependency: `GET /api/mobile/user/trip-requests` and `POST /api/fleet/trip-requests` both require the authenticated user to have an `hr.employee` record linked via `user_id`. Admin users without an employee record will receive `{ success: false, error: 'Employee record not found' }`. The frontend must handle this gracefully (see MyRequests fix above).

### Inventory Integration

`models/inventory_allocation.py` links `product.product` records to `fleet.vehicle` via `mesob.inventory.allocation`. This is managed entirely through the Odoo backend UI. The frontend has no inventory management screens — fleet vehicles are displayed with their names and categories from the fleet API, which does not expose inventory allocation data. No frontend changes are needed for inventory integration.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Every API call includes credentials

*For any* path and options object passed to the `request()` function, the resulting `fetch()` call must include `credentials: "include"` in its options, regardless of what other options are provided.

**Validates: Requirements 1.4, 4.1**

### Property 2: Content-Type is checked before JSON parsing

*For any* HTTP response whose `Content-Type` header does not include `"application/json"`, the `request()` function must throw an error containing `"Session expired"` or `"backend returned HTML"` and must never call `res.json()`.

**Validates: Requirements 4.3, 4.6**

### Property 3: Role mapping is deterministic and priority-ordered

*For any* `roles` array returned by the Auth_API, the role assigned by `useUserStore.login()` must equal the highest-privilege role in the array, following the priority order: `fleet_manager` → Admin, `fleet_dispatcher` → Dispatcher, `fleet_user` → Staff, `driver` → Driver, empty → Admin. No two different roles arrays that share the same highest-privilege group should produce different frontend roles.

**Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**

### Property 4: Login-to-display role round-trip consistency

*For any* successful login response, the role stored in `useUserStore` must equal the role displayed in the Sidebar role badge, and the role persisted in `localStorage["messob-auth"]` must equal the role in the store. The round-trip `login → store.user.role → localStorage → hydrate → store.user.role → badge text` must be identity-preserving.

**Validates: Requirements 2.7, 2.8, 9.1**

### Property 5: Role-based menu filtering is exact

*For any* user with a given role, the set of menu items rendered by the Sidebar must be exactly equal to the set of `menuItems` whose `roles` array includes that role. No items outside the allowed set should appear, and no allowed items should be missing.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.7**

### Property 6: loginError is never persisted

*For any* login attempt (success or failure), the value stored in `localStorage["messob-auth"]` must not contain a `loginError` key. The `partialize` function must exclude `loginError` from the persisted state.

**Validates: Requirements 9.5**

### Property 7: API error strings reach the toast

*For any* API response with `{ success: false, error: "some message" }`, the error string `"some message"` must appear in a toast notification. The error must not be silently swallowed.

**Validates: Requirements 10.2**

---

## Error Handling

### Session Expiry Flow

```
API call
  │
  ├─ Content-Type: text/html?
  │     YES → logout() + localStorage.removeItem("messob-auth") + redirect /login
  │           throw "Session expired or backend returned HTML..."
  │
  ├─ data.error.code === 100 or message includes "Session Expired"?
  │     YES → logout() + redirect /login
  │           throw "Session expired. Please log in again."
  │
  ├─ !res.ok?
  │     YES → throw data.error.message || "Request failed"
  │
  └─ data.success === false?
        YES → throw data.error || "Unknown error"
```

### Component-Level Error Handling

All data-fetching components follow this pattern:

```js
try {
  const res = await someApi.list();
  setData(res.items || []);
} catch (err) {
  if (err.message?.includes("Employee record not found")) {
    setData([]);  // graceful empty state
  } else {
    toast.error(err.message);
  }
} finally {
  setLoading(false);
}
```

### HTTP 403 Handling

When the backend returns `{ success: false, error: "Insufficient permissions" }` or HTTP 403, the frontend displays: `"You do not have permission to perform this action."` via toast.

### Network Error Handling

Wrap the `fetch()` call in a try/catch to distinguish network errors from API errors:

```js
let res;
try {
  res = await fetch(...);
} catch (networkErr) {
  throw new Error("Network error. Check your connection.");
}
```

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- Unit tests catch concrete bugs with specific inputs
- Property tests verify universal correctness across all inputs

### Property-Based Testing

Use **fast-check** (JavaScript) for property-based testing. Each property test must run a minimum of 100 iterations.

Each test must be tagged with a comment referencing the design property:
```
// Feature: react-frontend-integration, Property N: <property_text>
```

**Property 1 — Every API call includes credentials:**
```js
// Feature: react-frontend-integration, Property 1: Every API call includes credentials
fc.assert(fc.asyncProperty(
  fc.string(), fc.record({ method: fc.constantFrom("GET","POST"), body: fc.option(fc.string()) }),
  async (path, options) => {
    const fetchSpy = vi.fn().mockResolvedValue(mockJsonResponse({}));
    await request(path, options);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  }
), { numRuns: 100 });
```

**Property 2 — Content-Type checked before JSON parsing:**
```js
// Feature: react-frontend-integration, Property 2: Content-Type checked before JSON parsing
fc.assert(fc.asyncProperty(
  fc.string(), fc.constantFrom("text/html", "text/plain", "application/xml"),
  async (path, contentType) => {
    mockFetch({ contentType, body: "<html>Login</html>" });
    await expect(request(path)).rejects.toThrow(/Session expired|backend returned HTML/);
  }
), { numRuns: 100 });
```

**Property 3 — Role mapping is deterministic:**
```js
// Feature: react-frontend-integration, Property 3: Role mapping is deterministic and priority-ordered
fc.assert(fc.property(
  fc.subarray(["fleet_manager","fleet_dispatcher","fleet_user","driver"]),
  (roles) => {
    const role = detectRole(roles);
    if (roles.includes("fleet_manager")) return role === "Admin";
    if (roles.includes("fleet_dispatcher")) return role === "Dispatcher";
    if (roles.includes("fleet_user")) return role === "Staff";
    if (roles.includes("driver")) return role === "Driver";
    return role === "Admin"; // empty
  }
), { numRuns: 100 });
```

**Property 4 — Login-to-display round-trip:**
```js
// Feature: react-frontend-integration, Property 4: Login-to-display role round-trip consistency
fc.assert(fc.asyncProperty(
  fc.subarray(["fleet_manager","fleet_dispatcher","fleet_user","driver"]),
  async (roles) => {
    mockLoginResponse({ roles });
    await store.getState().login("user", "pass");
    const storedRole = store.getState().user.role;
    const persisted = JSON.parse(localStorage.getItem("messob-auth")).state.user.role;
    return storedRole === persisted;
  }
), { numRuns: 100 });
```

**Property 5 — Role-based menu filtering is exact:**
```js
// Feature: react-frontend-integration, Property 5: Role-based menu filtering is exact
fc.assert(fc.property(
  fc.constantFrom("Admin", "Dispatcher", "Staff", "Driver"),
  (role) => {
    const filtered = menuItems.filter(item => item.roles.includes(role));
    const expected = EXPECTED_MENUS[role];
    return filtered.map(i => i.name).sort().join() === expected.sort().join();
  }
), { numRuns: 100 });
```

**Property 6 — loginError never persisted:**
```js
// Feature: react-frontend-integration, Property 6: loginError is never persisted
fc.assert(fc.asyncProperty(
  fc.boolean(), fc.string(),
  async (shouldSucceed, errorMsg) => {
    if (shouldSucceed) mockLoginSuccess(); else mockLoginFailure(errorMsg);
    await store.getState().login("u", "p");
    const persisted = JSON.parse(localStorage.getItem("messob-auth") || "{}");
    return !("loginError" in (persisted.state || {}));
  }
), { numRuns: 100 });
```

**Property 7 — API error strings reach the toast:**
```js
// Feature: react-frontend-integration, Property 7: API error strings reach the toast
fc.assert(fc.asyncProperty(
  fc.string({ minLength: 1 }),
  async (errorMsg) => {
    mockApiResponse({ success: false, error: errorMsg });
    const toastSpy = vi.spyOn(toast, "error");
    await someComponent.triggerFetch();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining(errorMsg));
  }
), { numRuns: 100 });
```

### Unit Tests

Unit tests focus on specific examples, edge cases, and integration points:

- Login happy path: valid credentials → `isAuthenticated: true`, correct role set
- Login failure: invalid credentials → `loginError` set, `isAuthenticated: false`
- Session expiry: HTML response → redirect to `/login`, store cleared
- Odoo error envelope: `{ error: { code: 100 } }` → redirect to `/login`
- Logout: store cleared, localStorage removed, `/web/session/destroy` called
- DashboardLayout: unauthenticated → redirects to `/login`
- MyRequests: "Employee record not found" → empty state, no toast error
- ApprovalQueue: quick-approve button calls `tripApi.approve()` exactly once
- Maintenance: mounts → calls both `maintenanceApi.list()` and `maintenanceApi.schedules()`
- Driver role: Sidebar with `role="Driver"` renders Dashboard and My Requests only

### Test Configuration

```json
// vitest.config.js
{
  "test": {
    "environment": "jsdom",
    "setupFiles": ["./src/test/setup.ts"],
    "globals": true
  }
}
```

Run tests with: `npx vitest --run` (single execution, no watch mode).
