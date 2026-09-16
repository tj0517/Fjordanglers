/**
 * Vitest global setup — runs before every test file.
 *
 * 1. Loads .env.test with override priority so no stale value from .env.local
 *    can reach the database client.
 * 2. Enforces the safety fuse: if NEXT_PUBLIC_SUPABASE_URL does not point to
 *    127.0.0.1 or localhost the entire run is aborted immediately — zero queries.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.test — override:true so it wins over anything already in process.env.
try {
  const text = readFileSync(resolve(process.cwd(), '.env.test'), 'utf-8')
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m != null) process.env[m[1]] = m[2]
  }
} catch {
  // .env.test missing — the fuse below will fire because the URL won't be localhost.
}

// SAFETY FUSE ─────────────────────────────────────────────────────────────────
// Integration tests INSERT rows into the database. If this URL points anywhere
// other than localhost the run must stop before the first query executes.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) {
  process.stderr.write(
    '\n' +
      '  SAFETY FUSE — test run aborted\n' +
      '\n' +
      `  NEXT_PUBLIC_SUPABASE_URL="${url}"\n` +
      '  does not point to 127.0.0.1 or localhost.\n' +
      '\n' +
      '  Integration tests INSERT rows into the database.\n' +
      '  Running them against a non-local Supabase instance is forbidden.\n' +
      '\n' +
      '  Fix: ensure .env.test sets\n' +
      '       NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421\n' +
      '\n',
  )
  process.exit(1)
}
