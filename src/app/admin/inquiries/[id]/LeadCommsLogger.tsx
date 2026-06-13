'use client'

/**
 * LeadCommsLogger — conversation timeline + manual log form.
 *
 * Shows all lead_messages for an inquiry in a chat-like timeline,
 * then provides a form to log a new inbound/outbound message.
 *
 * No email is sent — purely internal CRM record.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, MessagesSquare } from 'lucide-react'
import { logLeadMessage, type LeadMessage } from '@/actions/inquiries'
import { ConversationImporter } from './ConversationImporter'

type Channel     = 'whatsapp' | 'email' | 'note'
type Direction   = 'inbound' | 'outbound'
type ContactType = 'client' | 'guide'

const CHANNEL_META: Record<Channel, { label: string; color: string; bg: string; border: string; icon: string }> = {
  whatsapp: { label: 'WhatsApp', color: '#15803D', bg: 'rgba(21,128,61,0.1)',   border: 'rgba(21,128,61,0.25)',  icon: '💬' },
  email:    { label: 'Email',    color: '#1D4ED8', bg: 'rgba(29,78,216,0.1)',   border: 'rgba(29,78,216,0.25)',  icon: '✉️' },
  note:     { label: 'Note',     color: '#6D28D9', bg: 'rgba(109,40,217,0.1)',  border: 'rgba(109,40,217,0.25)', icon: '📝' },
}

const DIRECTION_META: Record<Direction, { label: string; color: string; bg: string; border: string }> = {
  inbound:  { label: 'Inbound',  color: '#065F46', bg: 'rgba(6,95,70,0.1)',  border: 'rgba(6,95,70,0.25)'  },
  outbound: { label: 'Outbound', color: '#92400E', bg: 'rgba(146,64,14,0.1)', border: 'rgba(146,64,14,0.25)' },
}

function fmtMsgDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  inquiryId:       string
  initialMessages: LeadMessage[]
  anglerName:      string
  guideName:       string | null
}

export function LeadCommsLogger({ inquiryId, initialMessages, anglerName, guideName }: Props) {
  const router        = useRouter()
  const [pending, start] = useTransition()
  const [flash, setFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [channel,     setChannel]     = useState<Channel>('whatsapp')
  const [direction,   setDirection]   = useState<Direction>('inbound')
  const [contactType, setContactType] = useState<ContactType>('client')
  const [contactName, setContactName] = useState(anglerName)
  const [content,     setContent]     = useState('')

  function handleContactTypeChange(ct: ContactType) {
    setContactType(ct)
    // Auto-fill name from known context
    setContactName(ct === 'guide' ? (guideName ?? '') : anglerName)
  }

  function handleSubmit() {
    if (content.trim() === '') return
    setError(null)
    start(async () => {
      const res = await logLeadMessage(inquiryId, {
        direction, channel, contactType,
        contactName: contactName.trim() || (contactType === 'guide' ? (guideName ?? 'Guide') : anglerName),
        content,
      })
      if (res.success) {
        setContent('')
        setFlash(true)
        setTimeout(() => setFlash(false), 3000)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="rounded-[22px] overflow-hidden"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>

      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="px-6 py-4 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(230,126,80,0.03)' }}>
        <MessagesSquare size={14} style={{ color: '#E67E50', flexShrink: 0 }} />
        <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Communications</h2>
        {initialMessages.length > 0 && (
          <span className="text-[10px] font-bold f-body px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(230,126,80,0.12)', color: '#E67E50', border: '1px solid rgba(230,126,80,0.2)' }}>
            {initialMessages.length}
          </span>
        )}
      </div>

      {/* ─── Timeline ──────────────────────────────────────────── */}
      {initialMessages.length > 0 ? (
        <div className="px-6 py-4 space-y-4"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
          {initialMessages.map(msg => {
            const ch  = CHANNEL_META[msg.channel as Channel]  ?? CHANNEL_META.note
            const dir = DIRECTION_META[msg.direction as Direction] ?? DIRECTION_META.inbound
            const isOut = msg.direction === 'outbound'

            return (
              <div key={msg.id} className={`flex gap-3 ${isOut ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold f-body"
                  style={{
                    background: isOut ? 'rgba(230,126,80,0.15)' : 'rgba(10,46,77,0.1)',
                    color:      isOut ? '#E67E50'                : '#0A2E4D',
                  }}>
                  {msg.contact_type === 'guide' ? 'G' : msg.contact_name.charAt(0).toUpperCase()}
                </div>

                <div className={`flex-1 min-w-0 flex flex-col ${isOut ? 'items-end' : 'items-start'}`}>
                  {/* Meta badges */}
                  <div className={`flex items-center gap-1.5 mb-1.5 flex-wrap ${isOut ? 'justify-end' : ''}`}>
                    <span className="text-[11px] font-bold f-body" style={{ color: '#0A2E4D' }}>
                      {msg.contact_name}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded f-body"
                      style={{ background: ch.bg, color: ch.color, border: `1px solid ${ch.border}` }}>
                      {ch.icon} {ch.label}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded f-body"
                      style={{ background: dir.bg, color: dir.color, border: `1px solid ${dir.border}` }}>
                      {dir.label}
                    </span>
                    <span className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                      {fmtMsgDate(msg.created_at)}
                    </span>
                  </div>

                  {/* Bubble */}
                  <div
                    className="px-3 py-2.5 rounded-xl text-sm f-body leading-relaxed"
                    style={{
                      background:  isOut ? 'rgba(230,126,80,0.07)' : 'rgba(10,46,77,0.04)',
                      border:      isOut ? '1px solid rgba(230,126,80,0.18)' : '1px solid rgba(10,46,77,0.07)',
                      color:       '#374151',
                      whiteSpace:  'pre-wrap',
                      maxWidth:    '90%',
                    }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="px-6 py-5"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
          <p className="text-xs f-body text-center" style={{ color: 'rgba(10,46,77,0.35)' }}>
            No messages logged yet.
          </p>
        </div>
      )}

      {/* ─── Log form ──────────────────────────────────────────── */}
      <div className="px-6 py-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}>
            Log communication
          </p>
        </div>

        {/* Import conversation */}
        <ConversationImporter
          inquiryId={inquiryId}
          anglerName={anglerName}
          guideName={guideName}
          onSaved={() => router.refresh()}
        />

        {/* Channel + Direction pills */}
        <div className="flex flex-wrap gap-2">
          {/* Channel */}
          <div className="flex gap-1 flex-wrap">
            {(['whatsapp', 'email', 'note'] as Channel[]).map(ch => {
              const m = CHANNEL_META[ch]
              return (
                <button
                  key={ch} type="button"
                  onClick={() => setChannel(ch)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold f-body transition-all"
                  style={{
                    background: channel === ch ? m.bg               : 'rgba(10,46,77,0.05)',
                    color:      channel === ch ? m.color            : 'rgba(10,46,77,0.45)',
                    border:     channel === ch ? `1px solid ${m.border}` : '1px solid rgba(10,46,77,0.1)',
                  }}>
                  {m.icon} {m.label}
                </button>
              )
            })}
          </div>

          {/* Direction */}
          <div className="flex gap-1">
            {(['inbound', 'outbound'] as Direction[]).map(dir => {
              const m = DIRECTION_META[dir]
              return (
                <button
                  key={dir} type="button"
                  onClick={() => setDirection(dir)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold f-body transition-all"
                  style={{
                    background: direction === dir ? m.bg               : 'rgba(10,46,77,0.05)',
                    color:      direction === dir ? m.color            : 'rgba(10,46,77,0.45)',
                    border:     direction === dir ? `1px solid ${m.border}` : '1px solid rgba(10,46,77,0.1)',
                  }}>
                  {dir === 'inbound' ? '↙' : '↗'} {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Contact type + name */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 flex-shrink-0">
            {(['client', 'guide'] as ContactType[]).map(ct => (
              <button
                key={ct} type="button"
                onClick={() => handleContactTypeChange(ct)}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold f-body transition-all"
                style={{
                  background: contactType === ct ? 'rgba(10,46,77,0.1)'   : 'rgba(10,46,77,0.05)',
                  color:      contactType === ct ? '#0A2E4D'               : 'rgba(10,46,77,0.45)',
                  border:     contactType === ct ? '1px solid rgba(10,46,77,0.25)' : '1px solid rgba(10,46,77,0.1)',
                }}>
                {ct === 'client' ? '🎣' : '⚓'} {ct === 'client' ? 'Client' : 'Guide'}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={contactName}
            onChange={e => setContactName(e.target.value)}
            placeholder="Contact name"
            className="flex-1 px-3 py-1.5 rounded-xl text-xs f-body outline-none"
            style={{
              background: 'rgba(10,46,77,0.04)',
              border:     '1px solid rgba(10,46,77,0.1)',
              color:      '#0A2E4D',
              minWidth:   0,
            }}
          />
        </div>

        {/* Content */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Paste message content or write a note…"
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none resize-none"
          style={{
            background: 'rgba(10,46,77,0.04)',
            border:     '1px solid rgba(10,46,77,0.1)',
            color:      '#0A2E4D',
          }}
        />

        {flash && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <Check size={12} style={{ color: '#059669' }} />
            <p className="text-xs f-body font-semibold" style={{ color: '#059669' }}>Logged</p>
          </div>
        )}
        {error != null && (
          <p className="text-xs f-body" style={{ color: '#DC2626' }}>{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || content.trim() === ''}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body transition-all"
          style={{
            background: !pending && content.trim() !== '' ? '#0A2E4D' : 'rgba(10,46,77,0.1)',
            color:      !pending && content.trim() !== '' ? '#FFFFFF' : 'rgba(10,46,77,0.3)',
            cursor:     pending || content.trim() === '' ? 'not-allowed' : 'pointer',
            boxShadow:  !pending && content.trim() !== '' ? '0 4px 14px rgba(10,46,77,0.18)' : 'none',
          }}
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          {pending ? 'Logging…' : 'Log message'}
        </button>
      </div>
    </div>
  )
}
