import { defineConfig } from 'vitest/config'
import path from 'path'

// FA-1.72 proof only: real Anthropic call (judgeReply), no database, no email.
export default defineConfig({
  test: { environment: 'node', include: ['.fa-proofs/fa-1.72/judge-cases.mts'], testTimeout: 600_000 },
  resolve: { alias: { '@': path.resolve(__dirname, '../../src') } },
})
