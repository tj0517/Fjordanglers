/**
 * FA-1.22 (D-F) — agent_knowledge.country stays in step with COUNTRIES.
 *
 * `agent_knowledge_country_check` repeats the country list from src/lib/countries.ts as a
 * SQL literal, because a CHECK cannot import TypeScript. Two sources of one list drift:
 * someone adds a country to COUNTRIES, the constraint keeps rejecting it, and a knowledge
 * entry for that country silently cannot be saved.
 *
 * tj chose two tests rather than one (22 Sep), because `pg_get_constraintdef` is out of
 * reach here — the tests talk to PostgREST, which exposes only `public`, and the repo has
 * no raw Postgres client:
 *
 *   1. parsing     — reads the literal list out of the migration file and compares it to
 *                    COUNTRIES. Catches the drift at its source and needs no database.
 *   2. behavioural — every COUNTRIES value really inserts against the live local database,
 *                    and a value from outside the list is really rejected by that
 *                    constraint by name.
 *
 * Together they pin both directions except "constraint widened in the database only",
 * which `supabase db diff --local` in CI already catches.
 */

import { describe, it, expect, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { COUNTRIES } from '@/lib/countries'
import { createServiceClient } from '@/lib/supabase/server'

const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261005000000_add_agent_knowledge.sql',
)

/** Marks every row this file creates, so cleanup never touches the seed. */
const TITLE_TAG = 'FA-1.22 country sync test'

afterAll(async () => {
  await createServiceClient().from('agent_knowledge').delete().eq('title', TITLE_TAG)
})

describe('FA-1.22 — agent_knowledge_country_check matches COUNTRIES', () => {
  it('the list written into the migration equals COUNTRIES', () => {
    const sql = readFileSync(MIGRATION, 'utf8')

    const block = sql.match(
      /CONSTRAINT\s+agent_knowledge_country_check[\s\S]*?country\s+IN\s*\(([\s\S]*?)\)/,
    )
    expect(
      block,
      'agent_knowledge_country_check with a "country IN (…)" list not found in the migration',
    ).not.toBeNull()

    const inConstraint = [...block![1].matchAll(/'([^']+)'/g)].map(m => m[1])

    expect([...inConstraint].sort()).toEqual([...COUNTRIES].sort())
  })

  it('every COUNTRIES value is accepted by the live constraint', async () => {
    const svc = createServiceClient()

    const rows = COUNTRIES.map(country => ({
      kind: 'destination',
      country,
      title: TITLE_TAG,
      body: `probe for ${country}`,
    }))

    const { error } = await svc.from('agent_knowledge').insert(rows)
    expect(error, `a COUNTRIES value was rejected: ${error?.message}`).toBeNull()

    const { data } = await svc
      .from('agent_knowledge')
      .select('country')
      .eq('title', TITLE_TAG)

    expect((data ?? []).map(r => r.country).sort()).toEqual([...COUNTRIES].sort())
  })

  it('a value outside COUNTRIES is rejected by that constraint, by name', async () => {
    const { error } = await createServiceClient().from('agent_knowledge').insert({
      kind: 'destination',
      country: 'Atlantis',
      title: TITLE_TAG,
      body: 'not a supported country',
    })

    expect(error).not.toBeNull()
    expect(error!.message).toContain('agent_knowledge_country_check')
  })
})
