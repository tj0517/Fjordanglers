'use server'

/**
 * messages.ts — Server Actions for the messages thread. FA-1.12.
 *
 * matchUnmatchedMessage(unmatchedId, inquiryId)
 *   Links an unmatched_message to an inquiry by inserting a messages row
 *   (occurred_at = unmatched_messages.created_at per tj decision 2026-09-17)
 *   and marking the unmatched_message as matched.
 *
 * bulkMatchUnmatchedMessages(ids, inquiryId)
 *   Same, bulk.
 *
 * sendMessageFromThread(inquiryId, params)
 *   Admin sends a freeform message from the inquiry thread UI.
 *
 * markAsGuideOffer(messageId, { guideId, options })
 *   Admin marks an inbound guide message as "this is the offer".
 *   Inserts an offers + offer_options row and emits guide.offer_received.
 *
 * markOfferPresented(offerId, messageId?)
 *   Admin marks the outbound message to the angler as "presents this offer".
 *   Emits offer.presented + proposes offer_presented transition.
 *
 * markClientAccepted(offerId, optionId)
 *   Admin marks the client's reply as accepting an option.
 *   Sets offer_options.is_accepted, emits offer.accepted + proposes awaiting_payment.
 *
 * markClientDeclined(offerId, messageId?)
 *   Admin marks the client's reply as declining.
 *   Emits offer.declined + proposes lost.
 *
 * markGuideNotifiedPaid(messageId)
 *   Admin marks a guide message as "guide was told about the deposit".
 *   Emits guide.notified_paid.
 *
 * markContactsExchanged(messageId)
 *   Admin marks the step where contacts were exchanged.
 *   Emits contacts.exchanged + proposes handed_over.
 *
 * createPaymentLink(inquiryId, amountCents, currency)
 *   Creates a Stripe Payment Link, inserts a draft message, emits payment.link_sent.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/actions/inquiries'
import { requireAdmin } from '@/lib/auth/guards'
import { emitEvent } from '@/lib/events/emit'
import { transition, TransitionError } from '@/lib/inquiries/state'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { getGuidePhone } from '@/lib/guide-contacts'

// ─── matchUnmatchedMessage ────────────────────────────────────────────────────

/**
 * Link one unmatched_message to an inquiry.
 * occurred_at = unmatched_messages.created_at (decision tj 2026-09-17).
 */
export async function matchUnmatchedMessage(
  unmatchedId: string,
  inquiryId:   string,
): Promise<ActionResult> {
  await requireAdmin()
  const svc = createServiceClient()

  const { data: msg, error: fetchErr } = await svc
    .from('unmatched_messages')
    .select('id, source, content, matched_inquiry_id, created_at')
    .eq('id', unmatchedId)
    .maybeSingle()

  if (fetchErr != null || msg == null) {
    return { success: false, error: fetchErr?.message ?? 'Message not found' }
  }
  if (msg.matched_inquiry_id != null) {
    return { success: false, error: 'Message is already linked to an inquiry' }
  }

  const now = new Date().toISOString()

  const { error: insertErr } = await svc.from('messages').insert({
    inquiry_id:  inquiryId,
    direction:   'inbound',
    channel:     msg.source as 'email' | 'whatsapp' | 'instagram',
    counterpart: 'angler',
    body:        msg.content,
    status:      'received',
    drafted_by:  null,
    occurred_at: msg.created_at ?? now,
  })

  if (insertErr != null) {
    console.error('[matchUnmatchedMessage] insert messages error:', insertErr)
    return { success: false, error: insertErr.message }
  }

  await svc
    .from('unmatched_messages')
    .update({ matched_inquiry_id: inquiryId, matched_at: now, matched_by: 'admin' })
    .eq('id', unmatchedId)

  await svc
    .from('inquiries')
    .update({ last_contact_at: now })
    .eq('id', inquiryId)

  revalidatePath('/admin/inquiries/' + inquiryId)
  revalidatePath('/admin/inquiries/unmatched')
  console.log(`[matchUnmatchedMessage] Linked unmatched ${unmatchedId} → inquiry ${inquiryId}`)
  return { success: true }
}

// ─── bulkMatchUnmatchedMessages ───────────────────────────────────────────────

