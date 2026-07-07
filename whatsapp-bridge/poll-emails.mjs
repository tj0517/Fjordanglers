/**
 * FjordAnglers — Email Poller
 *
 * Runs import-emails.mjs on a schedule via PM2 cron.
 * Checks Zoho Mail every 5 minutes for new messages.
 *
 * Start with PM2:
 *   pm2 start poll-emails.mjs --name email-poller --cron "*/5 * * * *" --no-autorestart
 *   pm2 save
 *
 * The --no-autorestart flag is important: PM2 will restart it on the cron
 * schedule, not immediately after it exits.
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ts = new Date().toLocaleTimeString('en-GB')
console.log(`[${ts}] 📧  Running email poll…`)

try {
  const out = execSync(`node ${join(__dirname, 'import-emails.mjs')}`, {
    cwd: __dirname,
    encoding: 'utf8',
    timeout: 120_000,
  })

  // Only print the summary line, not the full verbose output
  const lines = out.split('\n')
  const summary = lines.filter(l =>
    l.includes('messages →') || l.includes('skipped') || l.includes('Done')
  )
  if (summary.length) {
    summary.forEach(l => console.log('   ', l.trim()))
  } else {
    console.log('    No new messages.')
  }
} catch (err) {
  console.error(`[${ts}] ❌  Poll error:`, err.message)
}
