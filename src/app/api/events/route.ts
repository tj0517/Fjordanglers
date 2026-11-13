/**
 * POST /api/events — ingest a single funnel telemetry event.
 *
 * Fires from the client via navigator.sendBeacon (Blob, application/json)
 * with a fetch keepalive fallback. Cookie consent is NOT required — no
 * personal identifier is stored (no IP, no browser fingerprint, no ad-click id, no session id).
 *
 * device: derived server-side from sec-ch-ua-mobile / User-Agent; never stored.
 * referrer_host: sent by the page (FA-1.87, see src/lib/web-events.ts), reduced again here to a
 *   host; an odd value is stored as NULL, never a 400. Payloads without it (pages cached before
 *   FA-1.87) are accepted and stored with NULL. The beacon's own Referer header is not read —
 *   it is always our own site.
 * country: passed by the client from the page's destination data (not geolocation).
 * utm_campaign / utm_content: from window.location.search on page_view only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { normaliseReferrerHost } from '@/lib/attribution'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Rate limit (in-process, per path) ───────────────────────────────────────
// 60 requests per minute per path. Resets automatically via the resetAt clock.
// Acceptable for a page-view counter; no client identifier is read.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 60

function isRateLimited(path: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(path)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(path, { count: 1, resetAt: now + 60_000 })
    return false
  }

  if (entry.count >= RATE_LIMIT_MAX) return true

  entry.count++
  return false
}

// ─── Device detection (server-side, UA never stored) ─────────────────────────

function detectDevice(req: NextRequest): 'mobile' | 'desktop' | 'tablet' | 'unknown' {
  const mobile = req.headers.get('sec-ch-ua-mobile')
  const ua     = req.headers.get('user-agent') ?? ''

  if (mobile === '?1') {
    if (/iPad|Tablet/i.test(ua)) return 'tablet'
    return 'mobile'
  }
  if (mobile === '?0') {
    return 'desktop'
  }

  // Fallback: UA heuristic
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  if (/Mobile|Android/i.test(ua)) return 'mobile'
  if (ua.length > 0) return 'desktop'
  return 'unknown'
}

// ─── Zod schema — strict() rejects unknown fields with a 400 ─────────────────

const EventSchema = z
  .object({
    event:        z.enum(['page_view', 'form_open', 'form_submit']),
    path:         z.string().min(1).max(500),
    country:      z.string().max(40).optional(),
    utm_campaign: z.string().max(200).optional(),
    utm_content:  z.string().max(200).optional(),
    // Untrusted, analytics only: anything odd becomes NULL rather than costing the event.
    referrer_host: z.unknown().optional().transform(normaliseReferrerHost),
  })
  .strict()

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Parse body — sendBeacon sends application/json Blob; fallback sends text too
  let body: unknown
  try {
    body = JSON.parse(await req.text())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = EventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { event, path, country, utm_campaign, utm_content, referrer_host } = parsed.data

  // Rate limit per path — never reads client IP
  if (isRateLimited(path)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const device = detectDevice(req)

  const svc = createServiceClient()
  const { error } = await svc.from('web_events').insert({
    event,
    path,
    country:      country      ?? null,
    utm_campaign: utm_campaign ?? null,
    utm_content:  utm_content  ?? null,
    device,
    referrer_host,
  })

  if (error) {
    console.error('[POST /api/events] insert error:', error.message)
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
  }

  // 204 No Content — sendBeacon ignores the response anyway
  return new NextResponse(null, { status: 204 })
}
