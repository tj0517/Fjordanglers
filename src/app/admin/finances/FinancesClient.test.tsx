// @vitest-environment jsdom
/**
 * FA-1.31 red proof — a data-changing action in the admin panel must show a
 * pending state and must not be invokable twice while it is in flight.
 *
 * Representative action: "Add cost" → inline form → Save (addFixedCost).
 * Two rapid clicks on Save must call the server action exactly once.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { FinancesClient } from './FinancesClient'
import { addFixedCost } from '@/actions/finances'

vi.mock('@/actions/finances', () => ({
  addFixedCost:    vi.fn(() => new Promise(() => {})), // never resolves — stays pending
  updateFixedCost: vi.fn(),
  deleteFixedCost: vi.fn(),
}))

afterEach(() => { cleanup(); vi.clearAllMocks() })

function openFormAndFillName() {
  render(<FinancesClient rows={[]} />)
  fireEvent.click(screen.getByRole('button', { name: /add cost/i }))
  fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Office rent' } })
  return screen.getByTitle(/^save$/i)
}

describe('FinancesClient — Save fixed cost', () => {
  it('two rapid clicks on Save call addFixedCost once', () => {
    const save = openFormAndFillName()
    fireEvent.click(save)
    fireEvent.click(save)
    expect(addFixedCost).toHaveBeenCalledTimes(1)
  })

  it('Save is disabled and shows a pending state while the action runs', () => {
    const save = openFormAndFillName()
    fireEvent.click(save)
    const pending = screen.getByTitle(/saving/i)
    expect((pending as HTMLButtonElement).disabled).toBe(true)
    expect(pending.getAttribute('aria-busy')).toBe('true')
  })
})
