import { defineConfig } from 'vitest/config'
import path from 'path'

// FA-1.47 proof only: real Anthropic call, no database, no email.
export default defineConfig({
  test: { environment: 'node', include: ['.fa-proofs/fa-1.47/judge-knowledge.mts'], testTimeout: 120_000 },
  resolve: { alias: { '@': path.resolve(__dirname, '../../src') } },
})
