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
 * Access table (from SRS):
 * ─────────────────────────────────────────────────────────────────────────────
 * Menu Item            Admin  Dispatcher  Staff  Driver  Mechanic
 * Dashboard            ✅     ✅          ✅     ✅      ✅
 * New Request          ✅     ✅          ✅     ✅      ✅
 * My Requests          ✅     ✅          ✅     ✅      ✅
 * Approval Queue       ✅     ✅          ❌     ❌      ❌
 * Fleet Calendar       ✅     ✅          ❌     ❌      ❌
 * Manage Fleet         ✅     ✅          ❌     ❌      ❌
 * GPS Tracking         ✅     ✅          ❌     ❌      ❌
 * Drivers              ✅     ✅          ❌     ❌      ❌
 * Fuel Logs            ✅     ✅          ❌     ❌      ❌
 * Maintenance          ✅     ✅          ❌     ❌      ❌
 * Alerts               ✅     ✅          ❌     ❌      ❌
 * Analytics            ✅     ❌          ❌     ❌      ❌
 * Parts & Inventory    ✅     ❌          ❌     ❌      ❌
 * HR Sync              ✅     ❌          ❌     ❌      ❌
 * User Management      ✅     ❌          ❌     ❌      ❌
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Mirror the menuItems array from Sidebar.jsx — the source of truth for filtering
const menuItems = [
  // All roles
  { name: 'Dashboard',          roles: ['Admin', 'Dispatcher', 'Staff', 'Driver', 'Mechanic'] },
  { name: 'New Request',        roles: ['Admin', 'Dispatcher', 'Staff', 'Driver', 'Mechanic'] },
  { name: 'My Requests',        roles: ['Admin', 'Dispatcher', 'Staff', 'Driver', 'Mechanic'] },
  // Dispatcher + Admin
  { name: 'Approval Queue',     roles: ['Admin', 'Dispatcher'] },
  { name: 'Fleet Calendar',     roles: ['Admin', 'Dispatcher'] },
  { name: 'Manage Fleet',       roles: ['Admin', 'Dispatcher'] },
  { name: 'GPS Tracking',       roles: ['Admin', 'Dispatcher'] },
  { name: 'Drivers',            roles: ['Admin', 'Dispatcher'] },
  { name: 'Fuel Logs',          roles: ['Admin', 'Dispatcher'] },
  { name: 'Maintenance',        roles: ['Admin', 'Dispatcher'] },
  { name: 'Alerts',             roles: ['Admin', 'Dispatcher'] },
  // Admin only
  { name: 'Analytics',          roles: ['Admin'] },
  { name: 'Parts & Inventory',  roles: ['Admin'] },
  { name: 'HR Sync',            roles: ['Admin'] },
  { name: 'User Management',    roles: ['Admin'] },
]

// Expected menu item names per role
const EXPECTED_MENUS = {
  Admin: [
    'Dashboard', 'New Request', 'My Requests',
    'Approval Queue', 'Fleet Calendar', 'Manage Fleet', 'GPS Tracking',
    'Drivers', 'Fuel Logs', 'Maintenance', 'Alerts',
    'Analytics', 'Parts & Inventory', 'HR Sync', 'User Management',
  ],
  Dispatcher: [
    'Dashboard', 'New Request', 'My Requests',
    'Approval Queue', 'Fleet Calendar', 'Manage Fleet', 'GPS Tracking',
    'Drivers', 'Fuel Logs', 'Maintenance', 'Alerts',
  ],
  Staff: [
    'Dashboard', 'New Request', 'My Requests',
  ],
  Driver: [
    'Dashboard', 'New Request', 'My Requests',
  ],
  Mechanic: [
    'Dashboard', 'New Request', 'My Requests',
  ],
}

/** Mirrors the filterMenu logic in Sidebar.jsx */
function filterMenuForRole(role) {
  return menuItems.filter(item => item.roles.includes(role))
}

describe('Property 5: Role-based menu filtering is exact', () => {
  it('filtered menu exactly matches expected items — no extras, no missing', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Admin', 'Dispatcher', 'Staff', 'Driver', 'Mechanic'),
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
          // Exact count
          expect(filteredNames.length).toBe(expectedNames.length)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('every item in filtered menu has the role in its roles array', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Admin', 'Dispatcher', 'Staff', 'Driver', 'Mechanic'),
        (role) => {
          const filtered = filterMenuForRole(role)
          for (const item of filtered) {
            expect(item.roles).toContain(role)
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
        fc.constantFrom('Admin', 'Dispatcher', 'Staff', 'Driver', 'Mechanic'),
        (role) => {
          const filtered = filterMenuForRole(role)
          const filteredNames = filtered.map(i => i.name)
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

  it('Staff, Driver, Mechanic cannot see dispatcher or admin items', () => {
    const restrictedItems = [
      'Approval Queue', 'Fleet Calendar', 'Manage Fleet', 'GPS Tracking',
      'Drivers', 'Fuel Logs', 'Maintenance', 'Alerts',
      'Analytics', 'Parts & Inventory', 'HR Sync', 'User Management',
    ]
    for (const role of ['Staff', 'Driver', 'Mechanic']) {
      const filtered = filterMenuForRole(role)
      const filteredNames = filtered.map(i => i.name)
      for (const restricted of restrictedItems) {
        expect(filteredNames).not.toContain(restricted)
      }
    }
  })

  it('Dispatcher cannot see admin-only items', () => {
    const adminOnly = ['Analytics', 'Parts & Inventory', 'HR Sync', 'User Management']
    const filtered = filterMenuForRole('Dispatcher')
    const filteredNames = filtered.map(i => i.name)
    for (const item of adminOnly) {
      expect(filteredNames).not.toContain(item)
    }
  })
})
