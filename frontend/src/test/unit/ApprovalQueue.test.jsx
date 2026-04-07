// Unit test: ApprovalQueue single-approve
// Validates: Requirements 6.4

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// --- Mock tripApi, fleetApi, driverApi ---
vi.mock('@/lib/api', () => ({
  tripApi: {
    list: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    assign: vi.fn(),
  },
  fleetApi: {
    list: vi.fn(),
  },
  driverApi: {
    list: vi.fn(),
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

import { tripApi, fleetApi, driverApi } from '@/lib/api'
import { useUserStore } from '@/store/useUserStore'
import ApprovalQueue from '@/features/dispatch/ApprovalQueue'

const MOCK_REQUESTS = [
  {
    id: 1,
    name: 'TR/001',
    purpose: 'Business trip',
    state: 'pending',
    employee_name: 'Alice',
    vehicle_category: 'Sedan',
    start_datetime: '2025-01-15T08:00:00',
    end_datetime: '2025-01-15T18:00:00',
    pickup_location: 'HQ',
    destination_location: 'Airport',
    passenger_count: 1,
    priority: 'normal',
    trip_type: 'one_way',
    assigned_vehicle: null,
    assigned_driver: null,
    create_date: '2025-01-10T10:00:00',
  },
]

beforeEach(() => {
  vi.clearAllMocks()

  // useUserStore returns a Dispatcher user
  useUserStore.mockReturnValue({ role: 'Dispatcher', name: 'Test Dispatcher' })

  // API mocks
  tripApi.list.mockResolvedValue({ trip_requests: MOCK_REQUESTS })
  fleetApi.list.mockResolvedValue({ vehicles: [] })
  driverApi.list.mockResolvedValue({ drivers: [] })
  tripApi.approve.mockResolvedValue({ success: true })
})

describe('ApprovalQueue — quick-approve button', () => {
  it('calls tripApi.approve() exactly once when the quick-approve button is clicked', async () => {
    const user = userEvent.setup()

    render(<ApprovalQueue />)

    // Wait for the table to load (the request row appears)
    await waitFor(() => {
      expect(screen.getByText('TR/001')).toBeInTheDocument()
    })

    // The quick-approve button is the green CheckCircle button in the table row.
    // It has no text label, so we find it by its role and position among action buttons.
    // There are 3 action buttons per pending row: View, ✓ (approve), ✗ (reject)
    // The approve button is the second button in the actions cell.
    const approveButtons = screen.getAllByRole('button')
    // Find the green approve button — it contains a CheckCircle icon (no text)
    // We identify it as the button that is NOT "View", "Assign", or the reject button
    // by filtering for buttons that have the bg-green-600 class via aria or test approach.
    // Since shadcn Button renders a <button>, we look for the one with CheckCircle only.
    // The simplest approach: find all buttons, click the one right after "View" for row 0.
    const viewButton = screen.getByRole('button', { name: /view/i })
    // The approve button is the next sibling button after View in the DOM
    // Use getAllByRole and pick by index — View is index N, approve is N+1
    const allButtons = screen.getAllByRole('button')
    const viewIdx = allButtons.indexOf(viewButton)
    const quickApproveButton = allButtons[viewIdx + 1]

    await user.click(quickApproveButton)

    // tripApi.approve should be called exactly once with the request id
    expect(tripApi.approve).toHaveBeenCalledTimes(1)
    expect(tripApi.approve).toHaveBeenCalledWith(1)
  })
})
