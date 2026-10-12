import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../lib/i18n'
import { SnoozeModal } from '../components/ui/SnoozeModal'

describe('SnoozeModal', () => {
  it('renders quick day buttons (+3天, +7天, +14天) and allows date selection', () => {
    const handleConfirm = vi.fn()
    render(
      <LanguageProvider>
        <SnoozeModal
          isOpen={true}
          title="延期「猫粮」提醒"
          onClose={vi.fn()}
          onConfirm={handleConfirm}
        />
      </LanguageProvider>
    )
    expect(screen.getByText('延期「猫粮」提醒')).toBeDefined()
    const btn3Days = screen.getByText('+3天')
    expect(btn3Days).toBeDefined()
    fireEvent.click(btn3Days)
    const confirmBtn = screen.getByText('确认延期')
    fireEvent.click(confirmBtn)
    expect(handleConfirm).toHaveBeenCalled()
  })
})
