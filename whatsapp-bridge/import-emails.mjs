/**
 * FjordAnglers — Zoho Mail History Importer
 *
 * Connects to Zoho Mail via IMAP and imports all email conversations
 * into Supabase (lead_messages + unmatched_messages).
 *
 * Usage:
 *   node import-emails.mjs [--dry-run] [--since 2024-01-01] [--limit 2000]
 *
 * Options:
 *   --dry-run       Print what would happen without writing to the DB
 *   --since DATE    Only import emails after this date (ISO format)
 *   --limit N       Max emails per folder (default: 2000)
 *
 * Required in .env:
 *   ZOHO_IMAP_HOST   imap.zoho.eu  (or imap.zoho.com for US accounts)
 *   ZOHO_EMAIL       hello@fjordanglers.com
 *   ZOHO_PASSWORD    your Zoho password or App Password (if 2FA enabled)
 */

import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import 'dotenv/config'

// ─── Args ─────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const LIMIT    = limitIdx !== -1 ? Number(args[limitIdx + 1]) || 2000 : 2000
const sinceIdx = args.indexOf('--since')
const sinceArg = sinceIdx !== -1 ? args[sinceIdx + 1] : null
const SINCE    = sinceArg ? new Date(sinceArg) : null
// --folder can be specified multiple times: --folder Inquiries/Iceland/Brynjar --folder Inquiries/Iceland/Magnus
const EXTRA_FOLDERS = args
  .map((a, i) => (a === '--folder' ? args[i + 1] : null))
  .filter(Boolean)

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const IMAP_HOST    = process.env.ZOHO_IMAP_HOST   ?? 'imap.zoho.eu'
const IMAP_USER    = process.env.ZOHO_EMAIL
const IMAP_PASS    = process.env.ZOHO_PASSWORD

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}
if (!IMAP_USER || !IMAP_PASS) {
  console.error('❌  Missing ZOHO_EMAIL or ZOHO_PASSWORD in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { transport: ws },
})

if (DRY_RUN) console.log('🔍  DRY RUN — nothing will be written to the DB\n')
if (SINCE)   console.log(`📅  Only importing emails after ${SINCE.toISOString()}\n`)

// ─── Email helpers ─────────────────────────────────────────────────────────────

function normaliseEmail(raw) {
  if (!raw) return ''
  return raw.trim().toLowerCase()
}

/** Extract just the address from "Name <email@example.com>" or plain address. */
function extractAddress(addressObj) {
  if (!addressObj) return null
  // mailparser returns { value: [{ address, name }], text, html }
  if (Array.isArray(addressObj.value) && addressObj.value.length > 0) {
    return normaliseEmail(addressObj.value[0].address ?? '')
  }
  return null
}

function extractAllAddresses(addressObj) {
  if (!addressObj) return []
  if (Array.isArray(addressObj.value)) {
    return addressObj.value
      .map(a => normaliseEmail(a.address ?? ''))
      .filter(Boolean)
  }
  return []
}

function extractName(addressObj) {
  if (!addressObj) return ''
  if (Array.isArray(addressObj.value) && addressObj.value.length > 0) {
    return (addressObj.value[0].name ?? '').trim()
  }
  return ''
}

/**
 * Strip quoted reply history, keeping only the top-level message.
 *
 * Handles:
 *  - Lines starting with ">" (standard quoted text)
 *  - "On DATE, NAME wrote:" — English reply separator (may span 2 lines)
 *  - "Od: " / "Do: " — Polish Zoho reply headers
 *  - "From: " / "To: " — English reply header block mid-body
 *  - "-----Original Message-----" / "_____" separators
 */
