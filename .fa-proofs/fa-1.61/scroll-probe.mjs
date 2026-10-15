// FA-1.61 — error-scroll evidence. Local only.
// Usage: RESEND_DEV_FAKE=1 node scroll-probe.mjs <baseUrl> <slug> <v1|v2> <width> <height> <tag>
// For v1: opens the modal, goes to the details step, fills e-mail + trip length, leaves first/last name
//   empty, scrolls the modal body to its bottom, clicks Send.
// For v2: opens the wizard, goes to step 3, fills e-mail + country, leaves first/last name empty,
//   scrolls the wizard body to its bottom, clicks "Send the inquiry". Also probes step 2 (all four
//   choice groups unanswered) and the inline step-1 "Continue" with no month picked.
// Records, after the click: is the first invalid field inside the visible area (viewport AND every
// clipping ancestor), document.activeElement, aria-invalid, scroll position. Screenshot per run.
// Nothing is sent to the server by this script (validation fails first). Google requests are aborted.

if (process.env.RESEND_DEV_FAKE !== '1') {
  console.error('STOP: set RESEND_DEV_FAKE=1 before running this proof script')
  process.exit(1)
}
import { createRequire } from 'node:module'
import { appendFileSync } from 'node:fs'
const require = createRequire(new URL('../../package.json', import.meta.url))
const { chromium } = require('playwright')

const [, , baseUrl, slug, variant, wArg, hArg, tag] = process.argv
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl ?? '')) { console.error('STOP: local only'); process.exit(1) }
const W = Number(wArg), H = Number(hArg)
const OUT = new URL('.', import.meta.url).pathname
const SZ = (W === 390 && H === 667) || (W === 1280 && H === 720) ? `${W}` : `${W}x${H}`  // canonical sizes keep the plain name
const GOOGLE_HOSTS = /(googletagmanager\.com|google-analytics\.com|googleadservices\.com|googlesyndication\.com|doubleclick\.net|google\.com\/pagead|google\.com\/ccm)/

// Runs in the page: geometry and visibility of an element within the viewport AND every clipping ancestor.
function inPage([field, scroller]) {
  function describe(el) {
    if (!el) return null
    const label = el.closest('label')
    return {
      tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), id: el.id || null, name: el.getAttribute('name'),
      placeholder: el.getAttribute('placeholder'), ariaLabel: el.getAttribute('aria-label'),
      labelText: label ? label.textContent.trim().slice(0, 40) : null,
      testid: el.getAttribute('data-testid'), ariaInvalid: el.getAttribute('aria-invalid'),
    }
  }
  function visibility(el) {
    const r = el.getBoundingClientRect()
    let clip = { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth }
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p)
      if (/(auto|scroll|hidden|clip)/.test(o.overflowY + o.overflowX)) {
        const b = p.getBoundingClientRect()
        clip = { top: Math.max(clip.top, b.top), left: Math.max(clip.left, b.left), bottom: Math.min(clip.bottom, b.bottom), right: Math.min(clip.right, b.right) }
      }
    }
    const overlapH = Math.max(0, Math.min(r.bottom, clip.bottom) - Math.max(r.top, clip.top))
    return {
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) },
      inWindowViewport: r.top >= 0 && r.bottom <= window.innerHeight,
      visibleClip: { top: Math.round(clip.top), bottom: Math.round(clip.bottom) },
      fullyVisibleInClip: r.height > 0 && r.top >= clip.top - 0.5 && r.bottom <= clip.bottom + 0.5,
      visibleFraction: r.height > 0 ? Math.round(100 * overlapH / r.height) / 100 : 0,
    }
  }
  return {
    field: field ? describe(field) : null,
    visibility: field ? visibility(field) : null,
    activeElement: describe(document.activeElement),
    activeIsField: field ? document.activeElement === field : false,
    scrollTop: scroller ? Math.round(scroller.scrollTop) : null,
    scrollMax: scroller ? Math.round(scroller.scrollHeight - scroller.clientHeight) : null,
    pageScrollY: Math.round(window.scrollY),
  }
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 })
const page = await context.newPage()
let aborted = 0
await page.route('**/*', route => {
  if (GOOGLE_HOSTS.test(route.request().url())) { aborted++; return route.abort() }
  return route.continue()
})
const posts = []
page.on('request', r => { if (r.url().endsWith('/api/inquiries') && r.method() === 'POST') posts.push(r.url()) })

const log = (obj) => { const line = JSON.stringify(obj); console.log(line); appendFileSync(`${OUT}scroll-before.log`, line + '\n') }

async function measure(firstInvalidLocator, scrollerLocator, step) {
  const field = await firstInvalidLocator.elementHandle()
  const scroller = scrollerLocator ? await scrollerLocator.elementHandle() : null
  const data = await page.evaluate(inPage, [field, scroller])
  return { step, ...data }
}

