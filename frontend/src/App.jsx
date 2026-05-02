import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/layouts/DashboardLayout";
import Login from "./features/auth/Login";
import ProtectedRoute from "./features/auth/ProtectedRoute";

// Lazy-load all pages — each becomes its own chunk, loaded only when visited
const RequestWizard  = lazy(() => import("./features/requests/components/RequestWizard"));
const MyRequests     = lazy(() => import("./features/requests/MyRequests"));
const ApprovalQueue  = lazy(() => import("./features/dispatch/ApprovalQueue"));
const FleetCalendar  = lazy(() => import("./features/dispatch/FleetCalendar"));
const DashboardHome  = lazy(() => import("./features/dispatch/DashboardHome"));
const Profile        = lazy(() => import("./features/profile/profile"));
const ManageFleet    = lazy(() => import("./features/fleet/ManageFleet"));
const FuelLog        = lazy(() => import("./features/fleet/FuelLog"));
const Maintenance    = lazy(() => import("./features/fleet/Maintenance"));
const GPSTracking    = lazy(() => import("./features/fleet/GPSTracking"));
const Alerts         = lazy(() => import("./features/fleet/Alerts"));
const Analytics      = lazy(() => import("./features/fleet/Analytics"));
const Drivers        = lazy(() => import("./features/fleet/Drivers"));
const Inventory      = lazy(() => import("./features/fleet/Inventory"));
const UserManagement = lazy(() => import("./features/admin/UserManagement"));
const HRSync         = lazy(() => import("./features/admin/HRSync"));

// Minimal skeleton shown while a page chunk loads
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function S({ children }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />

      {/* All dashboard routes are protected */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Available to all authenticated roles */}
          <Route path="dashboard"    element={<S><DashboardHome /></S>} />
          <Route path="requests/new" element={<S><RequestWizard /></S>} />
          <Route path="my-requests"  element={<S><MyRequests /></S>} />
          <Route path="profile"      element={<S><Profile /></S>} />

          {/* Dispatcher + Admin only */}
          <Route path="dispatch/approvals" element={<S><ApprovalQueue /></S>} />
          <Route path="dispatch/calendar"  element={<S><FleetCalendar /></S>} />
          <Route path="fleet"              element={<S><ManageFleet /></S>} />
          <Route path="tracking"           element={<S><GPSTracking /></S>} />
          <Route path="drivers"            element={<S><Drivers /></S>} />
          <Route path="fuel-log"           element={<S><FuelLog /></S>} />
          <Route path="maintenance"        element={<S><Maintenance /></S>} />
          <Route path="alerts"             element={<S><Alerts /></S>} />

          {/* Admin only */}
          <Route path="analytics"  element={<S><Analytics /></S>} />
          <Route path="inventory"  element={<S><Inventory /></S>} />
          <Route path="hr-sync"    element={<S><HRSync /></S>} />
          <Route path="users"      element={<S><UserManagement /></S>} />
        </Route>
      </Route>

      {/* Catch-all → login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
