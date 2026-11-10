/**
 * FA-1.86 — the database refuses an active guide without a slug (`guides_active_requires_slug`:
 * `status <> 'active' or (slug is not null and btrim(slug) <> '')`).
 *
 * This is the database's own guarantee, so the statements go straight to Postgres with `psql`,
 * not through PostgREST or the admin actions (those have their own tests). `psql -v
 * VERBOSITY=verbose` prints the error's structured fields — the SQLSTATE after `ERROR:` and the
 * `CONSTRAINT NAME:` line — which is what is asserted; the wording of the message is not.
 *
 * Local stack only (the safety fuse in `src/tests/setup.ts` has already refused any other
 * Supabase URL; the Postgres port is the stack's own 54422). Own rows with fixed ids, removed
 * before and after; the seed is not touched.
 */
import { spawnSync } from 'node:child_process'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const PG_URL = 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'
const CONSTRAINT = 'guides_active_requires_slug'
const CHECK_VIOLATION = '23514'

const ID_INSERT = '86860000-0000-4000-8000-000000000001'
const ID_BLANK  = '86860000-0000-4000-8000-000000000002'
const ID_ACTIVATE = '86860000-0000-4000-8000-000000000003'
const IDS = [ID_INSERT, ID_BLANK, ID_ACTIVATE]
const idList = IDS.map(id => `'${id}'`).join(', ')

type Outcome = { ok: true } | { ok: false; sqlstate: string | null; constraint: string | null; stderr: string }

/** One statement, one transaction (psql autocommit), run against the local Postgres. */
function run(sql: string): Outcome {
  const r = spawnSync(
    'psql',
    [PG_URL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-c', sql],
    { encoding: 'utf8' },
  )
  if (r.error != null) throw new Error(`psql could not be started (${r.error.message}) — this test needs the psql client`)
  if (r.status === 0) return { ok: true }
  return {
    ok: false,
    sqlstate: /^ERROR:\s+([0-9A-Z]{5}):/m.exec(r.stderr)?.[1] ?? null,
    constraint: /^CONSTRAINT NAME:\s+(\S+)\s*$/m.exec(r.stderr)?.[1] ?? null,
    stderr: r.stderr,
  }
}

function mustSucceed(sql: string) {
  const out = run(sql)
  if (!out.ok) throw new Error(`expected success, got ${out.sqlstate}: ${out.stderr}`)
}

/** The statement must be refused by the constraint — by code and by name. */
function expectRefusedByRule(sql: string) {
  const out = run(sql)
  expect(out.ok, 'the statement must be rejected').toBe(false)
  if (out.ok) return
  expect(out.sqlstate).toBe(CHECK_VIOLATION)
  expect(out.constraint).toBe(CONSTRAINT)
}

function cleanup() {
  mustSucceed(`delete from public.guides where id in (${idList})`)
  mustSucceed(`delete from public.audit_log where table_name = 'guides' and record_id in (${idList})`)
}

function stored(id: string): string {
  const r = spawnSync('psql', [PG_URL, '-X', '-At', '-c', `select coalesce(slug,'<null>') || '|' || status from public.guides where id = '${id}'`], { encoding: 'utf8' })
  return r.stdout.trim()
}

beforeAll(cleanup)
afterAll(cleanup)

describe('guides_active_requires_slug — straight to the database (FA-1.86)', () => {
  it('the constraint exists with the approved definition', () => {
    const r = spawnSync('psql', [PG_URL, '-X', '-At', '-c',
      `select pg_get_constraintdef(oid) from pg_constraint where conname = '${CONSTRAINT}' and conrelid = 'public.guides'::regclass`],
      { encoding: 'utf8' })
    expect(r.stdout).toContain("status <> 'active'")
    expect(r.stdout).toContain('slug IS NOT NULL')
  })

  it('RED: INSERT of an active guide with slug NULL is rejected', () => {
    expectRefusedByRule(
      `insert into public.guides (id, full_name, country, status, slug) values ('${ID_INSERT}', 'FA-1.86 db proof', 'Iceland', 'active', null)`,
    )
    expect(stored(ID_INSERT)).toBe('') // nothing was written
  })

  it("RED: UPDATE of a slugged active guide to slug = '' is rejected", () => {
    mustSucceed(
      `insert into public.guides (id, full_name, country, status, slug) values ('${ID_BLANK}', 'FA-1.86 db proof', 'Iceland', 'active', 'fa186-db-proof-blank')`,
    )
    expectRefusedByRule(`update public.guides set slug = '' where id = '${ID_BLANK}'`)
    expectRefusedByRule(`update public.guides set slug = null where id = '${ID_BLANK}'`)
    expectRefusedByRule(`update public.guides set slug = '   ' where id = '${ID_BLANK}'`)
    expect(stored(ID_BLANK)).toBe('fa186-db-proof-blank|active') // unchanged
  })

  it("RED: UPDATE of a pending guide without a slug to status = 'active' is rejected", () => {
    mustSucceed(
      `insert into public.guides (id, full_name, country, status) values ('${ID_ACTIVATE}', 'FA-1.86 db proof', 'Iceland', 'pending')`,
    )
    expectRefusedByRule(`update public.guides set status = 'active' where id = '${ID_ACTIVATE}'`)
    expect(stored(ID_ACTIVATE)).toBe('<null>|pending') // still pending, still no slug
  })

  it('GREEN: the same guide with a valid slug can be set to active', () => {
    mustSucceed(`update public.guides set slug = 'fa186-db-proof-activate', status = 'active' where id = '${ID_ACTIVATE}'`)
    expect(stored(ID_ACTIVATE)).toBe('fa186-db-proof-activate|active')
  })

  it('GREEN: a guide that is not active needs no slug (pending / verified / suspended)', () => {
    for (const status of ['pending', 'verified', 'suspended']) {
      mustSucceed(`update public.guides set slug = null, status = '${status}' where id = '${ID_ACTIVATE}'`)
      expect(stored(ID_ACTIVATE)).toBe(`<null>|${status}`)
    }
  })
})
