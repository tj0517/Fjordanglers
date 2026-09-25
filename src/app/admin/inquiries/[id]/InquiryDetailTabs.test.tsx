// @vitest-environment jsdom
/**
 * FA-1.33 — tab switching is client-side: a click changes the visible panel and
 * never asks the router to navigate; `?tab=` deep links still pick the initial tab.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { InquiryDetailTabs } from './InquiryDetailTabs'

const replace = vi.fn()
const push    = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter:       () => ({ replace, push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}))

beforeEach(() => { search = '' })
afterEach(() => { cleanup(); vi.clearAllMocks() })

function renderTabs() {
  return render(
    <InquiryDetailTabs
      status="qualifying"
      overviewContent={<p>OVERVIEW PANEL</p>}
      conversationContent={<p>CONVERSATION PANEL</p>}
      briefContent={<p>BRIEF PANEL</p>}
      guideContent={<p>GUIDE PANEL</p>}
      offerContent={<p>OFFER PANEL</p>}
      conversationCount={2}
    />,
  )
}

describe('InquiryDetailTabs — client-side switching', () => {
  it('clicking a tab shows its panel without router.replace/push', () => {
    renderTabs()
    expect(screen.getByText('CONVERSATION PANEL')).toBeTruthy()   // default for qualifying
    fireEvent.click(screen.getByRole('tab', { name: /offer & payment/i }))
    expect(screen.getByText('OFFER PANEL')).toBeTruthy()
    expect(screen.queryByText('CONVERSATION PANEL')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('updates the URL with history.replaceState (deep link survives reload)', () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    renderTabs()
    fireEvent.click(screen.getByRole('tab', { name: /guide/i }))
    expect(spy).toHaveBeenCalled()
    const url = String(spy.mock.calls.at(-1)?.[2] ?? '')
    expect(url).toContain('tab=guide')
    spy.mockRestore()
  })

  it('?tab=offer deep link opens Offer & payment', () => {
    search = 'tab=offer'
    renderTabs()
    expect(screen.getByText('OFFER PANEL')).toBeTruthy()
    expect(screen.queryByText('CONVERSATION PANEL')).toBeNull()
  })
})
