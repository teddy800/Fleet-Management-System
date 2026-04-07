# Implementation Plan: React Frontend Integration

## Overview

Fix all critical integration bugs between the React/Vite frontend and Odoo 19 backend, implement the missing Maintenance component, and elevate the UI/UX to a premium, polished standard across all pages.

## Tasks

- [x] 1. Fix Vite proxy cookie forwarding
  - In `frontend/vite.config.js`, add `cookieDomainRewrite: "localhost"`, `cookiePathRewrite: { "*": "/" }`, and a `configure` proxy event listener that rewrites `SameSite=None` to `SameSite=Lax` and strips `; Secure` from all `Set-Cookie` headers for the `/api`, `/web`, and `/webhook` proxy entries
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 1.1 Write property test for proxy cookie rewriting
    - **Property 1: Every API call includes credentials**
    - **Validates: Requirements 1.4, 4.1**

- [x] 2. Fix `api.js` request function
  - In `frontend/src/lib/api.js`, wrap `fetch()` in a try/catch to surface network errors as `"Network error. Check your connection."`
  - Check `res.headers.get("content-type")` before calling `res.json()`; if not `application/json`, call `useUserStore.getState().logout()`, redirect to `/login`, and throw `"Session expired or backend returned HTML. Please log in again."`
  - Handle Odoo JSON-RPC error envelope: if `data.error.code === 100` or message includes `"Session Expired"`, logout and redirect to `/login`
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 10.1_

  - [x] 2.1 Write property test for Content-Type check before JSON parsing
    - **Property 2: Content-Type is checked before JSON parsing**
    - **Validates: Requirements 4.3, 4.6**

- [x] 3. Fix `useUserStore.js` logout
  - In `frontend/src/store/useUserStore.js`, add `localStorage.removeItem("messob-auth")` inside the `logout()` action before clearing Zustand state, ensuring the persisted entry is removed even if the persist middleware has not flushed
  - _Requirements: 1.6, 9.4_

  - [x] 3.1 Write property test for loginError never persisted
    - **Property 6: loginError is never persisted**
    - **Validates: Requirements 9.5**

  - [x] 3.2 Write property test for login-to-display role round-trip consistency
    - **Property 4: Login-to-display role round-trip consistency**
    - **Validates: Requirements 2.7, 2.8, 9.1**

- [x] 4. Fix Sidebar Driver role visibility
  - In `frontend/src/components/shared/Sidebar.jsx`, add `"Driver"` to the `roles` array of the Dashboard menu item and the My Requests menu item so that Driver users see a non-empty sidebar
  - _Requirements: 3.4, 3.7_

  - [x] 4.1 Write property test for role-based menu filtering
    - **Property 5: Role-based menu filtering is exact**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.7**

- [x] 5. Fix ApprovalQueue double-approve bug
  - In `frontend/src/features/dispatch/ApprovalQueue.jsx`, change the table row quick-approve button's `onClick` to call only `handleApproveImmediate(req)`, removing the simultaneous `setSelectedReq(req)` + `setMode("approve")` that was triggering a second approval through the dialog flow
  - _Requirements: 6.4_

  - [x] 5.1 Write unit test for ApprovalQueue single-approve
    - Verify that clicking the quick-approve button calls `tripApi.approve()` exactly once
    - _Requirements: 6.4_

- [x] 6. Fix MyRequests empty state for missing employee record
  - In `frontend/src/features/requests/MyRequests.jsx`, catch the `"Employee record not found"` error from `tripApi.listMine()` and set requests to `[]` with an explanatory empty-state message instead of showing an error toast
  - _Requirements: 6.2, 10.2_

  - [x] 6.1 Write unit test for MyRequests employee-not-found empty state
    - Mock `tripApi.listMine()` to reject with `"Employee record not found"` and assert no toast is shown and an empty state message is rendered
    - _Requirements: 6.2_

- [x] 7. Checkpoint — Ensure all integration bug fixes pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Maintenance.jsx
  - Replace the placeholder in `frontend/src/features/fleet/Maintenance.jsx` with a full component that calls `maintenanceApi.list()` and `maintenanceApi.schedules()` in parallel via `Promise.all()`
  - Render summary cards: total logs, pending, overdue count
  - Render a tabbed view with a History tab (table: vehicle, type, date, technician, cost, status) and a Schedules tab (table: vehicle, type, next due date, next due odometer, overdue badge)
  - Show loading skeletons while fetching and an error toast on failure
  - _Requirements: 7.4_

  - [x] 8.1 Write unit test for Maintenance parallel API calls
    - Assert that both `maintenanceApi.list()` and `maintenanceApi.schedules()` are called on mount
    - _Requirements: 7.4_

- [x] 9. Enhance `index.css` — premium design tokens and utilities
  - Add CSS custom properties for a premium color palette (brand gradients, glass surfaces, shadow scales)
  - Add keyframe animations: `fadeInUp`, `slideInLeft`, `pulse-glow`, `counter-up`, `shimmer`
  - Add utility classes: `.glass`, `.glass-dark`, `.gradient-card`, `.gradient-text`, `.animate-fade-in`, `.animate-slide-in`, `.pulse-dot`
  - _Requirements: (UI/UX enhancement)_

- [x] 9.1 Smoke-test CSS utilities render without layout breakage
  - Verify key utility classes apply expected CSS properties in a jsdom render
  - _Requirements: (UI/UX enhancement)_

