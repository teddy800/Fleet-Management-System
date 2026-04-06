import { create } from 'zustand';
import { authApi } from '@/lib/api';

export const useUserStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  loginError: null,

  // --- ACTIONS ---

  /**
   * Real Login: Authenticates against Odoo backend
   * @param {string} email
   * @param {string} password
   */
  login: async (email, password) => {
    set({ loginError: null });
    try {
      const data = await authApi.login(email, password);
      const userData = {
        name: data.user?.name || data.name,
        role: data.user?.role || (data.roles?.[0]) || "Staff",
        email: data.user?.email || email,
      };
      set({ user: userData, isAuthenticated: true });
      localStorage.setItem("user-role", userData.role);
      return { success: true };
    } catch (err) {
      set({ loginError: err.message });
      return { success: false, error: err.message };
    }
  },

  /**
   * Developer Helper: Used for the "Quick Login" buttons
   * @param {string} role - "Staff", "Dispatcher", or "Admin"
   */
  loginAsRole: (role) => {
    const mockUsers = {
      Staff: { name: "Sumeya (Staff)", role: "Staff", email: "staff@messob.et" },
      Dispatcher: { name: "Abebe (Dispatcher)", role: "Dispatcher", email: "dispatch@messob.et" },
      Admin: { name: "Admin User", role: "Admin", email: "admin@messob.et" }
    };
    const selectedUser = mockUsers[role] || mockUsers.Staff;
    set({ user: selectedUser, isAuthenticated: true });
    localStorage.setItem("user-role", role);
  },

  /**
   * Logout: Clears everything
   */
  logout: async () => {
    try { await authApi.logout(); } catch (_) { /* ignore */ }
    set({ user: null, isAuthenticated: false });
    localStorage.removeItem("user-role");
  },
}));