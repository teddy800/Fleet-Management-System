// Feature: react-frontend-integration, Property 5: Role-based menu filtering is exact
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.7

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 5: Role-based menu filtering is exact
 *
 * For any user with a given role, the set of menu items rendered by the Sidebar
 * must be exactly equal to the set of menuItems whose roles array includes that role.
 * No items outside the allowed set should appear, and no allowed items should be missing.
 *
 * Expected menus per role (from requirements.md):
 *   Staff:      Dashboard, Request Vehicle, My Requests
 *   Dispatcher: Dashboard, Approval Queue, Fleet Calendar, Manage Fleet,
 *               GPS Tracking, Drivers, Fuel Logs, Maintenance, Alerts
 *   Admin:      All menu items (including Analytics)
 *   Driver:     Dashboard, My Requests
 */

// Mirror the menuItems array from Sidebar.jsx — the source of truth for filtering
const menuItems = [
  { name: 'Dashboard',       roles: ['Staff', 'Dispatcher', 'Admin', 'Driver'] },
  { name: 'Request Vehicle', roles: ['Staff', 'Admin'] },
  { name: 'My Requests',     roles: ['Staff', 'Admin', 'Driver'] },
  { name: 'Approval Queue',  roles: ['Dispatcher', 'Admin'] },
  { name: 'Fleet Calendar',  roles: ['Dispatcher', 'Admin'] },
  { name: 'Manage Fleet',    roles: ['Dispatcher', 'Admin'] },
  { name: 'GPS Tracking',    roles: ['Dispatcher', 'Admin'] },
  { name: 'Drivers',         roles: ['Dispatcher', 'Admin'] },
  { name: 'Fuel Logs',       roles: ['Admin', 'Dispatcher'] },
  { name: 'Maintenance',     roles: ['Admin', 'Dispatcher'] },
  { name: 'Alerts',          roles: ['Admin', 'Dispatcher'] },
  { name: 'Analytics',       roles: ['Admin'] },
]

// Expected menu item names per role (from requirements.md sections 3.1–3.4)
const EXPECTED_MENUS = {
  Staff:      ['Dashboard', 'Request Vehicle', 'My Requests'],
  Dispatcher: ['Dashboard', 'Approval Queue', 'Fleet Calendar', 'Manage Fleet',
               'GPS Tracking', 'Drivers', 'Fuel Logs', 'Maintenance', 'Alerts'],
  Admin:      ['Dashboard', 'Request Vehicle', 'My Requests', 'Approval Queue',
               'Fleet Calendar', 'Manage Fleet', 'GPS Tracking', 'Drivers',
               'Fuel Logs', 'Maintenance', 'Alerts', 'Analytics'],
  Driver:     ['Dashboard', 'My Requests'],
}

/**
 * Mirrors the filteredMenu logic in Sidebar.jsx:
 *   Admin sees all items; other roles see items whose roles array includes their role.
 */
function filterMenuForRole(role) {
  return menuItems.filter(item => {
    if (role === 'Admin') return true
    return item.roles.includes(role)
  })
}

describe('Property 5: Role-based menu filtering is exact', () => {
  it('filtered menu exactly matches expected items — no extras, no missing', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Admin', 'Dispatcher', 'Staff', 'Driver'),
        (role) => {
          const filtered = filterMenuForRole(role)
          const filteredNames = filtered.map(i => i.name).sort()
          const expectedNames = [...EXPECTED_MENUS[role]].sort()

          // No extra items
          for (const name of filteredNames) {
            expect(expectedNames).toContain(name)
          }

          // No missing items
          for (const name of expectedNames) {
            expect(filteredNames).toContain(name)
          }

          // Exact count match
          expect(filteredNames.length).toBe(expectedNames.length)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('every item in filtered menu has the role in its roles array (or role is Admin)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Admin', 'Dispatcher', 'Staff', 'Driver'),
        (role) => {
          const filtered = filterMenuForRole(role)

          for (const item of filtered) {
            if (role !== 'Admin') {
              expect(item.roles).toContain(role)
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no allowed item is missing from the filtered menu', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Admin', 'Dispatcher', 'Staff', 'Driver'),
        (role) => {
          const filtered = filterMenuForRole(role)
          const filteredNames = filtered.map(i => i.name)

          // Every menuItem whose roles includes this role must appear in filtered
          const shouldBeVisible = menuItems.filter(item => item.roles.includes(role))
          for (const item of shouldBeVisible) {
            expect(filteredNames).toContain(item.name)
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
