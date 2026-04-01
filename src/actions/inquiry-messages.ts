'use server'

/**
 * inquiry-messages.ts — compatibility wrappers.
 *
 * inquiry_messages merged into booking_messages.
 * All implementations live in bookings.ts.
 *
 * NOTE: Must use explicit async function wrappers (not `export { x } from '...'`)
 * because Next.js 'use server' files only allow async function exports.
 *
 * TODO: update import sites to use sendBookingMessage directly, then delete.
 */

import { sendBookingMessage } from '@/actions/bookings'

export async function sendInquiryMessage(
  ...args: Parameters<typeof sendBookingMessage>
): ReturnType<typeof sendBookingMessage> {
  return sendBookingMessage(...args)
}

/**
 * markInquiryMessagesRead — re-implemented on booking_messages.
 * Called by inquiry chat pages to mark messages as read.
 */
export async function markInquiryMessagesRead(bookingId: string): Promise<void> {
  const { createClient, createServiceClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const serviceClient = createServiceClient()
  await serviceClient
    .from('booking_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .neq('sender_id', user.id)
    .is('read_at', null)
}
