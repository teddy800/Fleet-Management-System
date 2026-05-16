import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

/**
 * SIMPLIFIED Protected Route - Direct storage check
 * No Zustand dependency, checks storage directly
 */

const ROUTE_ROLES = {
  '/dispatch/approvals': ['Admin', 'Dispatcher'],
  '/dispatch/calendar':  ['Admin', 'Dispatcher'],
  '/fleet':              ['Admin', 'Dispatcher'],
  '/tracking':           ['Admin', 'Dispatcher'],
  '/drivers':            ['Admin', 'Dispatcher'],
  '/fuel-log':           ['Admin', 'Dispatcher'],
  '/maintenance':        ['Admin', 'Dispatcher'],
  '/alerts':             ['Admin', 'Dispatcher'],
  '/analytics':          ['Admin'],
  '/inventory':          ['Admin'],
  '/hr-sync':            ['Admin'],
  '/users':              ['Admin'],
};

// Direct storage check - no Zustand
function checkAuthFromStorage() {
  console.log("🔍 ProtectedRoute: Checking storage...");
  
  try {
    // Check localStorage
    const stored = localStorage.getItem('messob-auth');
    console.log("💾 localStorage raw:", stored ? stored.substring(0, 100) + "..." : "null");
    
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log("📦 localStorage parsed:", {
        hasState: !!parsed.state,
        isAuth: parsed.state?.isAuthenticated,
        hasUser: !!parsed.state?.user,
        userRole: parsed.state?.user?.role
      });
      
      if (parsed.state?.isAuthenticated && parsed.state?.user) {
        console.log("✅ Auth found in localStorage!");
        return {
          isAuthenticated: true,
          user: parsed.state.user
        };
      }
    }
    
    // Check sessionStorage backup
    const backup = sessionStorage.getItem('messob-auth-backup');
    console.log("💾 sessionStorage backup:", backup ? "exists" : "null");
    
    if (backup) {
      const parsed = JSON.parse(backup);
      if (parsed.state?.isAuthenticated && parsed.state?.user) {
        console.log("✅ Auth found in sessionStorage - restoring to localStorage");
        // Restore to localStorage
        localStorage.setItem('messob-auth', backup);
        return {
          isAuthenticated: true,
          user: parsed.state.user
        };
      }
    }
  } catch (err) {
    console.error('❌ Storage check error:', err);
  }
  
  console.log("❌ No auth found in storage");
  return {
    isAuthenticated: false,
    user: null
  };
}

export default function ProtectedRoute() {
  const location = useLocation();
  const [authState, setAuthState] = useState(null);

  useEffect(() => {
    console.log('🛡️ ProtectedRoute: Checking auth for:', location.pathname);
    
    // Direct storage check
    const auth = checkAuthFromStorage();
    console.log('🔍 Auth result:', auth);
    
    setAuthState(auth);
  }, [location.pathname]);

  // Loading state
  if (authState === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!authState.isAuthenticated) {
    console.log('❌ Not authenticated - redirecting to login');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  console.log('✅ User authenticated:', authState.user.role);

  // Check role permissions
  const requiredRoles = ROUTE_ROLES[location.pathname];
  if (requiredRoles && !requiredRoles.includes(authState.user.role)) {
    console.log('⚠️ Insufficient permissions - redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('✅ Access granted to:', location.pathname);
  return <Outlet />;
}
