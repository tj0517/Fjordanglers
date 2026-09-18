/**
 * FA-1.12 Playwright UI-walk proof
 *
 * Drives the admin panel through the full messages-thread path:
 *   new → waiting_guide
 *   outbound email to angler           (MessageComposer UI)
 *   inbound email from guide           (email-inbound webhook POST)
 *   waiting_guide → offer_presented    (StatusChanger UI)  ⚠ see NOTE A
 *   offer_presented → awaiting_payment (StatusChanger UI)  ⚠ see NOTE A
 *   Stripe deposit webhook             (stripe-deposit webhook POST)
 *   paid → handed_over                 (StatusChanger UI)
 *
 * ───────────────────────────────────────────────────────────────────────────
 * NOTE A — missing UI buttons (3 of 10 steps have no UI):
 *   markAsGuideOffer, markOfferPresented, markClientAccepted are exported
 *   server actions in src/actions/messages.ts but no React component calls
 *   them anywhere in src/app/. The guide.offer_received, offer.presented and
 *   offer.accepted events therefore cannot be emitted through the browser.
 *   The StatusChanger is used instead (direct status.changed transitions).
 *   Full event coverage is provided by scripts/proofs/fa-1.12-walk.mts which
 *   calls those actions directly (no browser required).
 *
 * NOTE B — "send to guide" UI:
 *   MessageComposer in the admin sidebar only sends to the angler.
 *   There is no "Send to guide" tab/button in the current admin panel.
 *   guide.contacted is not emitted in this walk as a result.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * HOW TO RUN (the dev server MUST use local Supabase, not production):
 *
 *   # 1. Start local Supabase
 *   supabase start -x studio,imgproxy,mailpit,logflare,vector,edge-runtime,\
 *                     realtime,storage-api,postgres-meta
 *
 *   # 2. Start dev server with LOCAL env — use the helper script:
 *   bash scripts/proofs/run-fa-1.12-ui-walk.sh
 *
 *   # OR manually:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from supabase status> \
 *   SUPABASE_SERVICE_ROLE_KEY=<local service role key from supabase status> \
 *   STRIPE_WEBHOOK_SECRET=whsec_test_local \
 *   RESEND_INBOUND_SECRET=test-resend-secret \
 *   pnpm dev &
 *
 *   # 3. In a separate terminal:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 \
 *   STRIPE_WEBHOOK_SECRET=whsec_test_local \
 *   npx playwright test scripts/proofs/fa-1.12-ui-walk.spec.ts
 *
 * SAFETY FUSE: refuses to run against any host other than 127.0.0.1 / localhost.
 */

import { test, expect }  from '@playwright/test'
import { execSync }       from 'node:child_process'
import { readFileSync }   from 'node:fs'
import { resolve }        from 'node:path'

// ── Local-stack constants (same for every `supabase start`) ───────────────────

// These are the standard Supabase demo JWT keys, always used for local stacks.
// They are NOT production secrets.
const LOCAL_SB_URL   = 'http://127.0.0.1:54421'
const LOCAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_PG       = 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'

