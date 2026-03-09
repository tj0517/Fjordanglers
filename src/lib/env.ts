/**
 * Environment variable validation — Zod schema.
 *
 * SERVER-ONLY. Import only in:
 *   - Server Components
 *   - Server Actions  (src/actions/*)
 *   - Route Handlers  (src/app/api/*)
 *   - Lib helpers     (src/lib/stripe/*, src/lib/supabase/server.ts)
 *
 * Throws at startup if any required variable is missing or malformed.
 * This surfaces configuration errors at boot time, not at runtime.
 *
 * Required .env.local variables:
 * ─────────────────────────────────────────────────────────────────────
 *  NEXT_PUBLIC_SUPABASE_URL           https://<ref>.supabase.co
 *  NEXT_PUBLIC_SUPABASE_ANON_KEY      eyJ...
 *  SUPABASE_SERVICE_ROLE_KEY          eyJ...  (never expose to browser!)
 *  STRIPE_SECRET_KEY                  sk_live_... / sk_test_...
 *  STRIPE_WEBHOOK_SECRET              whsec_...
 *  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY pk_live_... / pk_test_...
 *  NEXT_PUBLIC_APP_URL                https://fjordanglers.com (or http://localhost:3000)
 *  PLATFORM_COMMISSION_RATE           0.10  (optional, defaults to 10%)
 * ─────────────────────────────────────────────────────────────────────
 */

import { z } from 'zod'

const envSchema = z.object({
  // ── Supabase ───────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(
    'NEXT_PUBLIC_SUPABASE_URL must be a valid URL (e.g. https://<ref>.supabase.co)',
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // ── Stripe ─────────────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required'),

  // ── App ────────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().url(
    'NEXT_PUBLIC_APP_URL must be a valid URL (e.g. http://localhost:3000)',
  ),

  // Commission rate as a decimal (0.10 = 10%). Defaults to 10%.
  PLATFORM_COMMISSION_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // ── Optional ───────────────────────────────────────────────────────────────
  // Supabase CLI access token — only needed for `pnpm supabase:types`
  SUPABASE_ACCESS_TOKEN: z.string().optional(),
  // GitHub token — only needed in CI
  GITHUB_TOKEN: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const messages = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
      .join('\n')

    throw new Error(
      `\n❌ Invalid environment variables:\n${messages}\n\n` +
        'Check your .env.local file and ensure all required variables are set.',
    )
  }

  return result.data
}

export const env = validateEnv()
