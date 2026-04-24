'use server'

import { env } from '@/lib/env'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TripPlanPayload {
  species:     string[]
  country:     string
  datesApprox: string | null
  partySize:   number
  tripType:    string
  duration:    string
  name:        string
  email:       string
  phone:       string | null
  message:     string | null
  newsletter:  boolean
}

export type TripPlanResult =
  | { success: true }
  | { success: false; error: string }

// ─── submitTripPlan ───────────────────────────────────────────────────────────

export async function submitTripPlan(payload: TripPlanPayload): Promise<TripPlanResult> {
  // Server-side validation
  if (!payload.name.trim()) return { success: false, error: 'Name is required' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
    return { success: false, error: 'Valid email is required' }
  }
  if (!payload.country)             return { success: false, error: 'Country is required' }
  if (payload.species.length === 0) return { success: false, error: 'At least one species is required' }

  const speciesList = payload.species.join(', ')
  const faEmail     = env.FA_EMAIL ?? 'contact@fjordanglers.com'

  const rows: [string, string][] = [
    ['Name',           payload.name.trim()],
    ['Email',          payload.email.trim()],
    ...(payload.phone ? [['Phone', payload.phone] as [string, string]] : []),
    ['Target species', speciesList],
    ['Country',        payload.country],
    ...(payload.datesApprox ? [['Approx. dates', payload.datesApprox] as [string, string]] : []),
    ['Party size',     String(payload.partySize)],
    ['Trip type',      payload.tripType],
    ['Duration',       payload.duration],
    ...(payload.message ? [['Message', payload.message.trim()] as [string, string]] : []),
    ['Newsletter',     payload.newsletter ? 'Yes' : 'No'],
  ]

  const tableRows = rows
    .map(([k, v]) => `
      <tr>
        <td style="padding:8px 14px;border:1px solid #ddd;background:#f9f6f1;font-weight:700;width:150px;color:#0A2E4D">${k}</td>
        <td style="padding:8px 14px;border:1px solid #ddd;color:#333">${v}</td>
      </tr>`)
    .join('')

  const faHtml = `
    <div style="font-family:sans-serif;color:#0A2E4D;max-width:640px;margin:0 auto">
      <div style="background:#0A2E4D;padding:24px 32px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#fff;font-size:20px">New trip plan inquiry</h2>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:13px">Submitted via fjordanglers.com/plan-your-trip</p>
      </div>
      <div style="border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;padding:24px 32px;background:#fff">
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">${tableRows}</table>
        <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee">
          <a href="${env.NEXT_PUBLIC_APP_URL}/admin/inquiries" style="background:#E67E50;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px">
            View in admin →
          </a>
        </div>
      </div>
    </div>
  `

  const firstName = payload.name.trim().split(/\s+/)[0]!
  const anglerHtml = `
    <div style="font-family:sans-serif;color:#0A2E4D;max-width:640px;margin:0 auto">
      <div style="background:#0A2E4D;padding:24px 32px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#fff;font-size:20px">We've got your trip plan, ${firstName}!</h2>
      </div>
      <div style="border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;padding:24px 32px;background:#fff">
        <p style="margin:0 0 16px;line-height:1.6">Thank you for reaching out. We read every inquiry ourselves and will get back to you within 24 hours with trip ideas, availability, and next steps.</p>
        <div style="background:#f9f6f1;border-radius:6px;padding:16px 20px;margin:0 0 20px">
          <p style="margin:0 0 8px;font-weight:700;color:#0A2E4D;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">Your summary</p>
          <ul style="margin:0;padding-left:18px;line-height:1.8">
            <li><strong>Species:</strong> ${speciesList}</li>
            <li><strong>Country:</strong> ${payload.country}</li>
            ${payload.datesApprox ? `<li><strong>Approx. dates:</strong> ${payload.datesApprox}</li>` : ''}
            <li><strong>Party size:</strong> ${payload.partySize} ${payload.partySize === 1 ? 'angler' : 'anglers'}</li>
          </ul>
        </div>
        <p style="margin:0;color:#666;font-size:14px;line-height:1.6">— The FjordAnglers Team<br>
          <a href="${env.NEXT_PUBLIC_APP_URL}" style="color:#E67E50">fjordanglers.com</a>
        </p>
      </div>
    </div>
  `

  try {
    await Promise.all([
      fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          from:    'FjordAnglers <contact@fjordanglers.com>',
          to:      faEmail,
          subject: `New trip plan — ${payload.name} · ${payload.country} · ${speciesList}`,
          html:    faHtml,
        }),
        cache: 'no-store',
      }),
      fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          from:    'FjordAnglers <contact@fjordanglers.com>',
          to:      payload.email.trim(),
          subject: 'Your trip plan is with us — FjordAnglers',
          html:    anglerHtml,
        }),
        cache: 'no-store',
      }),
    ])

    console.log(`[submitTripPlan] Sent trip plan email for ${payload.email} → ${faEmail}`)
    return { success: true }
  } catch (err) {
    console.error('[submitTripPlan] Error:', err)
    return { success: false, error: 'Failed to send your inquiry. Please try again.' }
  }
}
