/**
 * FA-M.03 (tj D3 a) — event types written by SQL functions must be in the TypeScript catalogue.
 *
 * The guide request functions write `inquiry_events` rows inside the database transaction, so they
 * bypass `emitEvent()`'s type check. This test reads every migration, finds each event type literal
 * inside an `INSERT INTO public.inquiry_events` statement and requires it in EVENT_TYPES. Renaming a
 * type on either side without the other fails here.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EVENT_TYPES } from '@/lib/events/types'

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

/** Event type literals ('a.b') inside INSERT INTO public.inquiry_events … ; statements of a file. */
function sqlEventTypes(sql: string): string[] {
  const found: string[] = []
  const stmt = /INSERT\s+INTO\s+public\.inquiry_events\b[\s\S]*?;/gi
  for (const m of sql.matchAll(stmt)) {
    for (const lit of m[0].matchAll(/'([a-z_]+\.[a-z_]+)'/g)) found.push(lit[1])
  }
  return found
}

describe('SQL ↔ types.ts event catalogue', () => {
  const byFile = readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql'))
    .map(f => ({ file: f, types: sqlEventTypes(readFileSync(join(MIGRATIONS, f), 'utf8')) }))
    .filter(x => x.types.length > 0)

  it('finds the guide request event types in the FA-M.03 migration', () => {
    const m03 = byFile.find(x => x.file.endsWith('_add_guide_requests.sql'))
    expect(new Set(m03?.types)).toEqual(new Set([
      'guide.request_sent', 'guide.request_opened', 'guide.request_answered', 'guide.request_withdrawn',
    ]))
  })

  it('every event type written by a migration is in EVENT_TYPES', () => {
    const catalogue = new Set<string>(EVENT_TYPES)
    const missing = byFile.flatMap(x => x.types.filter(t => !catalogue.has(t)).map(t => `${x.file}: ${t}`))
    expect(missing).toEqual([])
  })
})
