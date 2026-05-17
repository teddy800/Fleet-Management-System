import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { canAccessRoute } from "@/config/rbac";

export default function ProtectedRoute() {
  const location = useLocation();
  const { ready, isAuthenticated, user } = useAuth();

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = user?.role || "Staff";
  if (!canAccessRoute(role, location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
