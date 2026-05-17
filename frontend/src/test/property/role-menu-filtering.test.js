// Property 5: Role-based menu filtering is exact
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { MENU_ITEMS, getMenuForRole } from '../../config/rbac'

const EXPECTED_MENUS = {
  Admin: [
    'Dashboard', 'New Request', 'My Requests',
    'Approval Queue', 'Fleet Calendar', 'Manage Fleet', 'Drivers',
    'GPS Tracking', 'Fleet Alerts', 'Maintenance', 'Fuel Logs',
    'Analytics', 'Parts & Inventory', 'HR Sync', 'User Management',
  ],
  Dispatcher: [
    'Dashboard', 'New Request', 'My Requests',
    'Approval Queue', 'Fleet Calendar', 'Manage Fleet', 'Drivers',
    'GPS Tracking', 'Fleet Alerts', 'Maintenance', 'Fuel Logs',
  ],
  Staff: [
    'Dashboard', 'New Request', 'My Requests',
    'GPS Tracking', 'Maintenance',
  ],
  Driver: [
    'Dashboard', 'New Request', 'My Requests', 'My Assignments',
    'GPS Tracking', 'Maintenance', 'Fuel Logs',
  ],
  Mechanic: [
    'Dashboard', 'New Request', 'My Requests',
    'Manage Fleet', 'Fleet Alerts', 'Maintenance', 'Fuel Logs',
  ],
}

function filterMenu(role) {
  return getMenuForRole(role).map((i) => i.name)
}

describe('Property 5: Role-based menu filtering is exact', () => {
  it.each(Object.keys(EXPECTED_MENUS))('menu for %s matches access table', (role) => {
    const visible = filterMenu(role)
    const expected = EXPECTED_MENUS[role]
    expect(visible.sort()).toEqual(expected.sort())
  })

  it('property: filtered menu is subset of MENU_ITEMS for role', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Admin', 'Dispatcher', 'Staff', 'Driver', 'Mechanic'),
        (role) => {
          const visible = filterMenu(role)
          const allowed = MENU_ITEMS.filter((i) => i.roles.includes(role)).map((i) => i.name)
          return visible.every((n) => allowed.includes(n))
        }
      ),
      { numRuns: 100 }
    )
  })
})
