/**
 * /admin/inquiries/unmatched — Queue of incoming messages not yet matched to an inquiry.
 *
 * Shows WhatsApp & email messages that arrived via webhook but couldn't be
 * auto-matched to an existing inquiry. Admin can manually link them here.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { UnmatchedPageClient } from './UnmatchedPageClient'

export const metadata = {
  title: 'Unmatched Messages — Admin',
}

export default async function UnmatchedMessagesPage() {
  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await (svc as any)
    .from('unmatched_messages')
    .select('id, source, from_identifier, sender_name, content, created_at')
    .is('matched_inquiry_id', null)
    .order('created_at', { ascending: false })
    .limit(200)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiries } = await (svc as any)
    .from('inquiries')
    .select('id, angler_name, angler_email, angler_phone, status, created_at')
    .not('status', 'in', '("cancelled","refunded")')
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <UnmatchedPageClient
      messages={messages ?? []}
      inquiries={inquiries ?? []}
    />
  )
}
