'use server'

/**
 * Guide invites (FA-M.08) — the only way an account gets bound to a `guides` row.
 *
 * Admin side (requireAdmin first):
 *   issueGuideInvite(guideId, email)   → a one-time link, shown once (only its sha256 is stored)
 *   revokeGuideInvite(inviteId, guideId)
 *   getGuideAccountSummary(guideId)    → what the admin "Guide account" card shows
 *
 * Guide side (the code in the link is the credential):
 *   getGuideInviteByToken(code)        → listing name + e-mail for an open invite, else null
 *   acceptGuideInvite(code, password)  → creates the account for the invite e-mail, binds it
 *   claimGuideInvite(code)             → binds the signed-in account (its e-mail must match)
 *
 * The binding itself (invite used + guides.user_id + profiles.role='guide' + audit_log row)
 * happens in one transaction inside `redeem_guide_invite` — see
 * supabase/migrations/20261113000000_add_guide_invites.sql. Nothing here decides a role from
 * client input or account metadata (FA-1.93).
 */

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { generateInviteCode, hashInviteCode, isInviteCode } from '@/lib/auth/invite-token'

/** The one message a visitor sees for any unusable link — the reason is only on the admin card. */
const INVITE_INVALID = 'This invite link is no longer valid — ask FjordAnglers for a new one.'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

export type InviteRefusalReason =
  | 'not_found' | 'revoked' | 'used' | 'expired' | 'email_mismatch'
  | 'account_is_admin' | 'account_already_linked' | 'guide_already_linked'

// ─── Shared read ──────────────────────────────────────────────────────────────

type OpenInvite = { id: string; guideId: string; guideName: string; email: string; tokenHash: string }

/** The invite behind a code, only while it is open (not used, not revoked, not expired). */
async function findOpenInvite(code: string): Promise<OpenInvite | null> {
  if (!isInviteCode(code)) return null
  const tokenHash = hashInviteCode(code)

  const svc = createServiceClient()
  const { data } = await svc
    .from('guide_invites')
    .select('id, guide_id, email, expires_at, redeemed_at, revoked_at, guides(full_name)')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (data == null || data.redeemed_at != null || data.revoked_at != null) return null
  if (new Date(data.expires_at) <= new Date()) return null

  return {
    id: data.id,
    guideId: data.guide_id,
    guideName: data.guides?.full_name ?? '',
    email: data.email,
    tokenHash,
  }
}

async function redeem(
  tokenHash: string,
  userId: string,
  userEmail: string | null,
): Promise<{ outcome: string; guideId: string | null }> {
  const svc = createServiceClient()
  const { data, error } = await svc.rpc('redeem_guide_invite', {
    p_token_hash: tokenHash,
    p_user_id: userId,
    p_user_email: userEmail ?? '',
  })
  if (error != null) {
    console.error('[guide-invites/redeem] rpc failed:', error.message)
    return { outcome: 'error', guideId: null }
  }
  const row = data?.[0]
  return { outcome: row?.outcome ?? 'error', guideId: row?.bound_guide_id ?? null }
}

// ─── Guide side ───────────────────────────────────────────────────────────────

export type InvitePreview = { guideName: string; email: string }

/** Public, code-gated: what the invite page shows. Null for any unusable code. */
export async function getGuideInviteByToken(code: string): Promise<InvitePreview | null> {
  const invite = await findOpenInvite(code)
  return invite == null ? null : { guideName: invite.guideName, email: invite.email }
}

export type AcceptInviteResult =
  | { success: true }
  | { existingAccount: true }
  | { error: string }

/**
 * Signed-out guide: create the account for the invite e-mail with this password, bind it to
 * the listing, sign in. If the e-mail already has an account, nothing is created and the page
 * asks the guide to sign in and claim the invite instead (tj decision D5).
 */
export async function acceptGuideInvite(code: string, password: string): Promise<AcceptInviteResult> {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return { error: `Password must be at least ${MIN_PASSWORD} characters.` }
  }

  const invite = await findOpenInvite(code)
  if (invite == null) return { error: INVITE_INVALID }

  const svc = createServiceClient()
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email: invite.email,
    password,
    // The e-mail was set by FA on the invite (D4) and the code proves the link reached its
    // holder; Supabase sends no confirmation mail on this path.
    email_confirm: true,
    user_metadata: { full_name: invite.guideName },
  })

  if (createErr != null || created.user == null) {
    const msg = createErr?.message.toLowerCase() ?? ''
    if (msg.includes('already been registered') || msg.includes('already registered') || msg.includes('already exists')) {
      return { existingAccount: true }
    }
    console.error('[guide-invites/accept] createUser failed:', createErr?.message)
    return { error: 'Could not create your account. Please try again.' }
  }

  const userId = created.user.id
  const { outcome } = await redeem(invite.tokenHash, userId, created.user.email ?? null)

  if (outcome !== 'redeemed') {
    // Lost a race (the same link used twice at once) or the listing changed under us: remove
    // the account this call just created so no orphan login is left behind.
    const { error: delErr } = await svc.auth.admin.deleteUser(userId)
    if (delErr != null) console.error('[guide-invites/accept] cleanup deleteUser failed:', delErr.message)
    return { error: INVITE_INVALID }
  }

  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: invite.email, password })
  if (signInErr != null) {
    // The account is bound; the guide can still sign in from /login.
    console.error('[guide-invites/accept] sign-in after redeem failed:', signInErr.message)
  }

  return { success: true }
}

