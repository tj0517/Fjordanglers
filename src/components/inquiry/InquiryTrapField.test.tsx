// @vitest-environment jsdom
/**
 * FA-1.43 — the trap field is invisible to people and to screen readers, but still a
 * real, fillable input in the DOM (so a script that fills every input fills it).
 */
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { InquiryTrapField, TRAP_FIELD_NAME, elapsedSinceShown } from './InquiryTrapField'

afterEach(cleanup)

function trapInput(): HTMLInputElement {
  render(<form><InquiryTrapField inputRef={() => {}} /></form>)
  return document.querySelector(`input[name="${TRAP_FIELD_NAME}"]`) as HTMLInputElement
}

describe('InquiryTrapField', () => {
  it('is a plain text input, so a bot that fills every input fills it', () => {
    const input = trapInput()
    expect(input).not.toBeNull()
    expect(input.type).toBe('text')
    expect(input.value).toBe('')
  })

  it('is hidden from screen readers: aria-hidden wrapper, out of the accessibility tree', () => {
    const input = trapInput()
    expect(input.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('textbox', { hidden: true })).toBe(input)
  })

  it('is out of the tab order and opted out of autofill and password managers', () => {
    const input = trapInput()
    expect(input.tabIndex).toBe(-1)
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(input.getAttribute('data-lpignore')).toBe('true')
    expect(input.getAttribute('data-1p-ignore')).toBe('true')
  })

  it('is invisible by position, not by display:none / type=hidden / visibility', () => {
    const input = trapInput()
    const box = input.parentElement as HTMLElement
    expect(box.style.position).toBe('absolute')
    expect(parseInt(box.style.left, 10)).toBeLessThanOrEqual(-1000)
    expect(box.style.display).not.toBe('none')
    expect(box.style.visibility).not.toBe('hidden')
    expect(input.type).not.toBe('hidden')
  })

  it('has no label and no placeholder that would announce or reveal it', () => {
    const input = trapInput()
    expect(input.labels?.length ?? 0).toBe(0)
    expect(input.placeholder).toBe('')
    expect(input.getAttribute('aria-label')).toBeNull()
  })
})

describe('elapsedSinceShown', () => {
  it('is null when the form was never shown', () => {
    expect(elapsedSinceShown(null, 5000)).toBeNull()
  })
  it('is whole milliseconds on the browser stopwatch', () => {
    expect(elapsedSinceShown(1000, 3400.6)).toBe(2401)
  })
  it('never goes negative', () => {
    expect(elapsedSinceShown(5000, 4000)).toBe(0)
  })
})
