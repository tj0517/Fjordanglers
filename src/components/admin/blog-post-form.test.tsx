// @vitest-environment jsdom
/**
 * FA-1.84 — the editor form. The server re-checks everything (blog-actions.test.ts); what is pinned
 * here is what the author sees: the SEO counters turn red past 60 / 155 and switch saving off (E1),
 * the slug follows the title until edited and is fixed once the post has been public (E2), the
 * preview is the public renderer and warns about HTML it will drop (E4), and the server's message
 * about a missing hero image or alt text is shown as it is.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  save: vi.fn(),
  setStatus: vi.fn(),
}))

vi.mock('@/actions/blog', () => ({ saveBlogPost: h.save, setBlogPostStatus: h.setStatus }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/components/admin/image-upload', () => ({ default: () => <div data-testid="image-upload" /> }))

import { BlogPostForm, type BlogPostFormValues } from './blog-post-form'

const empty: BlogPostFormValues = {
  title: '', slug: '', seo_title: '', description: '', body_md: '',
  image_url: null, image_alt: '', category: 'Planning', country: null, guide_id: null,
}

const renderNew = (values: Partial<BlogPostFormValues> = {}) =>
  render(<BlogPostForm postId={null} initialStatus="draft" initialPublishedAt={null} guides={[]} initialValues={{ ...empty, ...values }} />)

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

const saveButtons = () => [screen.getByRole('button', { name: 'Save draft' }), screen.getByRole('button', { name: 'Publish' })] as HTMLButtonElement[]

beforeEach(() => { h.save.mockReset(); h.setStatus.mockReset() })
afterEach(cleanup)

describe('SEO counters (E1)', () => {
  it('60 characters is fine; 61 turns the counter red and switches saving off', () => {
    renderNew({ title: 'A title', slug: 'a-title' })
    type(/SEO title/i, 'x'.repeat(60))
    expect(document.getElementById('seo-title-count')?.dataset.over).toBe('false')
    expect(saveButtons().every(b => !b.disabled)).toBe(true)

    type(/SEO title/i, 'x'.repeat(61))
    const counter = document.getElementById('seo-title-count')!
    expect(counter.dataset.over).toBe('true')
    expect(counter.textContent).toContain('61/60')
    expect(saveButtons().every(b => b.disabled)).toBe(true)
    expect(screen.getByTestId('blocked-reason').textContent).toMatch(/SEO title is too long/)

    fireEvent.click(saveButtons()[0])
    expect(h.save).not.toHaveBeenCalled()
  })

  it('155 characters is fine; 156 turns the counter red and switches saving off', () => {
    renderNew({ title: 'A title', slug: 'a-title' })
    type(/Meta description/i, 'y'.repeat(155))
    expect(document.getElementById('description-count')?.dataset.over).toBe('false')
    expect(saveButtons().every(b => !b.disabled)).toBe(true)

    type(/Meta description/i, 'y'.repeat(156))
    expect(document.getElementById('description-count')?.dataset.over).toBe('true')
    expect(document.getElementById('description-count')?.textContent).toContain('156/155')
    expect(saveButtons().every(b => b.disabled)).toBe(true)
  })
})

describe('slug (E2)', () => {
  it('follows the title until the author edits it', () => {
    renderNew()
    type(/^Title/i, 'Fishing in Norway')
    expect((screen.getByLabelText(/Address/i) as HTMLInputElement).value).toBe('fishing-in-norway')
    type(/Address/i, 'my-own-slug')
    type(/^Title/i, 'Fishing in Norway 2026')
    expect((screen.getByLabelText(/Address/i) as HTMLInputElement).value).toBe('my-own-slug')
  })

  it('is fixed on a published post and on a draft that has been published before', () => {
    const { unmount } = render(<BlogPostForm postId="p1" initialStatus="published" initialPublishedAt="2026-03-17T00:00:00Z" guides={[]} initialValues={{ ...empty, title: 'T', slug: 'live-post' }} />)
    expect((screen.getByLabelText(/Address/i) as HTMLInputElement).disabled).toBe(true)
    unmount()
    render(<BlogPostForm postId="p1" initialStatus="draft" initialPublishedAt="2026-03-17T00:00:00Z" guides={[]} initialValues={{ ...empty, title: 'T', slug: 'was-live' }} />)
    expect((screen.getByLabelText(/Address/i) as HTMLInputElement).disabled).toBe(true)
  })

  it('stays editable on a draft that was never published', () => {
    render(<BlogPostForm postId="p1" initialStatus="draft" initialPublishedAt={null} guides={[]} initialValues={{ ...empty, title: 'T', slug: 'draft-post' }} />)
    expect((screen.getByLabelText(/Address/i) as HTMLInputElement).disabled).toBe(false)
  })
})

describe('preview and HTML warning (E4)', () => {
  const body = ':::warning\nCheck the licence.\n:::\n\n:::stat{value="15 kg" label="per person"}\nNote.\n:::\n\n<div class="x">pasted</div>'

  it('renders the D1 blocks with the public renderer', async () => {
    renderNew({ body_md: body })
    const preview = screen.getByTestId('preview')
    await waitFor(() => expect(preview.textContent).toContain('Check the licence.'))
    expect(preview.textContent).toContain('Important:')
    expect(preview.textContent).toContain('15 kg')
    expect(preview.textContent).not.toContain('pasted')
  })

  it('warns when the text contains HTML the page will drop, and names it', async () => {
    renderNew({ body_md: body })
    const warning = await screen.findByTestId('html-warning')
    expect(warning.textContent).toContain('will not be shown')
    expect(warning.textContent).toContain('<div class="x">')
  })

  it('does not warn about plain Markdown, code or an autolink', () => {
    renderNew({ body_md: 'Use `<div>` here, see <https://example.com>.\n\n## Heading' })
    expect(screen.queryByTestId('html-warning')).toBeNull()
  })
})

describe('publishing', () => {
  it("shows the server's message about a missing hero image and alt text, and keeps the author's text", async () => {
    h.save.mockResolvedValue({ success: false, error: 'Hero image and Image alt text are required to publish.', missing: ['image_url', 'image_alt'] })
    renderNew({ title: 'A title', slug: 'a-title', seo_title: 'SEO', description: 'Desc', body_md: 'Body' })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))

    const error = await screen.findByTestId('form-error')
    expect(error.textContent).toBe('Hero image and Image alt text are required to publish.')
    expect(h.save).toHaveBeenCalledWith(null, expect.objectContaining({ status: 'published', slug: 'a-title' }))
    expect((screen.getByLabelText(/^Article text/i) as HTMLTextAreaElement).value).toBe('Body')
  })
})
