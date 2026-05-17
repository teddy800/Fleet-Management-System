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
  } catch {
    /* ignore */
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
  const restoreFromStorage = useUserStore((s) => s.restoreFromStorage);
  const [hydrated, setHydrated] = useState(
    () => useUserStore.persist?.hasHydrated?.() ?? false
  );

  useEffect(() => {
    const finish = () => setHydrated(true);
    if (useUserStore.persist.hasHydrated()) {
      finish();
      return;
    }
    return useUserStore.persist.onFinishHydration(finish);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      restoreFromStorage();
    }
  }, [hydrated, isAuthenticated, restoreFromStorage]);

  const storageState = useMemo(
    () => (hydrated ? readAuthFromStorage() : null),
    [hydrated, isAuthenticated, user]
  );

  const authed = isAuthenticated || !!storageState?.isAuthenticated;
  const currentUser = user || storageState?.user || null;

  return {
    ready: hydrated,
    isAuthenticated: authed,
    user: currentUser,
  };
}
