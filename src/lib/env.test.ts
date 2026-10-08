import { describe, it, expect, beforeAll } from 'vitest'
import type { envSchema as EnvSchemaType, assertNoEmailFakeInProduction as AssertNoEmailFakeType } from './env'

// env.ts validates the full process.env at module-load time (see env.ts:149-152).
// That throws in the test environment (missing STRIPE_SECRET_KEY etc.) before we
// ever get to the schema we actually want to test. NEXT_PHASE=phase-production-build
// is the existing, already-shipped bypass for exactly this situation (Next.js build
// phase) — reusing it here for the test import, not adding a new one.
let envSchema: typeof EnvSchemaType
let assertNoEmailFakeInProduction: typeof AssertNoEmailFakeType

beforeAll(async () => {
  process.env.NEXT_PHASE = 'phase-production-build'
  ;({ envSchema, assertNoEmailFakeInProduction } = await import('./env'))
})

// FA-1.58 (D1): RESEND_DEV_FAKE on production must stop start-up, not silently drop customer e-mail.
describe('RESEND_DEV_FAKE on production', () => {
  it('VERCEL_ENV=production + RESEND_DEV_FAKE=1 → throws and names the variable', () => {
    expect(() =>
      assertNoEmailFakeInProduction({ VERCEL_ENV: 'production', RESEND_DEV_FAKE: '1' }),
    ).toThrow(/RESEND_DEV_FAKE/)
  })

  it('VERCEL_ENV=production without the flag → passes', () => {
    expect(() => assertNoEmailFakeInProduction({ VERCEL_ENV: 'production' })).not.toThrow()
  })

  it('VERCEL_ENV=preview + RESEND_DEV_FAKE=1 → passes (Preview uses the flag by design, FA-1.18)', () => {
    expect(() =>
      assertNoEmailFakeInProduction({ VERCEL_ENV: 'preview', RESEND_DEV_FAKE: '1' }),
    ).not.toThrow()
  })

  it('local (VERCEL_ENV unset) + RESEND_DEV_FAKE=1 → passes', () => {
    expect(() => assertNoEmailFakeInProduction({ RESEND_DEV_FAKE: '1' })).not.toThrow()
  })
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

// EXPERIENCE_V2_ENABLED follows the same 'true' | 'false' → boolean shape (FA-1.52):
// an unset or malformed flag must never turn the v2 template on.
describe('EXPERIENCE_V2_ENABLED', () => {
  it('"true" → true', () => {
    const result = envSchema.shape.EXPERIENCE_V2_ENABLED.safeParse('true')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(true)
  })

  it('"false" → false', () => {
    const result = envSchema.shape.EXPERIENCE_V2_ENABLED.safeParse('false')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(false)
  })

  it('undefined → false (default)', () => {
    const result = envSchema.shape.EXPERIENCE_V2_ENABLED.safeParse(undefined)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(false)
  })

  it('"on" → validation error (the flag is "true" | "false", not on|off)', () => {
    const result = envSchema.shape.EXPERIENCE_V2_ENABLED.safeParse('on')
    expect(result.success).toBe(false)
  })

  it('"" → validation error', () => {
    const result = envSchema.shape.EXPERIENCE_V2_ENABLED.safeParse('')
    expect(result.success).toBe(false)
  })
})
