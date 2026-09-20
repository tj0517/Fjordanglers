/**
 * FA-1.12 Playwright UI-walk proof
 *
 * Drives the admin panel through the full messages-thread path using only
 * the real UI buttons wired to FA-1.12 server actions.
 *
 * Steps and expected events:
 *   new → waiting_guide          (StatusChanger)             → status.changed
 *   send to angler                (MessageComposer)           → message.sent
 *   send to guide                 (MessageComposer guide tab) → message.sent + guide.contacted
 *   inbound email from angler     (email-inbound webhook)     → message.received
 *   Mark as Guide Offer           (ThreadActionsPanel)        → guide.offer_received
 *   Present Offer to Angler       (ThreadActionsPanel)        → offer.presented
 *   Client Accepted               (ThreadActionsPanel)        → offer.accepted
 *   Create Deposit Link           (ThreadActionsPanel)        → payment.link_sent
 *   Stripe deposit webhook                                    → payment.received + status.changed
 *   Guide Notified Paid           (ThreadActionsPanel)        → guide.notified_paid
 *   Contacts Exchanged            (ThreadActionsPanel)        → contacts.exchanged + status.changed
 *
 * Total: 13–14 events, final status: handed_over
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO RUN (dev server MUST use local Supabase, not production):
 *
 *   # 1. Start local Supabase
 *   supabase start -x studio,imgproxy,mailpit,logflare,vector,edge-runtime,\
 *                     realtime,storage-api,postgres-meta
 *
 *   # 2. Start dev server + run spec:
 *   bash scripts/proofs/run-fa-1.12-ui-walk.sh
 *
 * SAFETY FUSE: refuses to run against any host other than 127.0.0.1 / localhost.
 */

import { test, expect }  from '@playwright/test'
import { execSync }       from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve }        from 'node:path'

// ── Local-stack constants ──────────────────────────────────────────────────────

const LOCAL_SB_URL   = 'http://127.0.0.1:54421'
const LOCAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_PG       = 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'

// ── Read RESEND_INBOUND_SECRET from .env.local ─────────────────────────────────
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

const SB_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL    || LOCAL_SB_URL
const STRIPE_WH_SEC = process.env.STRIPE_WEBHOOK_SECRET       || 'whsec_test_local_fa112'

// ── Safety fuse ────────────────────────────────────────────────────────────────

if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(SB_URL)) {
  throw new Error(
    `SAFETY FUSE: fa-1.12-ui-walk.spec.ts only runs against the local stack.\n` +
    `Current NEXT_PUBLIC_SUPABASE_URL: ${SB_URL}\n` +
    `Start the dev server with LOCAL Supabase env — see HOW TO RUN above.`
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_EMAIL    = 'fa112-ui-walk@local.test'
const ADMIN_PASSWORD = 'fa112-ui-walk-pw!'
const ANGLER_EMAIL   = 'delivered@resend.dev'
const GUIDE_EMAIL    = 'delivered+guide@resend.dev'

const INQUIRY_ID     = '11111111-0001-4000-8000-000000fa1201'
const GUIDE_ID       = '11111111-0002-4000-8000-000000fa1202'

const OFFER_LABEL    = 'Iceland 3-day package'
const OFFER_PRICE    = '3600'   // EUR

// ── Helpers ────────────────────────────────────────────────────────────────────

function psql(sql: string): string {
  const tmpFile = `/tmp/fa-1.12-ui-walk-${Date.now()}.sql`
  writeFileSync(tmpFile, sql)
  try {
    return execSync(`psql "${LOCAL_PG}" -f "${tmpFile}" -t -A`, { encoding: 'utf8' }).trim()
  } finally {
    try { unlinkSync(tmpFile) } catch {}
  }
}

// ── One-time test setup ────────────────────────────────────────────────────────

test.beforeAll(async () => {
  const ADMIN_ID = '11111111-0003-4000-8000-000000fa1203'

  psql(`
    DELETE FROM inquiry_events WHERE inquiry_id = '${INQUIRY_ID}';
    DELETE FROM messages WHERE inquiry_id = '${INQUIRY_ID}';
    DELETE FROM offer_options WHERE offer_id IN (SELECT id FROM offers WHERE inquiry_id = '${INQUIRY_ID}');
    DELETE FROM offers WHERE inquiry_id = '${INQUIRY_ID}';
    DELETE FROM inquiries WHERE id = '${INQUIRY_ID}';

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

    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    VALUES (
      '${ADMIN_EMAIL}', '${ADMIN_ID}',
      jsonb_build_object('sub', '${ADMIN_ID}', 'email', '${ADMIN_EMAIL}'),
      'email', now(), now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;

    INSERT INTO public.profiles (id, role)
    VALUES ('${ADMIN_ID}', 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';

    INSERT INTO public.guides (id, full_name, invite_email, status, country)
    VALUES ('${GUIDE_ID}', 'UI Walk Guide', '${GUIDE_EMAIL}', 'active', 'IS')
    ON CONFLICT (id) DO UPDATE SET
      full_name    = EXCLUDED.full_name,
      invite_email = EXCLUDED.invite_email;

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

// ── Webhook signing helper (runs in page context) ─────────────────────────────

async function signAndPost(
  page: import('@playwright/test').Page,
  url:  string,
  body: string,
  opts: { kind: 'stripe'; secret: string } | { kind: 'resend'; secret: string; msgId: string },
): Promise<number> {
  return page.evaluate(
    async ({ url, body, opts }) => {
      if (opts.kind === 'stripe') {
        const t   = String(Math.floor(Date.now() / 1000))
        const msg = `${t}.${body}`
        const key = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(opts.secret),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
        )
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
        const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${t},v1=${hex}` },
          body,
        })
        return res.status
      } else {
        const ts     = String(Math.floor(Date.now() / 1000))
        const toSign = `${opts.msgId}.${ts}.${body}`
        const rawSec = opts.secret.replace(/^whsec_/, '')
        const bin    = atob(rawSec)
        const keyBuf = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) keyBuf[i] = bin.charCodeAt(i)
        const key    = await crypto.subtle.importKey(
          'raw', keyBuf.buffer,
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
        )
        const sig    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign))
        const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
        const res    = await fetch(url, {
          method:  'POST',
          headers: {
            'Content-Type':   'application/json',
            'svix-id':        opts.msgId,
            'svix-timestamp': ts,
            'svix-signature': `v1,${sigB64}`,
          },
          body,
        })
        return res.status
      }
    },
    { url, body, opts },
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// THE WALK
// ═══════════════════════════════════════════════════════════════════════════════