export async function bulkMatchUnmatchedMessages(
  unmatchedIds: string[],
  inquiryId:    string,
): Promise<ActionResult> {
  await requireAdmin()
  if (unmatchedIds.length === 0) return { success: true }

  const svc = createServiceClient()

  const { data: msgs, error: fetchErr } = await svc
    .from('unmatched_messages')
    .select('id, source, content, raw_payload, created_at')
    .in('id', unmatchedIds)
    .is('matched_inquiry_id', null)

  if (fetchErr != null || !msgs?.length) {
    return { success: false, error: fetchErr?.message ?? 'No messages found' }
  }

  const now = new Date().toISOString()

  const rows = msgs.map((msg) => {
    const rawPayload = msg.raw_payload as { timestamp?: number; fromMe?: boolean } | null
    const ts     = rawPayload?.timestamp
    const fromMe = rawPayload?.fromMe ?? false
    return {
      inquiry_id:  inquiryId,
      direction:   fromMe ? 'outbound' : ('inbound' as 'inbound' | 'outbound'),
      channel:     msg.source as 'email' | 'whatsapp' | 'instagram',
      counterpart: 'angler' as const,
      body:        msg.content,
      status:      fromMe ? 'sent' : ('received' as 'sent' | 'received'),
      drafted_by:  fromMe ? ('admin' as const) : null,
      // Use raw_payload.timestamp when available (WhatsApp), else unmatched_messages.created_at
      occurred_at: ts ? new Date(ts * 1000).toISOString() : (msg.created_at ?? now),
    }
  })

  const { error: insertErr } = await svc.from('messages').insert(rows)
  if (insertErr != null) {
    console.error('[bulkMatchUnmatchedMessages] insert messages error:', insertErr)
    return { success: false, error: insertErr.message }
  }

  await svc
    .from('unmatched_messages')
    .update({ matched_inquiry_id: inquiryId, matched_at: now, matched_by: 'admin' })
    .in('id', unmatchedIds)

  await svc
    .from('inquiries')
    .update({ last_contact_at: now })
    .eq('id', inquiryId)

  revalidatePath('/admin/inquiries/' + inquiryId)
  revalidatePath('/admin/inquiries/unmatched')
  console.log(`[bulkMatchUnmatchedMessages] Linked ${msgs.length} messages → inquiry ${inquiryId}`)
  return { success: true }
}

// ─── sendMessageFromThread ────────────────────────────────────────────────────

export interface SendMessageFromThreadParams {
  channel:      'email' | 'whatsapp' | 'instagram'
  counterpart:  'angler' | 'guide'
  subject?:     string
  body:         string
  /** WA only: pre-approved template name. If omitted the action selects the
   *  default template for the counterpart when the 24-h window is closed. */
  templateName?: string
}

