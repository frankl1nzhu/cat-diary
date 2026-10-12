import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DashboardSkeleton } from '../components/ui/DashboardSkeleton'
import { TimelineSkeleton } from '../components/ui/TimelineSkeleton'

describe('Skeletons', () => {
  it('renders DashboardSkeleton with shimmer classes', () => {
    const { container } = render(<DashboardSkeleton />)
    expect(container.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(3)
  })

  it('renders TimelineSkeleton with shimmer classes', () => {
    const { container } = render(<TimelineSkeleton />)
    expect(container.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(3)
  })
})
