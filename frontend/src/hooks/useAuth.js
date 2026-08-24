import { useEffect, useState, useMemo } from "react";
import { useUserStore } from "@/store/useUserStore";

const AUTH_KEY = "messob-auth";
const BACKUP_KEY = "messob-auth-backup";

/** Read persisted auth from storage (Zustand persist format). */
export function readAuthFromStorage() {
  try {
    const raw =
      localStorage.getItem(AUTH_KEY) ||
      sessionStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.state?.isAuthenticated && parsed?.state?.user) {
      return parsed.state;
    }
  } catch (error) {
    console.warn("⚠️ Failed to read auth from storage:", error);
    // Clear corrupted storage
    try {
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(BACKUP_KEY);
    } catch (e) {
      console.warn("⚠️ Failed to clear corrupted storage:", e);
    }
  }
  return null;
}

/**
 * Single auth source for route guards and layout.
 * Waits for Zustand persist hydration, then falls back to storage.
 */
export function useAuth() {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const user = useUserStore((s) => s.user);
  const _hasHydrated = useUserStore((s) => s._hasHydrated);
  const restoreFromStorage = useUserStore((s) => s.restoreFromStorage);
  
  // Use internal hydration flag instead of persist.hasHydrated()
  const [hydrated, setHydrated] = useState(_hasHydrated);

  useEffect(() => {
    if (_hasHydrated && !hydrated) {
      setHydrated(true);
    }
  }, [_hasHydrated, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      console.log("🔄 No auth state, attempting restore from storage");
      restoreFromStorage();
    }
  }, [hydrated, isAuthenticated, restoreFromStorage]);

  const storageState = useMemo(() => {
    if (!hydrated) return null;
    return readAuthFromStorage();
  }, [hydrated, isAuthenticated, user]);

  const authed = isAuthenticated || !!storageState?.isAuthenticated;
  const currentUser = user || storageState?.user || null;

  console.log("🔍 useAuth state:", {
    hydrated,
    isAuthenticated,
    hasUser: !!user,
    hasStorageState: !!storageState,
    finalAuth: authed
  });

  return {
    ready: hydrated,
    isAuthenticated: authed,
    user: currentUser,
  };
}
