// Feature: react-frontend-integration, Property 4: Login-to-display role round-trip consistency
// Validates: Requirements 2.7, 2.8, 9.1

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 4: Login-to-display role round-trip consistency
 *
 * Role priority mapping (from useUserStore.js):
 *   fleet_manager                          → Admin
 *   fleet_dispatcher (no manager)          → Dispatcher
 *   fleet_user + (is_driver OR driver role)→ Driver
 *   fleet_user + job_title contains mechanic → Mechanic
 *   fleet_user (no driver, no mechanic)    → Staff
 *   driver (no fleet groups)               → Driver
 *   empty roles array                      → Admin (Odoo admin fallback)
 */

const MECHANIC_KEYWORDS = ["mechanic", "technician", "maintenance tech", "service tech"];

/** Pure role-detection function mirroring useUserStore.detectRole() */
function detectExpectedRole(roles, isDriver = false, jobTitle = "") {
  if (roles.includes('fleet_manager'))    return 'Admin';
  if (roles.includes('fleet_dispatcher')) return 'Dispatcher';
  if (roles.includes('fleet_user')) {
    if (isDriver || roles.includes('driver')) return 'Driver';
    const jt = (jobTitle || '').toLowerCase();
    if (MECHANIC_KEYWORDS.some(k => jt.includes(k))) return 'Mechanic';
    return 'Staff';
  }
  if (roles.includes('driver')) return 'Driver';
  return 'Admin';
}

/**
 * Build mock fetch for the multi-step login flow:
 * 1. /web/session/authenticate → {uid, name}
 * 2. /api/user/info → {success, user: {roles, is_driver, job_title}}
 * 3. Any other probes → permission denied
 */
function mockLoginFetch(roles, isDriver = false, jobTitle = "") {
  return vi.fn().mockImplementation(async (url) => {
    const makeResponse = (data) => ({
      ok: true,
      status: 200,
      headers: { get: (n) => n === 'content-type' ? 'application/json' : null },
      json: async () => data,
    });

    if (typeof url === 'string' && url.includes('/web/session/authenticate')) {
      return makeResponse({
        result: { uid: 1, name: 'Test User', username: 'test@example.com' }
      });
    }

    if (typeof url === 'string' && url.includes('/api/user/info')) {
      return makeResponse({
        result: {
          success: true,
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            roles,
            is_driver: isDriver,
            employee_id: 42,
            job_title: jobTitle,
          }
        }
      });
    }

    // All other probes → permission denied
    return makeResponse({
      result: { success: false, error: 'Insufficient permissions' }
    });
  });
}

describe('Property 4: Login-to-display role round-trip consistency', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '/', assign: vi.fn() },
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it('store.user.role equals localStorage["messob-auth"].state.user.role after login', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.subarray(['fleet_manager', 'fleet_dispatcher', 'fleet_user', 'driver']),
        async (roles) => {
          vi.resetModules();
          localStorage.clear();

          globalThis.fetch = mockLoginFetch(roles);

          const { useUserStore } = await import('../../store/useUserStore.js');
          const result = await useUserStore.getState().login('testuser', 'testpass');
          expect(result.success).toBe(true);

          const storeRole = useUserStore.getState().user?.role;
          expect(storeRole).toBeDefined();

          const raw = localStorage.getItem('messob-auth');
          expect(raw).not.toBeNull();
          const persisted = JSON.parse(raw);
          const localStorageRole = persisted?.state?.user?.role;
          expect(localStorageRole).toBeDefined();

          // Core round-trip: store === localStorage
          expect(storeRole).toBe(localStorageRole);

          // Both must equal the expected role
          const expectedRole = detectExpectedRole(roles);
          expect(storeRole).toBe(expectedRole);
          expect(localStorageRole).toBe(expectedRole);

          // Must be a valid display role
          const validRoles = ['Admin', 'Dispatcher', 'Staff', 'Driver', 'Mechanic'];
          expect(validRoles).toContain(storeRole);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('hydrating store from localStorage preserves the role identity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.subarray(['fleet_manager', 'fleet_dispatcher', 'fleet_user', 'driver']),
        async (roles) => {
          vi.resetModules();
          localStorage.clear();

          globalThis.fetch = mockLoginFetch(roles);

          const { useUserStore: store1 } = await import('../../store/useUserStore.js');
          await store1.getState().login('testuser', 'testpass');
          const roleAfterLogin = store1.getState().user?.role;

          const raw = localStorage.getItem('messob-auth');
          expect(raw).not.toBeNull();
          const persistedRole = JSON.parse(raw)?.state?.user?.role;
          expect(persistedRole).toBe(roleAfterLogin);

          vi.resetModules();
          const { useUserStore: store2 } = await import('../../store/useUserStore.js');
          const roleAfterHydration = store2.getState().user?.role;
          expect(roleAfterHydration).toBe(persistedRole);
          expect(roleAfterHydration).toBe(roleAfterLogin);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Mechanic role detected when job_title contains mechanic keyword', async () => {
    vi.resetModules();
    localStorage.clear();

    // fleet_user + job_title "Mechanic" → Mechanic role
    globalThis.fetch = mockLoginFetch(['fleet_user'], false, 'Mechanic');

    const { useUserStore } = await import('../../store/useUserStore.js');
    const result = await useUserStore.getState().login('biruk', 'pass');
    expect(result.success).toBe(true);
    expect(useUserStore.getState().user?.role).toBe('Mechanic');
  });

  it('Driver role detected when fleet_user + is_driver=true', async () => {
    vi.resetModules();
    localStorage.clear();

    globalThis.fetch = mockLoginFetch(['fleet_user', 'driver'], true, 'Driver');

    const { useUserStore } = await import('../../store/useUserStore.js');
    const result = await useUserStore.getState().login('abebe', 'pass');
    expect(result.success).toBe(true);
    expect(useUserStore.getState().user?.role).toBe('Driver');
  });

  it('Staff role detected when fleet_user + not driver + not mechanic', async () => {
    vi.resetModules();
    localStorage.clear();

    globalThis.fetch = mockLoginFetch(['fleet_user'], false, 'Staff Member');

    const { useUserStore } = await import('../../store/useUserStore.js');
    const result = await useUserStore.getState().login('dawit', 'pass');
    expect(result.success).toBe(true);
    expect(useUserStore.getState().user?.role).toBe('Staff');
  });

  it('Admin fallback when no fleet groups', async () => {
    vi.resetModules();
    localStorage.clear();

    globalThis.fetch = mockLoginFetch([], false, '');

    const { useUserStore } = await import('../../store/useUserStore.js');
    const result = await useUserStore.getState().login('admin', 'admin');
    expect(result.success).toBe(true);
    expect(useUserStore.getState().user?.role).toBe('Admin');
  });
});
