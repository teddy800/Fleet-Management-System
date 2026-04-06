import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/layouts/DashboardLayout";
import Login from "./features/auth/Login";
import RequestWizard from "./features/requests/components/RequestWizard";
import MyRequests from "./features/requests/MyRequests";
import ApprovalQueue from "./features/dispatch/ApprovalQueue";
import FleetCalendar from "./features/dispatch/FleetCalendar";
import DashboardHome from "./features/dispatch/DashboardHome";
import Profile from "./features/profile/profile";
import ManageFleet from "./features/fleet/ManageFleet";
import FuelLog from "./features/fleet/FuelLog";
import Maintenance from "./features/fleet/Maintenance";
import GPSTracking from "./features/fleet/GPSTracking";
import Alerts from "./features/fleet/Alerts";
import Analytics from "./features/fleet/Analytics";
import Drivers from "./features/fleet/Drivers";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardHome />} />
        <Route path="requests/new" element={<RequestWizard />} />
        <Route path="my-requests" element={<MyRequests />} />
        <Route path="dispatch/approvals" element={<ApprovalQueue />} />
        <Route path="dispatch/calendar" element={<FleetCalendar />} />
        <Route path="profile" element={<Profile />} />
        <Route path="fleet" element={<ManageFleet />} />
        <Route path="tracking" element={<GPSTracking />} />
        <Route path="fuel-log" element={<FuelLog />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="drivers" element={<Drivers />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}