await page.goto(`${baseUrl}/experiences/${slug}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
await page.waitForLoadState('networkidle').catch(() => {})
const meta = { variant, width: W, height: H, tag }

if (variant === 'v1') {
  await page.locator('button:visible', { hasText: 'Send Inquiry →' }).first().click()
  await page.getByText(/Discuss dates later|Continue →/).first().click()
  await page.getByPlaceholder('you@example.com').fill('fa161-scroll@example.invalid')
  await page.locator('select').filter({ hasText: 'Select duration' }).selectOption('2-3')
  const scroller = page.locator('div.overflow-y-auto').filter({ has: page.locator('#inquiry-form') })
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight })
  const first = page.getByPlaceholder('Erik')
  const pre = await measure(first, scroller, 'before-click')
  await page.locator('button[type="submit"]').click()
  await page.waitForTimeout(400)
  const post = await measure(first, scroller, 'after-click')
  const last = await measure(page.getByPlaceholder('Andersen'), scroller, 'after-click (last name, second invalid)')
  await page.screenshot({ path: `${OUT}before-v1-${SZ}.png` })
  log({ ...meta, case: 'v1 details step, first+last name empty, body scrolled to bottom', pre, post, last, postRequests: posts.length })
} else {
  // ── open the wizard
  const openWizard = async () => {
    const cta = page.locator('a:visible, button:visible').filter({ hasText: /Check availability|Send (the )?inquiry|Ask for|Request/i }).first()
    await cta.click()
    await page.getByTestId('inquiry-wizard').waitFor()
  }
  // Case 0 (inline step 1 on the page): Continue with no month picked.
  const inlineContinue = page.getByTestId('inquiry-continue')
  if (await inlineContinue.count() > 0) {
    await inlineContinue.scrollIntoViewIfNeeded()
    // Scroll so the "When do you want to fish?" question is above the visible area and the button in view.
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="inquiry-continue"]')
      const r = btn.getBoundingClientRect()
      window.scrollBy(0, r.bottom - window.innerHeight + 24)
    })
    await page.waitForTimeout(1500) // let lazy content above settle before measuring
    const flexGroup = page.getByTestId('inquiry-inline').getByRole('radiogroup', { name: 'Month' })
    const pre0 = await measure(flexGroup, null, 'inline before-click')
    await inlineContinue.click()
    await page.waitForTimeout(400)
    const post0 = await measure(flexGroup, null, 'inline after-click')
    const err0 = await page.getByTestId('inquiry-inline').getByRole('alert').first().textContent().catch(() => null)
    const errVis = await measure(page.getByTestId('inquiry-inline').getByRole('alert').first(), null, 'inline error text')
    await page.screenshot({ path: `${OUT}before-v2-inline-${SZ}.png` })
    log({ ...meta, case: 'v2 inline step 1 (page), Continue with no month, button in view', pre: pre0, post: post0, errorText: err0, errorMessageVisibility: errVis, postRequests: posts.length })
    await page.evaluate(() => window.scrollTo(0, 0))
  }

  await openWizard()
  const dialog = page.getByTestId('inquiry-wizard')
  const body = dialog.locator('div.overflow-y-auto')
  if (await dialog.getByTestId('wizard-step-1').count() > 0) {
    const nextMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1))
    await dialog.getByText(nextMonth.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }), { exact: true }).first().click()
    await dialog.getByTestId('wizard-next').click()
  }

  // ── Step 2: nothing answered. The first invalid group is skill level, at the top.
  await dialog.getByTestId('wizard-step-2').waitFor()
  await body.evaluate(el => { el.scrollTop = el.scrollHeight })
  const skillGroup = dialog.getByTestId('wizard-step-2').locator('fieldset').first()
  const pre2 = await measure(skillGroup, body, 'step 2 before-click')
  await dialog.getByTestId('wizard-next').click()
  await page.waitForTimeout(400)
  const post2 = await measure(skillGroup, body, 'step 2 after-click')
  const firstRadio = await measure(skillGroup.locator('input').first(), body, 'step 2 after-click (first radio input)')
  const structure = await dialog.getByTestId('wizard-step-2').evaluate(root => [...root.querySelectorAll('fieldset')].map(fs => ({
    legend: fs.querySelector('legend')?.textContent?.trim().slice(0, 50),
    controls: [...fs.querySelectorAll('input,button,select')].map(c => `${c.tagName.toLowerCase()}${c.type ? '[' + c.type + ']' : ''}${c.classList.contains('sr-only') ? '(sr-only)' : ''}`).join(' '),
    fieldsetRole: fs.getAttribute('role'), ariaInvalid: fs.getAttribute('aria-invalid'), ariaDescribedby: fs.getAttribute('aria-describedby'),
    anyControlAriaInvalid: !!fs.querySelector('[aria-invalid]'),
    errorEl: fs.querySelector('[role="alert"]')?.textContent?.trim() ?? null,
  })))
  await page.screenshot({ path: `${OUT}before-v2-step2-${SZ}.png` })
  log({ ...meta, case: 'v2 step 2, nothing answered, body scrolled to bottom', pre: pre2, post: post2, firstRadio, structure, postRequests: posts.length })

  // ── answer step 2, go to step 3
  await dialog.getByText(/I cast 15 m/).click()
  await dialog.getByText(/One big fish/).click()
  await dialog.getByText(/A few kilometres/).click()
  await dialog.getByText('Yes', { exact: true }).click()
  const price = dialog.getByText(/I have seen the price/)
  if (await price.count() > 0) await price.click()
  await dialog.getByTestId('wizard-next').click()
  await dialog.getByTestId('wizard-step-3').waitFor()

  // ── Step 3: names empty, e-mail + country filled, body scrolled to the bottom.
  await dialog.getByLabel(/E-mail/).fill('fa161-scroll@example.invalid')
  await dialog.getByLabel(/Travelling from/).selectOption('PL')
  await body.evaluate(el => { el.scrollTop = el.scrollHeight })
  const first3 = dialog.getByLabel(/First name/)
  const pre3 = await measure(first3, body, 'step 3 before-click')
  await dialog.getByTestId('wizard-next').click()
  await page.waitForTimeout(400)
  const post3 = await measure(first3, body, 'step 3 after-click')
  const last3 = await measure(dialog.getByLabel(/Last name/), body, 'step 3 after-click (last name)')
  await page.screenshot({ path: `${OUT}before-v2-${SZ}.png` })
  log({ ...meta, case: 'v2 step 3, first+last name empty, body scrolled to bottom', pre: pre3, post: post3, last: last3, postRequests: posts.length })
}
log({ ...meta, googleRequestsAborted: aborted })
await browser.close()
