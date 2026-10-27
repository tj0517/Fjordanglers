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
 * markAsGuideOffer(inquiryId, { messageId, guideId, options, supersedesOfferId })
 *   Admin turns the guide's prices into an offer — from a thread reply (messageId) or
 *   from outside the thread (WhatsApp, phone: messageId null, FA-1.74 D2.1).
 *   Inserts an offers + offer_options row and emits guide.offer_received. With
 *   supersedesOfferId (a declined offer, FA-1.76) the old one becomes superseded.
 *
 * updateOfferOptions(offerId, options)
 *   Admin edits an offer in place (FA-1.74 D1): label / price / currency of existing
 *   options, new options, removed options. Status of the offer and inquiry unchanged.
 *   Emits offer.updated with the options before and after.
 *
 * markOfferPresented(offerId, messageId?)
 *   Admin marks the offer as presented — with the outbound message when there is one,
 *   without when it went out by WhatsApp or phone (FA-1.76 D2.2).
 *   Emits offer.presented + proposes offer_presented transition.
 *
 * markClientAccepted(offerId, optionId, messageId?)
 *   Admin marks the option the angler accepted. On a draft offer "presented" is
 *   recorded on the way (FA-1.76 D2.2). Sets offer_options.is_accepted, emits
 *   offer.accepted; the status stays offer_presented.
 *
 * backToDraft(offerId) · changeAcceptedOption(offerId) · reopenOffer(offerId)
 *   Step the offer back (FA-1.76 D2.3, D2.5, D5 a): presented → draft, accepted →
 *   presented (deactivates an active deposit link, clears the deposit amount,
 *   awaiting_payment → offer_presented),
 *   declined → draft. Each emits offer.reverted.
 *
 * markClientDeclined(offerId, messageId?)
 *   Admin marks the client's reply as declining.
 *   Emits offer.declined + proposes lost.
 *
 * markGuideNotifiedPaid(inquiryId, messageId?)
 *   Admin marks that the guide was told about the deposit; the message to the guide is
 *   optional (FA-1.76 D2.4). Emits guide.notified_paid.
 *
 * markContactsExchanged(inquiryId, messageId?)
 *   Admin marks the step where contacts were exchanged; message optional (D2.4).
 *   Emits contacts.exchanged + proposes handed_over.
 *
 * createPaymentLink(inquiryId, { name, description })
 *   Reads deposit amount + currency from the inquiry row (FA-1.28), creates (or re-uses)
 *   a Stripe Payment Link, inserts a draft message, emits payment.link_sent.
 *   One active link per inquiry: same amount/currency → returns existing link; changed
 *   amount/currency → deactivates old link, creates new one. The product's name and
 *   description come from the card (FA-1.77), validated before any Stripe call, and are
 *   recorded in the event with the product id.
 *
 * updatePaymentLinkDetails(inquiryId, { name, description })
 *   Renames the product behind the active link (FA-1.77 D3 a): products.update, the link
 *   and its URL stay. Emits payment.link_details_updated with the values before and after.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/actions/inquiries'
