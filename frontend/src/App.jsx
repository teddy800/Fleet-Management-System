import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/layouts/DashboardLayout";
import Login from "./features/auth/Login";

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
const UserManagement = lazy(() => import("./features/admin/UserManagement"));

// Minimal skeleton shown while a page chunk loads
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"          element={<Suspense fallback={<PageLoader />}><DashboardHome /></Suspense>} />
        <Route path="requests/new"       element={<Suspense fallback={<PageLoader />}><RequestWizard /></Suspense>} />
        <Route path="my-requests"        element={<Suspense fallback={<PageLoader />}><MyRequests /></Suspense>} />
        <Route path="dispatch/approvals" element={<Suspense fallback={<PageLoader />}><ApprovalQueue /></Suspense>} />
        <Route path="dispatch/calendar"  element={<Suspense fallback={<PageLoader />}><FleetCalendar /></Suspense>} />
        <Route path="profile"            element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
        <Route path="fleet"              element={<Suspense fallback={<PageLoader />}><ManageFleet /></Suspense>} />
        <Route path="tracking"           element={<Suspense fallback={<PageLoader />}><GPSTracking /></Suspense>} />
        <Route path="fuel-log"           element={<Suspense fallback={<PageLoader />}><FuelLog /></Suspense>} />
        <Route path="maintenance"        element={<Suspense fallback={<PageLoader />}><Maintenance /></Suspense>} />
        <Route path="alerts"             element={<Suspense fallback={<PageLoader />}><Alerts /></Suspense>} />
        <Route path="analytics"          element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
        <Route path="drivers"            element={<Suspense fallback={<PageLoader />}><Drivers /></Suspense>} />
        <Route path="users"              element={<Suspense fallback={<PageLoader />}><UserManagement /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
