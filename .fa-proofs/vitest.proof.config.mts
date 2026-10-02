import { defineConfig } from 'vitest/config'
import path from 'path'

// Proof scripts only: real network (local DB, Anthropic), no unit-test setup file.
export default defineConfig({
  test: { environment: 'node', include: ['.fa-proofs/demo-auto-send-form.mts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
})
