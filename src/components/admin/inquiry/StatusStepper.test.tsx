import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { StatusStepper } from './StatusStepper'
import { STATUSES } from '@/lib/inquiries/state'

describe('StatusStepper', () => {
  it('renders one step per non-terminal status from STATUSES', () => {
    const nonTerminal = STATUSES.filter(s => s !== 'lost' && s !== 'cancelled')
    const html = renderToStaticMarkup(<StatusStepper current="new" />)
    // Each status name appears in the rendered output as a data-status attribute
    for (const s of nonTerminal) {
      expect(html).toContain(s)
    }
  })

  it('shows terminal status as a pill, not a step list', () => {
    const html = renderToStaticMarkup(<StatusStepper current="lost" />)
    expect(html).toContain('data-status="lost"')
    // Should NOT render non-terminal steps
    expect(html).not.toContain('data-status="new"')
  })

  it('shows terminal cancelled as a pill', () => {
    const html = renderToStaticMarkup(<StatusStepper current="cancelled" />)
    expect(html).toContain('data-status="cancelled"')
  })
})
