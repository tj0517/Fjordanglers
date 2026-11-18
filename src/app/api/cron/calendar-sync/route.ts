/**
 * GET /api/cron/calendar-sync — FA-M.09. Reads every connected guide calendar and replaces its
 * calendar-sourced busy days (manual blocks are never touched; a failed fetch keeps the old days and
 * records the error). Vercel Cron with `Authorization: Bearer <CRON_SECRET>`, like offer-sla.
 *
 * Without a usable CALENDAR_LINK_KEY the route refuses with 503 and touches nothing (tj 2026-11-17).
 * The response and the log carry counts, guide ids and error codes — never a calendar link.
 */

import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { CalendarSyncDisabledError, syncAllCalendars } from '@/lib/calendar/connections'
import { CALENDAR_DISABLED_MESSAGE } from '@/lib/calendar/link-crypto'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** 4 calendars at a time, ≤10 s each: well inside this for the guides FA has. */
export const maxDuration = 300

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || !auth || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await syncAllCalendars(createServiceClient())
    console.log('[calendar-sync cron]', JSON.stringify({ total: summary.total, ok: summary.ok, failed: summary.failed, stale: summary.stale, disconnected: summary.disconnected, skipped: summary.skipped }))
    return NextResponse.json(summary)
  } catch (e) {
    if (e instanceof CalendarSyncDisabledError) {
      console.error('[calendar-sync cron]', CALENDAR_DISABLED_MESSAGE)
      return NextResponse.json({ error: CALENDAR_DISABLED_MESSAGE }, { status: 503 })
    }
    console.error('[calendar-sync cron] failed:', e instanceof Error ? e.message : 'unknown error')
    return NextResponse.json({ error: 'calendar sync failed' }, { status: 500 })
  }
}
