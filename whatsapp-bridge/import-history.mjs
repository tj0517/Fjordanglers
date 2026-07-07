/**
 * FjordAnglers — WhatsApp History Importer
 *
 * Run ONCE after the bridge is connected to pull existing WhatsApp
 * conversations into Supabase (lead_messages + unmatched_messages).
 *
 * Usage:
 *   node import-history.mjs [--limit 200] [--dry-run]
 *
 * Options:
 *   --limit N    Max messages to fetch per chat (default: 100)
 *   --dry-run    Print what would be inserted without touching the DB
 *
 * Requirements:
 *   - Bridge must have been connected at least once (session in .wwebjs_auth/)
 *   - .env must be configured (same as index.mjs)
 */

import pkg from 'whatsapp-web.js'
const { Client, LocalAuth } = pkg
import qrcode from 'qrcode-terminal'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import 'dotenv/config'

// ─── Args ─────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const LIMIT   = Number(args[args.indexOf('--limit') + 1] || 100)

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CREATED_BY   = 'whatsapp-import'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { transport: ws },
})

if (DRY_RUN) console.log('🔍  DRY RUN — nothing will be written to the DB\n')

// ─── Phone normalisation ───────────────────────────────────────────────────────

function normalizePhone(raw) {
  return String(raw).replace(/@.+$/, '').replace(/\D/g, '')
}

// ─── Load all inquiries with phones once ─────────────────────────────────────

async function loadInquiries() {
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, angler_name, angler_phone')
    .not('angler_phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) { console.error('DB error:', error.message); process.exit(1) }
  return data
}

function matchInquiry(phone, inquiries) {
  return inquiries.find(row => normalizePhone(row.angler_phone) === phone) ?? null
}

// ─── Deduplication: fetch already-imported timestamps per inquiry ─────────────
// We compare message timestamps so we don't double-insert if you run twice.

async function loadExistingTimestamps(inquiryId) {
  const { data } = await supabase
    .from('lead_messages')
    .select('created_at')
    .eq('inquiry_id', inquiryId)
    .eq('channel', 'whatsapp')
  return new Set((data ?? []).map(r => r.created_at))
}

async function loadExistingUnmatchedIdentifiers() {
  const { data } = await supabase
    .from('unmatched_messages')
    .select('from_identifier, created_at')
    .eq('source', 'whatsapp')
  return new Set((data ?? []).map(r => `${r.from_identifier}|${r.created_at}`))
}

// ─── Insert helpers ────────────────────────────────────────────────────────────

async function insertLeadMessages(rows) {
  if (!rows.length) return
  const { error } = await supabase.from('lead_messages').insert(rows)
  if (error) console.error('  lead_messages insert error:', error.message)
}

async function insertUnmatchedMessages(rows) {
  if (!rows.length) return
  const { error } = await supabase.from('unmatched_messages').insert(rows)
  if (error) console.error('  unmatched_messages insert error:', error.message)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run(client) {
  console.log('📥  Loading inquiries from DB...')
  const inquiries = await loadInquiries()
  console.log(`    ${inquiries.length} inquiries with phone numbers\n`)

  console.log('💬  Fetching WhatsApp chats...')
  const chats = await client.getChats()
  const dmChats = chats.filter(c => !c.isGroup && c.id._serialized !== 'status@broadcast')
  console.log(`    ${dmChats.length} direct message chats found\n`)

  const unmatchedKey = await loadExistingUnmatchedIdentifiers()

  let totalMatched   = 0
  let totalUnmatched = 0
  let totalSkipped   = 0

  for (const chat of dmChats) {
    const phone      = normalizePhone(chat.id._serialized)
    const phoneAlt   = normalizePhone(chat.name)   // sender_name is often the real phone number
    const chatName   = chat.name || `+${phone}`
    const inquiry    = matchInquiry(phone, inquiries) ?? matchInquiry(phoneAlt, inquiries)

    console.log(`── +${phone}  (${chatName})`)
    if (inquiry) console.log(`   matched → ${inquiry.angler_name} (${inquiry.id})`)
    else         console.log(`   no match`)

    // Fetch message history
    let messages
    try {
      messages = await chat.fetchMessages({ limit: LIMIT })
    } catch {
      console.log('   ⚠️  could not fetch messages — skipping')
      continue
    }

    console.log(`   ${messages.length} messages fetched`)

    if (inquiry) {
      // ── Matched: insert into lead_messages ──────────────────────────────────
      const existingTs = await loadExistingTimestamps(inquiry.id)

      const toInsert = []
      for (const msg of messages) {
        if (msg.type !== 'chat') continue   // skip media/stickers
        const body = msg.body?.trim()
        if (!body) continue

        const createdAt = new Date(msg.timestamp * 1000).toISOString()
        if (existingTs.has(createdAt)) { totalSkipped++; continue }

        // msg.fromMe = true when the message was sent BY us (from the linked phone)
        const direction    = msg.fromMe ? 'outbound' : 'inbound'
        const contactName  = msg.fromMe ? 'Tymon (FA)' : (chat.name || `+${phone}`)

        toInsert.push({
          inquiry_id:   inquiry.id,
          direction,
          channel:      'whatsapp',
          contact_type: 'client',
          contact_name: contactName,
          content:      body,
          created_at:   createdAt,
          created_by:   CREATED_BY,
        })
      }

      if (DRY_RUN) {
        console.log(`   → would insert ${toInsert.length} messages`)
      } else {
        await insertLeadMessages(toInsert)
        console.log(`   ✅  inserted ${toInsert.length} messages`)
      }
      totalMatched += toInsert.length

    } else {
      // ── Unmatched: insert only Tymon's outbound messages ────────────────────
      const toInsert = []
      for (const msg of messages) {
        if (msg.type !== 'chat') continue
        if (!msg.fromMe) continue   // skip inbound from unknown contacts
        const body = msg.body?.trim()
        if (!body) continue

        const createdAt = new Date(msg.timestamp * 1000).toISOString()
        const key       = `${phone}|${createdAt}`
        if (unmatchedKey.has(key)) { totalSkipped++; continue }

        toInsert.push({
          source:          'whatsapp',
          from_identifier: phone,
          sender_name:     msg.fromMe ? 'Tymon (FA)' : chatName,
          content:         body,
          raw_payload:     { timestamp: msg.timestamp, type: msg.type, fromMe: msg.fromMe },
          created_at:      createdAt,
        })
      }

      if (DRY_RUN) {
        console.log(`   → would insert ${toInsert.length} unmatched messages`)
      } else {
        await insertUnmatchedMessages(toInsert)
        console.log(`   ✅  inserted ${toInsert.length} unmatched messages`)
      }
      totalUnmatched += toInsert.length
    }
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`✅  Done`)
  console.log(`   ${totalMatched}  messages → lead_messages`)
  console.log(`   ${totalUnmatched}  messages → unmatched_messages`)
  console.log(`   ${totalSkipped}  skipped (already imported)`)
}

// ─── WhatsApp client (reuse saved session, no QR if already authed) ───────────

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
})

client.on('qr', qr => {
  console.log('\n📱  No saved session — scan QR code first:\n')
  qrcode.generate(qr, { small: true })
})

client.on('ready', async () => {
  console.log('✅  WhatsApp connected\n')
  try {
    await run(client)
  } finally {
    await client.destroy()
    process.exit(0)
  }
})

client.on('auth_failure', () => {
  console.error('❌  Auth failed — delete .wwebjs_auth/ and reconnect via index.mjs')
  process.exit(1)
})

client.initialize()
