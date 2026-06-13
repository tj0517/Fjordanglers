'use client'

/**
 * ConversationImporter
 *
 * Paste a raw conversation (WhatsApp export, email thread, plain text) →
 * auto-parse into individual messages → review & edit → bulk-save as
 * lead_messages with Markdown-formatted content.
 *
 * Supported input formats:
 *   1. WhatsApp bracket  : [DD/MM/YYYY, HH:MM:SS] Name: text
 *   2. WhatsApp dash     : DD/MM/YYYY, HH:MM - Name: text
 *   3. Labelled lines    : Name: text (multi-line messages supported)
 *   4. Fallback          : each paragraph = one message
 *
 * Storage format:
 *   content is stored as clean Markdown text so AI agents and future
 *   Zoho / WhatsApp webhook integrations can read the same schema.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, X, Check, Loader2, ChevronDown, ChevronUp,
  ArrowDownLeft, ArrowUpRight, Trash2,
} from 'lucide-react'
import { bulkLogLeadMessages, type BulkLeadMessage } from '@/actions/inquiries'

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel   = 'whatsapp' | 'email' | 'note'
type Direction = 'inbound'  | 'outbound'

interface ParsedMsg {
  id:          string
  senderName:  string
  text:        string          // raw parsed text
  timestamp:   string | null  // ISO string
  direction:   Direction
  keep:        boolean
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function tryParseDate(dateStr: string, timeStr: string): string | null {
  try {
    const parts = dateStr.split('/').map(Number)
    if (parts.length !== 3) return null
    const [day, month, year] = parts
    const [hours, minutes]   = timeStr.split(':').map(Number)
    if (!day || !month || !year) return null
    const d = new Date(year < 100 ? 2000 + year : year, month - 1, day, hours ?? 0, minutes ?? 0)
    return isNaN(d.getTime()) ? null : d.toISOString()
  } catch {
    return null
  }
}

function toMarkdown(text: string): string {
  // Preserve line breaks; escape any leading # that aren't intentional headings
  return text.trim()
}


export function parseConversation(
  raw:                string,
  myName:             string,
  defaultContactName: string,
): ParsedMsg[] {
  // Support space/comma-separated identifiers, e.g. "Tymon fjordanglers"
  // so FjordAnglers automated emails also match as outbound.
  const meTokens = myName.trim().toLowerCase().split(/[\s,]+/).filter(Boolean)
  const isMe = (sender: string, rawFrom = '') => {
    const s = sender.toLowerCase()
    const f = rawFrom.toLowerCase()
    return meTokens.some(t => t.length > 0 && (s.includes(t) || f.includes(t)))
  }

  // ── 1. WhatsApp bracket: [DD/MM/YYYY, HH:MM(:SS)] Name: text ──────────────
  const bracketRe = /\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:\n]+?):\s*([\s\S]+?)(?=\n\[[\d]|$)/g
  const bracketHits = [...raw.matchAll(bracketRe)]
  if (bracketHits.length >= 2) {
    return bracketHits.map((m, i) => {
      const sender = m[3].trim()
      return {
        id:         String(i),
        senderName: sender,
        text:       m[4].trim(),
        timestamp:  tryParseDate(m[1], m[2]),
        direction:  isMe(sender) ? 'outbound' : 'inbound',
        keep:       true,
      }
    })
  }

  // ── 2. WhatsApp dash: DD/MM/YYYY, HH:MM - Name: text ─────────────────────
  const dashRe = /(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2})\s*-\s*([^:\n]+?):\s*([\s\S]+?)(?=\n\d{1,2}\/\d{1,2}\/|$)/g
  const dashHits = [...raw.matchAll(dashRe)]
  if (dashHits.length >= 2) {
    return dashHits.map((m, i) => {
      const sender = m[3].trim()
      return {
        id:         String(i),
        senderName: sender,
        text:       m[4].trim(),
        timestamp:  tryParseDate(m[1], m[2]),
        direction:  isMe(sender) ? 'outbound' : 'inbound',
        keep:       true,
      }
    })
  }

  // ── 3. Labelled lines: Name: text (multi-line bodies) ─────────────────────
  // A "label" must start with a capital, be ≤ 40 chars, contain no digits
  const labelRe = /^([A-ZÄÖÜA-Za-zÀ-ÿ][^:\d\n]{1,39}):\s*([\s\S]+?)(?=\n[A-ZÄÖÜA-Za-zÀ-ÿ][^:\d\n]{1,39}:|$)/gm
  const labelHits = [...raw.matchAll(labelRe)]
  if (labelHits.length >= 2) {
    return labelHits.map((m, i) => {
      const sender = m[1].trim()
      return {
        id:         String(i),
        senderName: sender,
        text:       m[2].trim(),
        timestamp:  null,
        direction:  isMe(sender) ? 'outbound' : 'inbound',
        keep:       true,
      }
    })
  }

  // ── 4. Fallback: paragraphs ────────────────────────────────────────────────
  return raw
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map((text, i) => ({
      id:         String(i),
      senderName: defaultContactName,
      text,
      timestamp:  null,
      direction:  'inbound' as Direction,
      keep:       true,
    }))
}

// ─── Component ────────────────────────────────────────────────────────────────

const CHANNEL_META: Record<Channel, { label: string; color: string; bg: string; icon: string }> = {
  whatsapp: { label: 'WhatsApp', color: '#15803D', bg: 'rgba(21,128,61,0.1)',  icon: '💬' },
  email:    { label: 'Email',    color: '#1D4ED8', bg: 'rgba(29,78,216,0.1)',  icon: '✉️' },
  note:     { label: 'Note',     color: '#6D28D9', bg: 'rgba(109,40,217,0.1)', icon: '📝' },
}

interface Props {
  inquiryId:      string
  anglerName:     string
  guideName:      string | null
  onSaved:        () => void
}

export function ConversationImporter({ inquiryId, anglerName, guideName, onSaved }: Props) {
  const router           = useRouter()
  const [pending, start] = useTransition()

  // ── UI state ────────────────────────────────────────────────────────────────
  const [open,        setOpen]        = useState(false)
  const [step,        setStep]        = useState<'paste' | 'review'>('paste')
  const [raw,         setRaw]         = useState('')
  const [channel,     setChannel]     = useState<Channel>('whatsapp')
  const [myName,      setMyName]      = useState('Tymon')
  const [contactName, setContactName] = useState(anglerName)
  const [contactType, setContactType] = useState<'client' | 'guide'>('client')
  const [msgs,        setMsgs]        = useState<ParsedMsg[]>([])
  const [flash,       setFlash]       = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  // ── Parse ───────────────────────────────────────────────────────────────────
  function handleParse() {
    if (raw.trim() === '') return
    const parsed = parseConversation(raw, myName, contactName)
    setMsgs(parsed)
    setStep('review')
    setError(null)
  }

  function reset() {
    setStep('paste')
    setRaw('')
    setMsgs([])
    setError(null)
    setFlash(null)
  }

  function toggleDirection(id: string) {
    setMsgs(prev => prev.map(m =>
      m.id === id
        ? { ...m, direction: m.direction === 'inbound' ? 'outbound' : 'inbound' }
        : m
    ))
  }

  function toggleKeep(id: string) {
    setMsgs(prev => prev.map(m =>
      m.id === id ? { ...m, keep: !m.keep } : m
    ))
  }

  function updateSender(id: string, name: string) {
    setMsgs(prev => prev.map(m => m.id === id ? { ...m, senderName: name } : m))
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  function handleSave() {
    const toSave = msgs.filter(m => m.keep && m.text.trim() !== '')
    if (toSave.length === 0) return
    setError(null)

    const bulk: BulkLeadMessage[] = toSave.map(m => ({
      direction:   m.direction,
      channel,
      contactType,
      contactName: m.senderName.trim() || contactName,
      content:     toMarkdown(m.text),
      createdAt:   m.timestamp ?? undefined,
    }))

    start(async () => {
      const res = await bulkLogLeadMessages(inquiryId, bulk)
      if (res.success) {
        setFlash(`Saved ${res.count} message${(res.count ?? 0) !== 1 ? 's' : ''}`)
        setTimeout(() => {
          setFlash(null)
          reset()
          setOpen(false)
          onSaved()
          router.refresh()
        }, 1800)
      } else {
        setError(res.error)
      }
    })
  }

  const keepCount = msgs.filter(m => m.keep).length

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Toggle button ────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => { setOpen(v => !v); if (open) reset() }}
        className="flex items-center gap-2 px-3.5 py-2 rounded-[14px] text-xs font-semibold f-body transition-all w-full"
        style={{
          background: open ? 'rgba(10,46,77,0.1)' : 'rgba(10,46,77,0.05)',
          color:      'rgba(10,46,77,0.65)',
          border:     '1px solid rgba(10,46,77,0.12)',
        }}
      >
        <Upload size={12} style={{ flexShrink: 0 }} />
        Import conversation
        {open ? <ChevronUp size={12} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={12} style={{ marginLeft: 'auto' }} />}
      </button>

      {/* ── Panel ────────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="mt-2 rounded-[18px] overflow-hidden"
          style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.1)' }}
        >

          {/* ── Step 1: Paste ──────────────────────────────────────────── */}
          {step === 'paste' && (
            <div className="p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] f-body"
                style={{ color: 'rgba(10,46,77,0.38)' }}>
                Paste conversation
              </p>

              {/* Channel */}
              <div className="flex gap-1.5 flex-wrap">
                {(['whatsapp', 'email', 'note'] as Channel[]).map(ch => {
                  const m = CHANNEL_META[ch]
                  return (
                    <button key={ch} type="button"
                      onClick={() => setChannel(ch)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold f-body transition-all"
                      style={{
                        background: channel === ch ? m.bg            : 'rgba(10,46,77,0.05)',
                        color:      channel === ch ? m.color         : 'rgba(10,46,77,0.45)',
                        border:     `1px solid ${channel === ch ? m.color + '40' : 'rgba(10,46,77,0.1)'}`,
                      }}>
                      {m.icon} {m.label}
                    </button>
                  )
                })}
              </div>

              {/* Contact type */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {(['client', 'guide'] as const).map(ct => (
                    <button key={ct} type="button"
                      onClick={() => {
                        setContactType(ct)
                        setContactName(ct === 'guide' ? (guideName ?? '') : anglerName)
                      }}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold f-body transition-all"
                      style={{
                        background: contactType === ct ? 'rgba(10,46,77,0.1)'  : 'rgba(10,46,77,0.05)',
                        color:      contactType === ct ? '#0A2E4D'              : 'rgba(10,46,77,0.45)',
                        border:     `1px solid ${contactType === ct ? 'rgba(10,46,77,0.25)' : 'rgba(10,46,77,0.1)'}`,
                      }}>
                      {ct === 'client' ? '🎣' : '⚓'} {ct === 'client' ? 'Client' : 'Guide'}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Their name in conversation"
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs f-body outline-none"
                  style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.12)', color: '#0A2E4D', minWidth: 0 }}
                />
              </div>

              {/* My name */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold f-body flex-shrink-0"
                  style={{ color: 'rgba(10,46,77,0.45)', minWidth: 70 }}>
                  My name
                </span>
                <input
                  type="text"
                  value={myName}
                  onChange={e => setMyName(e.target.value)}
                  placeholder='e.g. "Tymon fjordanglers" — space-separated'
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs f-body outline-none"
                  style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.12)', color: '#0A2E4D' }}
                />
              </div>

              {/* Paste textarea */}
              <textarea
                value={raw}
                onChange={e => setRaw(e.target.value)}
                placeholder={`Paste conversation here…\n\nSupported formats:\n• Email thread (Gmail/Outlook) — From: / Date: headers or "On … wrote:"\n• WhatsApp export — [12/06/2026, 14:23:45] Name: message\n• WhatsApp mobile — 12/06/2026, 14:23 - Name: message\n• Labelled lines — Name: message\n• Plain paragraphs (each paragraph = one message)`}
                rows={8}
                className="w-full px-3 py-2.5 rounded-xl text-xs f-body outline-none resize-y"
                style={{
                  background:  '#fff',
                  border:      '1px solid rgba(10,46,77,0.12)',
                  color:       '#0A2E4D',
                  lineHeight:  '1.6',
                  fontFamily:  'monospace',
                }}
              />

              <button
                type="button"
                onClick={handleParse}
                disabled={raw.trim() === ''}
                className="w-full py-2.5 rounded-xl text-xs font-bold f-body transition-all"
                style={{
                  background: raw.trim() !== '' ? '#0A2E4D' : 'rgba(10,46,77,0.08)',
                  color:      raw.trim() !== '' ? '#fff'    : 'rgba(10,46,77,0.3)',
                  cursor:     raw.trim() === '' ? 'not-allowed' : 'pointer',
                }}
              >
                Parse conversation →
              </button>
            </div>
          )}

          {/* ── Step 2: Review ─────────────────────────────────────────── */}
          {step === 'review' && (
            <div className="p-4 space-y-3">

              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] f-body"
                  style={{ color: 'rgba(10,46,77,0.38)' }}>
                  Review {msgs.length} parsed message{msgs.length !== 1 ? 's' : ''}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1 text-[10px] f-body font-semibold"
                  style={{ color: 'rgba(10,46,77,0.4)' }}
                >
                  ← Edit paste
                </button>
              </div>

              {/* Message cards */}
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {msgs.map(msg => (
                  <div
                    key={msg.id}
                    className="px-3 py-2.5 rounded-[14px] transition-opacity"
                    style={{
                      background: msg.keep ? '#fff' : 'rgba(10,46,77,0.03)',
                      border:     `1px solid ${msg.keep ? 'rgba(10,46,77,0.1)' : 'rgba(10,46,77,0.06)'}`,
                      opacity:    msg.keep ? 1 : 0.45,
                    }}
                  >
                    {/* Message meta row */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {/* Direction toggle */}
                      <button
                        type="button"
                        onClick={() => toggleDirection(msg.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold f-body transition-all"
                        style={{
                          background: msg.direction === 'inbound'
                            ? 'rgba(6,95,70,0.1)'
                            : 'rgba(146,64,14,0.1)',
                          color: msg.direction === 'inbound' ? '#065F46' : '#92400E',
                          border: `1px solid ${msg.direction === 'inbound' ? 'rgba(6,95,70,0.25)' : 'rgba(146,64,14,0.25)'}`,
                        }}
                      >
                        {msg.direction === 'inbound'
                          ? <ArrowDownLeft size={9} />
                          : <ArrowUpRight  size={9} />
                        }
                        {msg.direction}
                      </button>

                      {/* Sender name (editable inline) */}
                      <input
                        type="text"
                        value={msg.senderName}
                        onChange={e => updateSender(msg.id, e.target.value)}
                        className="text-[10px] font-bold f-body bg-transparent outline-none border-b"
                        style={{
                          color:       '#0A2E4D',
                          borderColor: 'rgba(10,46,77,0.15)',
                          width:       Math.max(60, msg.senderName.length * 7),
                        }}
                      />

                      {/* Timestamp */}
                      {msg.timestamp != null && (
                        <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
                          {new Date(msg.timestamp).toLocaleString('en-GB', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      )}

                      {/* Delete/restore */}
                      <button
                        type="button"
                        onClick={() => toggleKeep(msg.id)}
                        className="ml-auto p-0.5 rounded transition-opacity hover:opacity-70"
                        title={msg.keep ? 'Remove this message' : 'Restore'}
                      >
                        {msg.keep
                          ? <Trash2 size={11} style={{ color: 'rgba(10,46,77,0.3)' }} />
                          : <span className="text-[10px] f-body" style={{ color: '#15803D' }}>restore</span>
                        }
                      </button>
                    </div>

                    {/* Message text preview */}
                    <p
                      className="text-xs f-body leading-relaxed"
                      style={{
                        color:      '#374151',
                        whiteSpace: 'pre-wrap',
                        maxHeight:  '80px',
                        overflow:   'hidden',
                        WebkitMaskImage: msg.text.length > 200
                          ? 'linear-gradient(to bottom, black 60%, transparent)'
                          : undefined,
                      }}
                    >
                      {msg.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Flash / error */}
              {flash != null && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <Check size={12} style={{ color: '#059669' }} />
                  <p className="text-xs f-body font-semibold" style={{ color: '#059669' }}>{flash}</p>
                </div>
              )}
              {error != null && (
                <p className="text-xs f-body" style={{ color: '#DC2626' }}>{error}</p>
              )}

              {/* Save button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={pending || keepCount === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body transition-all"
                style={{
                  background: keepCount > 0 && !pending ? '#0A2E4D' : 'rgba(10,46,77,0.08)',
                  color:      keepCount > 0 && !pending ? '#fff'    : 'rgba(10,46,77,0.3)',
                  cursor:     keepCount === 0 || pending ? 'not-allowed' : 'pointer',
                  boxShadow:  keepCount > 0 && !pending ? '0 4px 14px rgba(10,46,77,0.18)' : 'none',
                }}
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                {pending
                  ? 'Saving…'
                  : `Save ${keepCount} message${keepCount !== 1 ? 's' : ''} as Markdown`
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