// ── Read RESEND_INBOUND_SECRET from .env.local ─────────────────────────────────
// The dev server loads .env.local at startup; the spec must use the same value
// when computing the HMAC signature for the email-inbound webhook.
function readEnvLocal(): Record<string, string> {
  try {
    const file = readFileSync(resolve(__dirname, '../../.env.local'), 'utf8')
    return Object.fromEntries(
      file.split('\n').flatMap(line => {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
        return m ? [[m[1], m[2].replace(/^['"]|['"]$/g, '')]] : []
      })
    )
  } catch { return {} }
}
const envLocal      = readEnvLocal()
const RESEND_SECRET = envLocal['RESEND_INBOUND_SECRET'] ?? process.env.RESEND_INBOUND_SECRET ?? ''

// Runtime env overrides (also honour variables passed by the run script)
const SB_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL    || LOCAL_SB_URL
const STRIPE_WH_SEC = process.env.STRIPE_WEBHOOK_SECRET       || 'whsec_test_local'

// ── Safety fuse ────────────────────────────────────────────────────────────────

if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(SB_URL)) {
  throw new Error(
    `SAFETY FUSE: fa-1.12-ui-walk.spec.ts only runs against the local stack.\n` +
    `Current NEXT_PUBLIC_SUPABASE_URL: ${SB_URL}\n` +
    `Start the dev server with LOCAL Supabase env — see the HOW TO RUN comment above.`
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_EMAIL    = 'fa112-ui-walk@local.test'
const ADMIN_PASSWORD = 'fa112-ui-walk-pw!'
// Resend test addresses — accepted by the API without actual delivery
const ANGLER_EMAIL   = 'delivered@resend.dev'
const GUIDE_EMAIL    = 'delivered+guide@resend.dev'

const INQUIRY_ID     = '11111111-0001-4000-8000-000000fa1201'
const GUIDE_ID       = '11111111-0002-4000-8000-000000fa1202'

// ── Helpers ────────────────────────────────────────────────────────────────────

// psql helper — all setup goes through direct DB access to avoid Auth JWT issues.
// The local stack (Supabase CLI ≥ 2.75) uses ES256 JWTs; the HS256 service-role
// key from `supabase status` is rejected by the Auth admin API.
function psql(sql: string): string {
  // Write to a temp file to avoid shell quoting issues with complex SQL
  const { writeFileSync, unlinkSync } = require('node:fs')
  const tmpFile = `/tmp/fa-1.12-ui-walk-${Date.now()}.sql`
  writeFileSync(tmpFile, sql)
  try {
    return execSync(`psql "${LOCAL_PG}" -f "${tmpFile}" -t -A`, {
      encoding: 'utf8',
    }).trim()
  } finally {
    try { unlinkSync(tmpFile) } catch {}
  }
}

// ── One-time test setup ────────────────────────────────────────────────────────

test.beforeAll(async () => {
  // Create admin user + profile directly via psql (Auth admin API uses ES256
  // JWTs but supabase status only provides HS256 keys, so HTTP admin API fails).
  const ADMIN_ID = '11111111-0003-4000-8000-000000fa1203'

  psql(`
    -- Idempotent: delete existing test rows so re-runs start clean
    DELETE FROM inquiry_events WHERE inquiry_id = '${INQUIRY_ID}';
    DELETE FROM messages WHERE inquiry_id = '${INQUIRY_ID}';
    DELETE FROM offers WHERE inquiry_id = '${INQUIRY_ID}';
    DELETE FROM inquiries WHERE id = '${INQUIRY_ID}';

    -- Admin user in auth.users (bcrypt hash of '${ADMIN_PASSWORD}')
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, role, aud, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change, email_change_token_new
    )
    VALUES (
      '${ADMIN_ID}',
      '00000000-0000-0000-0000-000000000000',
      '${ADMIN_EMAIL}',
      crypt('${ADMIN_PASSWORD}', gen_salt('bf')),
      now(), 'authenticated', 'authenticated', now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      '', '',
      '', ''
    )
    ON CONFLICT (id) DO UPDATE SET
      email              = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = now(),
      email_change       = '',
      email_change_token_new = '';

    -- Auth identity (required for password sign-in)
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    VALUES (
      '${ADMIN_EMAIL}', '${ADMIN_ID}',
      jsonb_build_object('sub', '${ADMIN_ID}', 'email', '${ADMIN_EMAIL}'),
      'email', now(), now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;

    -- Admin profile
    INSERT INTO public.profiles (id, role)
    VALUES ('${ADMIN_ID}', 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';

    -- Guide
    INSERT INTO public.guides (id, full_name, invite_email, status, country)
    VALUES ('${GUIDE_ID}', 'UI Walk Guide', '${GUIDE_EMAIL}', 'active', 'IS')
    ON CONFLICT (id) DO UPDATE SET
      full_name    = EXCLUDED.full_name,
      invite_email = EXCLUDED.invite_email;

    -- Test inquiry
    INSERT INTO public.inquiries (
      id, angler_name, angler_email, angler_country,
      message, party_size, requested_dates, deposit_amount,
      status, assigned_guide_id
    )
    VALUES (
      '${INQUIRY_ID}',
      'UI Walk Angler', '${ANGLER_EMAIL}', 'NO',
      'I want to fish in Iceland, 3 days, 2 people.',
      2, ARRAY['2027-07-10','2027-07-12']::text[], 360,
      'new', '${GUIDE_ID}'
    );
  `)
})

// ── Login helper ───────────────────────────────────────────────────────────────

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login')
  await page.waitForURL('**/login')
  await page.getByPlaceholder('you@example.com').fill(ADMIN_EMAIL)
  await page.getByPlaceholder('Your password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 })
}

// ═══════════════════════════════════════════════════════════════════════════════
// THE WALK
// ═══════════════════════════════════════════════════════════════════════════════

test('FA-1.12 full admin path → handed_over', async ({ page }) => {

  // ── 0. Login ────────────────────────────────────────────────────────────────
  await login(page)

  // ── 1. Navigate to inquiry ───────────────────────────────────────────────────
  await page.goto(`/admin/inquiries/${INQUIRY_ID}`)
  await page.waitForSelector('text=UI Walk Angler', { timeout: 15_000 })

  // ── 2. Status: new → waiting_guide ───────────────────────────────────────────
  await page.getByRole('button', { name: /^waiting guide$/i }).click()
  await page.waitForTimeout(2_000)

  // ── 3. Send message to angler (MessageComposer) ───────────────────────────────
  await page.getByPlaceholder(/re: your inquiry/i).fill('Your Iceland inquiry')
  await page.getByPlaceholder(/Hi Jan/i).fill('Hello — we are looking into guides for your dates.')
  await page.getByRole('button', { name: /^send message →$/i }).click()
  await expect(page.getByText(/message sent to angler/i)).toBeVisible({ timeout: 10_000 })

  // ── 4. Inbound email from guide (email-inbound webhook) ───────────────────────
  // Resend inbound uses Svix signing:
  //   toSign   = svixId + "." + timestamp + "." + rawBody
  //   secretKey = base64decode(RESEND_INBOUND_SECRET.replace(/^whsec_/, ''))
  //   sig       = "v1," + base64(HMAC-SHA256(secretKey, toSign))
  //
  // The route expects: { type: "email.received", data: { email_id, from, subject, text } }
  // When RESEND_DEV_FAKE=1 the dev server skips the Resend body-fetch and uses
  // data.text from the payload directly; matchInquiryByEmail finds the inquiry
  // by the guide's email address.
  // Simulate a reply FROM the angler (matchInquiryByEmail matches by angler_email).
  // The guide reply path would need matchInquiryByGuideEmail (not yet implemented).
  const inboundPayload = {
    type: 'email.received',
    data: {
      email_id: 'test-inbound-ui-walk-1',
      from:     ANGLER_EMAIL,
      subject:  'Re: fishing trip inquiry',
      text:     'Sounds great, I am available Jul 10-12.',
    },
  }
  const inboundStatus = await page.evaluate(
    async ({ url, payload, secret }: { url: string; payload: unknown; secret: string }) => {
      const msgId   = 'msg_ui_walk_inbound'
      const ts      = String(Math.floor(Date.now() / 1000))
      const body    = JSON.stringify(payload)
      const toSign  = `${msgId}.${ts}.${body}`

      // Decode the base64 secret (strip optional "whsec_" prefix)
      const rawSec  = secret.replace(/^whsec_/, '')
      // atob decodes base64 → binary string; convert to Uint8Array
      const binStr  = atob(rawSec)
      const keyBuf  = new Uint8Array(binStr.length)
      for (let i = 0; i < binStr.length; i++) keyBuf[i] = binStr.charCodeAt(i)

      const key     = await crypto.subtle.importKey(
        'raw', keyBuf.buffer,
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      )
      const sigBuf  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign))
      const sigB64  = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))

      const res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          'svix-id':        msgId,
          'svix-timestamp': ts,
          'svix-signature': `v1,${sigB64}`,
        },
        body,
      })
      return res.status
    },
    { url: 'http://localhost:3000/api/webhooks/email-inbound', payload: inboundPayload, secret: RESEND_SECRET },
  )
  console.log('[step 4] email-inbound webhook status:', inboundStatus)
  expect(inboundStatus).toBe(200)

  // ── 5. Status: waiting_guide → offer_presented ───────────────────────────────
  // ⚠ NOTE A: markAsGuideOffer has no UI button — StatusChanger used directly.
  await page.reload()
  await page.waitForSelector('text=UI Walk Angler', { timeout: 10_000 })
  await page.getByRole('button', { name: /^offer presented$/i }).click()
  await page.waitForTimeout(2_000)

  // ── 6. Status: offer_presented → awaiting_payment ────────────────────────────
  // ⚠ NOTE A: markClientAccepted has no UI button — StatusChanger used directly.
  await page.getByRole('button', { name: /^awaiting payment$/i }).click()
  await page.waitForTimeout(2_000)

  // ── 7. Stripe deposit webhook ─────────────────────────────────────────────────
  const stripePayload = JSON.stringify({
    id:   'evt_ui_walk_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id:             'cs_ui_walk_1',
        object:         'checkout.session',
        payment_status: 'paid',
        amount_total:   36000,
        currency:       'eur',
        metadata:       { payment_type: 'inquiry_deposit', inquiry_id: INQUIRY_ID },
      },
    },
  })
  const stripeStatus = await page.evaluate(
    async ({ url, payload, secret }: { url: string; payload: string; secret: string }) => {
      const t          = String(Math.floor(Date.now() / 1000))
      const signedMsg  = `${t}.${payload}`
      const key        = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      )
      const sigBuf  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedMsg))
      const sigHex  = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2,'0')).join('')
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${t},v1=${sigHex}` },
        body:    payload,
      })
      return res.status
    },
    { url: 'http://localhost:3000/api/webhooks/stripe-deposit', payload: stripePayload, secret: STRIPE_WH_SEC },
  )
  console.log('[step 7] stripe-deposit webhook status:', stripeStatus)
  await page.waitForTimeout(2_000)

  // ── 8. Status: paid → handed_over ─────────────────────────────────────────────
  await page.reload()
  await page.waitForSelector('text=UI Walk Angler', { timeout: 10_000 })
  // Stripe webhook transitions inquiry to 'paid'; StatusChanger to handed_over.
  await page.getByRole('button', { name: /^handed over$/i }).click()
  await page.waitForTimeout(2_000)

  // ── 9. Verify final badge ─────────────────────────────────────────────────────
  await page.reload()
  await page.waitForSelector('text=UI Walk Angler', { timeout: 10_000 })
  await expect(
    page.locator('span', { hasText: /handed.?over/i }).first(),
  ).toBeVisible({ timeout: 5_000 })

  // ── 10. DB assertion ──────────────────────────────────────────────────────────
  const eventsRaw = psql(
    `SELECT type || '|' || COALESCE(channel,'') || '|' || COALESCE(source,'') ` +
    `FROM inquiry_events WHERE inquiry_id = '${INQUIRY_ID}' ORDER BY occurred_at`
  )
  const events    = eventsRaw.split('\n').filter(l => l.trim() !== '')
  const finalSt   = psql(`SELECT status FROM inquiries WHERE id = '${INQUIRY_ID}'`)

  console.log('\n── inquiry_events ─────────────────────────────────────────')
  events.forEach(e => console.log(' ', e))
  console.log(`\n total events: ${events.length}`)
  console.log(` final status: ${finalSt}`)
  console.log('\n NOTE: full ≥10 event count requires markAsGuideOffer / markOfferPresented /');
  console.log('       markClientAccepted wired to UI (none exist yet). See NOTE A above.');
  console.log('       For 18-event walk: scripts/proofs/fa-1.12-walk.mts\n');

  expect(events.length).toBeGreaterThanOrEqual(10)
  expect(finalSt).toBe('handed_over')
})
