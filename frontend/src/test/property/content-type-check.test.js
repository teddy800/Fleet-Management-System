// Feature: react-frontend-integration, Property 2: Content-Type is checked before JSON parsing
// Validates: Requirements 4.3, 4.6

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 2: Content-Type is checked before JSON parsing
 *
 * For any HTTP response whose Content-Type header does not include "application/json",
 * the request() function must:
 *   1. Throw an error matching /Session expired|backend returned HTML/
 *   2. Never call res.json()
 */

// Non-JSON content types to test against
const nonJsonContentTypes = fc.oneof(
  fc.constantFrom(
    'text/html',
    'text/html; charset=utf-8',
    'text/plain',
    'text/plain; charset=utf-8',
    'application/xml',
    'application/xhtml+xml',
    'text/xml',
    'text/css',
    'application/octet-stream',
    'multipart/form-data',
  ),
  // Also generate arbitrary non-JSON content types
  fc.string({ minLength: 1, maxLength: 50 }).filter(
    (s) => !s.includes('application/json')
  )
)

describe('Property 2: Content-Type is checked before JSON parsing', () => {
  let originalFetch
  let originalWindowLocation

  beforeEach(() => {
    originalFetch = globalThis.fetch
    // Mock window.location to prevent jsdom navigation errors
    originalWindowLocation = window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '/', assign: vi.fn() },
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalWindowLocation,
    })
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('throws matching /Session expired|backend returned HTML/ for any non-JSON Content-Type', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonJsonContentTypes,
        async (contentType) => {
          // Track whether json() was called
          const jsonSpy = vi.fn()

          const mockResponse = {
            ok: true,
            status: 200,
            headers: {
              get: (name) => {
                if (name === 'content-type') return contentType
                return null
              },
            },
            json: jsonSpy,
            text: async () => '<html><body>Login</body></html>',
          }

          globalThis.fetch = vi.fn().mockResolvedValue(mockResponse)

          // Dynamically import api.js — ESM module is cached, but fetch is resolved at call time
          const { authApi } = await import('../../lib/api.js')

          // The request() must throw with the expected message
          await expect(authApi.login('user', 'pass')).rejects.toThrow(
            /Session expired|backend returned HTML/
          )

          // res.json() must never be called on non-JSON responses
          expect(jsonSpy).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('does NOT throw for application/json Content-Type (control case)', async () => {
    const jsonSpy = vi.fn().mockResolvedValue({ success: true, user: { id: 1, name: 'Test', email: 'test@test.com', roles: [], is_driver: false, employee_id: null } })

    const mockResponse = {
      ok: true,
      status: 200,
      headers: {
        get: (name) => {
          if (name === 'content-type') return 'application/json'
          return null
        },
      },
      json: jsonSpy,
    }

    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse)

    const { authApi } = await import('../../lib/api.js')

    // Should NOT throw — JSON content type is valid
    await expect(authApi.login('user', 'pass')).resolves.toBeDefined()

    // res.json() SHOULD be called for JSON responses
    expect(jsonSpy).toHaveBeenCalled()
  })

  it('also handles application/json with charset suffix correctly (control case)', async () => {
    const jsonSpy = vi.fn().mockResolvedValue({ success: true, data: {} })

    const mockResponse = {
      ok: true,
      status: 200,
      headers: {
        get: (name) => {
          if (name === 'content-type') return 'application/json; charset=utf-8'
          return null
        },
      },
      json: jsonSpy,
    }

    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse)

    const { analyticsApi } = await import('../../lib/api.js')

    await expect(analyticsApi.dashboard()).resolves.toBeDefined()
    expect(jsonSpy).toHaveBeenCalled()
  })
})
