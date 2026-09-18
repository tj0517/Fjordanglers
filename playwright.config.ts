import { defineConfig } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env.local at config-parse time so all tests see the variables
try {
  const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && process.env[m[1]] == null) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
} catch {
  // .env.local absent in CI — rely on environment variables being set externally
}

export default defineConfig({
  testDir: './scripts/proofs',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  use: {
    baseURL:   'http://localhost:3000',
    headless:  true,
    locale:    'en-GB',
  },
  // Single worker — the walk is stateful; no parallel runs
  workers: 1,
})
