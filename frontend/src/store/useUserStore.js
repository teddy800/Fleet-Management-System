import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  return "Admin";
}

// Offline mock logins
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

async function performLogin(username, password) {
  console.log("🔐 Attempting authentication for:", username);
  
  try {
    const mobileRes = await fetch("/api/mobile/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        id: 1,
        params: { username, password }
      }),
    });

    if (mobileRes.ok) {
      const mobileData = await mobileRes.json();
      const result = mobileData?.result;
      if (result?.success && result.user) {
        const sessionOk = await verifyOdooSession();
        if (!sessionOk) {
          throw new Error("Login succeeded but session cookie was not saved.");
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

  let authRes;
  try {
    authRes = await fetch("/web/session/authenticate", {
      method: "POST", 
      credentials: "include",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", 
        method: "call", 
        id: 1,
        params: { db: "messob_db", login: username, password },
      }),
    });
  } catch (err) {
    console.error("❌ Network error:", err);
    throw new Error("Network error. Check your connection.");
  }

  const ct = authRes.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error("Server error. Please try again.");
  }

  const authRaw = await authRes.json();
  const authData = authRaw?.result;
  
  if (!authData?.uid) {
    throw new Error("Invalid credentials. Please try again.");
  }

  console.log("✅ Authentication successful - UID:", authData.uid);

  const sessionOk = await verifyOdooSession();
  if (!sessionOk) {
    throw new Error("Login succeeded but session cookie was not saved.");
  }

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

  const uid = authData.uid;
  const name = authData.name || username;
  const email = authData.username || username;

  try {
    const infoRes = await fetch("/api/user/info", {
      method: "POST", 
      credentials: "include",
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
          job_title: info.user.job_title || "",
        };
      }
    }
  } catch (_) { /* fallback */ }

  return { 
    id: uid, 
    name, 
    email, 
    roles: ["fleet_user"], 
    is_driver: false, 
    employee_id: null, 
    job_title: "" 
  };
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

// Create store base first, then wrap with persist
const storeConfig = (set, get) => ({
  user: null,
  isAuthenticated: false,
  loginError: null,
  _hasHydrated: false,

  setHasHydrated: (state) => {
    set({ _hasHydrated: state });
  },

  login: async (username, password) => {
    console.log("🚀 Login initiated for:", username);
    set({ loginError: null });
    
    try {
      const userData = await performLogin(username, password);
      const role = detectRole(userData.roles, userData.is_driver, userData.job_title);

      console.log("👤 User data received:", userData);
      console.log("🎭 Detected role:", role);

      const userState = {
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role,
          roles: userData.roles,
          employee_id: userData.employee_id,
          is_driver: userData.is_driver,
          job_title: userData.job_title,
        },
        isAuthenticated: true,
        loginError: null,
      };

      set(userState);
      console.log("✅ Login successful");
      return { success: true, role, user: userState.user };
    } catch (err) {
      console.error("❌ Login failed:", err);
      const isNetwork = /network|connection|failed to fetch/i.test(err.message || "");
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
        return { success: true, role, user: userState.user };
      }
      
      set({ loginError: err.message, isAuthenticated: false, user: null });
      return { success: false, error: err.message };
    }
  },

  logout: async () => {
    console.log("🚪 Logout initiated");
    set({ user: null, isAuthenticated: false, loginError: null });
    try {
      await fetch("/web/session/destroy", {
        method: "POST", 
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }),
      });
    } catch (_) { /* ignore */ }
    console.log("✅ Logout complete");
  },

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

  restoreFromStorage: () => {
    console.log("🔄 Attempting to restore auth state from storage...");
    try {
      const stored = localStorage.getItem("messob-auth");
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
});

// Create the store with persist middleware
export const useUserStore = create(
  persist(storeConfig, {
    name: "messob-auth",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
    }),
    onRehydrateStorage: () => {
      return (state, error) => {
        if (error) {
          console.error("💧 Hydration error:", error);
          setTimeout(() => {
            useUserStore.setState({ 
              user: null, 
              isAuthenticated: false, 
              loginError: null,
              _hasHydrated: true 
            });
          }, 0);
        } else {
          if (state?.isAuthenticated) {
            console.log("💧 State rehydrated from localStorage:", state.user);
          } else {
            console.log("💧 No state to rehydrate");
          }
          setTimeout(() => {
            useUserStore.setState({ _hasHydrated: true });
          }, 0);
        }
      };
    },
  })
);
