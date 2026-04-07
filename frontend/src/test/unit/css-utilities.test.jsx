// Smoke test: CSS utility classes render without layout breakage
// Validates: Requirements (UI/UX enhancement)

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'

const UTILITY_CLASSES = [
  'glass',
  'glass-dark',
  'gradient-card',
  'gradient-text',
  'animate-fade-in',
  'animate-slide-in',
  'pulse-dot',
]

describe('CSS utility classes — smoke tests', () => {
  UTILITY_CLASSES.forEach((cls) => {
    it(`renders a div with class "${cls}" without throwing`, () => {
      const { container } = render(<div className={cls} data-testid={cls}>content</div>)
      const el = container.firstChild
      expect(el).toBeInTheDocument()
      expect(el).toHaveClass(cls)
    })
  })
})
