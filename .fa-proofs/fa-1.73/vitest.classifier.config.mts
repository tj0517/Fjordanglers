import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: { environment: 'node', include: ['.fa-proofs/fa-1.73/classifier-cases.mts'], testTimeout: 3_600_000 },
  resolve: { alias: { '@': path.resolve(__dirname, '../../src') } },
})
