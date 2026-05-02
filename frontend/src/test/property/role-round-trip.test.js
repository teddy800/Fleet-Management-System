// Feature: react-frontend-integration, Property 4: Login-to-display role round-trip consistency
// Validates: Requirements 2.7, 2.8, 9.1

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 4: Login-to-display role round-trip consistency
 *
 * For any successful login response, the role stored in useUserStore must equal
 * the role displayed in the Sidebar role badge, and the role persisted in
 * localStorage["messob-auth"] must equal the role in the store.
 *
 * The round-trip: login → store.user.role → localStorage → hydrate → store.user.role → badge text
 * must be identity-preserving.
 *
 * Role priority mapping (from useUserStore.js):
 *   fleet_manager  → Admin
 *   fleet_dispatcher (no manager) → Dispatcher
 *   fleet_user (no dispatcher/manager) + is_driver → Driver
 *   fleet_user (no dispatcher/manager) → Staff
 *   driver (no fleet groups) → Driver
 *   empty roles array → Admin (Odoo admin fallback)
 *
 * Auth flow (new multi-step):
 *   1. POST /web/session/authenticate → {uid, name}
 *   2. POST /api/user/info OR fleet API probes → roles
 */

/** Pure role-detection function mirroring useUserStore.login() logic */
function detectExpectedRole(roles, isDriver = false) {
  if (roles.includes('fleet_manager')) return 'Admin'
  if (roles.includes('fleet_dispatcher')) return 'Dispatcher'
  if (roles.includes('fleet_user')) {
    // fleet_user + driver role OR is_driver flag → Driver
    return (isDriver || roles.includes('driver')) ? 'Driver' : 'Staff'
  }
  if (roles.includes('driver')) return 'Driver'
  return 'Admin' // empty array → Odoo admin
}

/**
 * Build mock fetch that handles the multi-step login flow:
 * 1. /web/session/authenticate → {uid, name, username}
 * 2. /api/user/info → {success, user: {roles, is_driver}}
 * 3. Any subsequent probes → permission denied (so role stays from step 2)
 */
function mockLoginFetch(roles, isDriver = false) {
  let callCount = 0
  return vi.fn().mockImplementation(async (url) => {
    callCount++
    const makeResponse = (data) => ({
      ok: true,
      status: 200,
      headers: { get: (n) => n === 'content-type' ? 'application/json' : null },
      json: async () => data,
    })

    // Step 1: authenticate
    if (typeof url === 'string' && url.includes('/web/session/authenticate')) {
      return makeResponse({
        result: { uid: 1, name: 'Test User', username: 'test@example.com' }
      })
    }

    // Step 2: /api/user/info — return roles directly
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
          }
        }
      })
    }

    // All other probes (fleet/vehicles, fleet/users, etc.) → permission denied
    return makeResponse({
      result: { success: false, error: 'Insufficient permissions' }
    })
  })
}

describe('Property 4: Login-to-display role round-trip consistency', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '/', assign: vi.fn() },
    })
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    localStorage.clear()
  })

  it('store.user.role equals localStorage["messob-auth"].state.user.role after login', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.subarray(['fleet_manager', 'fleet_dispatcher', 'fleet_user', 'driver']),
        async (roles) => {
          vi.resetModules()
          localStorage.clear()

          globalThis.fetch = mockLoginFetch(roles)

          const { useUserStore } = await import('../../store/useUserStore.js')

          const result = await useUserStore.getState().login('testuser', 'testpass')
          expect(result.success).toBe(true)

          // 1. Read role from the store
          const storeRole = useUserStore.getState().user?.role
          expect(storeRole).toBeDefined()

          // 2. Read role from localStorage (the persisted state)
          const raw = localStorage.getItem('messob-auth')
          expect(raw).not.toBeNull()

          const persisted = JSON.parse(raw)
          const localStorageRole = persisted?.state?.user?.role
          expect(localStorageRole).toBeDefined()

          // 3. Core round-trip assertion: store role === localStorage role
          expect(storeRole).toBe(localStorageRole)

          // 4. Both must equal the deterministically expected role
          const expectedRole = detectExpectedRole(roles)
          expect(storeRole).toBe(expectedRole)
          expect(localStorageRole).toBe(expectedRole)

          // 5. Sidebar badge text: the badge renders user?.role directly.
          const validDisplayRoles = ['Admin', 'Dispatcher', 'Staff', 'Driver']
          expect(validDisplayRoles).toContain(storeRole)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('hydrating store from localStorage preserves the role identity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.subarray(['fleet_manager', 'fleet_dispatcher', 'fleet_user', 'driver']),
        async (roles) => {
          vi.resetModules()
          localStorage.clear()

          globalThis.fetch = mockLoginFetch(roles)

          // First store instance: perform login (writes to localStorage)
          const { useUserStore: store1 } = await import('../../store/useUserStore.js')
          await store1.getState().login('testuser', 'testpass')
          const roleAfterLogin = store1.getState().user?.role

          // Capture what was persisted
          const raw = localStorage.getItem('messob-auth')
          expect(raw).not.toBeNull()
          const persistedRole = JSON.parse(raw)?.state?.user?.role

          // The persisted role must match what the store held
          expect(persistedRole).toBe(roleAfterLogin)

          // Second store instance: simulate a page reload
          vi.resetModules()
          const { useUserStore: store2 } = await import('../../store/useUserStore.js')

          // After hydration, the role must be identical to what was persisted
          const roleAfterHydration = store2.getState().user?.role
          expect(roleAfterHydration).toBe(persistedRole)
          expect(roleAfterHydration).toBe(roleAfterLogin)
        }
      ),
      { numRuns: 50 }
    )
  })
})