- [x] 10. Enhance Login.jsx — animated premium login experience
  - Add an animated particle/gradient background using CSS keyframes (no external canvas library)
  - Wrap the login card in a `fadeInUp` entrance animation
  - Apply premium input styling: floating labels or styled focus rings, subtle shadow on the card
  - _Requirements: (UI/UX enhancement)_

- [x] 11. Enhance DashboardLayout.jsx — glassmorphism header and page transitions
  - Apply a glassmorphism style to the top header bar (`backdrop-filter: blur`, semi-transparent background)
  - Add a notification bell icon with a badge showing pending request count (read from UserStore or a prop)
  - Wrap the `<Outlet />` in a CSS transition so page changes fade in smoothly
  - _Requirements: (UI/UX enhancement)_

- [x] 12. Enhance Sidebar.jsx — micro-animations and premium styling
  - Add an animated active-route indicator (sliding pill or left-border accent) that transitions between items
  - Add hover micro-animations on menu items (subtle translate-x or background fade)
  - Style the logo/brand area with a gradient background
  - Animate the collapse/expand toggle with a smooth width transition
  - _Requirements: (UI/UX enhancement)_

- [x] 13. Enhance DashboardHome.jsx — animated stat cards
  - Animate stat counter values counting up from 0 to their final value on mount using a `useCountUp` hook or CSS animation
  - Apply gradient backgrounds to each stat card (unique gradient per metric category)
  - Add a live pulse indicator dot on the "Active Trips" card when `active_trips > 0`
  - _Requirements: 5.2, 5.3 (UI/UX enhancement)_

- [x] 14. Enhance ManageFleet.jsx — premium vehicle cards and table
  - Replace plain status text with animated status dots (green pulse for available, amber for in-use, red for maintenance)
  - Add hover row highlight and a subtle row-enter animation when data loads
  - Style action buttons with icon + label and consistent sizing
  - _Requirements: 7.1 (UI/UX enhancement)_

- [x] 15. Enhance Drivers.jsx — avatar cards and license expiry indicators
  - Add a generated avatar (initials-based colored circle) for each driver
  - Show a progress bar for license expiry: green if > 90 days, amber if 30–90 days, red if < 30 days or expired
  - Add status indicator badges (Active / Inactive) with color coding
  - _Requirements: 7.2 (UI/UX enhancement)_

- [x] 16. Enhance FuelLog.jsx — efficiency trend and cost summary
  - Add a mini inline sparkline-style bar chart per vehicle showing the last 5 fuel efficiency readings (pure CSS or a lightweight SVG, no chart library required unless already present)
  - Add a gradient summary card at the top showing total fuel cost and average efficiency for the current filter period
  - _Requirements: 7.3 (UI/UX enhancement)_

- [x] 17. Enhance GPSTracking.jsx — live pulse animations on active vehicles
  - Add a pulsing ring animation around the status dot of vehicles with an active trip
  - Style vehicle cards with a premium layout: vehicle name, plate, last-seen timestamp, coordinates
  - _Requirements: 7.5 (UI/UX enhancement)_

- [x] 18. Enhance Analytics.jsx — animated KPI gauges and gradient metrics
  - Animate KPI metric values counting up on mount
  - Add gradient progress bars for utilization and efficiency metrics
  - Style metric cards with distinct gradient accents per category
  - _Requirements: 7.6 (UI/UX enhancement)_

- [x] 19. Enhance Alerts.jsx — severity-colored cards with pulse and priority badges
  - Color-code alert cards by severity: red/pulse for critical, amber for warning, blue for info
  - Add a pulsing animation on unread critical alerts
  - Add priority badges with distinct colors
  - _Requirements: (UI/UX enhancement)_

- [x] 20. Enhance ApprovalQueue.jsx — priority color coding and status timeline
  - Color-code table rows or left-border accents by request priority (urgent = red, high = amber, normal = blue, low = gray)
  - Animate the approval/rejection dialog entrance with a smooth scale-in transition
  - Add a compact status timeline inside the request detail view showing state transitions
  - _Requirements: 6.3, 6.4, 6.5 (UI/UX enhancement)_

- [x] 21. Enhance FleetCalendar.jsx — color-coded trip blocks and smooth navigation
  - Color-code calendar trip blocks by trip status (pending = amber, approved = blue, in_progress = green, completed = gray)
  - Highlight today's column/cell with a distinct background
  - Animate week-forward/back navigation with a slide transition
  - _Requirements: (UI/UX enhancement)_

- [x] 22. Enhance MyRequests.jsx — status timeline and gradient status indicators
  - Add a visual status timeline (horizontal stepper) on each request card showing the progression through states
  - Apply gradient left-border accents on request cards keyed to status color
  - _Requirements: 6.2 (UI/UX enhancement)_

- [x] 23. Enhance RequestWizard.jsx — animated step transitions and success confetti
  - Animate step transitions with a slide-left/right CSS transition when advancing or going back
  - Style form inputs with premium focus rings and smooth label transitions
  - On successful submission, show a brief confetti burst animation (pure CSS keyframes or a minimal JS snippet) before navigating away
  - _Requirements: 6.1 (UI/UX enhancement)_

- [x] 24. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use **fast-check** with a minimum of 100 iterations per property
- Run tests with: `npx vitest --run` (single execution, no watch mode)
- UI/UX enhancement tasks (Groups 3) have no hard requirement references but directly serve the stated goal of a premium, polished interface
