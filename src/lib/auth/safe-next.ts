/**
 * Where a user may be sent after sign-in or an invite (FA-M.08, tj decision D5 condition 2).
 *
 * Only relative paths from an allowlist pass; anything else — absolute URLs, protocol-relative
 * `//host`, backslash tricks, unknown paths — falls back to `/dashboard`, whose layout then
 * routes admins to `/admin` and non-guides to `/`.
 *
 * The allowlist is what the app already sends through `next`:
 *   - `/dashboard` and `/dashboard/…`, `/admin` and `/admin/…` — set by `src/proxy.ts` and
 *     `app/admin/layout.tsx` when a signed-out user hits a protected page;
 *   - `/dashboard/trips/<id>?action=accept` — the trip page's own sign-in redirect keeps the
 *     one-click accept (`app/dashboard/trips/[id]/page.tsx`); no other query string passes;
 *   - `/invite/<code>` — an invited guide who already has an account signs in first;
 *   - `/reset-password` — the password recovery landing page.
 */

export const DEFAULT_NEXT_PATH = '/dashboard'

const ALLOWED: readonly RegExp[] = [
  /^\/dashboard(?:\/[A-Za-z0-9_-]+)*$/,
  /^\/dashboard\/trips\/[A-Za-z0-9-]+\?action=accept$/,
  /^\/admin(?:\/[A-Za-z0-9_-]+)*$/,
  /^\/invite\/[A-Za-z0-9_-]+$/,
  /^\/reset-password$/,
]

/** The path to redirect to: `next` when it is an allowed relative path, else `/dashboard`. */
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== 'string') return DEFAULT_NEXT_PATH
  return ALLOWED.some(re => re.test(next)) ? next : DEFAULT_NEXT_PATH
}
