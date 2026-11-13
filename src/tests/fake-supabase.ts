/**
 * An in-memory stand-in for the supabase-js query builder, for tests that exercise the real data
 * layer (`src/lib/supabase/queries.ts`) without a database (FA-1.90). Rows are plain objects keyed by
 * table; embedded relations are just nested objects on the row.
 *
 * Supported, applied to the rows: eq, neq, in, is, not(col, 'is', null), order (with nullsFirst),
 * limit, range, single, maybeSingle. Accepted and ignored (the filter stays the caller's
 * responsibility to test elsewhere): select, or, contains, gte, lte. A table listed in `failing`
 * answers `{ data: null, error }` like a failed fetch does.
 */

type Row = Record<string, unknown>
type Filter = (row: Row) => boolean
type Sort = { column: string; ascending: boolean; nullsFirst: boolean }

export type FakeDb = {
  tables:  Record<string, Row[]>
  failing: Set<string>
  /** Every table read, in order — lets a test prove a read did not happen. */
  reads:   string[]
}

export function createFakeDb(): FakeDb {
  return { tables: {}, failing: new Set(), reads: [] }
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function builder(db: FakeDb, table: string) {
  const filters: Filter[] = []
  const sorts: Sort[] = []
  let take: number | null = null
  let skip = 0
  let single: 'single' | 'maybe' | null = null

  const run = () => {
    db.reads.push(table)
    if (db.failing.has(table)) return { data: null, error: { message: `fake: ${table} unavailable` }, count: null }

    let rows = (db.tables[table] ?? []).filter(row => filters.every(f => f(row)))
    for (const s of [...sorts].reverse()) {
      rows = [...rows].sort((x, y) => {
        const a = x[s.column], b = y[s.column]
        if (a == null || b == null) {
          if (a == null && b == null) return 0
          return (a == null) === s.nullsFirst ? -1 : 1
        }
        return s.ascending ? compare(a, b) : compare(b, a)
      })
    }
    const count = rows.length
    rows = rows.slice(skip, take == null ? undefined : skip + take)
    if (single != null) {
      if (rows[0] == null && single === 'single') return { data: null, error: { message: 'fake: no row' }, count }
      return { data: rows[0] ?? null, error: null, count }
    }
    return { data: rows, error: null, count }
  }

  const q = {
    select: () => q,
    or: () => q,
    contains: () => q,
    gte: () => q,
    lte: () => q,
    eq: (c: string, v: unknown) => { filters.push(r => r[c] === v); return q },
    neq: (c: string, v: unknown) => { filters.push(r => r[c] !== v); return q },
    in: (c: string, vs: unknown[]) => { filters.push(r => vs.includes(r[c])); return q },
    is: (c: string, v: unknown) => { filters.push(r => r[c] === v); return q },
    not: (c: string, op: string, v: unknown) => {
      if (op !== 'is' || v !== null) throw new Error(`fake: not(${c}, ${op}, ${String(v)}) unsupported`)
      filters.push(r => r[c] != null)
      return q
    },
    order: (column: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) => {
      const ascending = opts.ascending ?? true
      sorts.push({ column, ascending, nullsFirst: opts.nullsFirst ?? !ascending })
      return q
    },
    limit: (n: number) => { take = n; return q },
    range: (from: number, to: number) => { skip = from; take = to - from + 1; return q },
    single: () => { single = 'single'; return q },
    maybeSingle: () => { single = 'maybe'; return q },
    then: <T>(resolve: (v: ReturnType<typeof run>) => T, reject?: (e: unknown) => T) => {
      try { return Promise.resolve(resolve(run())) } catch (e) { return reject ? Promise.resolve(reject(e)) : Promise.reject(e) }
    },
  }
  return q
}

/** What `createClient` returns: `.from(table)` and nothing else. */
export function fakeClient(db: FakeDb) {
  return { from: (table: string) => builder(db, table) }
}
