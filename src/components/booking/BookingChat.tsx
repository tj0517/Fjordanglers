'use client'

/**
 * BookingChat — live chat widget between guide and angler.
 *
 * Available on both sides (guide dashboard + angler account) from the moment
 * a booking is created, so they can discuss dates/details before confirmation.
 *
 * Features:
 * - Shows the original booking note (special_requests) as context at the top
 * - Lists all booking_messages ordered by time
 * - My messages right-aligned, other person's left-aligned
 * - Optimistic UI: message appears instantly, replaced/removed on server response
 * - Enter to send, Shift+Enter for new line
 * - Auto-scrolls to the latest message
 */

import { useState, useRef, useEffect, useTransition, useCallback } from 'react'
import { sendBookingMessage } from '@/actions/bookings'
import type { BookingMessage } from '@/actions/bookings'
import { Send, Loader2 } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  bookingId:          string
  initialMessages:    BookingMessage[]
  currentUserId:      string
  senderRole:         'guide' | 'angler'
  myName:             string
  otherName:          string
  /** The original booking request note (special_requests) shown as context. */
  bookingNote?:       string | null
  /** ISO timestamp of the booking creation — shown next to the booking note. */
  bookingNoteDate?:   string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function getInitial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase()
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function BookingChat({
  bookingId,
  initialMessages,
  currentUserId,
  senderRole,
  myName,
  otherName,
  bookingNote,
  bookingNoteDate,
}: Props) {
  const [messages, setMessages]   = useState<BookingMessage[]>(initialMessages)
  const [text, setText]           = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom whenever messages change
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  function handleSend() {
    const body = text.trim()
    if (!body || isPending) return

    setSendError(null)
    setText('')

    // Optimistic message
    const tempId = `optimistic-${Date.now()}`
    const optimistic: BookingMessage = {
      id:          tempId,
      booking_id:  bookingId,
      body,
      sender_id:   currentUserId,
      sender_role: senderRole,
      created_at:  new Date().toISOString(),
      read_at:     null,
    }
    setMessages(prev => [...prev, optimistic])

    startTransition(async () => {
      const result = await sendBookingMessage(bookingId, body)
      if (result.success) {
        // Replace optimistic with real message from DB
        setMessages(prev => prev.map(m => m.id === tempId ? result.message : m))
      } else {
        // Remove optimistic and show error
        setMessages(prev => prev.filter(m => m.id !== tempId))
        setSendError(result.error)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isMyMessage = (msg: BookingMessage) => msg.sender_role === senderRole

  // Avatar colours
  const myColor    = senderRole === 'guide' ? '#E67E50' : '#0A2E4D'
  const otherColor = senderRole === 'guide' ? '#0A2E4D' : '#E67E50'

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background:  '#FFFFFF',
        border:      '1px solid rgba(10,46,77,0.08)',
        boxShadow:   '0 1px 4px rgba(10,46,77,0.06)',
        maxHeight:   '520px',
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-5 py-3.5 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
      >
        <h2
          className="text-xs font-bold uppercase tracking-wider f-body"
          style={{ color: 'rgba(10,46,77,0.4)' }}
        >
          Messages
        </h2>
        {messages.length > 0 && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full f-body"
            style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.45)' }}
          >
            {messages.length}
          </span>
        )}
      </div>

      {/* ── Scrollable messages area ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

        {/* Booking note — original special_requests shown as context */}
        {bookingNote != null && bookingNote.trim() !== '' && (
          <div
            className="rounded-xl px-4 py-3 text-sm f-body"
            style={{
              background: 'rgba(10,46,77,0.03)',
              border:     '1px dashed rgba(10,46,77,0.12)',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 f-body"
              style={{ color: 'rgba(10,46,77,0.35)' }}>
              Booking request note
            </p>
            <p className="text-sm f-body leading-relaxed" style={{ color: '#374151' }}>
              &ldquo;{bookingNote}&rdquo;
            </p>
            {bookingNoteDate != null && (
              <p className="text-[11px] f-body mt-1.5" style={{ color: 'rgba(10,46,77,0.35)' }}>
                {fmtTime(bookingNoteDate)}
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && (bookingNote == null || bookingNote.trim() === '') && (
          <p className="text-sm f-body text-center py-4"
            style={{ color: 'rgba(10,46,77,0.3)' }}>
            No messages yet. Start the conversation!
          </p>
        )}

        {/* Messages */}
        {messages.map(msg => {
          const mine     = isMyMessage(msg)
          const isOptimistic = msg.id.startsWith('optimistic-')

          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold f-body flex-shrink-0 mt-0.5"
                style={{ background: mine ? myColor : otherColor, opacity: isOptimistic ? 0.7 : 1 }}
              >
                {getInitial(mine ? myName : otherName)}
              </div>

              {/* Bubble */}
              <div className={`max-w-[80%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <p className="text-[11px] f-body mb-1" style={{ color: 'rgba(10,46,77,0.38)' }}>
                  {mine ? 'You' : otherName}
                  {!isOptimistic && (
                    <span> · {fmtTime(msg.created_at)}</span>
                  )}
                  {isOptimistic && (
                    <span style={{ color: 'rgba(10,46,77,0.28)' }}> · Sending…</span>
                  )}
                </p>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm f-body leading-relaxed ${
                    mine ? 'rounded-tr-none' : 'rounded-tl-none'
                  }`}
                  style={{
                    background: mine
                      ? (senderRole === 'guide' ? '#E67E50' : '#0A2E4D')
                      : 'rgba(10,46,77,0.06)',
                    color:      mine ? '#fff' : '#374151',
                    opacity:    isOptimistic ? 0.7 : 1,
                  }}
                >
                  {msg.body.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < msg.body.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}

        {/* Auto-scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* ── Compose area ── */}
      <div
        className="flex-shrink-0 p-3"
        style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}
      >
        {sendError != null && (
          <p className="text-xs f-body mb-2 px-1" style={{ color: '#DC2626' }}>
            {sendError}
          </p>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${otherName}… (Enter to send, Shift+Enter for new line)`}
            rows={1}
            className="flex-1 resize-none rounded-xl text-sm f-body outline-none px-3.5 py-2.5"
            style={{
              background:  '#F8F7F5',
              border:      '1.5px solid rgba(10,46,77,0.1)',
              color:       '#0A2E4D',
              lineHeight:  '1.5',
              minHeight:   '42px',
              maxHeight:   '100px',
              overflowY:   'auto',
              transition:  'border-color 0.15s',
            }}
            onFocus={e  => (e.currentTarget.style.borderColor = senderRole === 'guide' ? '#E67E50' : '#0A2E4D')}
            onBlur={e   => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)')}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() || isPending}
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-opacity"
            style={{
              background: senderRole === 'guide' ? '#E67E50' : '#0A2E4D',
              color:      '#fff',
              opacity:    (!text.trim() || isPending) ? 0.4 : 1,
            }}
            aria-label="Send message"
          >
            {isPending
              ? <Loader2 size={16} className="animate-spin" />
              : <Send size={15} />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