import { requireAdmin } from '@/lib/auth/guards'
import { emitEvent, type EmitEventParams } from '@/lib/events/emit'
import { EVENT_CHANNELS, type EventChannel } from '@/lib/events/types'
import { transition, TransitionError, type InquiryStatus } from '@/lib/inquiries/state'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { getGuidePhone } from '@/lib/guide-contacts'
import { formatDepositAmount, isDepositCurrency } from '@/lib/inquiries/deposit'
import { getInquiryExperience, tripTitleOf, TRIP_TITLE_FALLBACK } from '@/lib/inquiries/experience-lookup'
import { draftDepositLinkMessage } from '@/lib/ai/draft-deposit-link'
import { checkProductDetails, linkProductFromEvents, type ProductDetails } from '@/lib/stripe/product-details'
import { loadKnowledge } from '@/lib/ai/knowledge'
import type { ConversationMessage } from '@/lib/ai/extract-trip'

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
  /** When set: promote this existing draft row instead of inserting a new one. */
  draftId?:     string
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

  // When promoting a draft, preserve its drafted_by attribution
  let draftedBy: 'admin' | 'agent' = 'admin'
  if (params.draftId != null) {
    const { data: draftRow } = await svc
      .from('messages')
      .select('drafted_by')
      .eq('id', params.draftId)
      .single()
    if (draftRow?.drafted_by === 'agent') draftedBy = 'agent'
  }

  const { sendMessage } = await import('@/lib/messages/send')
  try {
    await sendMessage(svc, {
      inquiryId,
      channel:      params.channel,
      counterpart:  params.counterpart,
      to,
      subject:      params.subject?.trim() || undefined,
      body:         params.body.trim(),
      draftedBy,
      draftId:      params.draftId,
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

/** create_offer_with_options casts price_cents to int4. */
const MAX_PRICE_CENTS = 2_147_483_647

/**
 * Server-side check of one option from the form (FA-1.74): non-empty label, positive
 * integer cents, currency from the deposit list (tj D-C). Returns the error or null.
 */
function offerOptionError(o: { label: unknown; priceCents: unknown; currency: unknown }, n: number): string | null {
  if (typeof o.label !== 'string' || o.label.trim() === '') return `Option ${n}: name is required`
  if (typeof o.priceCents !== 'number' || !Number.isInteger(o.priceCents) || o.priceCents <= 0 || o.priceCents > MAX_PRICE_CENTS) {
    return `Option ${n}: price must be a positive amount`
  }
  if (typeof o.currency !== 'string' || !isDepositCurrency(o.currency.toUpperCase())) {
    return `Option ${n}: currency is not supported`
  }
  return null
}

export interface MarkAsGuideOfferParams {
  /** The thread reply the offer came from; null when the guide quoted outside the thread. */
  messageId?: string | null
  guideId?:   string | null
  options:    OfferOptionInput[]
  /** A declined offer this one replaces ("New offer", FA-1.76) — it becomes superseded. */
  supersedesOfferId?: string | null
}

export async function markAsGuideOffer(
  inquiryId: string,
  params:    MarkAsGuideOfferParams,
): Promise<ActionResult & { offerId?: string }> {
  const { userId } = await requireAdmin()
  if (params.options.length === 0) return { success: false, error: 'At least one option is required' }
  for (const [i, o] of params.options.entries()) {
    const err = offerOptionError(o, i + 1)
    if (err != null) return { success: false, error: err }
  }

  const svc = createServiceClient()
  const messageId = params.messageId ?? null

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id')
    .eq('id', inquiryId)
    .maybeSingle()
  if (inquiry == null) return { success: false, error: 'Inquiry not found' }

  if (messageId != null) {
    const { data: msg } = await svc
      .from('messages')
      .select('id')
      .eq('id', messageId)
      .eq('inquiry_id', inquiryId)
      .maybeSingle()
    if (msg == null) return { success: false, error: 'Message not found in this inquiry' }
  }

  const supersedesOfferId = params.supersedesOfferId ?? null
  if (supersedesOfferId != null) {
    const { data: old } = await svc
      .from('offers')
      .select('id, status')
      .eq('id', supersedesOfferId)
      .eq('inquiry_id', inquiryId)
      .maybeSingle()
    if (old == null) return { success: false, error: 'The offer to replace was not found in this inquiry' }
    if (old.status !== 'declined') return { success: false, error: `Only a declined offer can be replaced — this one is ${old.status}` }
  }

  // Use RPC to insert offer + options in one server-side transaction.
  // Separate PostgREST calls each commit immediately; the DEFERRABLE INITIALLY DEFERRED
  // trigger on offers would fire after the first commit (before options exist) and raise P0001.
  const optionsJson = params.options.map(o => ({
    label:      o.label.trim(),
    price_cents: o.priceCents,
    currency:   o.currency.toLowerCase(),
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
    // Same for p_source_message_id: NULL = offer quoted outside the thread (FA-1.74 D2.1)
    p_source_message_id: messageId as unknown as string,
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

  if (supersedesOfferId != null) {
    // After the new offer exists, so a failure here never leaves the inquiry without one.
    const { data: moved } = await svc
      .from('offers')
      .update({ status: 'superseded' })
      .eq('id', supersedesOfferId)
      .eq('status', 'declined')
      .select('id')
      .maybeSingle()
    try {
      if (moved == null) throw new Error('declined offer changed underneath us')
      await emitEvent(svc, {
        inquiryId,
        type:    'offer.superseded',
        actor:   { kind: 'admin', id: userId },
        source:  'app',
        channel: 'app',
        payload: { offer_id: supersedesOfferId, superseded_by: offerId },
      })
    } catch (err) {
      console.error('[markAsGuideOffer] supersede error:', err)
      if (moved != null) {
        await svc.from('offers').update({ status: 'declined' }).eq('id', supersedesOfferId).eq('status', 'superseded')
      }
      revalidatePath('/admin/inquiries/' + inquiryId)
      return { success: false, error: 'The new offer was created, but the declined one could not be marked as replaced — reload the page' }
    }
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true, offerId }
}

// ─── updateOfferOptions ───────────────────────────────────────────────────────

export interface OfferOptionEdit {
  /** Existing option id; null/absent = a new option. */
  id?:        string | null
  label:      string
  priceCents: number
  currency:   string
}

const EDITABLE_OFFER_STATUSES = ['draft', 'presented', 'accepted']
/** Paid or later, and the closed ones (tj D-D). */
const OFFER_LOCKED_INQUIRY_STATUSES = ['paid', 'handed_over', 'completed', 'lost', 'cancelled']

type OfferOptionSnapshot = { id: string; label: string; price_cents: number; currency: string }

function snapshot(o: OfferOptionSnapshot): OfferOptionSnapshot {
  return { id: o.id, label: o.label, price_cents: o.price_cents, currency: o.currency }
}

/**
 * Edit an offer in place (FA-1.74 D1). No database function (tj D-A = A), so the change
 * is three writes, each committed on its own:
 *   1. one upsert — changed and new options (adds first, so the offer never drops to 0);
 *   2. one delete — removed options (the deferred min-one trigger still guards it);
 *   3. the offer.updated event — only after 1 and 2 succeeded.
 * If 2 or 3 fails, the options are put back as they were (original rows re-upserted,
 * added rows deleted) and the action returns an error.
 */
export async function updateOfferOptions(
  offerId: string,
  options: OfferOptionEdit[],
): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  if (options.length === 0) return { success: false, error: 'An offer needs at least one option' }
  for (const [i, o] of options.entries()) {
    const err = offerOptionError(o, i + 1)
    if (err != null) return { success: false, error: err }
  }
  const submittedIds = options.flatMap(o => (o.id != null ? [o.id] : []))
  if (new Set(submittedIds).size !== submittedIds.length) {
    return { success: false, error: 'The same option was submitted twice' }
  }

  const svc = createServiceClient()

  const { data: offer } = await svc
    .from('offers')
    .select('id, inquiry_id, status')
    .eq('id', offerId)
    .maybeSingle()
  if (offer == null) return { success: false, error: 'Offer not found' }
  if (!EDITABLE_OFFER_STATUSES.includes(offer.status)) {
    return { success: false, error: `A ${offer.status} offer cannot be edited` }
  }

  const inquiryId: string = offer.inquiry_id
  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, status')
    .eq('id', inquiryId)
    .maybeSingle()
  if (inquiry == null) return { success: false, error: 'Inquiry not found' }
  if (OFFER_LOCKED_INQUIRY_STATUSES.includes(inquiry.status)) {
    return { success: false, error: `The offer cannot be edited — the inquiry is ${inquiry.status}` }
  }

  const { data: currentRows, error: currentErr } = await svc
    .from('offer_options')
    .select('*')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (currentErr != null || currentRows == null) {
    console.error('[updateOfferOptions] options lookup error:', currentErr)
    return { success: false, error: 'Could not read the offer options' }
  }
  const current = currentRows

  const currentById = new Map(current.map(o => [o.id, o]))
  if (submittedIds.some(id => !currentById.has(id))) {
    return { success: false, error: 'Option not found or does not belong to this offer' }
  }
  const removed = current.filter(o => !submittedIds.includes(o.id))
  if (removed.some(o => o.is_accepted)) {
    return { success: false, error: 'The accepted option cannot be removed — change the accepted option first' }
  }

  const upserts = options.flatMap(o => {
    const row = { offer_id: offerId, label: o.label.trim(), price_cents: o.priceCents, currency: o.currency.toLowerCase() }
    if (o.id == null) return [row]
    const prev = currentById.get(o.id)
    const same = prev != null && prev.label === row.label && prev.price_cents === row.price_cents && prev.currency === row.currency
    return same ? [] : [{ id: o.id, ...row }]
  })
  if (upserts.length === 0 && removed.length === 0) return { success: true }

  const changedIds = upserts.flatMap(r => ('id' in r ? [r.id] : []))
  let addedIds: string[] = []

  /** Puts the options back as they were before this call. Returns false when it could not. */
  async function rollback(): Promise<boolean> {
    const originals = current.filter(o => changedIds.includes(o.id) || removed.some(r => r.id === o.id))
    if (originals.length > 0) {
      const { error } = await svc.from('offer_options').upsert(originals, { onConflict: 'id' })
      if (error != null) { console.error('[updateOfferOptions] rollback upsert error:', error); return false }
    }
    if (addedIds.length > 0) {
      const { error } = await svc.from('offer_options').delete().in('id', addedIds).eq('offer_id', offerId)
      if (error != null) { console.error('[updateOfferOptions] rollback delete error:', error); return false }
    }
    return true
  }
  const PARTLY_SAVED = 'Saving failed and the offer may be partly saved — reload the page and check the options'

  // 1. changed + new options (one statement)
  if (upserts.length > 0) {
    const { data: written, error } = await svc
      .from('offer_options')
      .upsert(upserts, { onConflict: 'id', defaultToNull: false })
      .select('id')
    if (error != null || written == null) {
      console.error('[updateOfferOptions] upsert error:', error)
      return { success: false, error: 'Could not save the offer options' }
    }
    addedIds = written.map(w => w.id).filter(id => !currentById.has(id))
  }

  // 2. removed options (one statement)
  if (removed.length > 0) {
    const { error } = await svc
      .from('offer_options')
      .delete()
      .in('id', removed.map(o => o.id))
      .eq('offer_id', offerId)
    if (error != null) {
      console.error('[updateOfferOptions] delete error:', error)
      return { success: false, error: (await rollback()) ? 'Could not save the offer options — nothing was changed' : PARTLY_SAVED }
    }
  }

  // 3. the event — only after every option write succeeded (tj D-A)
  const { data: after, error: afterErr } = await svc
    .from('offer_options')
    .select('id, label, price_cents, currency')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  try {
    if (afterErr != null || after == null) throw new Error(afterErr?.message ?? 'options not readable after save')
    await emitEvent(svc, {
      inquiryId,
      type:    'offer.updated',
      actor:   { kind: 'admin', id: userId },
      source:  'app',
      channel: 'app',
      payload: { offer_id: offerId, before: current.map(snapshot), after: after.map(snapshot) },
    })
  } catch (err) {
    console.error('[updateOfferOptions] event error:', err)
    return { success: false, error: (await rollback()) ? 'Could not save the offer options — nothing was changed' : PARTLY_SAVED }
  }

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true }
}

// ─── Offer stages (FA-1.76) ───────────────────────────────────────────────────
//
// Much of the offer flow happens outside the app (WhatsApp, phone) and anglers come
// back, so no stage needs a thread message and every stage before payment can be
// stepped back. One thing never moves: `paid` comes only from Stripe.

type ServiceClient = ReturnType<typeof createServiceClient>

interface OfferContext {
  offerId:              string
  offerStatus:          string
  inquiryId:            string
  inquiryStatus:        string
  depositPaymentLinkId: string | null
}

type OfferContextResult = { ok: true; ctx: OfferContext } | { ok: false; error: string }

/** Reads the offer and its inquiry; refuses when the inquiry is paid or closed. */
async function readOfferContext(svc: ServiceClient, offerId: string): Promise<OfferContextResult> {
  const { data: offer } = await svc
    .from('offers')
    .select('id, inquiry_id, status')
    .eq('id', offerId)
    .maybeSingle()
  if (offer == null) return { ok: false, error: 'Offer not found' }

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, status, deposit_payment_link_id')
    .eq('id', offer.inquiry_id)
    .maybeSingle()
  if (inquiry == null) return { ok: false, error: 'Inquiry not found' }
  if (OFFER_LOCKED_INQUIRY_STATUSES.includes(inquiry.status)) {
    return { ok: false, error: `The offer cannot be changed — the inquiry is ${inquiry.status}` }
  }

  return {
    ok:  true,
    ctx: {
      offerId,
      offerStatus:          offer.status,
      inquiryId:            inquiry.id,
      inquiryStatus:        inquiry.status,
      depositPaymentLinkId: inquiry.deposit_payment_link_id,
    },
  }
}

/** The message's channel when it belongs to the inquiry; null when it does not. */
async function messageChannel(svc: ServiceClient, messageId: string, inquiryId: string): Promise<EventChannel | null> {
  const { data: msg } = await svc
    .from('messages')
    .select('id, channel')
    .eq('id', messageId)
    .eq('inquiry_id', inquiryId)
    .maybeSingle()
  if (msg == null) return null
  return (EVENT_CHANNELS as readonly string[]).includes(msg.channel) ? msg.channel as EventChannel : 'app'
}

/** Best-effort status move: an inquiry already in `to` is fine, anything else is logged. */
async function proposeTransition(
  svc:       ServiceClient,
  inquiryId: string,
  to:        InquiryStatus,
  userId:    string,
  reason:    string,
  caller:    string,
): Promise<void> {
  try {
    await transition(svc, inquiryId, to, { actor: { kind: 'admin', id: userId }, reason })
  } catch (err) {
    if (!(err instanceof TransitionError && err.message.includes('already'))) {
      console.warn(`[${caller}] transition warn:`, err)
    }
  }
}

/**
 * Offer status compare-and-set + its event. If the event cannot be written the offer
 * is put back, so the log never misses a step the card shows (CLAUDE.md rule 5).
 * Returns the error, or null.
 */
async function moveOffer(
  svc:   ServiceClient,
  ctx:   OfferContext,
  from:  string,
  to:    string,
  event: Omit<EmitEventParams, 'inquiryId'>,
): Promise<string | null> {
  const { data: moved, error } = await svc
    .from('offers')
    .update({ status: to })
    .eq('id', ctx.offerId)
    .eq('status', from)
    .select('id')
    .maybeSingle()
  if (error != null || moved == null) {
    if (error != null) console.error('[moveOffer] update error:', error)
    return 'The offer changed underneath us — reload and try again'
  }
  try {
    await emitEvent(svc, { inquiryId: ctx.inquiryId, ...event })
  } catch (err) {
    console.error('[moveOffer] event error:', err)
    await svc.from('offers').update({ status: from }).eq('id', ctx.offerId).eq('status', to)
    return 'Could not record the change, so it was undone — try again'
  }
  return null
}

/**
 * draft → presented, `offer.presented`, inquiry → `offer_presented`. Shared by "Mark as
 * presented" and by "Client accepted" on a draft offer, where presented is recorded on
 * the way (tj D2.2). The message is attached when there is one.
 */
async function presentOffer(
  svc:       ServiceClient,
  ctx:       OfferContext,
  userId:    string,
  messageId: string | null,
): Promise<string | null> {
  let channel: EventChannel | null = null
  if (messageId != null) {
    channel = await messageChannel(svc, messageId, ctx.inquiryId)
    if (channel == null) return 'Message not found in this inquiry'
  }

  const err = await moveOffer(svc, ctx, 'draft', 'presented', {
    type:      'offer.presented',
    actor:     { kind: 'admin', id: userId },
    source:    'app',
    channel,
    messageId,
    payload:   { offer_id: ctx.offerId },
  })
  if (err != null) return err

  await proposeTransition(svc, ctx.inquiryId, 'offer_presented', userId, 'Offer presented to angler', 'presentOffer')
  return null
}

// ─── markOfferPresented ───────────────────────────────────────────────────────

export async function markOfferPresented(
  offerId:    string,
  messageId?: string | null,
): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const svc = createServiceClient()

  const read = await readOfferContext(svc, offerId)
  if (!read.ok) return { success: false, error: read.error }
  if (read.ctx.offerStatus !== 'draft') {
    return { success: false, error: `A ${read.ctx.offerStatus} offer cannot be marked as presented` }
  }

  const err = await presentOffer(svc, read.ctx, userId, messageId ?? null)
  if (err != null) return { success: false, error: err }

  revalidatePath('/admin/inquiries/' + read.ctx.inquiryId)
  return { success: true }
}

// ─── markClientAccepted ───────────────────────────────────────────────────────

/**
 * The angler picked an option. Works on a draft offer too — "presented" is recorded
 * first (tj D2.2). The option is flagged before the offer moves, and both are undone
 * if the event cannot be written.
 */
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
    .maybeSingle()

  if (option == null) {
    return { success: false, error: 'Option not found or does not belong to this offer' }
  }

  const read = await readOfferContext(svc, offerId)
  if (!read.ok) return { success: false, error: read.error }
  const ctx = read.ctx
  if (ctx.offerStatus === 'accepted') {
    return { success: false, error: 'An option is already accepted — use “Change accepted option” first' }
  }
  if (ctx.offerStatus !== 'draft' && ctx.offerStatus !== 'presented') {
    return { success: false, error: `A ${ctx.offerStatus} offer cannot be accepted` }
  }

  if (ctx.offerStatus === 'draft') {
    const err = await presentOffer(svc, ctx, userId, null)
    if (err != null) return { success: false, error: err }
  }

  // One accepted option per offer (partial unique index offer_options_one_accepted_idx);
  // none is accepted while the offer is draft or presented.
  const { error: optErr } = await svc
    .from('offer_options')
    .update({ is_accepted: true })
    .eq('id', optionId)
    .eq('offer_id', offerId)
  if (optErr != null) {
    console.error('[markClientAccepted] option update error:', optErr)
    return { success: false, error: 'Could not mark the option as accepted' }
  }

  const err = await moveOffer(svc, ctx, 'presented', 'accepted', {
    type:      'offer.accepted',
    actor:     { kind: 'admin', id: userId },
    source:    'app',
    messageId: messageId ?? null,
    payload:   { offer_id: offerId, option_id: optionId },
  })
  if (err != null) {
    await svc.from('offer_options').update({ is_accepted: false }).eq('id', optionId)
    return { success: false, error: err }
  }

  // Status stays offer_presented — awaiting_payment is reached only via createPaymentLink
  // (FA-1.29 D1). The public acceptOffer path is handled separately (deferred-tasks.md D1).

  revalidatePath('/admin/inquiries/' + ctx.inquiryId)
  return { success: true }
}

// ─── backToDraft ──────────────────────────────────────────────────────────────

/** presented → draft (tj D2.3). The inquiry status is left as it is. */
export async function backToDraft(offerId: string): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const svc = createServiceClient()

  const read = await readOfferContext(svc, offerId)
  if (!read.ok) return { success: false, error: read.error }
  if (read.ctx.offerStatus !== 'presented') {
    return { success: false, error: `A ${read.ctx.offerStatus} offer cannot go back to draft` }
  }

  const err = await moveOffer(svc, read.ctx, 'presented', 'draft', {
    type:    'offer.reverted',
    actor:   { kind: 'admin', id: userId },
    source:  'app',
    channel: 'app',
    payload: { offer_id: offerId, from: 'presented', to: 'draft' },
  })
  if (err != null) return { success: false, error: err }

  revalidatePath('/admin/inquiries/' + read.ctx.inquiryId)
  return { success: true }
}

// ─── changeAcceptedOption ─────────────────────────────────────────────────────

/**
 * accepted → presented: the accepted option is cleared so another can be picked
 * (tj D2.3). With a deposit link out (tj D2.5), the link is deactivated in Stripe
 * first — if that fails nothing changes — and the inquiry goes back from
 * awaiting_payment to offer_presented, so the angler cannot pay for a withdrawn option.
 *
 * The deposit amount was set for the withdrawn option, so it is cleared too (tj
 * 2026-10-27, option B) and the card asks for it again with the new option's hint.
 * The old amount, currency and frozen rate go into offer.reverted; if a later step
 * fails, the deposit is put back.
 *
 * A payment landing between the deactivation and the status change is not handled
 * here (docs/deferred-tasks.md, FA-1.76).
 */
export async function changeAcceptedOption(offerId: string): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const svc = createServiceClient()

  const read = await readOfferContext(svc, offerId)
  if (!read.ok) return { success: false, error: read.error }
  const ctx = read.ctx
  if (ctx.offerStatus !== 'accepted') {
    return { success: false, error: `No accepted option to change — the offer is ${ctx.offerStatus}` }
  }

  const { data: accepted } = await svc
    .from('offer_options')
    .select('id')
    .eq('offer_id', offerId)
    .eq('is_accepted', true)
    .maybeSingle()

  const { data: dep } = await svc
    .from('inquiries')
    .select('deposit_amount_cents, deposit_currency, deposit_eur_rate, deposit_eur_rate_at')
    .eq('id', ctx.inquiryId)
    .maybeSingle()
  const oldDeposit = dep?.deposit_amount_cents != null ? dep : null

  /** Puts the cleared deposit back when a later step fails — the option stays accepted. */
  async function restoreDeposit(): Promise<void> {
    if (oldDeposit == null) return
    const { error } = await svc
      .from('inquiries')
      .update(oldDeposit)
      .eq('id', ctx.inquiryId)
      .is('deposit_amount_cents', null)
    if (error != null) console.error('[changeAcceptedOption] deposit restore error:', error)
  }

  const linkId = ctx.depositPaymentLinkId
  if (linkId != null) {
    try {
      await stripe.paymentLinks.update(linkId, { active: false })
    } catch (err) {
      console.error('[changeAcceptedOption] Could not deactivate link:', err)
      return { success: false, error: `Could not deactivate the payment link — nothing was changed. (${err instanceof Error ? err.message : 'Stripe error'})` }
    }
  }

  if (linkId != null || oldDeposit != null) {
    // The link is dead: forget it, or createPaymentLink would hand the same URL out again.
    // The deposit belonged to the withdrawn option (all four columns — deposit_cents_all_or_nothing).
    let clear = svc
      .from('inquiries')
      .update({
        deposit_amount_cents: null,
        deposit_currency:     null,
        deposit_eur_rate:     null,
        deposit_eur_rate_at:  null,
        ...(linkId != null ? { deposit_payment_link_id: null, deposit_payment_link_url: null } : {}),
      })
      .eq('id', ctx.inquiryId)
    if (linkId != null) clear = clear.eq('deposit_payment_link_id', linkId)
    const { error: clearErr } = await clear
    if (clearErr != null) {
      console.error('[changeAcceptedOption] inquiry clear error:', clearErr)
      return {
        success: false,
        error:   linkId != null
          ? 'The payment link was deactivated in Stripe, but the inquiry could not be updated — reload and try again'
          : 'Could not clear the deposit amount — nothing was changed',
      }
    }
  }

  if (ctx.inquiryStatus === 'awaiting_payment') {
    try {
      await transition(svc, ctx.inquiryId, 'offer_presented', {
        actor:  { kind: 'admin', id: userId },
        reason: 'Accepted option withdrawn — deposit link deactivated',
      })
    } catch (err) {
      console.error('[changeAcceptedOption] transition error:', err)
      await restoreDeposit()
      return { success: false, error: `The payment link was deactivated, but the status could not go back: ${err instanceof Error ? err.message : 'unknown error'}` }
    }
  }

  const { error: optErr } = await svc
    .from('offer_options')
    .update({ is_accepted: false })
    .eq('offer_id', offerId)
    .eq('is_accepted', true)
  if (optErr != null) {
    console.error('[changeAcceptedOption] option update error:', optErr)
    await restoreDeposit()
    return { success: false, error: 'Could not clear the accepted option' }
  }

  const err = await moveOffer(svc, ctx, 'accepted', 'presented', {
    type:    'offer.reverted',
    actor:   { kind: 'admin', id: userId },
    source:  'app',
    channel: 'app',
    payload: {
      offer_id:  offerId,
      from:      'accepted',
      to:        'presented',
      option_id: accepted?.id ?? null,
      ...(linkId != null ? { link_id: linkId } : {}),
      ...(oldDeposit != null
        ? {
            deposit_cleared: {
              amount_cents: oldDeposit.deposit_amount_cents,
              currency:     oldDeposit.deposit_currency,
              eur_rate:     oldDeposit.deposit_eur_rate,
              eur_rate_at:  oldDeposit.deposit_eur_rate_at,
            },
          }
        : {}),
    },
  })
  if (err != null) {
    if (accepted != null) await svc.from('offer_options').update({ is_accepted: true }).eq('id', accepted.id)
    await restoreDeposit()
    return { success: false, error: err }
  }

  revalidatePath('/admin/inquiries/' + ctx.inquiryId)
  return { success: true }
}

