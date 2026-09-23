/**
 * FA-1.24 Playwright proof — /admin/knowledge panel UI walk
 *
 * Covers acceptance criteria 3 and 4:
 *   - Create a destination entry
 *   - Edit it
 *   - Deactivate it
 *   - Try to create a second active instructions entry → human error, not raw SQL
 *   - Deactivate Jon Seed's guide entry → gaps section lists Jon Seed
 *   - Re-activate Jon Seed's entry → gap disappears
 *
 * Screenshots saved to .playwright-mcp/
 *
 * SAFETY FUSE: localhost only.
 */

import { test, expect } from '@playwright/test'
import * as path        from 'node:path'
import * as fs          from 'node:fs'

const BASE = 'http://localhost:3000'
const SCREENSHOT_DIR = path.resolve(__dirname, '../../.playwright-mcp')

function screenshotPath(name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  return path.join(SCREENSHOT_DIR, `fa-1.24-${name}.png`)
}

// ── Login helper ───────────────────────────────────────────────────────────────

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', 'admin@seed.test')
  await page.fill('input[type="password"]', 'seed-admin-password-2026')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin/, { timeout: 20_000 })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test('knowledge panel — full UI walk', async ({ page }) => {
  // Safety fuse
  expect(BASE).toMatch(/localhost|127\.0\.0\.1/)

  await loginAdmin(page)

  // ── 1. Knowledge list page ─────────────────────────────────────────────────
  await page.goto(`${BASE}/admin/knowledge`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: screenshotPath('01-list'), fullPage: true })

  // Verify nav item exists (aria-current set when active)
  await expect(page.locator('a[aria-current="page"][href="/admin/knowledge"]')).toBeVisible()

  // ── 2. Create a destination entry (Iceland) ────────────────────────────────
  await page.click('text=New entry')
  await page.waitForURL(/\/admin\/knowledge\/new/, { timeout: 10_000 })
  await page.waitForLoadState('networkidle')

  // Set kind = destination (it's the default)
  await page.selectOption('#kind', 'destination')

  // Set country = Iceland
  await page.selectOption('#country', 'Iceland')

  // Fill title
  await page.fill('#title', 'Iceland — FA-1.24 proof entry')

  // Fill body
  await page.fill('#body', 'This is a **test** destination entry created by the FA-1.24 proof walk.\n\nSeason: June to September.')

  // Preview toggle
  await page.click('text=Preview')
  await page.waitForTimeout(500)
  await page.screenshot({ path: screenshotPath('02-form-preview'), fullPage: true })

  // Switch back to edit
  await page.click('text=Edit')

  // Submit
  await page.click('text=Create entry')
  await page.waitForURL(/\/admin\/knowledge$/, { timeout: 15_000 })
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: screenshotPath('03-after-create'), fullPage: true })

  // Verify entry appears (exact match to avoid matching the edited variant)
  await expect(page.getByText('Iceland — FA-1.24 proof entry', { exact: true })).toBeVisible()

  // ── 3. Edit the entry ──────────────────────────────────────────────────────
  const newEntryRow = page.getByText('Iceland — FA-1.24 proof entry', { exact: true })
  await newEntryRow.locator('..').locator('..').locator('text=Edit').click()
  await page.waitForURL(/\/admin\/knowledge\/.+\/edit/, { timeout: 10_000 })
  await page.waitForLoadState('networkidle')

  // Change the title
  await page.fill('#title', 'Iceland — FA-1.24 proof entry (edited)')
  await page.click('text=Save changes')
  await page.waitForURL(/\/admin\/knowledge$/, { timeout: 15_000 })
  await page.waitForLoadState('networkidle')

  await expect(page.getByText('Iceland — FA-1.24 proof entry (edited)', { exact: true }).first()).toBeVisible()
  await page.screenshot({ path: screenshotPath('04-after-edit'), fullPage: true })

  // ── 4. Deactivate the entry ────────────────────────────────────────────────
  const editedRow = page.getByText('Iceland — FA-1.24 proof entry (edited)', { exact: true }).first()
  await editedRow.locator('..').locator('..').locator('text=Deactivate').click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  await page.screenshot({ path: screenshotPath('05-after-deactivate'), fullPage: true })

  // ── 5. Try to create a second active instructions entry ────────────────────
  await page.click('text=New entry')
  await page.waitForURL(/\/admin\/knowledge\/new/, { timeout: 10_000 })
  await page.waitForLoadState('networkidle')

  await page.selectOption('#kind', 'instructions')
  await page.fill('#title', 'Duplicate instructions entry')
  await page.fill('#body', 'This should fail because one active instructions entry already exists.')

  await page.click('text=Create entry')
  await page.waitForTimeout(1500)

  // Expect human error message (not raw SQL)
  const errorDiv = page.locator('[role="alert"]').first()
  await expect(errorDiv).toBeVisible({ timeout: 8_000 })
  const errorText = await errorDiv.textContent()
  expect(errorText).toContain('active instructions')
  expect(errorText).not.toContain('agent_knowledge_one_active_instructions')
  expect(errorText).not.toContain('duplicate key')

  await page.screenshot({ path: screenshotPath('06-duplicate-instructions-error'), fullPage: true })

  // Cancel back to list
  await page.click('text=Cancel')
  await page.waitForURL(/\/admin\/knowledge$/, { timeout: 10_000 })

  // ── 6. Deactivate Jon Seed's guide entry → gaps section shows him ──────────
  // Find Jon Seed's entry in the Guides section
  const jonRow = page.locator('text=Jon Seed — rates and style').first()
  await jonRow.locator('..').locator('..').locator('text=Deactivate').click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)

  // Gaps section should now show Jon Seed
  await expect(page.locator('text=Jon Seed — no active knowledge entry')).toBeVisible()
  await page.screenshot({ path: screenshotPath('07-gaps-with-jon-seed'), fullPage: true })

  // ── 7. Re-activate Jon Seed's entry → gap disappears ──────────────────────
  const jonRowInactive = page.locator('text=Jon Seed — rates and style').first()
  await jonRowInactive.locator('..').locator('..').locator('text=Activate').click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)

  // Jon Seed gap should be gone
  await expect(page.locator('text=Jon Seed — no active knowledge entry')).not.toBeVisible()
  await page.screenshot({ path: screenshotPath('08-gaps-without-jon-seed'), fullPage: true })

  // ── 8. Guide card → Agent knowledge link ──────────────────────────────────
  // Jon Seed's seed guide id (from supabase/seed.sql)
  const jonGuideId = '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c03'
  await page.goto(`${BASE}/admin/guides/${jonGuideId}`)
  await page.waitForLoadState('networkidle')

  // Verify Agent knowledge link exists on the guide card
  await expect(page.locator('text=Agent knowledge')).toBeVisible()
  await page.screenshot({ path: screenshotPath('09-guide-card-with-knowledge-link'), fullPage: true })
})
