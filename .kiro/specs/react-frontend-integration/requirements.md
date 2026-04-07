# Requirements Document

## Introduction

This feature covers the complete frontend-backend integration for the MESSOB Fleet Management System (FMS). The React/Vite frontend (port 3000) must authenticate against the Odoo 19 backend (port 8069) using JSON-RPC session-based authentication, detect the authenticated user's role from Odoo security groups, enforce role-based UI visibility and routing, and ensure all frontend components fetch live data from the Odoo REST/JSON-RPC API endpoints with correct session cookies. The feature also fixes the critical "Invalid JSON" bug caused by unauthenticated API calls returning Odoo's HTML login redirect instead of JSON.

## Glossary

- **Frontend**: The React + Vite application running at `localhost:3000`.
- **Backend**: The Odoo 19 instance running at `localhost:8069` with the `mesob_fleet_customizations` module installed.
- **Auth_API**: The `/api/mobile/auth/login` Odoo JSON-RPC endpoint that authenticates a user and returns session info and roles.
- **Session_Cookie**: The `session_id` HTTP cookie set by Odoo after successful authentication, required on all subsequent API calls.
- **Vite_Proxy**: The Vite dev-server proxy that forwards `/api/*` and `/web/*` requests from port 3000 to port 8069, preserving cookies.
- **UserStore**: The Zustand store (`useUserStore.js`) that persists authenticated user state including role.
- **Role**: One of `Admin` (fleet_manager), `Dispatcher` (fleet_dispatcher), `Staff` (fleet_user / default internal user), or `Driver`.
- **Odoo_Group**: An Odoo `res.groups` record that grants permissions; the relevant groups are `group_fleet_manager`, `group_fleet_dispatcher`, and `group_fleet_user`.
- **ProtectedRoute**: The React component that redirects unauthenticated users to `/login`.
- **DashboardLayout**: The React layout component that wraps all authenticated pages and renders the Sidebar.
- **Sidebar**: The navigation component that filters menu items based on the current user's Role.
- **Fleet_API**: The Odoo controller at `controllers/fleet_api.py` exposing `/api/fleet/*` endpoints.
- **Mobile_API**: The Odoo controller at `controllers/mobile_api.py` exposing `/api/mobile/*` endpoints.
- **CORS**: Cross-Origin Resource Sharing; not applicable in dev because the Vite_Proxy eliminates cross-origin requests.

---

## Requirements

### Requirement 1: Odoo Session-Based Authentication

**User Story:** As a MESSOB user, I want to log in with my Odoo credentials so that I receive a valid session that is automatically included in all subsequent API calls.

#### Acceptance Criteria

1. WHEN a user submits valid credentials on the Login page, THE Auth_API SHALL authenticate the user via Odoo's JSON-RPC session mechanism and return `{ success: true, user: { id, name, email, roles, employee_id, is_driver }, session_id }`.
2. WHEN a user submits invalid credentials, THE Auth_API SHALL return `{ success: false, error: "Invalid credentials" }` and THE Frontend SHALL display the error message without navigating away from the login page.
3. WHEN authentication succeeds, THE Vite_Proxy SHALL forward the `Set-Cookie` header from Odoo's response to the browser so that the `session_id` cookie is stored.
4. WHEN any authenticated API call is made, THE Frontend SHALL include `credentials: "include"` in the fetch options so that the `session_id` cookie is sent to the Vite_Proxy and forwarded to the Backend.
5. WHEN the Vite_Proxy forwards a request to the Backend, THE Vite_Proxy SHALL preserve and forward all cookies including `session_id`.
6. WHEN a user logs out, THE Frontend SHALL call `/web/session/destroy` and THE UserStore SHALL clear all persisted user state.
7. IF the `session_id` cookie has expired or is invalid, THEN THE Backend SHALL return an HTTP 200 response with an Odoo login redirect HTML page, AND THE Frontend SHALL detect the non-JSON response and redirect the user to `/login`.

---

### Requirement 2: Role Detection from Odoo Groups

**User Story:** As a system administrator, I want each user's role to be determined from their Odoo security group membership so that access control is consistent between the Odoo backend and the React frontend.

#### Acceptance Criteria

1. WHEN a user authenticates successfully, THE Auth_API SHALL inspect the user's Odoo group membership and return a `roles` array containing zero or more of: `"fleet_manager"`, `"fleet_dispatcher"`, `"fleet_user"`, `"driver"`.
2. WHEN the `roles` array contains `"fleet_manager"`, THE UserStore SHALL assign the user the `Admin` Role.
3. WHEN the `roles` array contains `"fleet_dispatcher"` but not `"fleet_manager"`, THE UserStore SHALL assign the user the `Dispatcher` Role.
4. WHEN the `roles` array contains `"fleet_user"` but not `"fleet_dispatcher"` or `"fleet_manager"`, THE UserStore SHALL assign the user the `Staff` Role.
5. WHEN the `roles` array contains `"driver"` but no fleet management roles, THE UserStore SHALL assign the user the `Driver` Role.
6. WHEN the `roles` array is empty (e.g., Odoo admin user without explicit fleet group assignment), THE UserStore SHALL assign the user the `Admin` Role to allow full system management.
7. THE UserStore SHALL persist the resolved Role across browser page refreshes using localStorage.
8. FOR ALL valid Odoo users, the Role assigned by THE UserStore SHALL match the highest-privilege Odoo_Group the user belongs to (round-trip property: login → role detection → role stored → role displayed SHALL be consistent).

