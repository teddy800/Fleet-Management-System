/**
 * Advanced Authentication Persistence Layer
 * 
 * This module ensures authentication state survives:
 * - Page refreshes
 * - Navigation
 * - React re-renders
 * - Browser back/forward
 */

const AUTH_KEY = "messob-auth";
const BACKUP_KEY = "messob-auth-backup";
const SESSION_KEY = "messob-session-active";

/**
 * Initialize authentication persistence
 * Call this BEFORE React renders
 */
export function initAuthPersistence() {
  console.log("🔐 Initializing authentication persistence layer...");
  
  // Mark session as active
  sessionStorage.setItem(SESSION_KEY, "true");
  
  // Check if we have auth data
  const authData = localStorage.getItem(AUTH_KEY);
  const backupData = sessionStorage.getItem(BACKUP_KEY);
  
  if (authData) {
    console.log("✅ Found auth data in localStorage");
    try {
      const parsed = JSON.parse(authData);
      if (parsed.state && parsed.state.isAuthenticated) {
        console.log("✅ Valid auth state found:", parsed.state.user?.role);
        
        // Ensure backup exists
        if (!backupData) {
          sessionStorage.setItem(BACKUP_KEY, authData);
          console.log("✅ Created sessionStorage backup");
        }
        
        return true;
      }
    } catch (err) {
      console.error("❌ Failed to parse auth data:", err);
    }
  } else if (backupData) {
    console.log("⚠️ No localStorage but found backup - restoring");
    try {
      const parsed = JSON.parse(backupData);
      if (parsed.state && parsed.state.isAuthenticated) {
        localStorage.setItem(AUTH_KEY, backupData);
        console.log("✅ Restored auth from backup");
        return true;
      }
    } catch (err) {
      console.error("❌ Failed to restore from backup:", err);
    }
  }
  
  console.log("ℹ️ No valid auth state found");
  return false;
}

/**
 * Save authentication state with redundancy
 */
export function saveAuthState(state) {
  console.log("💾 Saving auth state with redundancy...");
  
  const data = {
    state: {
      user: state.user,
      isAuthenticated: state.isAuthenticated,
    },
    version: 0,
    timestamp: Date.now(),
  };
  
  const serialized = JSON.stringify(data);
  
  try {
    // Save to localStorage
    localStorage.setItem(AUTH_KEY, serialized);
    console.log("✅ Saved to localStorage");
    
    // Save backup to sessionStorage
    sessionStorage.setItem(BACKUP_KEY, serialized);
    console.log("✅ Saved to sessionStorage backup");
    
    // Verify both saves
    const lsCheck = localStorage.getItem(AUTH_KEY);
    const ssCheck = sessionStorage.getItem(BACKUP_KEY);
    
    if (lsCheck === serialized && ssCheck === serialized) {
      console.log("✅ Both storage locations verified");
      return true;
    } else {
      console.error("❌ Storage verification failed");
      return false;
    }
  } catch (err) {
    console.error("❌ Failed to save auth state:", err);
    return false;
  }
}

/**
 * Load authentication state with fallback
 */
export function loadAuthState() {
  console.log("📂 Loading auth state...");
  
  // Try localStorage first
  let data = localStorage.getItem(AUTH_KEY);
  let source = "localStorage";
  
  // Fallback to sessionStorage
  if (!data) {
    console.log("⚠️ localStorage empty, trying backup");
    data = sessionStorage.getItem(BACKUP_KEY);
    source = "sessionStorage";
    
    // Restore to localStorage if found in backup
    if (data) {
      localStorage.setItem(AUTH_KEY, data);
      console.log("✅ Restored localStorage from backup");
    }
  }
  
  if (!data) {
    console.log("ℹ️ No auth state found");
    return null;
  }
  
  try {
    const parsed = JSON.parse(data);
    console.log(`✅ Loaded auth state from ${source}:`, parsed.state?.user?.role);
    return parsed.state;
  } catch (err) {
    console.error("❌ Failed to parse auth state:", err);
    return null;
  }
}

/**
 * Clear all authentication data
 */
export function clearAuthState() {
  console.log("🗑️ Clearing all auth state...");
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(BACKUP_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  console.log("✅ Auth state cleared");
}

/**
 * Check if session is active
 */
export function isSessionActive() {
  return sessionStorage.getItem(SESSION_KEY) === "true";
}

/**
 * Periodic sync to prevent data loss
 */
export function startAuthSync() {
  console.log("🔄 Starting auth sync monitor...");
  
  const syncInterval = setInterval(() => {
    const lsData = localStorage.getItem(AUTH_KEY);
    const ssData = sessionStorage.getItem(BACKUP_KEY);
    
    // If localStorage is missing but backup exists, restore
    if (!lsData && ssData) {
      console.log("🔄 Auto-restoring localStorage from backup");
      localStorage.setItem(AUTH_KEY, ssData);
    }
    
    // If backup is missing but localStorage exists, recreate backup
    if (lsData && !ssData) {
      console.log("🔄 Auto-recreating sessionStorage backup");
      sessionStorage.setItem(BACKUP_KEY, lsData);
    }
  }, 5000); // Check every 5 seconds
  
  // Clean up on page unload
  window.addEventListener("beforeunload", () => {
    clearInterval(syncInterval);
  });
  
  return syncInterval;
}

/**
 * Install global error handler for auth issues
 */
export function installAuthErrorHandler() {
  window.addEventListener("error", (event) => {
    if (event.message && event.message.includes("auth")) {
      console.error("🚨 Auth-related error detected:", event.message);
      
      // Try to recover
      const state = loadAuthState();
      if (state && state.isAuthenticated) {
        console.log("🔄 Attempting to recover auth state");
        saveAuthState(state);
      }
    }
  });
  
  console.log("✅ Auth error handler installed");
}

// Auto-initialize when module loads
if (typeof window !== "undefined") {
  initAuthPersistence();
  startAuthSync();
  installAuthErrorHandler();
  
  // Make utilities globally available for debugging
  window.authPersistence = {
    init: initAuthPersistence,
    save: saveAuthState,
    load: loadAuthState,
    clear: clearAuthState,
    isActive: isSessionActive,
  };
  
  console.log("✅ Auth persistence layer ready. Access via window.authPersistence");
}

export default {
  init: initAuthPersistence,
  save: saveAuthState,
  load: loadAuthState,
  clear: clearAuthState,
  isActive: isSessionActive,
  startSync: startAuthSync,
  installErrorHandler: installAuthErrorHandler,
};
