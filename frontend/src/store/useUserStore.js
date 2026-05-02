import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Role detection from API response ─────────────────────────────────────────
function detectRole(roles = [], isDriver = false) {
  if (roles.includes("fleet_manager"))    return "Admin";
  if (roles.includes("fleet_dispatcher")) return "Dispatcher";
  if (roles.includes("fleet_user"))       return (isDriver || roles.includes("driver")) ? "Driver" : "Staff";
  if (roles.includes("driver"))           return "Driver";
  return "Admin"; // Odoo admin / no fleet groups
}

// ── Multi-step login: authenticate → probe roles ──────────────────────────────
async function performLogin(username, password) {
  // Step 1: Authenticate via Odoo session
  let authRes;
  try {
    authRes = await fetch("/web/session/authenticate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: 1,
        params: { db: "messob_db", login: username, password },
      }),
    });
  } catch (_) {
    throw new Error("Network error. Check your connection.");
  }

  const ct = authRes.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error("Session expired. Please log in again.");
  }

  const authRaw = await authRes.json();
  const authData = authRaw?.result;
  if (!authData?.uid) {
    throw new Error("Invalid credentials. Please try again.");
  }

  const uid  = authData.uid;
  const name = authData.name || username;
  const email = authData.username || username;

  // Step 2: Try /api/user/info (fast, single call, uses sudo internally)
  try {
    const infoRes = await fetch("/api/user/info", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 2, params: {} }),
    });
    if (infoRes.ok) {
      const infoRaw = await infoRes.json();
      const info = infoRaw?.result;
      if (info?.success && info.user) {
        return {
          id: uid, name, email,
          roles: info.user.roles || [],
          is_driver: info.user.is_driver || false,
          employee_id: info.user.employee_id || null,
        };
      }
    }
  } catch (_) { /* fallback below */ }

  // Step 3: Role probe via fleet API (works with fixed hr_employee_public view)
  const roles = [];
  let isDriver = false;
  let employeeId = null;

  // Probe dispatcher access (vehicles endpoint is dispatcher/manager only)
  try {
    const vRes = await fetch("/api/fleet/vehicles", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 3, params: {} }),
    });
    const vRaw = await vRes.json();
    const vResult = vRaw?.result;
    if (vResult?.success === true) {
      roles.push("fleet_dispatcher");
      // Check manager (users endpoint is manager-only)
      try {
        const uRes = await fetch("/api/fleet/users", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 4, params: {} }),
        });
        const uRaw = await uRes.json();
        if (uRaw?.result?.success === true) roles.push("fleet_manager");
      } catch (_) { /* ignore */ }
    } else if (vResult?.error === "Insufficient permissions") {
      roles.push("fleet_user");
    }
  } catch (_) { /* ignore */ }

  // Get employee info (driver check)
  try {
    const empRes = await fetch("/web/dataset/call_kw", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: 5,
        params: {
          model: "hr.employee", method: "search_read",
          args: [[["user_id", "=", uid]]],
          kwargs: { fields: ["id", "is_driver"], limit: 1 },
        },
      }),
    });
    const empRaw = await empRes.json();
    const emp = empRaw?.result?.[0];
    if (emp) {
      employeeId = emp.id;
      isDriver = emp.is_driver || false;
      if (isDriver && !roles.includes("fleet_user")) roles.push("fleet_user");
      if (isDriver) roles.push("driver");
    }
  } catch (_) { /* ignore */ }

  // If still no roles, try trip requests (fleet_user fallback)
  if (roles.length === 0) {
    try {
      const trRes = await fetch("/api/mobile/user/trip-requests", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 6, params: {} }),
      });
      const trRaw = await trRes.json();
      if (trRaw?.result?.success === true) roles.push("fleet_user");
    } catch (_) { /* ignore */ }
  }

  return { id: uid, name, email, roles, is_driver: isDriver, employee_id: employeeId };
}

// ── Zustand store ─────────────────────────────────────────────────────────────
export const useUserStore = create(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      loginError: null,

      login: async (username, password) => {
        set({ loginError: null });
        try {
          const userData = await performLogin(username, password);
          const role = detectRole(userData.roles, userData.is_driver);

          set({
            user: {
              id: userData.id,
              name: userData.name,
              email: userData.email,
              role,
              roles: userData.roles,
              employee_id: userData.employee_id,
              is_driver: userData.is_driver,
            },
            isAuthenticated: true,
            loginError: null,
          });
          return { success: true, role };
        } catch (err) {
          set({ loginError: err.message, isAuthenticated: false, user: null });
          return { success: false, error: err.message };
        }
      },

      logout: async () => {
        localStorage.removeItem("messob-auth");
        set({ user: null, isAuthenticated: false, loginError: null });
        try {
          await fetch("/web/session/destroy", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }),
          });
        } catch (_) { /* ignore */ }
      },
    }),
    {
      name: "messob-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
