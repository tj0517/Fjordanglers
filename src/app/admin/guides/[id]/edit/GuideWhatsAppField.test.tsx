// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'

/**
 * FA-M.05 (D4 a) — the WhatsApp number field on /admin/guides/[id]/edit. The action is mocked; its
 * validation and the guide_contacts write are in src/actions/__tests__/send-guide-request.test.ts.
 * (The edit page cannot be opened on the local stack — deferred FA-1.86 — so this is the UI proof.)
 */

const saveGuideWhatsAppNumber = vi.fn()
vi.mock('@/actions/guide-requests', () => ({
  saveGuideWhatsAppNumber: (g: string, v: string) => saveGuideWhatsAppNumber(g, v),
}))

import { GuideWhatsAppField } from './GuideWhatsAppField'

const GUIDE = '22222222-2222-4222-8222-222222222222'

beforeEach(() => saveGuideWhatsAppNumber.mockReset())
afterEach(cleanup)

describe('GuideWhatsAppField', () => {
  it('shows the stored number and the server’s rejection of a non-E.164 value in red', async () => {
    saveGuideWhatsAppNumber.mockResolvedValue({ success: false, error: 'Use the international format: + and 8–15 digits, e.g. +64 21 123 4567.' })
    render(<GuideWhatsAppField guideId={GUIDE} initialNumber="+64211234567" />)
    const input = screen.getByRole('textbox', { name: 'WhatsApp number' }) as HTMLInputElement
    expect(input.value).toBe('+64211234567')
    fireEvent.change(input, { target: { value: '021 123 4567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save number' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('international format')
    expect(alert.className).toContain('text-red-600')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(saveGuideWhatsAppNumber).toHaveBeenCalledWith(GUIDE, '021 123 4567')
  })

  it('saves and shows the normalised number', async () => {
    saveGuideWhatsAppNumber.mockResolvedValue({ success: true, phoneE164: '+4791234567' })
    render(<GuideWhatsAppField guideId={GUIDE} initialNumber={null} />)
    const input = screen.getByRole('textbox', { name: 'WhatsApp number' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '+47 912 34 567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save number' }))
    await screen.findByText('Saved.')
    expect(input.value).toBe('+4791234567')
  })

  it('an empty value removes the number', async () => {
    saveGuideWhatsAppNumber.mockResolvedValue({ success: true, phoneE164: null })
    render(<GuideWhatsAppField guideId={GUIDE} initialNumber="+4791234567" />)
    fireEvent.change(screen.getByRole('textbox', { name: 'WhatsApp number' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save number' }))
    await screen.findByText('Number removed.')
  })
})
