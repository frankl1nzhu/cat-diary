import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyStateCat } from '../components/ui/EmptyStateCat'
import { computeIsTodayCareComplete } from '../lib/careCompletion'

describe('EmptyStateCat', () => {
  it('renders posture SVG and message', () => {
    render(<EmptyStateCat posture="hungry_bowl" message="今日暂无喂食记录" />)
    expect(screen.getByText('今日暂无喂食记录')).toBeDefined()
    expect(document.querySelector('svg')).not.toBeNull()
  })

  it('computes today care completion correctly', () => {
    expect(computeIsTodayCareComplete(0, '😸', 1)).toBe(false) // no feeds
    expect(computeIsTodayCareComplete(1, null, 0)).toBe(false) // feeds but no mood or poop
    expect(computeIsTodayCareComplete(1, '😸', 0)).toBe(true)  // feeds + mood
    expect(computeIsTodayCareComplete(2, null, 1)).toBe(true)  // feeds + poop
  })
})
