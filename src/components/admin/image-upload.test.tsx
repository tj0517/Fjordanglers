// @vitest-environment jsdom
/**
 * FA-1.64 — a single-photo field picking from the page library (tj 2026-10-22, decision 1 A):
 * the photo is set as it is — no crop step, no upload — while `pickFrom` (the admin guide edit
 * form) keeps crop-on-pick.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import ImageUpload from './image-upload'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('no upload expected') } }))
vi.mock('@/components/ui/image-crop', () => ({ ImageCropModal: () => <div data-testid="crop-modal" /> }))

afterEach(cleanup)

const LIBRARY = ['/a.jpg', '/b.jpg']

describe('ImageUpload — Choose from this page', () => {
  it('a pick from the page library sets the URL as it is, with no crop step', () => {
    const onUpload = vi.fn()
    render(<ImageUpload label="Boat photo" cropAspect={4 / 3} onUpload={onUpload} library={LIBRARY} />)
    expect(screen.getByRole('button', { name: 'Choose from this page' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pick photo 2' }))
    expect(onUpload).toHaveBeenCalledWith('/b.jpg')
    expect(screen.queryByTestId('crop-modal')).toBeNull()
  })

  it('pickFrom (guide edit form) still opens the crop step and sets nothing yet', () => {
    const onUpload = vi.fn()
    render(<ImageUpload label="Cover" cropAspect={16 / 9} onUpload={onUpload} pickFrom={LIBRARY} />)
    expect(screen.getByRole('button', { name: 'From gallery' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pick photo 2' }))
    expect(onUpload).not.toHaveBeenCalled()
    expect(screen.getByTestId('crop-modal')).toBeTruthy()
  })
})
