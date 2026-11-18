/**
 * GET /api/calendar/google/callback — Google sends the guide back here after the consent screen
 * (FA-M.10). Registered redirect URI (tj): http://localhost:3000/… and https://www.fjordanglers.com/….
 *
 * Order, so that a bad request stores nothing:
 *   1. the query (`state`, `code`, `error`) is validated by a schema;
 *   2. `state` must equal the httpOnly cookie set when this browser started — else refused, no DB call;
 *   3. the database uses the state up (wrong / used / expired → refused, nothing written);
 *   4. a start from the guide's session must finish as the same signed-in guide;
 *   5. only then is the code exchanged and the calendar stored.
 * The cookie is always cleared. The guide lands on one of two fixed paths — never a URL from the
 * request. Logs carry outcome codes only: never the state, the code, a token or calendar contents.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { env } from '@/lib/env'
import { requireGuide } from '@/lib/auth/guards'
import { finishGoogleConnect, type GoogleConnectEntry, type GoogleFinishOutcome } from '@/lib/calendar/google-connect'
import { CLEAR_GOOGLE_STATE_COOKIE, GOOGLE_STATE_COOKIE, stateMatchesCookie } from '@/lib/calendar/google-state-cookie'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  state: z.string().min(1).max(128).optional(),
  code: z.string().min(1).max(2048).optional(),
  error: z.string().min(1).max(128).optional(),
})

type LandingStatus = 'connected' | 'denied' | 'error'

/** The only two places the callback sends a guide (tj STOP 1, decision 3). */
function landingPath(entry: GoogleConnectEntry | null, status: LandingStatus): string {
  return entry === 'session' ? `/dashboard/calendar?google=${status}` : `/connect-calendar/done?status=${status}`
}

function land(entry: GoogleConnectEntry | null, status: LandingStatus): NextResponse {
  const res = NextResponse.redirect(new URL(landingPath(entry, status), env.NEXT_PUBLIC_APP_URL), 303)
  res.cookies.set(CLEAR_GOOGLE_STATE_COOKIE)
  return res
}

function statusOf(outcome: GoogleFinishOutcome): LandingStatus {
  return outcome.kind === 'connected' ? 'connected' : outcome.kind === 'denied' ? 'denied' : 'error'
}

async function signedInGuideId(): Promise<string | null> {
  try {
    return (await requireGuide()).guide.id
  } catch {
    return null
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams
  const parsed = querySchema.safeParse({
    state: params.get('state') ?? undefined,
    code: params.get('code') ?? undefined,
    error: params.get('error') ?? undefined,
  })
  if (!parsed.success || parsed.data.state == null) {
    console.warn('[google-calendar callback] refused: invalid query')
    return land(null, 'error')
  }
  const { state, code, error } = parsed.data
  if (!stateMatchesCookie(state, req.cookies.get(GOOGLE_STATE_COOKIE)?.value)) {
    console.warn('[google-calendar callback] refused: state does not match this browser')
    return land(null, 'error')
  }

  try {
    const outcome = await finishGoogleConnect(createServiceClient(), { state, code, error }, {
      sessionGuideId: await signedInGuideId(),
    })
    if (outcome.kind !== 'connected') {
      console.warn('[google-calendar callback]', outcome.kind, outcome.kind === 'failed' ? outcome.error : '')
    }
    return land(outcome.entry, statusOf(outcome))
  } catch (e) {
    console.error('[google-calendar callback] failed:', e instanceof Error ? e.message : 'unknown error')
    return land(null, 'error')
  }
}
