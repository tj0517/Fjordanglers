'use client'

/**
 * BookingChat — real-time chat thread for a single booking.
 *
 * Messages flow:
 *  1. Own send  → optimistic immediately, replaced by confirmed DB row when server action returns
 *  2. Partner   → Supabase Realtime (postgres_changes INSERT) + router.refresh() as safety net
 *  3. Sync      → useEffect merges new initialMessages (from server re-render) into local state
 *
 * Enter = send, Shift+Enter = newline.
 */

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendBookingMessage } from '@/actions/bookings'
import { MessageSquare, Loader2, ArrowRight } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatMessage = {
  id: string
  body: string
  sender_id: string
  created_at: string
}

type Props = {
  bookingId: string
  currentUserId: string
  myName: string
  partnerName: string
  initialMessages: ChatMessage[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingChat({
  bookingId,
  currentUserId,
  myName,
  partnerName,
  initialMessages,
}: Props) {
  const [messages, setMessages]     = useState<ChatMessage[]>(initialMessages)
  const [input, setInput]           = useState('')
  const [sendError, setSendError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const router      = useRouter()
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Sync server-side messages into state ──────────────────────────────────
  // When revalidatePath causes the server component to re-render, BookingChat
  // receives updated initialMessages props. useState doesn't re-init from new
  // props, so we manually merge here. This ensures partner messages always
  // appear even if Realtime delivery fails.
  useEffect(() => {
    setMessages(prev => {
      // Pending optimistic messages (not yet confirmed)
      const pendingOpt = prev.filter(m => m.id.startsWith('opt-'))
      // IDs already confirmed in our state
      const prevConfirmedIds = new Set(
        prev.filter(m => !m.id.startsWith('opt-')).map(m => m.id),
      )
      // Check whether the server has anything new
      const hasNewServerMsgs = initialMessages.some(m => !prevConfirmedIds.has(m.id))
      if (!hasNewServerMsgs) return prev

      // Merge: all server messages + still-pending optimistic ones
      return [...initialMessages, ...pendingOpt]
    })
  }, [initialMessages])

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`booking-chat-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_messages',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessage

          setMessages(prev => {
            // Skip if already in state (e.g., confirmed via server action return)
            if (prev.some(m => m.id === incoming.id)) return prev

            // Replace an optimistic placeholder that matches sender + body
            const optIdx = prev.findLastIndex(
              m =>
                m.id.startsWith('opt-') &&
                m.sender_id === incoming.sender_id &&
                m.body === incoming.body,
            )
            if (optIdx !== -1) {
              const next = [...prev]
              next[optIdx] = incoming
              return next
            }

            return [...prev, incoming]
          })

          // For partner messages: also refresh server data so initialMessages
          // stays in sync (safety net for any edge case where the state diverges)
          if (incoming.sender_id !== currentUserId) {
            router.refresh()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [bookingId, currentUserId, router])

  // ── Auto-scroll on new messages ────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send ───────────────────────────────────────────────────────────────────
  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isPending) return

    setSendError(null)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Optimistic placeholder — visible immediately
    const optimisticId: string = `opt-${Date.now()}`
    const optimistic: ChatMessage = {
      id:         optimisticId,
      body:       text,
      sender_id:  currentUserId,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    startTransition(async () => {
      const result = await sendBookingMessage(bookingId, text)

      if (result.error) {
        // Roll back optimistic message and restore input
        setSendError(result.error)
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
        setInput(text)
        return
      }

      if (result.message) {
        // Replace the optimistic placeholder with the real confirmed row.
        // Don't wait for Realtime — use the server action's return value directly.
        setMessages(prev =>
          prev.map(m => (m.id === optimisticId ? result.message! : m)),
        )
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e as unknown as React.FormEvent)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col"
      style={{
        background: '#FDFAF7',
        borderRadius: '24px',
        border: '1px solid rgba(10,46,77,0.07)',
        boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: '#0A2E4D' }}
        >
          {partnerName[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
            {partnerName}
          </p>
          <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
            Booking chat
          </p>
        </div>
        {/* Online dot — cosmetic */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: 'rgba(74,222,128,0.8)' }}
          title="Messages delivered in real-time"
        />
      </div>

      {/* ── Messages area ───────────────────────────────────────────────────── */}
      <div
        className="overflow-y-auto px-5 py-5 flex flex-col gap-3"
        style={{ minHeight: '300px', maxHeight: '460px' }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-12 text-center">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'rgba(10,46,77,0.06)' }}
            >
              <MessageSquare size={18} strokeWidth={1.5} style={{ color: 'rgba(10,46,77,0.35)' }} />
            </div>
            <p className="text-sm font-medium f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
              No messages yet
            </p>
            <p className="text-xs f-body mt-1" style={{ color: 'rgba(10,46,77,0.28)' }}>
              Start the conversation with {partnerName}.
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe         = msg.sender_id === currentUserId
            const isOptimistic = msg.id.startsWith('opt-')
            const time = new Date(msg.created_at).toLocaleTimeString('en-GB', {
              hour: '2-digit', minute: '2-digit',
            })

            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className="px-4 py-2.5 text-sm f-body leading-relaxed"
                  style={{
                    maxWidth: '78%',
                    background: isMe ? '#0A2E4D' : 'rgba(10,46,77,0.07)',
                    color:      isMe ? '#fff' : '#0A2E4D',
                    borderRadius: isMe
                      ? '18px 18px 4px 18px'
                      : '18px 18px 18px 4px',
                    opacity: isOptimistic ? 0.6 : 1,
                    transition: 'opacity 0.2s',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.body}
                </div>
                <p
                  className="text-[10px] f-body px-1"
                  style={{ color: 'rgba(10,46,77,0.3)' }}
                >
                  {isMe ? myName : partnerName} · {time}
                  {isOptimistic && ' · sending…'}
                </p>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {sendError != null && (
        <div
          className="mx-5 mb-2 px-3 py-2 rounded-xl text-xs f-body"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}
        >
          {sendError}
        </div>
      )}

      {/* ── Input ───────────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSend}
        className="px-4 py-3 flex items-end gap-2.5"
        style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${partnerName}…`}
          maxLength={2000}
          rows={1}
          disabled={isPending}
          className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm f-body outline-none transition-colors"
          style={{
            background: 'rgba(10,46,77,0.05)',
            border: '1px solid rgba(10,46,77,0.1)',
            color: '#0A2E4D',
            minHeight: '42px',
            maxHeight: '120px',
            lineHeight: '1.5',
          }}
          onInput={e => {
            const t = e.currentTarget
            t.style.height = 'auto'
            t.style.height = `${Math.min(t.scrollHeight, 120)}px`
          }}
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          aria-label="Send message"
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:brightness-110 active:scale-[0.95] disabled:opacity-35 disabled:cursor-not-allowed"
          style={{ background: '#0A2E4D' }}
        >
          {isPending ? (
            <Loader2 className="animate-spin" size={14} style={{ color: 'white' }} />
          ) : (
            <ArrowRight size={15} strokeWidth={1.8} style={{ color: 'white' }} />
          )}
        </button>
      </form>

      {/* Character count — only show when close to limit */}
      {input.length > 1800 && (
        <p
          className="px-5 pb-3 text-[10px] f-body text-right"
          style={{ color: input.length > 1950 ? '#DC2626' : 'rgba(10,46,77,0.35)' }}
        >
          {input.length}/2000
        </p>
      )}
    </div>
  )
}