---

### Requirement 3: Role-Based UI Visibility and Routing

**User Story:** As a MESSOB user, I want to see only the navigation items and pages relevant to my role so that the interface is not cluttered with features I cannot use.

#### Acceptance Criteria

1. WHILE the current user's Role is `Staff`, THE Sidebar SHALL display only: Dashboard, Request Vehicle, My Requests.
2. WHILE the current user's Role is `Dispatcher`, THE Sidebar SHALL display: Dashboard, Approval Queue, Fleet Calendar, Manage Fleet, GPS Tracking, Drivers, Fuel Logs, Maintenance, Alerts.
3. WHILE the current user's Role is `Admin`, THE Sidebar SHALL display all menu items including Analytics.
4. WHILE the current user's Role is `Driver`, THE Sidebar SHALL display: Dashboard, My Requests.
5. WHEN an unauthenticated user navigates to any route under `/`, THE DashboardLayout SHALL redirect the user to `/login`.
6. WHEN an authenticated user navigates to a route not in their allowed menu, THE Frontend SHALL not crash and SHALL render the page content (routes are not hard-blocked, only hidden from navigation).
7. THE Sidebar SHALL display the current user's Role in the role badge at all times while authenticated.

---

### Requirement 4: Fix Invalid JSON / Session Not Sent Bug

**User Story:** As a developer, I want all API calls to correctly send the Odoo session cookie so that the backend returns JSON data instead of an HTML login redirect page.

#### Acceptance Criteria

1. THE Frontend's `api.js` request function SHALL include `credentials: "include"` on every fetch call so that the session cookie is always sent.
2. WHEN the Vite_Proxy configuration is applied, THE Vite_Proxy SHALL set `changeOrigin: true` and SHALL forward cookies from the browser to the Backend without stripping the `Cookie` header.
3. WHEN an API response cannot be parsed as JSON (e.g., the response body starts with `<`), THE Frontend's request function SHALL throw a descriptive error: `"Session expired or backend returned HTML. Please log in again."` instead of a raw JSON parse error.
4. WHEN the above error is thrown, THE Frontend SHALL redirect the user to `/login` and clear the UserStore state.
5. WHEN the Backend returns `{ "error": { "code": 100, "message": "Odoo Session Expired" } }` in a JSON-RPC error envelope, THE Frontend SHALL treat this as a session expiry and redirect to `/login`.
6. THE `api.js` request function SHALL check `res.ok` and the response `Content-Type` header before calling `res.json()` to prevent the "Unexpected token '<'" error.

---

### Requirement 5: Dashboard Real Data Integration

**User Story:** As a fleet manager or dispatcher, I want the Dashboard to display live fleet statistics from the Odoo backend so that I can monitor the fleet in real time.

#### Acceptance Criteria

1. WHEN the Dashboard page mounts, THE DashboardHome component SHALL call `analyticsApi.dashboard()` which maps to `GET /api/fleet/dashboard`.
2. WHEN the Backend returns a valid dashboard payload, THE DashboardHome component SHALL display: total fleet count, available vehicles, active trips, pending requests, maintenance-due vehicles, fuel cost, completed trips, and active drivers.
3. WHILE data is loading, THE DashboardHome component SHALL display skeleton/pulse placeholders in each stat card.
4. IF the Backend returns an error or the session is expired, THEN THE DashboardHome component SHALL display a "Backend not connected" warning with instructions to install the Odoo module.
5. THE DashboardHome component SHALL automatically refresh dashboard data every 60 seconds.
6. WHEN the user clicks the Refresh button, THE DashboardHome component SHALL immediately re-fetch dashboard data.

---

### Requirement 6: Trip Request Lifecycle Integration

**User Story:** As a staff member, I want to create, view, and cancel my trip requests through the React frontend so that my requests are stored and processed in Odoo.

#### Acceptance Criteria

1. WHEN a staff user submits the RequestWizard form, THE Frontend SHALL call `POST /api/fleet/trip-requests` with the trip details and THE Backend SHALL create a `mesob.trip.request` record in Odoo and auto-submit it.
2. WHEN the MyRequests page mounts, THE Frontend SHALL call `GET /api/mobile/user/trip-requests` and display only the current user's own trip requests.
3. WHEN a dispatcher or admin views the ApprovalQueue, THE Frontend SHALL call `GET /api/fleet/trip-requests` and THE Backend SHALL return all trip requests (not filtered by employee).
4. WHEN a dispatcher approves a request, THE Frontend SHALL call `POST /api/fleet/trip-requests/{id}/approve` and THE Backend SHALL transition the `mesob.trip.request` state to `approved`.
5. WHEN a dispatcher rejects a request, THE Frontend SHALL call `POST /api/fleet/trip-requests/{id}/reject` with an optional reason and THE Backend SHALL transition the state to `rejected`.
6. WHEN a dispatcher assigns a vehicle and driver, THE Frontend SHALL call `POST /api/fleet/trip-requests/{id}/assign` with `vehicle_id` and `driver_id`.
7. WHEN a staff user cancels a pending request, THE Frontend SHALL call `POST /api/fleet/trip-requests/{id}/cancel` and THE Backend SHALL only allow cancellation if the request state is `pending`.
8. IF a staff user attempts to cancel a non-pending request, THEN THE Backend SHALL return `{ success: false, error: "This request cannot be cancelled" }` and THE Frontend SHALL display the error via toast notification.

