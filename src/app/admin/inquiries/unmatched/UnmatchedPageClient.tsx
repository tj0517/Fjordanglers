'use client'

import { useState, useTransition } from 'react'
import { MessageSquare, Mail, Link2, Trash2 } from 'lucide-react'
import { UnmatchedLinker } from './UnmatchedLinker'
import { deleteUnmatchedMessages } from '@/actions/inquiries'

type LinkerMode =
  | { kind: 'single'; msg: UnmatchedMessage }
  | { kind: 'bulk';   ids: string[] }

interface UnmatchedMessage {
  id:              string
  source:          'whatsapp' | 'email'
  from_identifier: string
  sender_name:     string
  content:         string
  created_at:      string
}

interface InquiryOption {
  id:           string
  angler_name:  string
  angler_email: string
  angler_phone: string | null
  status:       string
  created_at:   string
}

interface Props {
  messages:  UnmatchedMessage[]
  inquiries: InquiryOption[]
}

const SOURCE_META = {
  whatsapp: { label: 'WhatsApp', color: '#15803D', bg: 'rgba(21,128,61,0.1)',  border: 'rgba(21,128,61,0.25)',  icon: <MessageSquare size={12} strokeWidth={1.8} /> },
  email:    { label: 'Email',    color: '#1D4ED8', bg: 'rgba(29,78,216,0.1)',  border: 'rgba(29,78,216,0.25)',  icon: <Mail size={12} strokeWidth={1.8} /> },
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function UnmatchedPageClient({ messages: initial, inquiries }: Props) {
  const [messages, setMessages]      = useState(initial)
  const [selected, setSelected]      = useState<Set<string>>(new Set())
  const [linker, setLinker]          = useState<LinkerMode | null>(null)
  const [isPending, startTransition] = useTransition()

  const allSelected = messages.length > 0 && selected.size === messages.length

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(messages.map(m => m.id)))
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleDelete() {
    const ids = [...selected]
    startTransition(async () => {
      const res = await deleteUnmatchedMessages(ids)
      if (res.success) {
        setMessages(prev => prev.filter(m => !selected.has(m.id)))
        setSelected(new Set())
      }
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="f-display font-bold text-[22px]" style={{ color: '#0A2E4D' }}>
            Unmatched Messages
          </h1>
          <p className="text-sm f-body mt-1" style={{ color: '#6B7280' }}>
            Incoming WhatsApp and email messages that couldn&apos;t be auto-matched to an inquiry.
          </p>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLinker({ kind: 'bulk', ids: [...selected] })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold f-body transition-all"
              style={{
                background: 'rgba(10,46,77,0.08)',
                color:      '#0A2E4D',
                border:     '1px solid rgba(10,46,77,0.2)',
              }}
            >
              <Link2 size={14} strokeWidth={2} />
              Link {selected.size} to inquiry
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold f-body transition-all"
              style={{
                background: isPending ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.1)',
                color:      '#DC2626',
                border:     '1px solid rgba(239,68,68,0.25)',
                opacity:    isPending ? 0.6 : 1,
              }}
            >
              <Trash2 size={14} strokeWidth={2} />
              Delete {selected.size}
            </button>
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(10,46,77,0.04)', border: '1px dashed rgba(10,46,77,0.15)' }}
        >
          <p className="text-sm f-body" style={{ color: '#9CA3AF' }}>
            No unmatched messages — great job!
          </p>
        </div>
      )}

      {messages.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(10,46,77,0.1)', background: '#fff' }}
        >
          {/* Table header */}
          <div
            className="grid text-xs font-semibold f-body px-4 py-3 uppercase tracking-wide items-center"
            style={{
              gridTemplateColumns: '36px 100px 180px 1fr 130px 110px',
              background: 'rgba(10,46,77,0.03)',
              borderBottom: '1px solid rgba(10,46,77,0.08)',
              color: '#6B7280',
            }}
          >
            {/* Select all checkbox */}
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 cursor-pointer accent-[#E67E50]"
            />
            <span>Source</span>
            <span>From</span>
            <span>Message</span>
            <span>Received</span>
            <span></span>
          </div>

          {messages.map((msg, i) => {
            const meta       = SOURCE_META[msg.source]
            const isSelected = selected.has(msg.id)
            return (
              <div
                key={msg.id}
                className="grid items-center px-4 py-3 gap-3"
                style={{
                  gridTemplateColumns: '36px 100px 180px 1fr 130px 110px',
                  borderBottom: i < messages.length - 1 ? '1px solid rgba(10,46,77,0.06)' : 'none',
                  background: isSelected ? 'rgba(230,126,80,0.04)' : 'transparent',
                }}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(msg.id)}
                  className="w-4 h-4 cursor-pointer accent-[#E67E50]"
                />

                {/* Source badge */}
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold f-body px-2 py-1 rounded-full w-fit"
                  style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
                >
                  {meta.icon}
                  {meta.label}
                </span>

                {/* From */}
                <div className="min-w-0">
                  {msg.sender_name && (
                    <p className="text-sm font-medium f-body truncate" style={{ color: '#111827' }}>{msg.sender_name}</p>
                  )}
                  <p className="text-xs f-body truncate" style={{ color: '#6B7280' }}>{msg.from_identifier}</p>
                </div>

                {/* Content preview */}
                <p
                  className="text-sm f-body line-clamp-2"
                  style={{ color: '#374151' }}
                  title={msg.content}
                >
                  {msg.content}
                </p>

                {/* Date */}
                <p className="text-xs f-body" style={{ color: '#9CA3AF' }}>{fmtDate(msg.created_at)}</p>

                {/* Action */}
                <button
                  onClick={() => setLinker({ kind: 'single', msg })}
                  className="flex items-center gap-1.5 text-xs font-semibold f-body px-3 py-1.5 rounded-xl transition-all"
                  style={{
                    color:      '#0A2E4D',
                    background: 'rgba(10,46,77,0.08)',
                    border:     '1px solid rgba(10,46,77,0.15)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,46,77,0.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,46,77,0.08)' }}
                >
                  <Link2 size={12} strokeWidth={2} />
                  Link
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Linker modal */}
      {linker && (
        <UnmatchedLinker
          {...(linker.kind === 'single'
            ? {
                unmatchedId:    linker.msg.id,
                fromIdentifier: linker.msg.from_identifier,
                senderName:     linker.msg.sender_name,
              }
            : {
                unmatchedIds: linker.ids,
                bulkCount:    linker.ids.length,
              }
          )}
          inquiries={inquiries}
          onClose={() => setLinker(null)}
          onLinked={ids => {
            setMessages(prev => prev.filter(m => !ids.includes(m.id)))
            setSelected(new Set())
          }}
        />
      )}
    </div>
  )
}
