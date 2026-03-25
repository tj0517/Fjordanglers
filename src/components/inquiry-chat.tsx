'use client'

/**
 * InquiryChat — real-time chat panel for a trip inquiry.
 *
 * Works on both sides:
 *   - Guide dashboard  /dashboard/inquiries/[id]
 *   - Angler account   /account/trips/[id]
 *
 * Renders initial messages (SSR-fetched) then subscribes to new ones via
 * Supabase Realtime. Sends via the sendInquiryMessage server action.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendInquiryMessage } from '@/actions/inquiry-messages'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatMessage = {
  id: string
  sender_id: string
  sender_role: string
  body: string
  created_at: string
  read_at: string | null
}

type Props = {
  inquiryId: string
  currentUserId: string
  currentUserRole: 'angler' | 'guide' | 'admin'
  initialMessages: ChatMessage[]
  /** Display name of the other party */
  otherPartyName: string
  /** true = inquiry is closed, input is disabled */
  readOnly?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InquiryChat({
  inquiryId,
  currentUserId,
  currentUserRole,
  initialMessages,
  otherPartyName,
  readOnly = false,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const bottomRef  = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase   = createClient()

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`inquiry-chat-${inquiryId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'inquiry_messages',
          filter: `inquiry_id=eq.${inquiryId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage
          setMessages(prev => {
            // Dedup: ignore if we already have this id (optimistic insert)
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [inquiryId, supabase])

  // ── Auto-scroll to bottom on new messages ─────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send ──────────────────────────────────────────────────────────────────
  function handleSend() {
    const trimmed = draft.trim()
    if (!trimmed || isPending) return

    setError(null)

    // Optimistic insert
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      sender_id: currentUserId,
      sender_role: currentUserRole,
      body: trimmed,
      created_at: new Date().toISOString(),
      read_at: null,
    }
    setMessages(prev => [...prev, optimistic])
    setDraft('')
    textareaRef.current?.focus()

    startTransition(async () => {
      const result = await sendInquiryMessage(inquiryId, trimmed)
      if (result.error) {
        // Rollback optimistic message
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
        setDraft(trimmed)
        setError(result.error)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col"
      style={{
        background:   '#FDFAF7',
        borderRadius: '24px',
        border:       '1px solid rgba(10,46,77,0.08)',
        overflow:     'hidden',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
      >
        <div className="flex items-center gap-2.5">
          {/* Chat icon */}
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            stroke="#E67E50" strokeWidth="1.7" strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3l2 2 2-2h5a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" />
            <line x1="4" y1="6" x2="12" y2="6" />
            <line x1="4" y1="9" x2="8"  y2="9" />
          </svg>
          <h3
            className="text-sm font-semibold f-body"
            style={{ color: '#0A2E4D' }}
          >
            Chat with {otherPartyName}
          </h3>
        </div>

        {messages.length > 0 && (
          <span
            className="text-[10px] f-body"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </span>
        )}
      </div>

      {/* ── Message list ────────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-3 px-4 py-4 overflow-y-auto"
        style={{ maxHeight: 380, minHeight: 120 }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <svg
              width="28" height="28" viewBox="0 0 28 28" fill="none"
              stroke="rgba(10,46,77,0.2)" strokeWidth="1.4"
            >
              <path d="M24 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6l4 4 4-4h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
            </svg>
            <p
              className="text-xs f-body text-center"
              style={{ color: 'rgba(10,46,77,0.35)' }}
            >
              No messages yet.
              <br />
              Start the conversation!
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.sender_id === currentUserId

          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}
            >
              {/* Sender label */}
              <span
                className="text-[10px] font-semibold f-body px-1"
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                {isOwn ? 'You' : otherPartyName}
              </span>

              {/* Bubble */}
              <div
                className="px-3.5 py-2.5 max-w-[85%]"
                style={{
                  borderRadius: isOwn
                    ? '16px 16px 4px 16px'
                    : '16px 16px 16px 4px',
                  background: isOwn
                    ? '#0A2E4D'
                    : 'rgba(10,46,77,0.06)',
                  color: isOwn ? '#fff' : '#0A2E4D',
                  // Optimistic messages slightly dimmed
                  opacity: msg.id.startsWith('opt-') ? 0.65 : 1,
                }}
              >
                <p
                  className="text-sm f-body whitespace-pre-wrap leading-relaxed break-words"
                >
                  {msg.body}
                </p>
              </div>

              {/* Timestamp */}
              <span
                className="text-[9px] f-body px-1"
                style={{ color: 'rgba(10,46,77,0.3)' }}
              >
                {formatTime(msg.created_at)}
              </span>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ──────────────────────────────────────────────────── */}
      {!readOnly && (
        <div
          className="px-4 pb-4 pt-2"
          style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}
        >
          {error && (
            <p
              className="text-[11px] f-body mb-2 px-1"
              style={{ color: '#DC2626' }}
            >
              {error}
            </p>
          )}

          <div
            className="flex items-end gap-2"
            style={{
              background:   'rgba(10,46,77,0.04)',
              borderRadius: '14px',
              border:       '1px solid rgba(10,46,77,0.1)',
              padding:      '8px 8px 8px 14px',
            }}
          >
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send)"
              rows={1}
              disabled={isPending}
              aria-label="Message input"
              className="flex-1 resize-none bg-transparent text-sm f-body leading-relaxed focus:outline-none placeholder:text-[rgba(10,46,77,0.35)]"
              style={{
                color:     '#0A2E4D',
                maxHeight: '120px',
                overflow:  'auto',
              }}
              onInput={e => {
                // Auto-grow
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
              }}
            />

            <button
              onClick={handleSend}
              disabled={!draft.trim() || isPending}
              aria-label="Send message"
              className="flex-shrink-0 flex items-center justify-center rounded-xl transition-all"
              style={{
                width:      36,
                height:     36,
                background: draft.trim() && !isPending
                  ? '#E67E50'
                  : 'rgba(10,46,77,0.12)',
                cursor:     draft.trim() && !isPending ? 'pointer' : 'not-allowed',
              }}
            >
              {isPending ? (
                // Spinner
                <svg
                  width="14" height="14" viewBox="0 0 14 14"
                  stroke="rgba(10,46,77,0.5)" strokeWidth="2"
                  fill="none"
                  className="animate-spin"
                >
                  <circle cx="7" cy="7" r="5" strokeOpacity=".3" />
                  <path d="M7 2a5 5 0 0 1 5 5" />
                </svg>
              ) : (
                // Send arrow
                <svg
                  width="14" height="14" viewBox="0 0 14 14"
                  fill="none"
                  stroke={draft.trim() ? '#fff' : 'rgba(10,46,77,0.4)'}
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <line x1="2" y1="7" x2="12" y2="7" />
                  <polyline points="8,3 12,7 8,11" />
                </svg>
              )}
            </button>
          </div>

          <p
            className="text-[9px] f-body mt-1.5 px-1"
            style={{ color: 'rgba(10,46,77,0.25)' }}
          >
            Shift+Enter for new line
          </p>
        </div>
      )}

      {readOnly && (
        <div
          className="px-5 py-3 text-center"
          style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}
        >
          <p
            className="text-xs f-body"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            This inquiry is closed — messages are read-only.
          </p>
        </div>
      )}
    </div>
  )
}
