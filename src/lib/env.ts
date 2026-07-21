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
 *  RESEND_API_KEY                     re_...
 *  SENTRY_DSN                         https://...@sentry.io/... (optional)
 *  IBAN_ENCRYPTION_KEY                64-char hex (optional, required in prod)
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
  // Connect webhook secret — used for account.updated events from connected accounts.
  // In production: register a separate Connect webhook in Stripe Dashboard → Connect → Webhooks.
  // Locally: `stripe listen --forward-connect-to ...` gives the same whsec_ as STRIPE_WEBHOOK_SECRET,
  // so you can set both to the same value.
  // Optional — falls back to STRIPE_WEBHOOK_SECRET if not set (covers local dev).
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().optional(),
  // Separate webhook secret for the deposit checkout endpoint.
  // Register a second endpoint in Stripe Dashboard → Developers → Webhooks
  // pointing to /api/webhooks/stripe-deposit. Optional in local dev (can reuse STRIPE_WEBHOOK_SECRET).
  STRIPE_WEBHOOK_SECRET_DEPOSIT: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required'),

  // ── App ────────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().url(
    'NEXT_PUBLIC_APP_URL must be a valid URL (e.g. http://localhost:3000)',
  ),
  // Public contact info — baked into client bundle, safe to expose.
  // Phone number in E.164 without "+", e.g. "48698936563"
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().optional().default('48698936563'),
  NEXT_PUBLIC_FA_EMAIL: z.string().email().optional().default('contact@fjordanglers.com'),

  // Commission rate as a decimal (0.10 = 10%). Defaults to 10%.
  PLATFORM_COMMISSION_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // ── Email (Resend) ─────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  // FA contact email — receives new inquiry notifications (FA inbox).
  FA_EMAIL: z.string().email().optional().default('contact@fjordanglers.com'),
  // Sender address shown in all outbound emails ("From" header).
  FA_FROM_EMAIL: z.string().optional().default('FjordAnglers <contact@fjordanglers.com>'),
  // Inbound email address configured in Resend dashboard (for reference / auto-replies).
  FA_INBOUND_EMAIL: z.string().email().optional().default('leads@fjordanglers.com'),

  // ── Security / Observability ───────────────────────────────────────────────
  // Sentry DSN — optional. If not set, Sentry is disabled (safe without key).
  SENTRY_DSN: z.string().optional(),
  // AES-256-GCM key for IBAN field encryption — 64 hex chars (32 bytes).
  // If not set, encryption is disabled (passthrough). Required in production.
  IBAN_ENCRYPTION_KEY: z.string().min(64).optional(),

  // ── WhatsApp (Meta Cloud API) ───────────────────────────────────────────────
  // Random secret string used to verify Meta's hub.challenge GET request.
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  // Meta App Secret — used to verify HMAC-SHA256 signature on incoming messages.
  WHATSAPP_APP_SECRET: z.string().optional(),
  // Phone Number ID from Meta Business → WhatsApp → Getting Started (needed to SEND messages).
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  // The FA WhatsApp business number in E.164 format, e.g. +48123456789 (for display / routing).
  WHATSAPP_BUSINESS_NUMBER: z.string().optional(),

  // ── Resend Inbound (email webhook) ─────────────────────────────────────────
  // Signing secret provided by Resend for inbound email webhooks.
  RESEND_INBOUND_SECRET: z.string().optional(),

  // ── Cron ───────────────────────────────────────────────────────────────────
  // Bearer token used to authenticate Vercel cron job requests.
  CRON_SECRET: z.string().optional(),

  // ── Google Ads API ─────────────────────────────────────────────────────────
  // All optional — cron silently skips sync if not configured.
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  GOOGLE_ADS_CLIENT_ID: z.string().optional(),
  GOOGLE_ADS_CLIENT_SECRET: z.string().optional(),
  GOOGLE_ADS_REFRESH_TOKEN: z.string().optional(),
  // 10-digit customer ID without dashes, e.g. "1234567890"
  GOOGLE_ADS_CUSTOMER_ID: z.string().optional(),

  // ── AI ─────────────────────────────────────────────────────────────────────
  // Anthropic API key — required for AI-powered features (trip detail extraction).
  // Optional so build succeeds without it; action returns error if missing at runtime.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Feature flag: auto-reply agent on new inquiries. Off by default.
  AI_AUTO_REPLY_ENABLED: z.coerce.boolean().optional().default(false),

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

// During `next build`, Next.js executes module-level code to analyse routes.
// At that point server-only secrets (STRIPE_*, SUPABASE_SERVICE_ROLE_KEY) may
// not be present in the build container — they're injected at runtime instead.
// We skip strict validation in the build phase so the build succeeds; any
// missing value will still cause a hard crash the first time the route actually
// handles a request, which is the right time to surface the error.
export const env: Env =
  process.env.NEXT_PHASE === 'phase-production-build'
    ? (process.env as unknown as Env)
    : validateEnv()
