/**
 * Bring the first invalid field of an inquiry form to the angler (FA-1.61).
 *
 * A failed validation used to colour the field and nothing else: when the field sat above the
 * visible part of the form's scroll area, "Send" looked like it did nothing. The v1 modal and
 * the v2 wizard are both `overflow-y-auto` containers inside a fixed overlay; `scrollIntoView`
 * scrolls every scrollable ancestor, so the call needs no knowledge of which one clips.
 *
 * Fields are found by `data-field="<key>"` — the key of the form's own error map — never by
 * position or by tag, so a new field in the middle of a form cannot silently shift the target.
 */

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'

/** `'auto'` (an instant jump) when the visitor asked the OS for less motion, else `'smooth'`. */
function scrollBehavior(): ScrollBehavior {
  const reduce = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return reduce ? 'auto' : 'smooth'
}

/**
 * Centering a target that is taller than the area it scrolls in would crop its top — for a
 * question, the legend that says what is being asked — and its bottom alike. Such a target
 * (a five-option group on a phone) is aligned to the top instead, so the question is read first.
 */
function blockFor(target: HTMLElement): ScrollLogicalPosition {
  let area = target.parentElement
  while (area != null && area.scrollHeight <= area.clientHeight) area = area.parentElement
  return area != null && target.getBoundingClientRect().height > area.clientHeight ? 'start' : 'center'
}

/**
 * The element that takes focus for `target`: the control itself, or — for a group
 * (`<fieldset>`) — its first enabled control, which is where a keyboard user starts in it.
 */
function focusTargetOf(target: HTMLElement): HTMLElement {
  if (target.matches(FOCUSABLE)) return target
  return target.querySelector<HTMLElement>(FOCUSABLE) ?? target
}

/**
 * Scrolls the element marked `data-field="<field>"` inside `root` to the middle of its scroll
 * area (to its top, when it is taller than that area) and focuses it — for a group, its first
 * control. Returns whether it found the field. Focus is taken with `preventScroll` so it does
 * not fight the scroll above.
 */
export function scrollToField(root: ParentNode | null, field: string): boolean {
  const target = root?.querySelector<HTMLElement>(`[data-field="${field}"]`)
  if (target == null) return false

  // jsdom (and the odd embedded webview) has no scrollIntoView; focus must still happen.
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ block: blockFor(target), behavior: scrollBehavior() })
  }
  focusTargetOf(target).focus({ preventScroll: true })
  return true
}