export async function sendMessageFromThread(
  inquiryId: string,
  params:    SendMessageFromThreadParams,
): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const isWa = params.channel === 'whatsapp'
  // body required for email/instagram; for WA it is optional (template path has no body)
  if (!isWa && params.body.trim() === '') return { success: false, error: 'Body is required' }

  const svc = createServiceClient()

  // Fetch inquiry — include angler_phone for WA sends
  const { data: inq } = await svc
    .from('inquiries')
    .select('id, angler_name, angler_email, angler_phone, assigned_guide_id')
    .eq('id', inquiryId)
    .single()

  if (inq == null) return { success: false, error: 'Inquiry not found' }

  let to: string
  let counterpartId: string | null = null
  let templateName: string | undefined = params.templateName

  if (params.counterpart === 'angler') {
    if (isWa) {
      const phone = inq.angler_phone as string | null
      if (!phone) return { success: false, error: 'Angler has no phone number' }
      to = phone
    } else {
      to = inq.angler_email as string
    }
  } else {
    if (inq.assigned_guide_id == null) return { success: false, error: 'No guide assigned' }
    counterpartId = inq.assigned_guide_id as string
    const { data: guide } = await svc
      .from('guides')
      .select('invite_email, user_id')
      .eq('id', counterpartId)
      .single()
    if (guide == null) return { success: false, error: 'Guide not found' }

    if (isWa) {
      let phone: string | null
      try {
        phone = await getGuidePhone(counterpartId)
      } catch {
        // Already logged by getGuidePhone — a read failure is not "no number on file".
        return { success: false, error: 'Could not read the guide contact — try again' }
      }
      if (!phone) return { success: false, error: 'Guide has no WhatsApp number (phone_e164)' }
      to = phone
    } else {
      let guideEmail: string | null = (guide as unknown as { invite_email: string | null }).invite_email ?? null
      if ((guideEmail == null || guideEmail === '') && (guide as unknown as { user_id: string | null }).user_id != null) {
        const { data: authUser } = await svc.auth.admin.getUserById((guide as unknown as { user_id: string }).user_id)
        guideEmail = authUser?.user?.email ?? null
      }
      if (guideEmail == null) return { success: false, error: 'Guide has no email address' }
      to = guideEmail
    }
  }

  // For WA without explicit templateName, the server will auto-select by counterpart
  // when the 24-h window is closed (whatsappAdapter.send throws for closed window + no template).
  // Resolve the default template here so the error is actionable.
  if (isWa && !templateName) {
    templateName = params.counterpart === 'guide' ? env.WHATSAPP_TEMPLATE_GUIDE : env.WHATSAPP_TEMPLATE_ANGLER
  }

  // Get last outbound thread_key for In-Reply-To (email) / last thread key (WA = phone)
  const { data: lastMsg } = await svc
    .from('messages')
    .select('thread_key')
    .eq('inquiry_id', inquiryId)
    .eq('direction', 'outbound')
    .eq('counterpart', params.counterpart)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { sendMessage } = await import('@/lib/messages/send')
  try {
    await sendMessage(svc, {
      inquiryId,
      channel:      params.channel,
      counterpart:  params.counterpart,
      to,
      subject:      params.subject?.trim() || undefined,
      body:         params.body.trim(),
      draftedBy:    'admin',
      actor:        { kind: 'admin', id: userId },
      counterpartId,
      threadKey:    lastMsg?.thread_key ?? null,
      templateName,
    })
  } catch (err) {
    console.error('[sendMessageFromThread] error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Send failed' }
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true }
}

// ─── markAsGuideOffer ─────────────────────────────────────────────────────────

interface OfferOptionInput {
  label:      string
  priceCents: number
  currency:   string
  dateFrom?:  string | null
  dateTo?:    string | null
  partySize?: number | null
  includes?:  string[]
  notes?:     string | null
}

export interface MarkAsGuideOfferParams {
  guideId?: string | null
  options:  OfferOptionInput[]
}

export async function markAsGuideOffer(
  messageId: string,
  params:    MarkAsGuideOfferParams,
): Promise<ActionResult & { offerId?: string }> {
  const { userId } = await requireAdmin()
  if (params.options.length === 0) return { success: false, error: 'At least one option is required' }

  const svc = createServiceClient()

  const { data: msg } = await svc
    .from('messages')
    .select('id, inquiry_id')
    .eq('id', messageId)
    .single()
  if (msg == null) return { success: false, error: 'Message not found' }

  const inquiryId: string = msg.inquiry_id

  // Use RPC to insert offer + options in one server-side transaction.
  // Separate PostgREST calls each commit immediately; the DEFERRABLE INITIALLY DEFERRED
  // trigger on offers would fire after the first commit (before options exist) and raise P0001.
  const optionsJson = params.options.map(o => ({
    label:      o.label,
    price_cents: o.priceCents,
    currency:   o.currency,
    date_from:  o.dateFrom ?? null,
    date_to:    o.dateTo ?? null,
    party_size: o.partySize ?? null,
    includes:   o.includes ?? [],
    notes:      o.notes ?? null,
  }))

  const { data: offerId, error: offerErr } = await svc.rpc('create_offer_with_options', {
    p_inquiry_id:        inquiryId,
    // Postgres function accepts NULL uuid; generator typed p_guide_id as non-nullable string
    p_guide_id:          (params.guideId ?? null) as unknown as string,
    p_source_message_id: messageId,
    p_created_by:        userId,
    p_options:           optionsJson,
  })

  if (offerErr != null || offerId == null) {
    console.error('[markAsGuideOffer] offer insert error:', offerErr)
    return { success: false, error: offerErr?.message ?? 'Failed to create offer' }
  }

  await emitEvent(svc, {
    inquiryId,
    type:      'guide.offer_received',
    actor:     { kind: 'admin', id: userId },
    source:    'app',
    messageId,
    payload:   { offer_id: offerId, guide_id: params.guideId ?? null },
  })

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true, offerId }
}