/**
 * Signed-in account: bind it to the invite's listing. Refused (same generic message) unless
 * the account's e-mail — read by the server from Supabase Auth — equals the invite e-mail;
 * the reason is recorded for the admin card.
 */
export async function claimGuideInvite(code: string): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) return { error: 'Please sign in first.' }

  if (!isInviteCode(code)) return { error: INVITE_INVALID }

  const { outcome } = await redeem(hashInviteCode(code), user.id, user.email ?? null)
  if (outcome !== 'redeemed') return { error: INVITE_INVALID }

  return { success: true }
}

// ─── Admin side ───────────────────────────────────────────────────────────────

export type IssueInviteResult = { success: true; link: string; expiresAt: string } | { error: string }

/** Issue a new invite for a listing (revokes its open one). The link is returned once. */
export async function issueGuideInvite(guideId: string, email: string): Promise<IssueInviteResult> {
  const { userId: adminId } = await requireAdmin()

  const normalised = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(normalised)) return { error: 'Enter a valid e-mail address.' }

  const code = generateInviteCode()
  const svc = createServiceClient()
  const { data: inviteId, error } = await svc.rpc('issue_guide_invite', {
    p_guide_id: guideId,
    p_email: normalised,
    p_token_hash: hashInviteCode(code),
    p_admin_id: adminId,
  })

  if (error != null || inviteId == null) {
    if (error?.message.includes('guide_already_linked')) return { error: 'This guide already has an account.' }
    if (error?.message.includes('guide_not_found')) return { error: 'Guide not found.' }
    console.error('[guide-invites/issue] rpc failed:', error?.message)
    return { error: 'Could not create the invite. Please try again.' }
  }

  const { data: row } = await svc.from('guide_invites').select('expires_at').eq('id', inviteId).single()

  revalidatePath(`/admin/guides/${guideId}`)
  return {
    success: true,
    link: `${await getAppUrl()}/invite/${code}`,
    expiresAt: row?.expires_at ?? '',
  }
}

export async function revokeGuideInvite(inviteId: string, guideId: string): Promise<{ success: true } | { error: string }> {
  const { userId: adminId } = await requireAdmin()

  const svc = createServiceClient()
  const { data: revoked, error } = await svc.rpc('revoke_guide_invite', {
    p_invite_id: inviteId,
    p_admin_id: adminId,
  })
  if (error != null) {
    console.error('[guide-invites/revoke] rpc failed:', error.message)
    return { error: 'Could not revoke the invite. Please try again.' }
  }
  if (revoked !== true) return { error: 'This invite is no longer open.' }

  revalidatePath(`/admin/guides/${guideId}`)
  return { success: true }
}

type GuideInviteState = 'open' | 'expired' | 'used' | 'revoked'

export type GuideAccountSummary = {
  /** The bound account, when guides.user_id is set. */
  account: { email: string | null; linkedAt: string | null } | null
  /** The latest invite of the listing, if any. */
  invite: {
    id: string
    email: string
    state: GuideInviteState
    createdAt: string
    expiresAt: string
    redeemedAt: string | null
    revokedAt: string | null
    /** The last refused redemption of this invite (e.g. a different signed-in account). */
    lastRefusal: { reason: InviteRefusalReason; at: string } | null
  } | null
  /** Legacy guides.invite_email — only a prefill for a new invite; it binds nothing. */
  legacyInviteEmail: string | null
}

const REFUSAL_REASONS: readonly InviteRefusalReason[] = [
  'not_found', 'revoked', 'used', 'expired', 'email_mismatch',
  'account_is_admin', 'account_already_linked', 'guide_already_linked',
]

/** What the admin "Guide account" card shows for one listing. */
export async function getGuideAccountSummary(guideId: string): Promise<GuideAccountSummary | null> {
  await requireAdmin()
  const svc = createServiceClient()

  const { data: guide } = await svc
    .from('guides')
    .select('id, user_id, invite_email')
    .eq('id', guideId)
    .maybeSingle()
  if (guide == null) return null

  const { data: inv } = await svc
    .from('guide_invites')
    .select('id, email, created_at, expires_at, redeemed_at, revoked_at')
    .eq('guide_id', guideId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let invite: GuideAccountSummary['invite'] = null
  if (inv != null) {
    const state: GuideInviteState =
      inv.redeemed_at != null ? 'used'
        : inv.revoked_at != null ? 'revoked'
          : new Date(inv.expires_at) <= new Date() ? 'expired'
            : 'open'

    const { data: refusal } = await svc
      .from('audit_log')
      .select('new_data, changed_at')
      .eq('table_name', 'guide_invites')
      .eq('operation', 'REDEEM_REFUSED')
      .eq('record_id', inv.id)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const rawReason = (refusal?.new_data as { reason?: unknown } | null)?.reason
    const reason = REFUSAL_REASONS.find(r => r === rawReason)

    invite = {
      id: inv.id,
      email: inv.email,
      state,
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
      redeemedAt: inv.redeemed_at,
      revokedAt: inv.revoked_at,
      lastRefusal: reason != null && refusal?.changed_at != null ? { reason, at: refusal.changed_at } : null,
    }
  }

  let account: GuideAccountSummary['account'] = null
  if (guide.user_id != null) {
    const { data: u } = await svc.auth.admin.getUserById(guide.user_id)
    account = {
      email: u.user?.email ?? null,
      linkedAt: invite?.state === 'used' ? invite.redeemedAt : null,
    }
  }

  return {
    account,
    invite,
    legacyInviteEmail: guide.invite_email != null && guide.invite_email.trim() !== '' ? guide.invite_email.trim() : null,
  }
}
