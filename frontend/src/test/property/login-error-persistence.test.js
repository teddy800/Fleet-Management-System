// Feature: react-frontend-integration, Property 6: loginError is never persisted
// Validates: Requirements 9.5

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 6: loginError is never persisted
 *
 * For any login attempt (success or failure), the value stored in
 * localStorage["messob-auth"] must not contain a loginError key.
 * The partialize function must exclude loginError from the persisted state.
 */

describe('Property 6: loginError is never persisted', () => {
  let originalFetch
  let originalWindowLocation

  beforeEach(() => {
    originalFetch = globalThis.fetch
    // Mock window.location to prevent jsdom navigation errors
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '/', assign: vi.fn() },
    })
    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
    vi.resetModules()
    localStorage.clear()
  })

  it('loginError is never present in localStorage["messob-auth"] after any login attempt', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary login scenarios: success or failure
        fc.boolean(),
        // Generate arbitrary error messages for failure cases
        fc.string({ minLength: 1, maxLength: 100 }),
        async (shouldSucceed, errorMsg) => {
          // Reset modules so we get a fresh store instance each iteration
          vi.resetModules()
          localStorage.clear()

          if (shouldSucceed) {
            // Mock a successful login response
            globalThis.fetch = vi.fn().mockResolvedValue({
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
                  roles: ['fleet_user'],
                  is_driver: false,
                  employee_id: 42,
                },
                session_id: 'abc123',
              }),
            })
          } else {
            // Mock a failed login response (non-JSON / HTML or error JSON)
            globalThis.fetch = vi.fn().mockResolvedValue({
              ok: false,
              status: 401,
              headers: {
                get: (name) => (name === 'content-type' ? 'application/json' : null),
              },
              json: async () => ({
                success: false,
                error: errorMsg,
              }),
            })
          }

          // Import a fresh store instance after resetting modules
          const { useUserStore } = await import('../../store/useUserStore.js')

          // Attempt login
          await useUserStore.getState().login('testuser', 'testpass')

          // Check localStorage — loginError must NOT be present
          const raw = localStorage.getItem('messob-auth')
          if (raw === null) {
            // Nothing persisted yet — that's fine, loginError is definitely not there
            return true
          }

          const persisted = JSON.parse(raw)
          const state = persisted.state || {}

          // The key assertion: loginError must not be in persisted state
          expect('loginError' in state).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('loginError is absent from localStorage even when login fails with various error messages', async () => {
    // Focused test: only failure scenarios with diverse error messages
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.constantFrom(
            'Invalid credentials',
            'User not found',
            'Account locked',
            'Network timeout',
            'Server error',
            '',
          ),
        ),
        async (errorMsg) => {
          vi.resetModules()
          localStorage.clear()

          globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            headers: {
              get: (name) => (name === 'content-type' ? 'application/json' : null),
            },
            json: async () => ({
              success: false,
              error: errorMsg || 'Login failed',
            }),
          })

          const { useUserStore } = await import('../../store/useUserStore.js')

          await useUserStore.getState().login('user', 'wrongpass')

          const raw = localStorage.getItem('messob-auth')
          if (raw === null) return true

          const persisted = JSON.parse(raw)
          const state = persisted.state || {}

          expect('loginError' in state).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
