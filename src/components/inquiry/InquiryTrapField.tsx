/**
 * Hidden trap field for the inquiry form (FA-1.43, O-27 a).
 *
 * A person never sees or reaches it; a script that fills every input does. It is NOT
 * `display:none` / `type="hidden"` (many bots skip those) — it is pushed off-screen,
 * hidden from assistive technology and taken out of the tab order.
 *
 * The name avoids the words browsers and password managers key their autofill on
 * (name, email, phone, address, company, website, url, fax, zip…), and the opt-out
 * attributes are set for Chrome, 1Password and LastPass. Not tested in real browsers.
 *
 * The value is client-side and forgeable: it filters simple bots, it is not a security
 * boundary. The server decides what to do with it (suspicionReason).
 */

import type { Ref } from 'react'

export const TRAP_FIELD_NAME = 'trip_notes_extra'

export function InquiryTrapField({ inputRef }: { inputRef: Ref<HTMLInputElement> }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        name={TRAP_FIELD_NAME}
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
      />
    </div>
  )
}

/**
 * Whole milliseconds since the form was first shown, measured with the browser's own
 * monotonic clock (so a wrong system clock cannot matter). null when it never was.
 */
export function elapsedSinceShown(shownAt: number | null, now: number): number | null {
  if (shownAt == null) return null
  return Math.max(0, Math.round(now - shownAt))
}
