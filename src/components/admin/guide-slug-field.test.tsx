// @vitest-environment jsdom
/**
 * FA-1.86 (tj decision 2) — the slug field in the admin guide forms: prefilled from name + country
 * on create, locked (read-only + hint) once the guide is active, editable otherwise, and the
 * create form refuses to submit without a usable slug.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const createBetaGuide = vi.fn()
const updateGuide = vi.fn()
vi.mock('@/actions/admin', () => ({
  createBetaGuide: (...a: unknown[]) => createBetaGuide(...a),
  updateGuide: (...a: unknown[]) => updateGuide(...a),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/components/admin/image-upload', () => ({ default: () => null }))
vi.mock('@/components/admin/multi-image-upload', () => ({ default: () => null }))
vi.mock('@/components/ui/image-crop', () => ({ ImageCropModal: () => null }))

import CreateGuideForm from './create-guide-form'
import EditGuideForm from './edit-guide-form'

afterEach(() => { cleanup(); createBetaGuide.mockReset(); updateGuide.mockReset() })

const guideRow = (over: Record<string, unknown> = {}) => ({
  id: 'g-1', slug: 'josh-hart-new-zealand', full_name: 'Josh Hart', country: 'New Zealand', city: null, bio: null,
  languages: ['English'], fish_expertise: ['Rainbow Trout'], years_experience: null, avatar_url: null, cover_url: null,
  instagram_url: null, youtube_url: null, pricing_model: 'commission' as const, status: 'active', is_beta_listing: true,
  invite_email: null, ...over,
})

describe('create form', () => {
  it('prefills the slug from name + country and follows edits until the admin types one', () => {
    render(<CreateGuideForm defaultValues={{ full_name: 'Inge Rønning', country: 'Norway' }} />)
    const slug = screen.getByPlaceholderText('e.g. bjorn-eriksen-norway') as HTMLInputElement
    expect(slug.value).toBe('inge-ronning-norway')

    fireEvent.change(screen.getByPlaceholderText('e.g. Bjørn Eriksen'), { target: { value: 'Inge Ronning Jr' } })
    expect(slug.value).toBe('inge-ronning-jr-norway')

    fireEvent.change(slug, { target: { value: 'my-own-slug' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Bjørn Eriksen'), { target: { value: 'Someone Else' } })
    expect(slug.value).toBe('my-own-slug') // hand-edited → no longer overwritten
  })

  it('refuses to submit a malformed slug, before calling the action', async () => {
    render(<CreateGuideForm defaultValues={{ full_name: 'Inge Rønning', country: 'Norway', fish_expertise: ['Salmon'] }} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. bjorn-eriksen-norway'), { target: { value: 'Not A Slug' } })
    fireEvent.submit(screen.getByPlaceholderText('e.g. bjorn-eriksen-norway').closest('form')!)
    await waitFor(() => expect(screen.getByText(/lowercase letters/)).toBeTruthy())
    expect(createBetaGuide).not.toHaveBeenCalled()
  })
})

describe('edit form', () => {
  it('an active guide with a slug: slug is read-only, explained, and not sent', async () => {
    updateGuide.mockResolvedValue({ success: true })
    render(<EditGuideForm guide={guideRow()} />)
    const slug = screen.getByLabelText(/Profile slug/) as HTMLInputElement
    expect(slug.value).toBe('josh-hart-new-zealand')
    expect(slug.readOnly).toBe(true)
    expect(screen.getByText(/Locked while the guide is active/)).toBeTruthy()

    fireEvent.submit(slug.closest('form')!)
    await waitFor(() => expect(updateGuide).toHaveBeenCalled())
    expect(updateGuide.mock.calls[0]![1]).not.toHaveProperty('slug')
  })

  it('a suspended guide: slug is editable and sent', async () => {
    updateGuide.mockResolvedValue({ success: true })
    render(<EditGuideForm guide={guideRow({ status: 'suspended' })} />)
    const slug = screen.getByLabelText(/Profile slug/) as HTMLInputElement
    expect(slug.readOnly).toBe(false)
    fireEvent.change(slug, { target: { value: 'josh-hart-nz' } })
    fireEvent.submit(slug.closest('form')!)
    await waitFor(() => expect(updateGuide).toHaveBeenCalled())
    expect(updateGuide.mock.calls[0]![1]).toMatchObject({ slug: 'josh-hart-nz' })
  })

  it('an active guide that has no slug yet (legacy row) can be given one', () => {
    render(<EditGuideForm guide={guideRow({ slug: null })} />)
    expect((screen.getByLabelText(/Profile slug/) as HTMLInputElement).readOnly).toBe(false)
  })
})
