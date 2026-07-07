/**
 * FjordAnglers — WhatsApp Bridge
 *
 * Connects to WhatsApp Web via whatsapp-web.js (no Meta approval needed).
 * Incoming messages are matched to inquiries by angler_phone and logged
 * to lead_messages. Unmatched messages go to unmatched_messages.
 *
 * Also exposes a tiny HTTP API so the Next.js admin panel can send
 * outbound WhatsApp messages.
 *
 * Usage:
 *   cd whatsapp-bridge && npm install && node index.mjs
 *
 * On first run, scan the QR code with WhatsApp on your phone.
 * Session is saved locally in .wwebjs_auth/ — no need to re-scan.
 */

import pkg from 'whatsapp-web.js'
const { Client, LocalAuth } = pkg
import qrcode from 'qrcode-terminal'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import http from 'http'
import 'dotenv/config'

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PORT         = Number(process.env.PORT ?? 3001)
const CREATED_BY   = process.env.CREATED_BY ?? 'whatsapp-bridge'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { transport: ws },
})

// ─── Phone normalisation ───────────────────────────────────────────────────────
// WhatsApp sends from "48123456789@c.us" — strip suffix, keep digits only.
// Stored angler_phone may have +, spaces, dashes — same stripping applied.

function normalizePhone(raw) {
  return String(raw)
    .replace(/@.+$/, '')   // strip @c.us / @g.us
    .replace(/\D/g, '')    // digits only
}

// ─── Supabase helpers ──────────────────────────────────────────────────────────

/**
 * Find the most recent inquiry whose angler_phone normalises to `phone`.
 * Supabase can't run JS normalization server-side, so we pull recent
 * inquiries with a phone and match in JS. Fine for <1000 rows.
 */
async function findInquiryByPhone(phone) {
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, angler_name, angler_phone')
    .not('angler_phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('  [db] fetch inquiries error:', error.message)
    return null
  }

  return data.find(row => normalizePhone(row.angler_phone) === phone) ?? null
}

async function logLeadMessage({ inquiryId, direction, contactName, content }) {
  const { error } = await supabase.from('lead_messages').insert({
    inquiry_id:   inquiryId,
    direction,
    channel:      'whatsapp',
    contact_type: 'client',
    contact_name: contactName,
    content,
    created_by:   CREATED_BY,
  })
  if (error) console.error('  [db] lead_messages insert error:', error.message)
}

async function logUnmatched({ phone, senderName, content, rawPayload }) {
  const { error } = await supabase.from('unmatched_messages').insert({
    source:          'whatsapp',
    from_identifier: phone,
    sender_name:     senderName,
    content,
    raw_payload:     rawPayload,
  })
  if (error) console.error('  [db] unmatched_messages insert error:', error.message)
}

async function touchLastContact(inquiryId) {
  await supabase
    .from('inquiries')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', inquiryId)
}

// ─── WhatsApp client ───────────────────────────────────────────────────────────

const wa = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
})

wa.on('qr', qr => {
  console.log('\n📱  Scan this QR code with WhatsApp on your phone:\n')
  qrcode.generate(qr, { small: true })
  console.log()
})

wa.on('authenticated', () => {
  console.log('🔐  WhatsApp authenticated — session saved to .wwebjs_auth/')
})

wa.on('ready', () => {
  console.log('✅  WhatsApp client ready — listening for messages\n')
})

wa.on('auth_failure', msg => {
  console.error('❌  WhatsApp auth failed:', msg)
})

wa.on('disconnected', reason => {
  console.warn('⚠️   WhatsApp disconnected:', reason)
  console.warn('    Restart the bridge to reconnect.')
})

