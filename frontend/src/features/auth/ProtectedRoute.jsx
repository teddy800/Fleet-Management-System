import { Navigate, Outlet } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';

export default function ProtectedRoute() {
  const token = useUserStore((state) => state.token);
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}