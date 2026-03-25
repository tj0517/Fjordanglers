'use server'

/**
 * Inquiry chat messages — server actions.
 *
 * sendInquiryMessage  — insert a message into inquiry_messages
 * markInquiryRead     — stamp read_at on unread messages sent by the other party
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── sendInquiryMessage ───────────────────────────────────────────────────────

const sendSchema = z.object({
  inquiryId: z.string().uuid(),
  body: z.string().min(1, 'Message cannot be empty').max(2000),
})

export async function sendInquiryMessage(
  inquiryId: string,
  body: string,
): Promise<{ error?: string }> {
  const parsed = sendSchema.safeParse({ inquiryId, body: body.trim() })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in to send messages.' }

  const serviceClient = createServiceClient()

  // Fetch inquiry to determine sender_role and verify access
  const { data: inquiry } = await serviceClient
    .from('trip_inquiries')
    .select('id, angler_id, assigned_guide_id, status')
    .eq('id', parsed.data.inquiryId)
    .single()

  if (!inquiry) return { error: 'Inquiry not found.' }
  if (inquiry.status === 'cancelled') return { error: 'This inquiry has been cancelled.' }

  // Determine sender_role
  let senderRole: 'angler' | 'guide' | 'admin' | null = null

  if (inquiry.angler_id === user.id) {
    senderRole = 'angler'
  }

  if (senderRole === null && inquiry.assigned_guide_id != null) {
    const { data: guide } = await serviceClient
      .from('guides')
      .select('id')
      .eq('id', inquiry.assigned_guide_id)
      .eq('user_id', user.id)
      .single()
    if (guide) senderRole = 'guide'
  }

  // Admin fallback
  if (senderRole === null) {
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role === 'admin') senderRole = 'admin'
  }

  if (senderRole === null) {
    return { error: 'You do not have permission to message on this inquiry.' }
  }

  const { error: insertError } = await serviceClient
    .from('inquiry_messages')
    .insert({
      inquiry_id: parsed.data.inquiryId,
      sender_id: user.id,
      sender_role: senderRole,
      body: parsed.data.body,
    })

  if (insertError) {
    console.error('[sendInquiryMessage]', insertError)
    return { error: 'Failed to send message. Please try again.' }
  }

  // Revalidate both pages so SSR re-fetches if user navigates away and back
  revalidatePath(`/dashboard/inquiries/${parsed.data.inquiryId}`)
  revalidatePath(`/account/trips/${parsed.data.inquiryId}`)

  return {}
}

// ─── markInquiryMessagesRead ──────────────────────────────────────────────────

export async function markInquiryMessagesRead(
  inquiryId: string,
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const serviceClient = createServiceClient()

  // Mark messages from others as read (not the current user's own messages)
  await serviceClient
    .from('inquiry_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('inquiry_id', inquiryId)
    .neq('sender_id', user.id)
    .is('read_at', null)
}
