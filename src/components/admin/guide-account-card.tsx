'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, KeyRound, Loader2 } from 'lucide-react'
import {
  issueGuideInvite,
  revokeGuideInvite,
  type GuideAccountSummary,
  type InviteRefusalReason,
} from '@/actions/guide-invites'

/**
 * Admin "Guide account" card (FA-M.08): the account bound to the listing, or its invite.
 *
 * The invite link is shown once, right after "Create invite link" / "New link" — only its
 * sha256 is stored, so it cannot be shown again. To resend, the admin creates a new link,
 * which revokes the old one.
 */

type Props = { guideId: string; summary: GuideAccountSummary }

const REFUSAL_TEXT: Record<InviteRefusalReason, string> = {
  not_found:              'unknown link',
  revoked:                'the link was revoked',
  used:                   'the link was already used',
  expired:                'the link had expired',
  email_mismatch:         'signed in with a different e-mail than the invite',
  account_is_admin:       'signed in with an admin account',
  account_already_linked: 'that account is already linked to another listing',
  guide_already_linked:   'this listing already had an account',
}

function fmt(iso: string | null): string {
  if (iso == null || iso === '') return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const btn = 'flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full transition-all hover:brightness-95 f-body disabled:opacity-50'
const btnStyle = { background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }

export default function GuideAccountCard({ guideId, summary }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState(summary.invite?.email ?? summary.legacyInviteEmail ?? '')
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { account, invite } = summary

  function issue() {
    setError(null)
    startTransition(async () => {
      const res = await issueGuideInvite(guideId, email)
      if ('error' in res) { setError(res.error); return }
      setLink({ url: res.link, expiresAt: res.expiresAt })
      setCopied(false)
      router.refresh()
    })
  }

  function revoke(inviteId: string) {
    setError(null)
    startTransition(async () => {
      const res = await revokeGuideInvite(inviteId, guideId)
      if ('error' in res) { setError(res.error); return }
      setLink(null)
      router.refresh()
    })
  }

  async function copy() {
    if (link == null) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
    } catch {
      setError('Could not copy — select the link and copy it by hand.')
    }
  }

  return (
    <div className="mt-4 px-4 py-3 rounded-xl" style={{ background: 'rgba(10,46,77,0.035)', border: '1px solid rgba(10,46,77,0.08)' }}>
      <div className="flex items-center gap-2 mb-2">
        <KeyRound width={13} height={13} stroke="#0A2E4D" strokeWidth={1.4} />
        <p className="text-[11px] font-semibold uppercase tracking-wide f-body" style={{ color: '#0A2E4D' }}>Guide account</p>
      </div>

      {account != null ? (
        <p className="text-xs f-body" style={{ color: '#0A2E4D' }} data-testid="account-linked">
          Linked to <strong>{account.email ?? 'an account'}</strong>
          {account.linkedAt != null && <span className="opacity-60"> · linked on {fmt(account.linkedAt)}</span>}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {invite != null && (
            <p className="text-xs f-body" style={{ color: '#0A2E4D' }} data-testid="invite-state">
              {invite.state === 'open' && <>Invite open for <strong>{invite.email}</strong> · expires {fmt(invite.expiresAt)}</>}
              {invite.state === 'expired' && <>Invite for <strong>{invite.email}</strong> expired on {fmt(invite.expiresAt)}</>}
              {invite.state === 'revoked' && <>Invite for <strong>{invite.email}</strong> revoked on {fmt(invite.revokedAt)}</>}
              {invite.state === 'used' && <>Invite for <strong>{invite.email}</strong> used on {fmt(invite.redeemedAt)}</>}
              <span className="opacity-60"> · created {fmt(invite.createdAt)}</span>
            </p>
          )}
          {invite?.lastRefusal != null && (
            <p className="text-xs f-body" style={{ color: '#B45309' }} data-testid="invite-refusal">
              Last refused attempt {fmt(invite.lastRefusal.at)}: {REFUSAL_TEXT[invite.lastRefusal.reason]}
            </p>
          )}
          {invite == null && summary.legacyInviteEmail != null && (
            <p className="text-[11px] f-body opacity-60" style={{ color: '#0A2E4D' }}>
              Old invite e-mail on file: {summary.legacyInviteEmail} (it no longer links anything — create an invite link)
            </p>
          )}

          {link != null && (
            <div className="flex flex-col gap-1.5 p-3 rounded-lg" style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.12)' }}>
              <p className="text-[11px] f-body font-semibold" style={{ color: '#0A2E4D' }}>
                Send this link to the guide — it is shown only once and works until {fmt(link.expiresAt)}.
              </p>
              <code className="text-[11px] break-all" style={{ color: '#0A2E4D' }} data-testid="invite-link">{link.url}</code>
              <button type="button" onClick={() => { void copy() }} className={btn} style={btnStyle}>
                {copied ? <Check width={11} height={11} /> : <Copy width={11} height={11} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="guide@example.com"
              aria-label="Invite e-mail"
              className="text-xs f-body px-3 py-2 rounded-full"
              style={{ border: '1px solid rgba(10,46,77,0.15)', minWidth: '220px', color: '#0A2E4D' }}
            />
            <button type="button" onClick={issue} disabled={isPending} className={btn} style={btnStyle}>
              {isPending && <Loader2 width={11} height={11} className="animate-spin" />}
              {invite == null ? 'Create invite link' : 'New link'}
            </button>
            {invite?.state === 'open' && (
              <button type="button" onClick={() => revoke(invite.id)} disabled={isPending} className={btn}
                style={{ background: 'rgba(220,38,38,0.08)', color: '#B91C1C' }}>
                Revoke
              </button>
            )}
          </div>
        </div>
      )}

      {error != null && <p role="alert" className="text-xs f-body mt-2" style={{ color: '#B91C1C' }}>{error}</p>}
    </div>
  )
}
