import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Mechanic keyword detection ────────────────────────────────────────────────
const MECHANIC_KEYWORDS = ["mechanic", "technician", "maintenance tech", "service tech"];

// ── Role detection (pure function) ───────────────────────────────────────────
export function detectRole(roles = [], isDriver = false, jobTitle = "") {
  if (roles.includes("fleet_manager"))    return "Admin";
  if (roles.includes("fleet_dispatcher")) return "Dispatcher";
  if (roles.includes("mechanic"))         return "Mechanic";
  if (roles.includes("fleet_user") || roles.includes("staff_user")) {
    if (isDriver || roles.includes("driver")) return "Driver";
    const jt = (jobTitle || "").toLowerCase();
    if (MECHANIC_KEYWORDS.some(k => jt.includes(k))) return "Mechanic";
    return "Staff";
  }
  if (roles.includes("driver")) return "Driver";
  return "Admin"; // Odoo admin / no fleet groups
}

// Offline mock logins — only when VITE_USE_MOCK_AUTH=true (never for admin; needs real Odoo session)
const USE_MOCK_AUTH = import.meta.env.VITE_USE_MOCK_AUTH === "true";

const MOCK_USERS = {
  "fleet.manager@mesob.com": { password: "Manager@123", role: "Admin", name: "Fleet Manager" },
  "tigist.haile@mesob.com": { password: "Dispatcher@123", role: "Dispatcher", name: "Tigist Haile" },
  "rahel.mekonnen@mesob.com": { password: "Dispatcher@123", role: "Dispatcher", name: "Rahel Mekonnen" },
  "dawit.bekele@mesob.com": { password: "Staff@123", role: "Staff", name: "Dawit Bekele" },
  "kebede.worku@mesob.com": { password: "Staff@123", role: "Staff", name: "Kebede Worku" },
  "abebe.kebede@mesob.com": { password: "Driver@123", role: "Driver", name: "Abebe Kebede" },
  "sara.tesfaye@mesob.com": { password: "Driver@123", role: "Driver", name: "Sara Tesfaye" },
  "yonas.girma@mesob.com": { password: "Driver@123", role: "Driver", name: "Yonas Girma" },
  "mekdes.alemu@mesob.com": { password: "Driver@123", role: "Driver", name: "Mekdes Alemu" },
  "hana.worku@mesob.com": { password: "Driver@123", role: "Driver", name: "Hana Worku" },
  "tesfaye.mulugeta@mesob.com": { password: "Driver@123", role: "Driver", name: "Tesfaye Mulugeta" },
  "liya.solomon@mesob.com": { password: "Driver@123", role: "Driver", name: "Liya Solomon" },
  "biruk.tadesse@mesob.com": { password: "Mechanic@123", role: "Mechanic", name: "Biruk Tadesse" },
};

async function verifyOdooSession() {
  try {
    const res = await fetch("/web/session/get_session_info", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 99, params: {} }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return false;
    const data = await res.json();
    return Boolean(data?.result?.uid);
  } catch {
    return false;
  }
}