// ─── reopenOffer ──────────────────────────────────────────────────────────────

/** declined → draft, for an angler who came back (tj D5 a). */
export async function reopenOffer(offerId: string): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const svc = createServiceClient()

  const read = await readOfferContext(svc, offerId)
  if (!read.ok) return { success: false, error: read.error }
  if (read.ctx.offerStatus !== 'declined') {
    return { success: false, error: `Only a declined offer can be reopened — this one is ${read.ctx.offerStatus}` }
  }

  const err = await moveOffer(svc, read.ctx, 'declined', 'draft', {
    type:    'offer.reverted',
    actor:   { kind: 'admin', id: userId },
    source:  'app',
    channel: 'app',
    payload: { offer_id: offerId, from: 'declined', to: 'draft' },
  })
  if (err != null) return { success: false, error: err }

  revalidatePath('/admin/inquiries/' + read.ctx.inquiryId)
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

// ─── Guide steps after payment ────────────────────────────────────────────────

const PAID_STATUSES = ['paid', 'handed_over', 'completed']

/**
 * Reads the paid inquiry and, when given, checks the message belongs to it. The message
 * is optional (tj D2.4): the guide is often told by WhatsApp or phone.
 */
async function readPaidInquiry(
  svc:       ServiceClient,
  inquiryId: string,
  messageId: string | null,
): Promise<{ ok: true; status: string; channel: EventChannel | null } | { ok: false; error: string }> {
  const { data: inquiry } = await svc
    .from('inquiries')
    .select('id, status')
    .eq('id', inquiryId)
    .maybeSingle()
  if (inquiry == null) return { ok: false, error: 'Inquiry not found' }
  if (!PAID_STATUSES.includes(inquiry.status)) {
    return { ok: false, error: `The deposit is not paid yet — the inquiry is ${inquiry.status}` }
  }

  let channel: EventChannel | null = null
  if (messageId != null) {
    channel = await messageChannel(svc, messageId, inquiryId)
    if (channel == null) return { ok: false, error: 'Message not found in this inquiry' }
  }
  return { ok: true, status: inquiry.status, channel }
}