// ─── markOfferPresented ───────────────────────────────────────────────────────

export async function markOfferPresented(
  offerId:   string,
  messageId: string,
): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  if (!messageId) return { success: false, error: 'messageId is required to present an offer' }
  const svc = createServiceClient()

  const { data: offer } = await svc
    .from('offers')
    .select('id, inquiry_id, status')
    .eq('id', offerId)
    .single()
  if (offer == null) return { success: false, error: 'Offer not found' }

  const inquiryId: string = offer.inquiry_id

  await svc
    .from('offers')
    .update({ status: 'presented' })
    .eq('id', offerId)

  await emitEvent(svc, {
    inquiryId,
    type:      'offer.presented',
    actor:     { kind: 'admin', id: userId },
    source:    'app',
    channel:   'email',
    messageId,
    payload:   { offer_id: offerId },
  })

  // Propose status transition (best-effort — not a hard failure)
  try {
    await transition(svc, inquiryId, 'offer_presented', {
      actor:  { kind: 'admin', id: userId },
      reason: 'Offer presented to angler',
    })
  } catch (err) {
    if (!(err instanceof TransitionError && err.message.includes('already'))) {
      console.warn('[markOfferPresented] transition warn:', err)
    }
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true }
}

// ─── markClientAccepted ───────────────────────────────────────────────────────

export async function markClientAccepted(
  offerId:    string,
  optionId:   string,
  messageId?: string | null,
): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const svc = createServiceClient()

  const { data: option } = await svc
    .from('offer_options')
    .select('id, offer_id')
    .eq('id', optionId)
    .eq('offer_id', offerId)
    .single()

  if (option == null) {
    return { success: false, error: 'Option not found or does not belong to this offer' }
  }

  const { data: offer } = await svc
    .from('offers')
    .select('id, inquiry_id')
    .eq('id', offerId)
    .single()
  if (offer == null) return { success: false, error: 'Offer not found' }

  const inquiryId: string = offer.inquiry_id

  await svc
    .from('offer_options')
    .update({ is_accepted: true })
    .eq('id', optionId)

  await svc
    .from('offers')
    .update({ status: 'accepted' })
    .eq('id', offerId)

  await emitEvent(svc, {
    inquiryId,
    type:      'offer.accepted',
    actor:     { kind: 'admin', id: userId },
    source:    'app',
    messageId: messageId ?? null,
    payload:   { offer_id: offerId, option_id: optionId },
  })

  try {
    await transition(svc, inquiryId, 'awaiting_payment', {
      actor:  { kind: 'admin', id: userId },
      reason: 'Client accepted the offer',
    })
  } catch (err) {
    if (!(err instanceof TransitionError && err.message.includes('already'))) {
      console.warn('[markClientAccepted] transition warn:', err)
    }
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true }
}

// ─── markClientDeclined ───────────────────────────────────────────────────────

export async function markClientDeclined(
  offerId:    string,
  messageId?: string | null,
): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const svc = createServiceClient()

  const { data: offer } = await svc
    .from('offers')
    .select('id, inquiry_id')
    .eq('id', offerId)
    .single()
  if (offer == null) return { success: false, error: 'Offer not found' }

  const inquiryId: string = offer.inquiry_id

  await svc
    .from('offers')
    .update({ status: 'declined' })
    .eq('id', offerId)

  await emitEvent(svc, {
    inquiryId,
    type:      'offer.declined',
    actor:     { kind: 'admin', id: userId },
    source:    'app',
    messageId: messageId ?? null,
    payload:   { offer_id: offerId },
  })

  try {
    await transition(svc, inquiryId, 'lost', {
      actor:          { kind: 'admin', id: userId },
      lostReasonCode: 'offer_declined',
      lostReason:     'Client declined the offer',
    })
  } catch (err) {
    if (!(err instanceof TransitionError && err.message.includes('already'))) {
      console.warn('[markClientDeclined] transition warn:', err)
    }
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true }
}

// ─── markGuideNotifiedPaid ────────────────────────────────────────────────────

