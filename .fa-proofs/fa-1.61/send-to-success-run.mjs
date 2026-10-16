// FA-1.61 — time from clicking Send to the success screen, v1 and v2. Local only.
// Usage: RESEND_DEV_FAKE=1 node send-to-success-run.mjs <baseUrl> <slug> <v1|v2> <runs> [label]
// Every request to Google (GTM, Ads, GA4, doubleclick, syndication) is ABORTED, so a local submit
// can never reach a real Ads conversion. The dev server must have been started with RESEND_DEV_FAKE=1.

if (process.env.RESEND_DEV_FAKE !== '1') {
  console.error('STOP: set RESEND_DEV_FAKE=1 before running this proof script')
  process.exit(1)
}
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../package.json', import.meta.url))
const { chromium } = require('playwright')

const [, , baseUrl, slug, variant, runsArg, label = ''] = process.argv
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl ?? '')) {
  console.error('STOP: local base URL only')
  process.exit(1)
}
const RUNS = Number(runsArg)

export const GOOGLE_HOSTS = /(googletagmanager\.com|google-analytics\.com|googleadservices\.com|googlesyndication\.com|doubleclick\.net|google\.com\/pagead|google\.com\/ccm)/

const browser = await chromium.launch()
const results = []
let blocked = 0

for (let i = 0; i < RUNS; i++) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.route('**/*', route => {
    if (GOOGLE_HOSTS.test(route.request().url())) { blocked++; return route.abort() }
    return route.continue()
  })
  const email = `fa161-browser-${variant}-${Date.now().toString(36)}-${i}@example.invalid`

  await page.goto(`${baseUrl}/experiences/${slug}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForLoadState('networkidle').catch(() => {})

  let sendBtn
  let successLocator
  if (variant === 'v1') {
    await page.getByText('Send Inquiry →').first().click()
    await page.getByText(/Discuss dates later|Continue →/).first().click()
    await page.getByPlaceholder('Erik').fill('Anna')
    await page.getByPlaceholder('Andersen').fill('Angler')
    await page.getByPlaceholder('you@example.com').fill(email)
    await page.locator('select').filter({ hasText: 'Select duration' }).selectOption('2-3')
    await page.waitForTimeout(2600) // past the FA-1.43 minimum fill time (2 s)
    sendBtn = page.locator('button[type="submit"]')
    successLocator = page.getByText('Message sent!')
  } else {
    await page.locator('a:visible', { hasText: 'Check availability' }).first().click()
    const dialog = page.getByTestId('inquiry-wizard')
    await dialog.waitFor()
    if (await dialog.getByTestId('wizard-step-1').count() > 0) {
      const next  = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1))
      const month = next.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
      await dialog.getByText(month, { exact: true }).first().click()
      await dialog.getByTestId('wizard-next').click()
    }
    await dialog.getByText(/I cast 15 m/).click()
    await dialog.getByText(/One big fish/).click()
    await dialog.getByText(/A few kilometres/).click()
    await dialog.getByText('Yes', { exact: true }).click()
    const price = dialog.getByText(/I have seen the price/)
    if (await price.count() > 0) await price.click()
    await dialog.getByTestId('wizard-next').click()
    await dialog.getByLabel(/First name/).fill('Anna')
    await dialog.getByLabel(/Last name/).fill('Angler')
    await dialog.getByLabel(/E-mail/).fill(email)
    await dialog.getByLabel(/Travelling from/).selectOption('PL')
    await page.waitForTimeout(2600)
    sendBtn = dialog.getByTestId('wizard-next')
    successLocator = page.getByTestId('inquiry-thank-you')
  }

  const respPromise = page.waitForResponse(r => r.url().endsWith('/api/inquiries') && r.request().method() === 'POST', { timeout: 90_000 })
  const t0 = Date.now()
  await sendBtn.click()
  const resp = await respPromise
  const tResp = Date.now()
  await successLocator.waitFor({ timeout: 90_000 })
  const t1 = Date.now()
  const row = { variant, run: i + 1, status: resp.status(), click_to_response_ms: tResp - t0, click_to_success_ms: t1 - t0 }
  results.push(row)
  console.log(JSON.stringify(row))
  await context.close()
}

const ms = results.map(r => r.click_to_success_ms).sort((a, b) => a - b)
console.log(`${label}${variant}: click→success ms min=${ms[0]} median=${ms[Math.floor(ms.length / 2)]} max=${ms[ms.length - 1]} (n=${ms.length}); Google requests aborted: ${blocked}`)
await browser.close()
