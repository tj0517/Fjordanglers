import { describe, it, expect, beforeAll } from 'vitest'
import type { envSchema as EnvSchemaType } from './env'

// env.ts validates the full process.env at module-load time (see env.ts:149-152).
// That throws in the test environment (missing STRIPE_SECRET_KEY etc.) before we
// ever get to the schema we actually want to test. NEXT_PHASE=phase-production-build
// is the existing, already-shipped bypass for exactly this situation (Next.js build
// phase) — reusing it here for the test import, not adding a new one.
let envSchema: typeof EnvSchemaType

beforeAll(async () => {
  process.env.NEXT_PHASE = 'phase-production-build'
  ;({ envSchema } = await import('./env'))
})

describe('AI_AUTO_REPLY_ENABLED', () => {
  it('"true" → true', () => {
    const result = envSchema.shape.AI_AUTO_REPLY_ENABLED.safeParse('true')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(true)
  })

  it('"false" → false (the bug this fixes: z.coerce.boolean() gave true here)', () => {
    const result = envSchema.shape.AI_AUTO_REPLY_ENABLED.safeParse('false')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(false)
  })

  it('undefined → false (default)', () => {
    const result = envSchema.shape.AI_AUTO_REPLY_ENABLED.safeParse(undefined)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(false)
  })

  it('"1" → validation error', () => {
    const result = envSchema.shape.AI_AUTO_REPLY_ENABLED.safeParse('1')
    expect(result.success).toBe(false)
  })

  it('"" → validation error', () => {
    const result = envSchema.shape.AI_AUTO_REPLY_ENABLED.safeParse('')
    expect(result.success).toBe(false)
  })
})
