/**
 * Authorization guards for server actions.
 *
 * Every mutating server action must call the appropriate guard as its first
 * await before creating a service-role client or touching the database.
 * Zod input validation is allowed before the guard call.
 *
 * Contract (docs/01-architecture.md §2):
 *   requireAdmin / requireGuide / requireToken  ← guard, throws on failure
 *   createServiceClient()                       ← only after the guard passes
 *
 * Each guard throws UnauthorizedError on failure — never returns null.
 */

import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── Error class ──────────────────────────────────────────────────────────────

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

// ─── requireAdmin ─────────────────────────────────────────────────────────────

/**
 * Verify the current session user has profiles.role = 'admin'.
 * Throws UnauthorizedError if not authenticated or not admin.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) throw new UnauthorizedError('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new UnauthorizedError('Not authorized — admin role required')

  return { userId: user.id }
}

// ─── isAdminRequest ───────────────────────────────────────────────────────────

/**
 * Non-throwing counterpart of requireAdmin(), for routes that must *decide what
 * to render* instead of failing — e.g. the admin-only v2 preview (FA-1.52).
 *
 * Fails closed: any error (no session, wrong role, auth call failing) is false.
 * Never use it in place of requireAdmin() on a mutation — a guard must throw.
 */
export async function isAdminRequest(): Promise<boolean> {
  try {
    await requireAdmin()
    return true
  } catch {
    return false
  }
}

// ─── requireGuide ─────────────────────────────────────────────────────────────

/**
 * Verify the current session user is a guide (has a guides row with matching
 * user_id).  Throws UnauthorizedError if not authenticated or no guide profile
 * found.
 *
 * Returns { userId, guide: { id } } — use guide.id for record-ownership checks
 * in the action body.
 */
export async function requireGuide(): Promise<{ userId: string; guide: { id: string } }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user == null) throw new UnauthorizedError('Not authenticated')

  const svc = createServiceClient()
  const { data: guide } = await svc
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (guide == null) throw new UnauthorizedError('Guide profile not found')

  return { userId: user.id, guide: { id: guide.id } }
}

// ─── requireToken ─────────────────────────────────────────────────────────────

type TokenKind = 'offer' | 'review'

/**
 * Validate a magic-link token for offer or review pages.
 * Throws UnauthorizedError if the token is not found or has expired.
 *
 * Returns { id } — the primary key of the matched row (inquiry.id or
 * review.id).  Callers can use this id to fetch full row data by primary key
 * instead of querying by token a second time.
 */
export async function requireToken(kind: TokenKind, token: string): Promise<{ id: string }> {
  const svc = createServiceClient()

  if (kind === 'offer') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc as any)
      .from('inquiries')
      .select('id, offer_token_expires_at')
      .eq('offer_token', token)
      .maybeSingle()

    if (data == null) throw new UnauthorizedError('Offer token not found or has expired')

    if (data.offer_token_expires_at != null &&
        new Date(data.offer_token_expires_at as string) < new Date()) {
      throw new UnauthorizedError('This offer link has expired. Please contact us for a new one.')
    }

    return { id: data.id as string }
  }

  // kind === 'review'
  const { data } = await svc
    .from('reviews')
    .select('id, token_expires_at')
    .eq('token', token)
    .maybeSingle()

  if (data == null) throw new UnauthorizedError('Review token not found or has expired')

  if (new Date(data.token_expires_at) < new Date()) {
    throw new UnauthorizedError('This review link has expired.')
  }

  return { id: data.id }
}