test('FA-1.12 full admin path → handed_over', async ({ page }) => {
  test.setTimeout(180_000)

  // ── 0. Login ────────────────────────────────────────────────────────────────
  await login(page)

  // ── 1. Navigate to inquiry ───────────────────────────────────────────────────
  await page.goto(`/admin/inquiries/${INQUIRY_ID}`)
  await page.waitForSelector('text=UI Walk Angler', { timeout: 15_000 })

  // ── 2. Status: new → waiting_guide ───────────────────────────────────────────
  await page.getByRole('button', { name: /^waiting guide$/i }).click()
  await page.waitForTimeout(2_000)

  // ── 3. Send message to angler ────────────────────────────────────────────────
  await page.getByPlaceholder(/re: your inquiry/i).fill('Your Iceland inquiry')
  await page.getByPlaceholder(/Hi Jan/i).fill('Hello — we are looking into guides for your dates.')
  await page.getByRole('button', { name: /^send message →$/i }).click()
  await expect(page.getByText(/message sent to angler/i)).toBeVisible({ timeout: 10_000 })

  // Hard reload before guide step — clears flash and ensures page is stable
  await page.reload()
  await page.waitForSelector('text=UI Walk Angler', { timeout: 10_000 })

  // ── 4. Send message to guide (guide tab) ─────────────────────────────────────
  await page.getByRole('button', { name: /^guide$/i }).click()
  await page.getByPlaceholder(/Hi Jan/i).fill('Hi — confirming your availability for Jul 10-12?')
  await page.getByRole('button', { name: /^send message →$/i }).click()
  await expect(page.getByText(/message sent to guide/i)).toBeVisible({ timeout: 10_000 })

  // ── 5. Inbound email from angler (email-inbound webhook) ──────────────────────
  const inboundPayload = JSON.stringify({
    type: 'email.received',
    data: {
      email_id: 'test-inbound-ui-walk-1',
      from:     ANGLER_EMAIL,
      subject:  'Re: fishing trip inquiry',
      text:     'Sounds great, I am available Jul 10-12.',
    },
  })
  const inboundStatus = await signAndPost(
    page,
    'http://localhost:3000/api/webhooks/email-inbound',
    inboundPayload,
    { kind: 'resend', secret: RESEND_SECRET, msgId: 'msg_ui_walk_inbound_1' },
  )
  console.log('[step 5] email-inbound webhook status:', inboundStatus)
  expect(inboundStatus).toBe(200)

  // Hard reload — picks up latestInboundMsgId so "Mark as Guide Offer" appears
  await page.reload()
  await page.waitForSelector('text=UI Walk Angler', { timeout: 10_000 })

  // ── 6. Mark as Guide Offer ────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^mark as guide offer$/i }).click()
  await page.getByPlaceholder(/e\.g\. Trout/i).fill(OFFER_LABEL)
  await page.getByPlaceholder(/Price \(EUR\)/i).fill(OFFER_PRICE)
  await page.getByRole('button', { name: /^create guide offer$/i }).click()

  // Wait for "Present Offer to Angler" to appear — router.refresh() brings new offer data
  await expect(
    page.getByRole('button', { name: /^present offer to angler$/i }),
  ).toBeVisible({ timeout: 20_000 })

  // ── 7. Present Offer to Angler ────────────────────────────────────────────────
  await page.getByRole('button', { name: /^present offer to angler$/i }).click()

  // Wait for "Client Accepted" button — router.refresh() updates offer.status to 'presented'
  await expect(
    page.getByRole('button', { name: /^client accepted/i }).first(),
  ).toBeVisible({ timeout: 20_000 })

  // ── 8. Client Accepted ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^client accepted/i }).first().click()

  // Wait for "Create Deposit Link" button — router.refresh() updates offer.status to 'accepted'
  await expect(
    page.getByRole('button', { name: /create deposit link/i }),
  ).toBeVisible({ timeout: 20_000 })

  // ── 9. Create Deposit Link ────────────────────────────────────────────────────
  await page.getByRole('button', { name: /create deposit link/i }).click()
  await expect(page.getByText(/deposit link created/i)).toBeVisible({ timeout: 30_000 })

  // ── 10. Stripe deposit webhook ────────────────────────────────────────────────
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
  const stripeStatus = await signAndPost(
    page,
    'http://localhost:3000/api/webhooks/stripe-deposit',
    stripePayload,
    { kind: 'stripe', secret: STRIPE_WH_SEC },
  )
  console.log('[step 10] stripe-deposit webhook status:', stripeStatus)
  expect(stripeStatus).toBe(200)

  // Hard reload — picks up inquiry.status='paid' so "Guide Notified Paid" appears
  await page.reload()
  await page.waitForSelector('text=UI Walk Angler', { timeout: 10_000 })
  await expect(
    page.getByRole('button', { name: /^guide notified paid$/i }),
  ).toBeVisible({ timeout: 10_000 })

  // ── 11. Guide Notified Paid ───────────────────────────────────────────────────
  await page.getByRole('button', { name: /^guide notified paid$/i }).click()

  // Wait for "Contacts Exchanged" button — router.refresh() sets guideNotifiedPaid=true
  await expect(
    page.getByRole('button', { name: /^contacts exchanged$/i }),
  ).toBeVisible({ timeout: 20_000 })

  // ── 12. Contacts Exchanged ────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^contacts exchanged$/i }).click()
  // Panel header "Thread actions" disappears when isHandedOver=true (router.refresh)
  // This proves the action completed and the inquiry transitioned to handed_over
  await expect(page.getByText('Thread actions')).not.toBeVisible({ timeout: 20_000 })

  // ── 13. Verify final badge ────────────────────────────────────────────────────
  await page.reload()
  await page.waitForSelector('text=UI Walk Angler', { timeout: 10_000 })
  // STATUS_LABEL has no 'handed_over' entry → badge renders raw inquiry.status
  await expect(
    page.locator('span', { hasText: /handed.?over/i }).first(),
  ).toBeVisible({ timeout: 10_000 })

  // ── 14. DB assertion ──────────────────────────────────────────────────────────
  const eventsRaw = psql(
    `SELECT type || '|' || COALESCE(channel,'') || '|' || COALESCE(source,'') ` +
    `FROM inquiry_events WHERE inquiry_id = '${INQUIRY_ID}' ORDER BY occurred_at`
  )
  const events  = eventsRaw.split('\n').filter(l => l.trim() !== '')
  const finalSt = psql(`SELECT status FROM inquiries WHERE id = '${INQUIRY_ID}'`)

  console.log('\n── inquiry_events ─────────────────────────────────────────')
  events.forEach(e => console.log(' ', e))
  console.log(`\n total events: ${events.length}`)
  console.log(` final status: ${finalSt}\n`)

  expect(events.length).toBeGreaterThanOrEqual(10)
  expect(finalSt).toBe('handed_over')
})
