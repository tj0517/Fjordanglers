// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { ScrollAway } from '../scroll-away'

/** The framed heroes shrink, tip back and rise as the page scrolls (tj, 2026-11-20). */

const scrollTo = (y: number) => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  fireEvent.scroll(window)
}
const mount = (reduced: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as unknown as typeof window.matchMedia
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0 })
  const { container } = render(<ScrollAway><section data-block="hero" /></ScrollAway>)
  const el = container.firstElementChild as HTMLElement
  Object.defineProperty(el, 'offsetHeight', { value: 600, configurable: true })
  return el
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
})

describe('ScrollAway', () => {
  it('still at the top; halfway down its height it is smaller, tipped back and lifted', () => {
    const el = mount(false)
    expect(el.style.transform).toBe('')
    scrollTo(300)
    expect(el.style.transform).toContain('scale(0.9400)')
    expect(el.style.transform).toContain('rotateX(7.00deg)')
    expect(el.style.transform).toContain('translateY(-45.0px)')
    scrollTo(0)
    expect(el.style.transform).toBe('')
  })

  it('past its height it stops changing', () => {
    const el = mount(false)
    scrollTo(5000)
    expect(el.style.transform).toContain('scale(0.8800)')
  })

  it('reduced motion: nothing moves', () => {
    const el = mount(true)
    scrollTo(300)
    expect(el.style.transform).toBe('')
  })
})
