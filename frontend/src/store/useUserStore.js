import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api';

export const useUserStore = create(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      loginError: null,

      login: async (username, password) => {
        set({ loginError: null });
        try {
          const data = await authApi.login(username, password);
          const roles = data.user?.roles || [];
          
          // Role priority: fleet_manager > fleet_dispatcher > fleet_user > driver
          // If no fleet roles (module not installed or admin user), check if admin
          let role = "Staff";
          if (roles.includes("fleet_manager")) {
            role = "Admin";
          } else if (roles.includes("fleet_dispatcher")) {
            role = "Dispatcher";
          } else if (roles.includes("fleet_user")) {
            role = "Staff";
          } else if (roles.includes("driver")) {
            role = "Driver";
          } else if (roles.length === 0) {
            // No fleet groups — likely Odoo admin or module not installed
            // Give admin access so they can manage the system
            role = "Admin";
          }

          const userData = {
            id: data.user?.id,
            name: data.user?.name || username,
            email: data.user?.email || username,
            role,
            employee_id: data.user?.employee_id,
            is_driver: data.user?.is_driver || false,
            roles,
          };
          set({ user: userData, isAuthenticated: true, loginError: null });
          return { success: true };
        } catch (err) {
          set({ loginError: err.message, isAuthenticated: false });
          return { success: false, error: err.message };
        }
      },

      logout: async () => {
        try { await authApi.logout(); } catch (_) { /* ignore */ }
        localStorage.removeItem("messob-auth");
        set({ user: null, isAuthenticated: false, loginError: null });
      },
    }),
    {
      name: "messob-auth",
      // Only persist user and isAuthenticated, not loginError
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