wa.on('message', async msg => {
  // Skip groups, broadcast, and non-text messages
  if (msg.from.endsWith('@g.us'))             return
  if (msg.from === 'status@broadcast')        return
  if (msg.type !== 'chat')                    return  // ignore media/stickers/etc

  const phone      = normalizePhone(msg.from)
  const senderName = msg._data?.notifyName ?? phone
  const phoneAlt   = normalizePhone(senderName)   // LID contacts show real phone as their name
  const content    = msg.body?.trim() ?? ''

  if (!content) return

  const ts = new Date().toLocaleTimeString('en-GB')
  console.log(`[${ts}] 📩  +${phone} (${senderName}): ${content.slice(0, 80)}`)

  const inquiry = await findInquiryByPhone(phone) ?? await findInquiryByPhone(phoneAlt)

  if (inquiry != null) {
    console.log(`         → matched: inquiry ${inquiry.id} — ${inquiry.angler_name}`)
    await Promise.all([
      logLeadMessage({
        inquiryId:   inquiry.id,
        direction:   'inbound',
        contactName: senderName,
        content,
      }),
      touchLastContact(inquiry.id),
    ])
  } else {
    console.log(`         → no match — saved to unmatched_messages`)
    await logUnmatched({
      phone,
      senderName,
      content,
      rawPayload: {
        from:      msg.from,
        timestamp: msg.timestamp,
        type:      msg.type,
      },
    })
  }
})

wa.initialize()

// ─── HTTP API ──────────────────────────────────────────────────────────────────
// Used by the Next.js admin panel to send outbound WhatsApp messages.
//
// GET  /health
//   → { ok: true, state: "CONNECTED" }
//
// POST /send
//   body: { inquiryId: string, message: string }
//   → looks up angler_phone from DB, sends message, logs to lead_messages
//
// POST /send
//   body: { phone: string, message: string }
//   → sends to a raw phone number (no inquiry logging)

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')) }
      catch { reject(new Error('Invalid JSON')) }
    })
  })
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // GET /health
  if (req.url === '/health' && req.method === 'GET') {
    const state = await wa.getState().catch(() => 'UNKNOWN')
    json(res, 200, { ok: true, state })
    return
  }

  // POST /send
  if (req.url === '/send' && req.method === 'POST') {
    let body
    try { body = await readBody(req) }
    catch { json(res, 400, { ok: false, error: 'Invalid JSON' }); return }

    const { inquiryId, message, phone: rawPhone } = body

    if (!message?.trim()) {
      json(res, 400, { ok: false, error: 'message is required' }); return
    }

    try {
      if (inquiryId) {
        // Resolve phone from inquiry
        const { data: inq, error } = await supabase
          .from('inquiries')
          .select('angler_name, angler_phone')
          .eq('id', inquiryId)
          .single()

        if (error || !inq) {
          json(res, 404, { ok: false, error: 'Inquiry not found' }); return
        }
        if (!inq.angler_phone) {
          json(res, 400, { ok: false, error: 'Inquiry has no angler_phone — add the phone number first' }); return
        }

        const chatId = `${normalizePhone(inq.angler_phone)}@c.us`
        await wa.sendMessage(chatId, message.trim())

        await Promise.all([
          logLeadMessage({
            inquiryId,
            direction:   'outbound',
            contactName: inq.angler_name ?? chatId,
            content:     message.trim(),
          }),
          touchLastContact(inquiryId),
        ])

        const ts = new Date().toLocaleTimeString('en-GB')
        console.log(`[${ts}] 📤  → ${inq.angler_name} (${inq.angler_phone}): ${message.slice(0, 80)}`)
        json(res, 200, { ok: true })

      } else if (rawPhone) {
        // Raw phone — no inquiry logging
        const chatId = `${normalizePhone(rawPhone)}@c.us`
        await wa.sendMessage(chatId, message.trim())
        json(res, 200, { ok: true })

      } else {
        json(res, 400, { ok: false, error: 'Provide inquiryId or phone' })
      }
    } catch (err) {
      console.error('  [send] error:', err.message)
      json(res, 500, { ok: false, error: err.message })
    }
    return
  }

  res.writeHead(404); res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🌐  HTTP API → http://localhost:${PORT}`)
  console.log(`    POST /send  { inquiryId, message }  — send outbound WhatsApp`)
  console.log(`    GET  /health                        — connection status\n`)
})
