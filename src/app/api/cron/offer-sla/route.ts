/**
 * GET /api/cron/offer-sla
 *
 * Vercel Cron: "0 5 * * *" — 07:00 Europe/Warsaw (CEST summer) / 06:00 CET winter.
 * NOTE: Vercel cron schedules run in UTC and have no DST awareness. "0 5 * * *"
 * fires at 05:00 UTC year-round — that's 07:00 CEST (summer) and 06:00 CET (winter).
 *
 * Queries inquiries that have exceeded the 48 h offer SLA (no offer sent, active status).
 * If OWNER_EMAIL is set and the list is non-empty, sends a digest email.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { isEmailFaked, logFakeSend } from '@/lib/email-fake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  pending:                 'Pending',
  in_negotiation:          'Negotiating',
  waiting_for_guide_offer: 'Waiting guide',
  offer_sent:              'Offer sent',
  waiting_for_deposit:     'Waiting deposit',
  deposit_sent:            'Deposit sent',
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = env.CRON_SECRET
  const auth   = req.headers.get('authorization')
  if (!secret || !auth || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc     = createServiceClient()
  const cutoff  = new Date(Date.now() - 48 * 3_600_000).toISOString()

  const { data, error } = await svc
    .from('inquiries')
    .select('id, angler_name, trip_country, status, created_at')
    .is('offer_sent_at', null)
    .eq('external_offer_sent', false)
    .not('status', 'in', '(lost,cancelled,deposit_paid,completed)')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })

  if (error != null) {
    console.error('[offer-sla cron] query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const overdue = data ?? []
  console.log(`[offer-sla cron] ${overdue.length} overdue inquiries`)

  if (overdue.length === 0) {
    return NextResponse.json({ overdue: 0 })
  }

  if (!env.OWNER_EMAIL) {
    console.log('[offer-sla cron] OWNER_EMAIL not set — skipping mail')
    return NextResponse.json({ overdue: overdue.length, mailed: false })
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL
  const rows = overdue.map(row => {
    const hours     = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 3_600_000)
    const adminUrl  = `${baseUrl}/admin/inquiries/${row.id}`
    const rowColor  = hours > 72 ? '#DC2626' : '#EA580C'
    const statusLbl = STATUS_LABELS[row.status] ?? row.status
    return `
      <tr>
        <td style="padding:8px 14px;border-bottom:1px solid #E5E7EB;font-size:13px">${escHtml(row.angler_name ?? '—')}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E5E7EB;font-size:13px">${escHtml(row.trip_country ?? '—')}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E5E7EB;font-size:13px">${escHtml(statusLbl)}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E5E7EB;font-size:13px;color:${rowColor};font-weight:700">${hours}h</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E5E7EB;font-size:13px">
          <a href="${adminUrl}" style="color:#0A2E4D;font-weight:600">View →</a>
        </td>
      </tr>`
  }).join('')

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8FAFB;padding:32px 0">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden">
        <div style="background:#0A2E4D;padding:20px 32px">
          <p style="color:#fff;font-size:15px;font-weight:700;margin:0">FjordAnglers — Offer SLA alert</p>
        </div>
        <div style="padding:24px 32px">
          <p style="color:#374151;font-size:14px;margin:0 0 20px">
            ${overdue.length} inquir${overdue.length === 1 ? 'y has' : 'ies have'} been waiting for an offer for more than 48 hours.
          </p>
          <table width="100%" cellPadding="0" cellSpacing="0"
            style="border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#F8FAFB">
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em">Name</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em">Country</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em">Status</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em">Waiting</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em">Link</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#9CA3AF;font-size:12px;margin:20px 0 0">FjordAnglers · SLA digest</p>
        </div>
      </div>
    </div>`

  if (isEmailFaked()) {
    logFakeSend('offer-sla digest', env.OWNER_EMAIL)
    return NextResponse.json({ overdue: overdue.length, mailed: false, faked: true })
  }

  const sendRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body:  JSON.stringify({
      from:    env.FA_FROM_EMAIL,
      to:      env.OWNER_EMAIL,
      subject: `⏱ SLA alert — ${overdue.length} inquir${overdue.length === 1 ? 'y' : 'ies'} without offer`,
      html,
    }),
    cache: 'no-store',
  })

  if (!sendRes.ok) {
    const bodyText = await sendRes.text().catch(() => '(no body)')
    console.error('[offer-sla cron] email error:', sendRes.status, bodyText)
    return NextResponse.json({ overdue: overdue.length, mailed: false, emailError: sendRes.status }, { status: 500 })
  }

  return NextResponse.json({ overdue: overdue.length, mailed: true })
}

// Vercel Cron invokes GET; also accept POST for manual curl testing
export const POST = GET
