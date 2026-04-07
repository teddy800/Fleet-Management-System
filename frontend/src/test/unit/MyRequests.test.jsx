// Unit test: MyRequests employee-not-found empty state
// Validates: Requirements 6.2

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// --- Mock tripApi ---
vi.mock('@/lib/api', () => ({
  tripApi: {
    listMine: vi.fn(),
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

// --- Mock react-router-dom (Link used in component) ---
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}))

import { tripApi } from '@/lib/api'
import { useUserStore } from '@/store/useUserStore'
import { toast } from 'sonner'
import MyRequests from '@/features/requests/MyRequests'

beforeEach(() => {
  vi.clearAllMocks()
  useUserStore.mockReturnValue({ role: 'Staff', name: 'Test Staff' })
})

describe('MyRequests — employee-not-found empty state', () => {
  it('shows empty state and does NOT call toast.error when listMine rejects with "Employee record not found"', async () => {
    tripApi.listMine.mockRejectedValue(new Error('Employee record not found'))

    render(<MyRequests />)

    // Wait for loading to complete (spinner disappears, table body renders)
    await waitFor(() => {
      expect(tripApi.listMine).toHaveBeenCalledTimes(1)
    })

    // toast.error must NOT be called
    expect(toast.error).not.toHaveBeenCalled()

    // An empty state message should be visible — the component renders "No requests yet"
    // when requests.length === 0, which is the graceful empty state for this error
    await waitFor(() => {
      expect(screen.getByText(/no requests yet/i)).toBeInTheDocument()
    })
  })
})
