import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';

/**
 * Route-level RBAC enforcement.
 *
 * Access table (matches SRS exactly):
 * ─────────────────────────────────────────────────────────────────
 * Route                  Admin  Dispatcher  Staff  Driver  Mechanic
 * /dashboard             ✅     ✅          ✅     ✅      ✅
 * /requests/new          ✅     ✅          ✅     ✅      ✅
 * /my-requests           ✅     ✅          ✅     ✅      ✅
 * /profile               ✅     ✅          ✅     ✅      ✅
 * /dispatch/approvals    ✅     ✅          ❌     ❌      ❌
 * /dispatch/calendar     ✅     ✅          ❌     ❌      ❌
 * /fleet                 ✅     ✅          ❌     ❌      ❌
 * /tracking              ✅     ✅          ❌     ❌      ❌
 * /drivers               ✅     ✅          ❌     ❌      ❌
 * /fuel-log              ✅     ✅          ❌     ❌      ❌
 * /maintenance           ✅     ✅          ❌     ❌      ❌
 * /alerts                ✅     ✅          ❌     ❌      ❌
 * /analytics             ✅     ❌          ❌     ❌      ❌
 * /inventory             ✅     ❌          ❌     ❌      ❌
 * /hr-sync               ✅     ❌          ❌     ❌      ❌
 * /users                 ✅     ❌          ❌     ❌      ❌
 * ─────────────────────────────────────────────────────────────────
 */

// Routes that require specific roles (routes NOT listed here are open to all authenticated users)
const ROUTE_ROLES = {
  // Dispatcher + Admin
  '/dispatch/approvals': ['Admin', 'Dispatcher'],
  '/dispatch/calendar':  ['Admin', 'Dispatcher'],
  '/fleet':              ['Admin', 'Dispatcher'],
  '/tracking':           ['Admin', 'Dispatcher'],
  '/drivers':            ['Admin', 'Dispatcher'],
  '/fuel-log':           ['Admin', 'Dispatcher'],
  '/maintenance':        ['Admin', 'Dispatcher'],
  '/alerts':             ['Admin', 'Dispatcher'],

  // Admin only
  '/analytics':          ['Admin'],
  '/inventory':          ['Admin'],
  '/hr-sync':            ['Admin'],
  '/users':              ['Admin'],
};

export default function ProtectedRoute() {
  const isAuthenticated = useUserStore(s => s.isAuthenticated);
  const user            = useUserStore(s => s.user);
  const location        = useLocation();

  // Step 1: Must be authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Step 2: Check route-level role requirement
  const requiredRoles = ROUTE_ROLES[location.pathname];
  if (requiredRoles && user?.role && !requiredRoles.includes(user.role)) {
    // Silently redirect to dashboard — no error page
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
