// Unit test: Maintenance parallel API calls on mount
// Validates: Requirements 7.4

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// --- Mock maintenanceApi ---
vi.mock('@/lib/api', () => ({
  maintenanceApi: {
    list: vi.fn(),
    schedules: vi.fn(),
  },
}))

// --- Mock useUserStore ---
vi.mock('@/store/useUserStore', () => ({
  useUserStore: vi.fn(),
}))

// --- Mock sonner toast ---
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { maintenanceApi } from '@/lib/api'
import { useUserStore } from '@/store/useUserStore'
import Maintenance from '@/features/fleet/Maintenance'

beforeEach(() => {
  vi.clearAllMocks()

  useUserStore.mockReturnValue({ role: 'Dispatcher', name: 'Test Dispatcher' })

  maintenanceApi.list.mockResolvedValue({ maintenance_logs: [] })
  maintenanceApi.schedules.mockResolvedValue({ schedules: [] })
})

describe('Maintenance — parallel API calls on mount', () => {
  it('calls maintenanceApi.list() exactly once on mount', async () => {
    render(<Maintenance />)

    await waitFor(() => {
      expect(maintenanceApi.list).toHaveBeenCalledTimes(1)
    })
  })

  it('calls maintenanceApi.schedules() exactly once on mount', async () => {
    render(<Maintenance />)

    await waitFor(() => {
      expect(maintenanceApi.schedules).toHaveBeenCalledTimes(1)
    })
  })

  it('calls both maintenanceApi.list() and maintenanceApi.schedules() on mount without user interaction', async () => {
    render(<Maintenance />)

    await waitFor(() => {
      expect(maintenanceApi.list).toHaveBeenCalledTimes(1)
      expect(maintenanceApi.schedules).toHaveBeenCalledTimes(1)
    })
  })
})
