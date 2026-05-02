import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';

// Route-level role requirements
const ROUTE_ROLES = {
  '/dispatch/approvals': ['Dispatcher', 'Admin'],
  '/dispatch/calendar':  ['Dispatcher', 'Admin'],
  '/fleet':              ['Dispatcher', 'Admin'],
  '/tracking':           ['Dispatcher', 'Admin'],
  '/drivers':            ['Dispatcher', 'Admin'],
  '/fuel-log':           ['Dispatcher', 'Admin'],
  '/maintenance':        ['Dispatcher', 'Admin'],
  '/alerts':             ['Dispatcher', 'Admin'],
  '/analytics':          ['Admin'],
  '/inventory':          ['Admin'],
  '/hr-sync':            ['Admin'],
  '/users':              ['Admin'],
};

export default function ProtectedRoute() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const user = useUserStore((state) => state.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Role-based route guard
  const requiredRoles = ROUTE_ROLES[location.pathname];
  if (requiredRoles && user?.role && !requiredRoles.includes(user.role)) {
    // Redirect to dashboard with a message instead of a blank page
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
