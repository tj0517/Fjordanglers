// @vitest-environment jsdom
/**
 * FA-1.32 — the AI draft button ("Zaproponuj") exists in the DOM only when the
 * server says AI is available (ANTHROPIC_API_KEY set). The flag is a boolean prop
 * computed in page.tsx — never read from client-side env.
 */
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MessageComposer } from './MessageComposer'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/actions/messages', () => ({
  sendMessageFromThread: vi.fn(),
  proposeDraft:          vi.fn(),
}))

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('MessageComposer — AI availability flag', () => {
  it('aiEnabled=false → "Zaproponuj" is not in the DOM', () => {
    render(<MessageComposer inquiryId="inq-1" aiEnabled={false} anglerFirstName="Erik" />)
    expect(screen.queryByRole('button', { name: /zaproponuj/i })).toBeNull()
  })

  it('aiEnabled=true → "Zaproponuj" is present', () => {
    render(<MessageComposer inquiryId="inq-1" aiEnabled={true} anglerFirstName="Erik" />)
    expect(screen.getByRole('button', { name: /zaproponuj/i })).toBeTruthy()
  })

  it('placeholder is neutral and addresses the angler by first name', () => {
    render(<MessageComposer inquiryId="inq-1" aiEnabled={false} anglerFirstName="Erik" />)
    expect(screen.getByPlaceholderText('Write your message to Erik…')).toBeTruthy()
    expect(screen.queryByPlaceholderText(/Hi Jan/)).toBeNull()
  })
})
