import { defineConfig } from 'vitest/config'
import path from 'path'

// FA-1.42 proof script only: real network (local PostgREST), no unit-test setup file.
export default defineConfig({
  test: { environment: 'node', include: ['.fa-proofs/fa-1.42/proof-guard-queries.mts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '../../src') } },
})