// ─── markGuideNotifiedPaid ────────────────────────────────────────────────────

export async function markGuideNotifiedPaid(
  inquiryId:  string,
  messageId?: string | null,
): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const svc = createServiceClient()

  const read = await readPaidInquiry(svc, inquiryId, messageId ?? null)
  if (!read.ok) return { success: false, error: read.error }

  // The card reads this event with maybeSingle — a second one would hide it.
  const { data: existing } = await svc
    .from('inquiry_events')
    .select('id')
    .eq('inquiry_id', inquiryId)
    .eq('type', 'guide.notified_paid')
    .limit(1)
  if ((existing ?? []).length > 0) return { success: false, error: 'The guide is already marked as notified' }

  await emitEvent(svc, {
    inquiryId,
    type:      'guide.notified_paid',
    actor:     { kind: 'admin', id: userId },
    source:    'app',
    channel:   read.channel,
    messageId: messageId ?? null,
  })

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true }
}

// ─── markContactsExchanged ────────────────────────────────────────────────────

export async function markContactsExchanged(
  inquiryId:  string,
  messageId?: string | null,
): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const svc = createServiceClient()

  const read = await readPaidInquiry(svc, inquiryId, messageId ?? null)
  if (!read.ok) return { success: false, error: read.error }
  if (read.status !== 'paid') return { success: false, error: 'Contacts are already exchanged' }

  await emitEvent(svc, {
    inquiryId,
    type:      'contacts.exchanged',
    actor:     { kind: 'admin', id: userId },
    source:    'app',
    channel:   read.channel,
    messageId: messageId ?? null,
  })

  await proposeTransition(svc, inquiryId, 'handed_over', userId, 'Contacts exchanged', 'markContactsExchanged')

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true }
}