---

### Requirement 7: Fleet, Driver, Fuel, and Maintenance Data Integration

**User Story:** As a dispatcher or admin, I want all fleet management pages to display live data from Odoo so that I can manage the fleet effectively.

#### Acceptance Criteria

1. WHEN the ManageFleet page mounts, THE Frontend SHALL call `GET /api/fleet/vehicles` and display vehicle name, license plate, status, odometer, and assigned driver.
2. WHEN the Drivers page mounts, THE Frontend SHALL call `GET /api/fleet/drivers` and display driver name, license number, license expiry, and active trip count.
3. WHEN the FuelLog page mounts, THE Frontend SHALL call `GET /api/fleet/fuel-logs` and display vehicle, driver, date, station, volume, cost, and fuel efficiency.
4. WHEN the Maintenance page mounts, THE Frontend SHALL call `GET /api/fleet/maintenance-logs` and `GET /api/fleet/maintenance-schedules` and display maintenance history and upcoming schedules with overdue indicators.
5. WHEN the GPSTracking page mounts, THE Frontend SHALL call `GET /api/fleet/vehicles` and display each vehicle's last known GPS coordinates on a map or coordinate list.
6. WHEN the Analytics page mounts, THE Frontend SHALL call `GET /api/fleet/analytics/kpis` and display fleet KPI metrics.
7. IF any of the above API calls fail due to a session error, THEN THE Frontend SHALL display a toast error and redirect to `/login`.

---

### Requirement 8: Vite Proxy Cookie Forwarding

**User Story:** As a developer, I want the Vite development server proxy to correctly forward session cookies between the browser and Odoo so that authentication works without CORS issues.

#### Acceptance Criteria

1. THE Vite_Proxy SHALL proxy all requests matching `/api/*` to `http://localhost:8069` with `changeOrigin: true`.
2. THE Vite_Proxy SHALL proxy all requests matching `/web/*` to `http://localhost:8069` with `changeOrigin: true`.
3. THE Vite_Proxy SHALL set `cookieDomainRewrite: "localhost"` so that Odoo's `Set-Cookie` domain is rewritten to `localhost` and the browser stores the cookie correctly.
4. THE Vite_Proxy SHALL set `cookiePathRewrite: "/"` to ensure the session cookie path is accessible to all frontend routes.
5. WHEN the Vite_Proxy forwards a response from the Backend, THE Vite_Proxy SHALL not strip `Set-Cookie` headers.
6. THE Frontend SHALL use an empty `BASE_URL` (`""`) in `api.js` so that all API calls go through the Vite_Proxy on the same origin.

---

### Requirement 9: Session Persistence and Auto-Restore

**User Story:** As a user, I want my login session to persist across browser refreshes so that I do not have to log in again every time I reload the page.

#### Acceptance Criteria

1. WHEN a user successfully logs in, THE UserStore SHALL persist `{ user, isAuthenticated }` to localStorage under the key `"messob-auth"`.
2. WHEN the browser is refreshed, THE DashboardLayout SHALL read the persisted `isAuthenticated` flag from the UserStore and allow access without re-authenticating.
3. WHEN the browser is refreshed and `isAuthenticated` is `true` but the Odoo session cookie has expired, THE first API call SHALL fail with a session error and THE Frontend SHALL redirect to `/login` and clear the UserStore.
4. WHEN a user logs out, THE UserStore SHALL remove the `"messob-auth"` localStorage entry and THE Frontend SHALL redirect to `/login`.
5. THE UserStore SHALL NOT persist `loginError` to localStorage.

---

### Requirement 10: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages when something goes wrong so that I understand what happened and what to do next.

#### Acceptance Criteria

1. WHEN an API call fails with a network error, THE Frontend SHALL display a toast notification with the message "Network error. Check your connection."
2. WHEN an API call returns `{ success: false, error: "..." }`, THE Frontend SHALL display the error string in a toast notification.
3. WHEN a form submission fails, THE Frontend SHALL display the error inline near the submit button and SHALL NOT navigate away.
4. WHEN an API call is in progress, THE Frontend SHALL disable the relevant submit button and show a loading spinner to prevent duplicate submissions.
5. IF the Backend returns HTTP 403 or `{ error: "Insufficient permissions" }`, THEN THE Frontend SHALL display "You do not have permission to perform this action." via toast notification.
