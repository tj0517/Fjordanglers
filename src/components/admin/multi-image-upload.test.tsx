// @vitest-environment jsdom
/**
 * FA-1.64 — the "Choose from this page" picker of a multi-photo field.
 *
 * What is proven, on the component as the experience page form mounts it:
 *   • the tab shows every library photo and marks the ones already in this field;
 *   • a click adds a photo exactly as an upload would (URL in the list, first = cover);
 *   • a photo already in the field is never added a second time — its tile takes it out;
 *   • a full field refuses more: free tiles are disabled and the red line says why;
 *   • without a library (guide forms, /dashboard/photos) there is no tab at all.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import MultiImageUpload, { type GalleryImage } from './multi-image-upload'

// The picker never uploads; the Storage client is only reached by the upload path.
vi.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('no upload expected') } }))

afterEach(cleanup)

const LIBRARY = ['/a.jpg', '/b.jpg', '/c.jpg']

const field = (urls: string[]): GalleryImage[] =>
  urls.map((url, i) => ({ url, is_cover: i === 0, sort_order: i }))

function mount(initial: string[], max: number, library: string[] | null = LIBRARY) {
  const onChange = vi.fn<(images: GalleryImage[]) => void>()
  render(<MultiImageUpload label="Species photos" initial={field(initial)} max={max} onChange={onChange} library={library ?? undefined} />)
  return onChange
}

const tile = (n: number) => screen.getByRole('button', { name: new RegExp(`^(Add|Remove) photo ${n}$`) })
const lastSent = (onChange: ReturnType<typeof mount>) => onChange.mock.calls.at(-1)?.[0].map(g => g.url)

describe('MultiImageUpload — Choose from this page', () => {
  it('opens on the page library and marks the photos already in this field', () => {
    mount(['/b.jpg'], 5)
    expect(screen.getByRole('button', { name: /Choose from this page \(3\)/ })).toBeTruthy()
    expect(tile(1).getAttribute('aria-pressed')).toBe('false')
    expect(tile(2).getAttribute('aria-pressed')).toBe('true')
    expect(tile(3).getAttribute('aria-pressed')).toBe('false')
    expect(tile(2).querySelector('img')?.getAttribute('src')).toBe('/b.jpg')
  })

  it('a click adds the URL as an upload would — appended, first stays the cover', () => {
    const onChange = mount(['/b.jpg'], 5)
    fireEvent.click(tile(1))
    expect(onChange).toHaveBeenLastCalledWith([
      { url: '/b.jpg', is_cover: true,  sort_order: 0 },
      { url: '/a.jpg', is_cover: false, sort_order: 1 },
    ])
  })

  it('never puts a photo in the same field twice — its tile takes it out instead', () => {
    const onChange = mount(['/a.jpg', '/b.jpg'], 5)
    fireEvent.click(tile(2))
    expect(lastSent(onChange)).toEqual(['/a.jpg'])
    for (const [images] of onChange.mock.calls) {
      const urls = images.map(g => g.url)
      expect(new Set(urls).size).toBe(urls.length)
    }
  })

  it('a full field refuses another photo: free tiles disabled, red line, nothing sent', () => {
    const onChange = mount(['/a.jpg', '/b.jpg'], 2)
    expect((tile(3) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(tile(3))
    expect(onChange).not.toHaveBeenCalled()
    const alert = screen.getByTestId('photo-limit-full')
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.textContent).toContain('at most 2 photos')
    // A marked photo can still come out, which frees the field again.
    expect((tile(1) as HTMLButtonElement).disabled).toBe(false)
  })

  it('stops at max when picking one by one', () => {
    const onChange = mount([], 2)
    fireEvent.click(tile(1))
    fireEvent.click(tile(2))
    fireEvent.click(tile(3))
    expect(lastSent(onChange)).toEqual(['/a.jpg', '/b.jpg'])
    expect(screen.getByTestId('photo-limit-full')).toBeTruthy()
  })

  it('shows no red line while the field has room', () => {
    mount(['/a.jpg'], 2)
    expect(screen.queryByTestId('photo-limit-full')).toBeNull()
  })

  it('without a library there is no picker tab — the field is upload-only, as before', () => {
    mount([], 5, null)
    expect(screen.queryByRole('button', { name: /Choose from this page/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeTruthy()
  })
})
