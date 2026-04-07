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
 * Role priority mapping:
 *   fleet_manager  → Admin
 *   fleet_dispatcher (no manager) → Dispatcher
 *   fleet_user (no dispatcher/manager) → Staff
 *   driver (no fleet groups) → Driver
 *   empty roles array → Admin
 */

/** Pure role-detection function mirroring useUserStore.login() logic */
function detectExpectedRole(roles) {
  if (roles.includes('fleet_manager')) return 'Admin'
  if (roles.includes('fleet_dispatcher')) return 'Dispatcher'
  if (roles.includes('fleet_user')) return 'Staff'
  if (roles.includes('driver')) return 'Driver'
  return 'Admin' // empty array → Odoo admin
}

/** Build a mock successful login fetch response for the given roles array */
function mockLoginFetch(roles) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: {
      get: (name) => (name === 'content-type' ? 'application/json' : null),
    },
    json: async () => ({
      success: true,
      user: {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        roles,
        is_driver: roles.includes('driver'),
        employee_id: 42,
      },
      session_id: 'test-session-abc',
    }),
  })
}

describe('Property 4: Login-to-display role round-trip consistency', () => {
  beforeEach(() => {
    // Prevent jsdom navigation errors from window.location.href assignments
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
        // Generate arbitrary subsets of the known Odoo role strings
        fc.subarray(['fleet_manager', 'fleet_dispatcher', 'fleet_user', 'driver']),
        async (roles) => {
          // Reset modules so each iteration gets a fresh Zustand store instance
          vi.resetModules()
          localStorage.clear()

          // Mock fetch to return a successful login with the generated roles
          globalThis.fetch = mockLoginFetch(roles)

          // Import a fresh store instance
          const { useUserStore } = await import('../../store/useUserStore.js')

          // Perform login
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
          //    Verify the role is one of the valid display values the Sidebar accepts.
          const validDisplayRoles = ['Admin', 'Dispatcher', 'Staff', 'Driver']
          expect(validDisplayRoles).toContain(storeRole)
        }
      ),
      { numRuns: 100 }
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

          // Second store instance: simulate a page reload by resetting modules
          // and re-importing (Zustand persist will rehydrate from localStorage)
          vi.resetModules()
          const { useUserStore: store2 } = await import('../../store/useUserStore.js')

          // After hydration, the role must be identical to what was persisted
          const roleAfterHydration = store2.getState().user?.role
          expect(roleAfterHydration).toBe(persistedRole)
          expect(roleAfterHydration).toBe(roleAfterLogin)
        }
      ),
      { numRuns: 100 }
    )
  })
})