// ─── createPaymentLink ────────────────────────────────────────────────────────

export type CreatePaymentLinkResult =
  | { success: true;  url: string; draftId?: string; draftError?: string }
  | { success: false; error: string }

export async function createPaymentLink(
  inquiryId: string,
  product:   ProductDetails,
): Promise<CreatePaymentLinkResult> {
  const { userId } = await requireAdmin()
  const checked = checkProductDetails(product)
  if (!checked.ok) return { success: false, error: checked.error }
  const { name, description } = checked.details
  const svc = createServiceClient()

  const { data: inq } = await svc
    .from('inquiries')
    .select('id, angler_name, angler_email, party_size, deposit_amount_cents, deposit_currency, deposit_payment_link_id, deposit_payment_link_url, trip_id, experience_page_id, requested_dates, message, trip_country, assigned_guide_id, status')
    .eq('id', inquiryId)
    .single()
  if (inq == null) return { success: false, error: 'Inquiry not found' }

  if (inq.deposit_amount_cents == null || inq.deposit_currency == null) {
    return { success: false, error: 'Deposit amount not set — save an amount before creating a link' }
  }

  const amountCents = inq.deposit_amount_cents
  const currency    = inq.deposit_currency  // uppercase per FA-1.28 (EUR, USD, ISK, NZD)

  // ── One active link per inquiry ───────────────────────────────────────────
  // If a link already exists, check the amount/currency it was created for.
  // The payload of the latest payment.link_sent event for that link_id carries
  // { amount_cents, currency, link_id } — no new column needed.
  if (inq.deposit_payment_link_id != null) {
    const { data: evtRow } = await svc
      .from('inquiry_events')
      .select('payload')
      .eq('inquiry_id', inquiryId)
      .eq('type', 'payment.link_sent')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const evt = evtRow?.payload as { link_id?: string; amount_cents?: number; currency?: string } | null
    if (
      evt?.link_id    === inq.deposit_payment_link_id &&
      evt?.amount_cents === amountCents &&
      evt?.currency    === currency
    ) {
      // Same amount and currency — re-use the existing Stripe link
      revalidatePath('/admin/inquiries/' + inquiryId)
      return { success: true, url: inq.deposit_payment_link_url! }
    }

    // Amount or currency changed — must deactivate the old link before creating a new one
    try {
      await stripe.paymentLinks.update(inq.deposit_payment_link_id, { active: false })
    } catch (err) {
      console.error('[createPaymentLink] Could not deactivate old link:', err)
      return { success: false, error: `Could not deactivate old payment link — retry or contact support. (${err instanceof Error ? err.message : 'Stripe error'})` }
    }
  }

  // ── Fetch experience / trip title for the draft ───────────────────────────
  const experience   = await getInquiryExperience({
    experience_page_id: inq.experience_page_id ?? null,
    trip_id:            inq.trip_id ?? null,
  }).catch(() => null)
  const tripTitle      = tripTitleOf(experience) ?? TRIP_TITLE_FALLBACK
  const requestedDates = (inq.requested_dates ?? []) as string[]
  const partySize      = inq.party_size ?? 1

  // ── Create new Stripe link ────────────────────────────────────────────────
  // Product is created explicitly so we can set both name and description
  // (prices.create product_data has no description field — decision tj 2026-09-25).
  // One product per link, so renaming it later (updatePaymentLinkDetails) touches one link.
  // All four deposit currencies (EUR, USD, ISK, NZD) use ×100 storage — which matches
  // Stripe's unit_amount convention for these currencies (Stripe docs: ISK requires
  // a two-decimal representation ending in 00, e.g. 500 for 5 ISK — same ×100 as EUR).
  let paymentLink: { url: string; id: string; productId: string }
  try {
    const stripeProduct = await stripe.products.create({
      name,
      description,
      metadata:    { inquiry_id: inquiryId },
    })
    const price = await stripe.prices.create({
      currency:    currency.toLowerCase(),
      unit_amount: amountCents,
      product:     stripeProduct.id,
    })
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata:   { inquiry_id: inquiryId, payment_type: 'inquiry_deposit' },
      after_completion: {
        type:     'redirect',
        redirect: { url: `${env.NEXT_PUBLIC_APP_URL}/inquiry/${inquiryId}/confirmed` },
      },
    })
    paymentLink = { url: link.url, id: link.id, productId: stripeProduct.id }
  } catch (err) {
    console.error('[createPaymentLink] Stripe error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Stripe error' }
  }

  // Persist link id and URL on the inquiry row
  await svc
    .from('inquiries')
    .update({ deposit_payment_link_id: paymentLink.id, deposit_payment_link_url: paymentLink.url })
    .eq('id', inquiryId)

  // AI draft — always inserts a new row (never overwrites an existing draft).
  // If the draft fails, the link is still valid and visible on the card (O-23).
  let draftId:    string | undefined
  let draftError: string | undefined
  try {
    const amountString = formatDepositAmount(amountCents, currency)

    // Fetch thread messages for context
    const { data: threadData } = await svc
      .from('messages')
      .select('direction, channel, body, occurred_at, counterpart')
      .eq('inquiry_id', inquiryId)
      .neq('status', 'draft')
      .order('occurred_at', { ascending: true })
    const threadMessages = (threadData ?? []) as ConversationMessage[]

    // Fetch guide name
    let guideName: string | null = null
    if (inq.assigned_guide_id != null) {
      const { data: g } = await svc
        .from('guides')
        .select('full_name')
        .eq('id', inq.assigned_guide_id)
        .single()
      guideName = g?.full_name ?? null
    }

    // Load knowledge
    const { instructions, entries } = await loadKnowledge({
      country: inq.trip_country,
      guideId: inq.assigned_guide_id,
    })
    if (instructions == null) {
      throw new Error('No active instructions in agent_knowledge — add one before drafting.')
    }

    const draftText = await draftDepositLinkMessage({
      inquiryId,
      anglerName:      inq.angler_name,
      anglerMessage:   inq.message ?? null,
      requestedDates,
      partySize,
      status:          inq.status,
      guideName,
      instructions,
      knowledgeEntries: entries,
      tripTitle,
      amountString,
      linkUrl:         paymentLink.url,
      threadMessages,
    })

    // Always INSERT — never overwrite an existing draft
    const { data: inserted, error: insertErr } = await svc
      .from('messages')
      .insert({
        inquiry_id:  inquiryId,
        channel:     'email',
        direction:   'outbound',
        counterpart: 'angler',
        body:        draftText,
        status:      'draft',
        drafted_by:  'agent',
        occurred_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (insertErr != null) throw insertErr
    draftId = inserted.id
  } catch (err) {
    console.error('[createPaymentLink] draft error:', err)
    draftError = err instanceof Error ? err.message : 'Draft failed'
  }

  await emitEvent(svc, {
    inquiryId,
    type:    'payment.link_sent',
    actor:   { kind: 'admin', id: userId },
    source:  'app',
    channel: 'app',
    payload: { amount_cents: amountCents, currency, link_id: paymentLink.id, product_id: paymentLink.productId, name, description },
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
  return { success: true, url: paymentLink.url, draftId, draftError }
}

// ─── updatePaymentLinkDetails — FA-1.77 ──────────────────────────────────────

/**
 * Admin changes the name / description the angler sees on the active link's payment
 * page. tj D3 (a): the product is updated in Stripe, the link and its URL stay — Stripe
 * renders the payment page from the product ("The product's name and image are used to
 * render the payment page", docs.stripe.com/products-prices/how-products-and-prices-work).
 * No inquiry column changes; the event is the record.
 */
export async function updatePaymentLinkDetails(
  inquiryId: string,
  product:   ProductDetails,
): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const checked = checkProductDetails(product)
  if (!checked.ok) return { success: false, error: checked.error }
  const after = checked.details
  const svc = createServiceClient()

  const { data: inq } = await svc
    .from('inquiries')
    .select('deposit_payment_link_id, deposit_paid_at')
    .eq('id', inquiryId)
    .single()
  if (inq == null) return { success: false, error: 'Inquiry not found' }
  const linkId = inq.deposit_payment_link_id
  if (linkId == null) return { success: false, error: 'No active payment link — create one first' }
  if (inq.deposit_paid_at != null) return { success: false, error: 'The deposit is already paid' }

  const { data: evtRows, error: evtErr } = await svc
    .from('inquiry_events')
    .select('type, payload')
    .eq('inquiry_id', inquiryId)
    .in('type', ['payment.link_sent', 'payment.link_details_updated'])
    .order('occurred_at', { ascending: true })
    .order('id', { ascending: true })
  if (evtErr != null) return { success: false, error: evtErr.message }
  const recorded = linkProductFromEvents(evtRows ?? [], linkId)

  // Links created before FA-1.77 have no product id in the log: ask Stripe.
  let productId = recorded.productId
  let before    = recorded.details
  try {
    if (productId == null) {
      const items = await stripe.paymentLinks.listLineItems(linkId, { limit: 1, expand: ['data.price.product'] })
      const p = items.data[0]?.price?.product
      if (p == null) return { success: false, error: 'Stripe returned no product for this link' }
      if (typeof p === 'string') {
        productId = p
      } else {
        productId = p.id
        if (before == null && !('deleted' in p && p.deleted === true)) {
          before = { name: p.name, description: p.description ?? '' }
        }
      }
    }
    if (before != null && before.name === after.name && before.description === after.description) {
      return { success: true }
    }
    await stripe.products.update(productId, { name: after.name, description: after.description })
  } catch (err) {
    console.error('[updatePaymentLinkDetails] Stripe error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Stripe error' }
  }

  await emitEvent(svc, {
    inquiryId,
    type:    'payment.link_details_updated',
    actor:   { kind: 'admin', id: userId },
    source:  'app',
    channel: 'app',
    payload: { link_id: linkId, product_id: productId, before, after },
  })

  revalidatePath('/admin/inquiries/' + inquiryId)
  return { success: true }
}

// ─── getDepositLinkDraft — FA-1.30 ───────────────────────────────────────────

/**
 * Returns the latest agent draft for an inquiry if its body contains the
 * active deposit payment link URL. Older drafts (or drafts for a different link)
 * return null so they don't pre-fill the composer. Fix 5, FA-1.30.
 */
export async function getDepositLinkDraft(
  inquiryId: string,
  linkUrl:   string | null,
): Promise<{ id: string; body: string } | null> {
  if (linkUrl == null) return null
  await requireAdmin()
  const svc = createServiceClient()
  const { data } = await svc
    .from('messages')
    .select('id, body')
    .eq('inquiry_id', inquiryId)
    .eq('status', 'draft')
    .eq('direction', 'outbound')
    .eq('counterpart', 'angler')
    .eq('drafted_by', 'agent')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data == null || !data.body.includes(linkUrl)) return null
  return data as { id: string; body: string }
}

// ─── proposeDraft — FA-1.14 ───────────────────────────────────────────────────

export type ProposeDraftResult =
  | { success: true;  draftId: string; text: string; subject: string | null; usedIds: string[] }
  | { success: false; error: string }

/**
 * Admin clicks "zaproponuj": calls the draft-reply agent and returns the text.
 * Saves a status='draft' row in messages. Does not send.
 */
export async function proposeDraft(
  inquiryId:   string,
  counterpart: 'angler' | 'guide',
  channel:     'email' | 'whatsapp' | 'instagram',
): Promise<ProposeDraftResult> {
  await requireAdmin()
  const { draftReply } = await import('@/lib/ai/draft-reply')
  try {
    const result = await draftReply({ inquiryId, counterpart, channel, allowFormOnly: true })
    revalidatePath('/admin/inquiries/' + inquiryId)
    // Not a spread: usedEntries carries the knowledge bodies, which the client has no use for.
    return { success: true, draftId: result.draftId, text: result.text, subject: result.subject, usedIds: result.usedIds }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
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