export async function markGuideNotifiedPaid(messageId: string): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const svc = createServiceClient()

  const { data: msg } = await svc
    .from('messages')
    .select('id, inquiry_id')
    .eq('id', messageId)
    .single()
  if (msg == null) return { success: false, error: 'Message not found' }

  await emitEvent(svc, {
    inquiryId: msg.inquiry_id,
    type:      'guide.notified_paid',
    actor:     { kind: 'admin', id: userId },
    source:    'app',
    messageId,
  })

  revalidatePath('/admin/inquiries/' + msg.inquiry_id)
  return { success: true }
}

// ─── markContactsExchanged ────────────────────────────────────────────────────

export async function markContactsExchanged(messageId: string): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const svc = createServiceClient()

  const { data: msg } = await svc
    .from('messages')
    .select('id, inquiry_id')
    .eq('id', messageId)
    .single()
  if (msg == null) return { success: false, error: 'Message not found' }

  const inquiryId: string = msg.inquiry_id

  await emitEvent(svc, {
    inquiryId,
    type:      'contacts.exchanged',
    actor:     { kind: 'admin', id: userId },
    source:    'app',
    messageId,
  })

  try {
    await transition(svc, inquiryId, 'handed_over', {
      actor:  { kind: 'admin', id: userId },
      reason: 'Contacts exchanged',
    })
  } catch (err) {
    if (!(err instanceof TransitionError && err.message.includes('already'))) {
      console.warn('[markContactsExchanged] transition warn:', err)
    }
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true }
}

// ─── createPaymentLink ────────────────────────────────────────────────────────

export type CreatePaymentLinkResult =
  | { success: true;  url: string }
  | { success: false; error: string }

export async function createPaymentLink(
  inquiryId:   string,
  amountCents: number,
  currency:    string,
): Promise<CreatePaymentLinkResult> {
  const { userId } = await requireAdmin()
  if (amountCents < 50) return { success: false, error: 'Amount must be at least 50 cents' }

  const svc = createServiceClient()

  const { data: inq } = await svc
    .from('inquiries')
    .select('id, angler_name, angler_email, party_size')
    .eq('id', inquiryId)
    .single()
  if (inq == null) return { success: false, error: 'Inquiry not found' }

  let paymentLink: { url: string; id: string }
  try {
    // Create a Payment Link (not a Checkout Session) so the admin can paste it manually
    const price = await stripe.prices.create({
      currency:     currency.toLowerCase(),
      unit_amount:  amountCents,
      product_data: {
        name: `Booking & Curation Fee — FjordAnglers`,
        metadata: { inquiry_id: inquiryId },
      },
    })
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata:   { inquiry_id: inquiryId, payment_type: 'inquiry_deposit' },
      after_completion: {
        type: 'redirect',
        redirect: { url: `${env.NEXT_PUBLIC_APP_URL}/inquiry/${inquiryId}/confirmed` },
      },
    })
    paymentLink = { url: link.url, id: link.id }
  } catch (err) {
    console.error('[createPaymentLink] Stripe error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Stripe error' }
  }

  // Insert a draft message row with the link as body — admin will paste and send
  await svc.from('messages').insert({
    inquiry_id:  inquiryId,
    channel:     'email',
    direction:   'outbound',
    counterpart: 'angler',
    body:        `Payment link: ${paymentLink.url}`,
    status:      'draft',
    drafted_by:  'admin',
    occurred_at: new Date().toISOString(),
  })

  await emitEvent(svc, {
    inquiryId,
    type:    'payment.link_sent',
    actor:   { kind: 'admin', id: userId },
    source:  'app',
    channel: 'app',
    payload: { amount_cents: amountCents, currency, link_id: paymentLink.id },
  })

  try {
    await transition(svc, inquiryId, 'awaiting_payment', {
      actor:  { kind: 'admin', id: userId },
      reason: 'Payment link created',
    })
  } catch (err) {
    if (!(err instanceof TransitionError && err.message.includes('already'))) {
      console.warn('[createPaymentLink] transition warn:', err)
    }
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true, url: paymentLink.url }
}

// ─── deleteUnmatchedMessages (kept from old messages.ts) ─────────────────────

export async function deleteUnmatchedMessages(ids: string[]): Promise<ActionResult> {
  await requireAdmin()
  if (ids.length === 0) return { success: true }
  const svc = createServiceClient()
  const { error } = await svc
    .from('unmatched_messages')
    .delete()
    .in('id', ids)
  if (error != null) return { success: false, error: error.message }
  revalidatePath('/admin/inquiries/unmatched')
  return { success: true }
}