// ── Multi-step login ──────────────────────────────────────────────────────────
async function performLogin(username, password) {
  // ── Step 1: Odoo mobile API (creates session cookie for subsequent API calls) ─
  console.log("🔐 Attempting authentication via mobile API for:", username);
  try {
    const mobileRes = await fetch("/api/mobile/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        id: 1,
        params: {
          username: username,
          password: password
        }
      }),
    });

    if (mobileRes.ok) {
      const mobileData = await mobileRes.json();
      console.log("📦 Mobile API response:", mobileData);
      
      const result = mobileData?.result;
      if (result?.success && result.user) {
        const sessionOk = await verifyOdooSession();
        if (!sessionOk) {
          throw new Error(
            "Login succeeded but session cookie was not saved. Check the dev proxy or try again."
          );
        }
        console.log("✅ Mobile API authentication successful");
        return {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email || username,
          roles: result.user.roles || [],
          is_driver: result.user.is_driver || false,
          employee_id: result.user.employee_id || null,
          job_title: result.user.job_title || "",
        };
      }
      if (result?.success === false && result?.error) {
        throw new Error(
          result.error.toLowerCase().includes("invalid")
            ? "Invalid credentials. Please try again."
            : result.error
        );
      }
    }
  } catch (mobileErr) {
    if (mobileErr.message?.includes("Invalid credentials")) throw mobileErr;
    console.warn("⚠️ Mobile API failed, trying standard auth:", mobileErr);
  }

  // ── Step 3: Fallback to standard Odoo authentication ──────────────────────
  console.log("🔐 Attempting Odoo authentication for:", username);
  let authRes;
  try {
    authRes = await fetch("/web/session/authenticate", {
      method: "POST", 
      credentials: "include",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0", 
        method: "call", 
        id: 1,
        params: { 
          db: "messob_db", 
          login: username, 
          password 
        },
      }),
    });
  } catch (err) {
    console.error("❌ Network error during authentication:", err);
    throw new Error("Network error. Check your connection.");
  }

  const ct = authRes.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    console.error("❌ Invalid content type:", ct);
    throw new Error("Server error. Please try again.");
  }

  const authRaw  = await authRes.json();
  console.log("📦 Authentication response:", authRaw);
  
  const authData = authRaw?.result;
  if (!authData?.uid) {
    console.error("❌ Authentication failed - no UID in response");
    throw new Error("Invalid credentials. Please try again.");
  }

  console.log("✅ Authentication successful - UID:", authData.uid);

  const sessionOk = await verifyOdooSession();
  if (!sessionOk) {
    throw new Error(
      "Login succeeded but session cookie was not saved. Check the dev proxy or try again."
    );
  }

  // ── Special handling for admin user ──────────────────────────────────────
  if (username === "admin" && authData?.uid) {
    return {
      id: authData.uid,
      name: authData.name || "Administrator",
      email: authData.username || "admin",
      roles: ["fleet_manager"],
      is_driver: false,
      employee_id: null,
      job_title: "System Administrator",
    };
  }

  const uid   = authData.uid;
  const name  = authData.name  || username;
  const email = authData.username || username;

  // ── Step 2: Fast path — /api/user/info (sudo, returns everything) ─────────
  try {
    const infoRes = await fetch("/api/user/info", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 2, params: {} }),
    });
    if (infoRes.ok) {
      const infoRaw = await infoRes.json();
      const info    = infoRaw?.result;
      if (info?.success && info.user) {
        return {
          id: uid, name, email,
          roles:       info.user.roles       || [],
          is_driver:   info.user.is_driver   || false,
          employee_id: info.user.employee_id || null,
          job_title:   info.user.job_title   || "",
        };
      }
    }
  } catch (_) { /* fallback */ }

  // ── Step 3: Fast path — /api/fleet/me (sudo, returns everything) ──────────
  try {
    const meRes = await fetch("/api/fleet/me", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 3, params: {} }),
    });
    if (meRes.ok) {
      const meRaw = await meRes.json();
      const me    = meRaw?.result;
      if (me?.success && me.user) {
        return {
          id: uid, name, email,
          roles:       me.user.roles       || [],
          is_driver:   me.user.is_driver   || false,
          employee_id: me.user.employee_id || null,
          job_title:   me.user.job_title   || "",
        };
      }
    }
  } catch (_) { /* fallback */ }

  // ── Step 4: Probe-based detection (fallback when service hasn't reloaded) ──
  const roles    = [];
  let isDriver   = false;
  let employeeId = null;
  let jobTitle   = "";

  // 4a. Read job_title from res.users — always readable by the user themselves
  //     This is the KEY to distinguishing Mechanic from Staff
  try {
    const userRes = await fetch("/web/dataset/call_kw", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: 4,
        params: {
          model: "res.users", method: "read",
          args: [[uid]],
          kwargs: { fields: ["job_title"] },
        },
      }),
    });
    const userRaw = await userRes.json();
    jobTitle = userRaw?.result?.[0]?.job_title || "";
  } catch (_) { /* ignore */ }

  // 4b. Probe dispatcher access (vehicles endpoint is dispatcher/manager only)
  try {
    const vRes = await fetch("/api/fleet/vehicles", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 5, params: {} }),
    });
    const vRaw    = await vRes.json();
    const vResult = vRaw?.result;
    if (vResult?.success === true) {
      roles.push("fleet_dispatcher");
      // 4c. Probe manager access (users endpoint is manager-only)
      try {
        const uRes = await fetch("/api/fleet/users", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 6, params: {} }),
        });
        const uRaw = await uRes.json();
        if (uRaw?.result?.success === true) roles.push("fleet_manager");
      } catch (_) { /* ignore */ }
    } else if (vResult?.error === "Insufficient permissions") {
      roles.push("fleet_user");
    }
  } catch (_) { /* ignore */ }

  // 4d. Check is_driver from hr.employee (may work if view is fixed)
  try {
    const empRes = await fetch("/web/dataset/call_kw", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: 7,
        params: {
          model: "hr.employee", method: "search_read",
          args: [[["user_id", "=", uid]]],
          kwargs: { fields: ["id", "is_driver"], limit: 1 },
        },
      }),
    });
    const empRaw = await empRes.json();
    const emp    = empRaw?.result?.[0];
    if (emp) {
      employeeId = emp.id;
      isDriver   = emp.is_driver || false;
      if (isDriver && !roles.includes("fleet_user")) roles.push("fleet_user");
      if (isDriver && !roles.includes("driver"))     roles.push("driver");
    }
  } catch (_) { /* ignore */ }

  // 4e. Fallback: trip requests probe (fleet_user fallback)
  if (roles.length === 0) {
    try {
      const trRes = await fetch("/api/mobile/user/trip-requests", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 8, params: {} }),
      });
      const trRaw = await trRes.json();
      if (trRaw?.result?.success === true) roles.push("fleet_user");
    } catch (_) { /* ignore */ }
  }

  return { id: uid, name, email, roles, is_driver: isDriver, employee_id: employeeId, job_title: jobTitle };
}

