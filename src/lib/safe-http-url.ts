/**
 * FA-1.92: its own module, with no imports, because the browser inquiry wizard needs it and
 * `experience-v2-content.ts` pulls the zod-based page editor (`experiences/v2-editor.ts`) into
 * whatever imports it — that alone put zod in the offer page's first-load JS.
 *
 * Only `http(s)` URLs may become links (the value is admin-typed text, and `javascript:`
 * is the classic way an href turns into code). Anything else returns null and the caller
 * prints the text instead.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (value == null) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}