function cleanBody(text) {
  if (!text) return ''

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const result = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Quoted line
    if (trimmed.startsWith('>')) break

    // "On DATE ... wrote:" — may be one line or split across two
    if (/^On .{5,}/.test(trimmed)) {
      // Check this line or next line ends with "wrote:"
      const nextLine = (lines[i + 1] ?? '').trim()
      if (trimmed.endsWith('wrote:') || nextLine === 'wrote:' || nextLine.endsWith('wrote:')) {
        break
      }
    }

    // Polish reply headers: "Od: " (From) / "Do: " (To) / "Data: " (Date)
    if (/^Od: /i.test(trimmed) || /^Do: /i.test(trimmed) || /^Data: /i.test(trimmed)) break

    // English inline reply headers (only meaningful mid-body, not at very top)
    if (i > 2 && (/^From: /i.test(trimmed) || /^Sent: /i.test(trimmed))) break

    // Separator lines
    if (/^-{4,}/.test(trimmed) || /^_{4,}/.test(trimmed)) break

    result.push(line)
  }

  return result
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000)
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/** Load all inquiries with email addresses once. */
async function loadInquiries() {
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, angler_name, angler_email')
    .not('angler_email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) { console.error('DB error:', error.message); process.exit(1) }
  return data ?? []
}

function matchInquiry(email, inquiries) {
  if (!email) return null
  return inquiries.find(row => normaliseEmail(row.angler_email) === email) ?? null
}

/** Load existing email Message-IDs stored in lead_messages for dedup. */
async function loadExistingMessageIds() {
  // We store Message-ID in created_by field prefixed with "email-import|" + msgId
  // OR we can just dedup by created_at + inquiry_id — let's use created_at approach
  // to keep it simple (no schema change needed).
  const { data } = await supabase
    .from('lead_messages')
    .select('inquiry_id, created_at')
    .eq('channel', 'email')

  const set = new Set()
  for (const row of (data ?? [])) {
    set.add(`${row.inquiry_id}|${row.created_at}`)
  }
  return set
}

/** Load existing unmatched email identifiers for dedup. */
async function loadExistingUnmatched() {
  const { data } = await supabase
    .from('unmatched_messages')
    .select('from_identifier, created_at')
    .eq('source', 'email')

  const set = new Set()
  for (const row of (data ?? [])) {
    set.add(`${row.from_identifier}|${row.created_at}`)
  }
  return set
}

async function insertLeadMessages(rows) {
  if (!rows.length) return { count: 0, error: null }
  const { error } = await supabase.from('lead_messages').insert(rows)
  if (error) console.error('  lead_messages insert error:', error.message)
  return { count: rows.length, error }
}

async function insertUnmatched(rows) {
  if (!rows.length) return { count: 0, error: null }
  const { error } = await supabase.from('unmatched_messages').insert(rows)
  if (error) console.error('  unmatched_messages insert error:', error.message)
  return { count: rows.length, error }
}

// ─── IMAP fetch ───────────────────────────────────────────────────────────────

/** Fetch parsed emails from a given IMAP folder. Returns array of parsed email objects. */
async function fetchFolder(imap, folderName) {
  let mailbox
  try {
    mailbox = await imap.mailboxOpen(folderName)
  } catch {
    console.log(`  ⚠️  Folder "${folderName}" not found — skipping`)
    return []
  }

  const total = mailbox.exists
  console.log(`  📂  ${folderName}  (${total} messages total)`)

  if (total === 0) return []

  // Build search criteria
  const searchCriteria = SINCE
    ? { since: SINCE }
    : {}

  const uids = await imap.search(searchCriteria)
  const toFetch = uids.slice(-LIMIT)  // take most recent N if too many
  console.log(`      fetching ${toFetch.length} messages…`)

  const emails = []

  for await (const msg of imap.fetch(toFetch, { source: true, uid: true })) {
    let parsed
    try {
      parsed = await simpleParser(msg.source)
    } catch (e) {
      console.warn('      ⚠️  parse error, skipping message:', e.message)
      continue
    }
    emails.push(parsed)
  }

  return emails
}

// ─── Process emails ───────────────────────────────────────────────────────────

function processEmails({ emails, direction, ownEmail, inquiries, existingLeadKeys, existingUnmatchedKeys }) {
  const leadRows      = []
  const unmatchedRows = []
  let skipped = 0

  for (const email of emails) {
    const date = email.date ? new Date(email.date) : null
    if (!date || isNaN(date.getTime())) continue
    const createdAt = date.toISOString()

    const subject = email.subject?.trim() ?? ''
    const bodyText = cleanBody(email.text ?? email.textAsHtml ?? '')
    const content  = subject ? `**${subject}**\n\n${bodyText}` : bodyText
    if (!content.trim()) continue

    let anglerEmail, contactName, inquiry

    if (direction === 'inbound') {
      // INBOX: email came FROM the angler
      anglerEmail = extractAddress(email.from)
      contactName = extractName(email.from) || anglerEmail
      inquiry     = matchInquiry(anglerEmail, inquiries)
    } else {
      // Sent: email was sent TO an angler
      // Check all "To" recipients — pick the one that matches an inquiry
      const toAddresses = extractAllAddresses(email.to)
      inquiry = null
      anglerEmail = null
      for (const addr of toAddresses) {
        if (addr === normaliseEmail(ownEmail)) continue  // skip self
        const found = matchInquiry(addr, inquiries)
        if (found) {
          inquiry     = found
          anglerEmail = addr
          break
        }
        // Even if not matched, track the first non-self recipient
        if (!anglerEmail) anglerEmail = addr
      }
      contactName = extractName(email.to) || anglerEmail
    }

    if (!anglerEmail) continue  // no usable address

    if (inquiry) {
      const dedupeKey = `${inquiry.id}|${createdAt}`
      if (existingLeadKeys.has(dedupeKey)) { skipped++; continue }
      existingLeadKeys.add(dedupeKey)

      leadRows.push({
        inquiry_id:   inquiry.id,
        direction,
        channel:      'email',
        contact_type: 'client',
        contact_name: direction === 'inbound' ? contactName : 'Tymon (FA)',
        content,
        created_at:   createdAt,
        created_by:   'email-import',
      })
    } else if (direction === 'inbound') {
      // Only store unmatched for inbound (we don't need unmatched sent emails)
      const dedupeKey = `${anglerEmail}|${createdAt}`
      if (existingUnmatchedKeys.has(dedupeKey)) { skipped++; continue }
      existingUnmatchedKeys.add(dedupeKey)

      unmatchedRows.push({
        source:          'email',
        from_identifier: anglerEmail,
        sender_name:     contactName,
        content,
        created_at:      createdAt,
        raw_payload:     {
          subject,
          message_id: email.messageId ?? null,
        },
      })
    }
  }

  return { leadRows, unmatchedRows, skipped }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📥  Loading inquiries from DB…')
  const inquiries = await loadInquiries()
  console.log(`    ${inquiries.length} inquiries with email addresses\n`)

  console.log('📋  Loading existing email records for deduplication…')
  const [existingLeadKeys, existingUnmatchedKeys] = await Promise.all([
    loadExistingMessageIds(),
    loadExistingUnmatched(),
  ])
  console.log(`    ${existingLeadKeys.size} existing lead_messages, ${existingUnmatchedKeys.size} unmatched\n`)

  const imap = new ImapFlow({
    host:   IMAP_HOST,
    port:   993,
    secure: true,
    auth: {
      user: IMAP_USER,
      pass: IMAP_PASS,
    },
    logger: false,  // suppress verbose IMAP logs
  })

  console.log(`🔌  Connecting to ${IMAP_HOST} as ${IMAP_USER}…`)
  await imap.connect()
  console.log('    Connected ✓\n')

  // List available folders so user can see what's there
  const folderList = await imap.list()
  const folders = folderList.map(f => f.path)
  console.log('📁  Available folders:', folders.join(', '), '\n')

  // Find the Sent folder — Zoho typically names it "Sent"
  const sentFolderName = folders.find(f =>
    /^sent$/i.test(f) || /^sent items$/i.test(f) || /^sent messages$/i.test(f)
  ) ?? 'Sent'

  let totalLead = 0, totalUnmatched = 0, totalSkipped = 0

  // ── INBOX (inbound from anglers) ───────────────────────────────────────────
  console.log('── INBOX (inbound emails from anglers)')
  const inboxEmails = await fetchFolder(imap, 'INBOX')
  const inboxResult = processEmails({
    emails:               inboxEmails,
    direction:            'inbound',
    ownEmail:             IMAP_USER,
    inquiries,
    existingLeadKeys,
    existingUnmatchedKeys,
  })

  console.log(`      ${inboxResult.leadRows.length} matched, ${inboxResult.unmatchedRows.length} unmatched, ${inboxResult.skipped} skipped`)

  if (DRY_RUN) {
    console.log('      [DRY RUN] would insert the above rows')
  } else {
    await insertLeadMessages(inboxResult.leadRows)
    await insertUnmatched(inboxResult.unmatchedRows)
  }

  totalLead      += inboxResult.leadRows.length
  totalUnmatched += inboxResult.unmatchedRows.length
  totalSkipped   += inboxResult.skipped

  // ── Sent folder (outbound emails to anglers) ───────────────────────────────
  console.log(`\n── ${sentFolderName} (outbound emails to anglers)`)
  const sentEmails = await fetchFolder(imap, sentFolderName)
  const sentResult = processEmails({
    emails:               sentEmails,
    direction:            'outbound',
    ownEmail:             IMAP_USER,
    inquiries,
    existingLeadKeys,
    existingUnmatchedKeys,
  })

  console.log(`      ${sentResult.leadRows.length} matched, ${sentResult.skipped} skipped (outbound unmatched not stored)`)

  if (DRY_RUN) {
    console.log('      [DRY RUN] would insert the above rows')
  } else {
    await insertLeadMessages(sentResult.leadRows)
  }

  totalLead    += sentResult.leadRows.length
  totalSkipped += sentResult.skipped

  // ── Extra folders (custom --folder flags) ──────────────────────────────────
  for (const folderName of EXTRA_FOLDERS) {
    console.log(`\n── ${folderName} (custom folder — inbound)`)
    const folderEmails = await fetchFolder(imap, folderName)
    const folderResult = processEmails({
      emails:               folderEmails,
      direction:            'inbound',
      ownEmail:             IMAP_USER,
      inquiries,
      existingLeadKeys,
      existingUnmatchedKeys,
    })

    console.log(`      ${folderResult.leadRows.length} matched, ${folderResult.unmatchedRows.length} unmatched, ${folderResult.skipped} skipped`)

    if (DRY_RUN) {
      console.log('      [DRY RUN] would insert the above rows')
    } else {
      await insertLeadMessages(folderResult.leadRows)
      await insertUnmatched(folderResult.unmatchedRows)
    }

    totalLead      += folderResult.leadRows.length
    totalUnmatched += folderResult.unmatchedRows.length
    totalSkipped   += folderResult.skipped
  }

  await imap.logout()

  console.log('\n─────────────────────────────────────────')
  console.log('✅  Done')
  console.log(`   ${totalLead}       messages → lead_messages`)
  console.log(`   ${totalUnmatched}  messages → unmatched_messages`)
  console.log(`   ${totalSkipped}    skipped (already imported)`)
  console.log('')
  console.log('💡  Tip: run again anytime — duplicates are skipped automatically')
}

main().catch(err => {
  console.error('❌  Fatal error:', err.message)
  if (err.response) console.error('    IMAP response:', err.response)
  if (err.code)     console.error('    Error code:', err.code)
  console.error(err)
  process.exit(1)
})