function tryMockLogin(username, password) {
  if (!USE_MOCK_AUTH) return null;
  const mockUser = MOCK_USERS[username];
  if (!mockUser || mockUser.password !== password) return null;
  return {
    id: Math.floor(Math.random() * 1000) + 1,
    name: mockUser.name,
    email: username,
    roles: [mockUser.role.toLowerCase().replace(" ", "_")],
    is_driver: mockUser.role === "Driver",
    employee_id: Math.floor(Math.random() * 100) + 1,
    job_title: mockUser.role,
  };
}

function persistAuthSnapshot(userState) {
  const persistData = {
    state: {
      user: userState.user,
      isAuthenticated: true,
    },
    version: 0,
  };
  const serialized = JSON.stringify(persistData);
  localStorage.setItem("messob-auth", serialized);
  sessionStorage.setItem("messob-auth-backup", serialized);
}

// ── Zustand store ─────────────────────────────────────────────────────────────
export const useUserStore = create(
  persist(
    (set, get) => ({
      user:            null,
      isAuthenticated: false,
      loginError:      null,
      _hasHydrated:    false, // Track if store has been rehydrated

      // Mark store as hydrated
      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },

      login: async (username, password) => {
        console.log("🚀 Login initiated for:", username);
        set({ loginError: null });
        try {
          const userData = await performLogin(username, password);
          const role     = detectRole(userData.roles, userData.is_driver, userData.job_title);

          console.log("👤 User data received:", userData);
          console.log("🎭 Detected role:", role);

          const userState = {
            user: {
              id:          userData.id,
              name:        userData.name,
              email:       userData.email,
              role,
              roles:       userData.roles,
              employee_id: userData.employee_id,
              is_driver:   userData.is_driver,
              job_title:   userData.job_title,
            },
            isAuthenticated: true,
            loginError:      null,
          };

          set(userState);
          persistAuthSnapshot(userState);
          console.log("✅ Login successful - returning to caller");
          return { success: true, role, user: userState.user };
        } catch (err) {
          console.error("❌ Login failed:", err);
          const isNetwork = /network|connection|failed to fetch/i.test(err.message || "");
          // Optional offline mock only when Odoo is unreachable (not wrong password)
          const mockData = isNetwork ? tryMockLogin(username, password) : null;
          if (mockData) {
            const role = detectRole(mockData.roles, mockData.is_driver, mockData.job_title);
            const userState = {
              user: {
                id: mockData.id,
                name: mockData.name,
                email: mockData.email,
                role,
                roles: mockData.roles,
                employee_id: mockData.employee_id,
                is_driver: mockData.is_driver,
                job_title: mockData.job_title,
              },
              isAuthenticated: true,
              loginError: null,
            };
            set(userState);
            persistAuthSnapshot(userState);
            return { success: true, role, user: userState.user };
          }
          set({ loginError: err.message, isAuthenticated: false, user: null });
          return { success: false, error: err.message };
        }
      },

      logout: async () => {
        console.log("🚪 Logout initiated");
        localStorage.removeItem("messob-auth");
        sessionStorage.removeItem("messob-auth-backup");
        set({ user: null, isAuthenticated: false, loginError: null });
        try {
          await fetch("/web/session/destroy", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }),
          });
        } catch (_) { /* ignore */ }
        console.log("✅ Logout complete");
      },

      // Helper to check if user is authenticated (for debugging)
      checkAuth: () => {
        const state = get();
        console.log("🔍 Auth check:", {
          isAuthenticated: state.isAuthenticated,
          hasUser: !!state.user,
          userRole: state.user?.role,
          hasHydrated: state._hasHydrated,
        });
        return state.isAuthenticated;
      },

      // Force restore from storage (recovery mechanism)
      restoreFromStorage: () => {
        console.log("🔄 Attempting to restore auth state from storage...");
        try {
          // Try localStorage first
          let stored = localStorage.getItem("messob-auth");
          
          // Fallback to sessionStorage backup
          if (!stored) {
            console.log("⚠️ localStorage empty, trying sessionStorage backup");
            stored = sessionStorage.getItem("messob-auth-backup");
          }
          
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.state && parsed.state.isAuthenticated && parsed.state.user) {
              set({
                user: parsed.state.user,
                isAuthenticated: true,
                loginError: null,
              });
              console.log("✅ Auth state restored from storage:", parsed.state.user.role);
              return true;
            }
          }
          console.log("❌ No valid auth state found in storage");
          return false;
        } catch (err) {
          console.error("❌ Failed to restore from storage:", err);
          return false;
        }
      },
    }),
    {
      name: "messob-auth",
      partialize: (state) => ({
        user:            state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Hydration error:", error);
        } else if (state?.isAuthenticated) {
          console.log("Auth rehydrated:", state.user?.role);
        }
        useUserStore.setState({ _hasHydrated: true });
      },
    }
  )
);
