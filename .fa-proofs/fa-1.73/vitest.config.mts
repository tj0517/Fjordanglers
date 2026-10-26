import { defineConfig } from 'vitest/config'
import path from 'path'

// FA-1.73 proof only: real Anthropic calls (draftReply, judgeReply), LOCAL Supabase, no e-mail.
export default defineConfig({
  test: { environment: 'node', include: ['.fa-proofs/fa-1.73/draft-cases.mts'], testTimeout: 3_600_000 },
  resolve: { alias: { '@': path.resolve(__dirname, '../../src') } },
})
