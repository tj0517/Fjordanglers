import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { TripAcceptancePanel } from './TripAcceptancePanel'
import { TripBriefCard } from '@/components/dashboard/TripBriefCard'
import { GuideTodoList } from '@/components/dashboard/GuideTodoList'
import type { TripDetails } from '@/actions/inquiries'

export const revalidate = 0

export const metadata = { title: 'Trip Detail — Guide Dashboard' }

const COUNTRY_FLAG: Record<string, string> = {
  PL: '🇵🇱', DE: '🇩🇪', FR: '🇫🇷', GB: '🇬🇧', NL: '🇳🇱',
  SE: '🇸🇪', NO: '🇳🇴', FI: '🇫🇮', DK: '🇩🇰', IS: '🇮🇸',
  CZ: '🇨🇿', SK: '🇸🇰', HU: '🇭🇺', AT: '🇦🇹', CH: '🇨🇭',
  US: '🇺🇸', CA: '🇨🇦', AU: '🇦🇺',
}

export default async function GuideTripDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ action?: string }>
}) {
  const [{ id }, { action }] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) {
    const returnPath = action === 'accept'
      ? `/dashboard/trips/${id}?action=accept`
      : `/dashboard/trips/${id}`
    redirect(`/login?next=${encodeURIComponent(returnPath)}`)
  }

  const svc = createServiceClient()

  const { data: guide } = await svc
    .from('guides')
    .select('id, fish_expertise')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')

  // Fetch inquiry — only if assigned to this guide (ownership check)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawInquiry } = await (svc as any)
    .from('inquiries')
    .select('id, angler_name, angler_country, party_size, requested_dates, message, guide_acceptance, guide_decline_reason, guide_offer_eta, external_offer_sent')
    .eq('id', id)
    .eq('assigned_guide_id', guide.id)
    .single()

  if (rawInquiry == null) notFound()

  const inquiry = rawInquiry as {
    id: string
    angler_name: string
    angler_country: string | null
    party_size: number
    requested_dates: string[] | null
    message: string | null
    guide_acceptance: string | null
    guide_decline_reason: string | null
    guide_offer_eta: string | null
    external_offer_sent: boolean
  }

  // Fetch trip brief (graceful — table may not exist yet)
  let tripDetails: TripDetails | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tdData } = await (svc as any)
      .from('inquiry_trip_details')
      .select('confirmed_date,confirmed_party_size,price_range,date_flexibility,target_species,accommodation,guide_notes,guide_final_dates,guide_options')
      .eq('inquiry_id', id)
      .maybeSingle()
    if (tdData != null) tripDetails = tdData as TripDetails
  } catch {
    // Table not yet migrated — graceful fallback
  }

  const flag = COUNTRY_FLAG[inquiry.angler_country ?? ''] ?? ''

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/dashboard/trips" className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}>
          My Trips
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>
          {inquiry.angler_name}
        </span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold f-display" style={{ color: '#0A2E4D' }}>
          {flag && <span className="mr-2">{flag}</span>}
          {inquiry.angler_name}
        </h1>
      </div>

      {/* Acceptance panel */}
      <TripAcceptancePanel
        inquiryId={inquiry.id}
        guideAcceptance={inquiry.guide_acceptance}
        guideDeclineReason={inquiry.guide_decline_reason}
        guideOfferEta={inquiry.guide_offer_eta}
        autoAccept={action === 'accept'}
      />

      {/* Trip brief */}
      <TripBriefCard
        anglerName={inquiry.angler_name}
        requestedDates={inquiry.requested_dates ?? []}
        partySize={inquiry.party_size}
        details={tripDetails}
      />

      {/* Angler message */}
      {inquiry.message != null && inquiry.message.trim() !== '' && (
        <div className="rounded-[22px] px-6 py-5 mb-4"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-2"
            style={{ color: 'rgba(10,46,77,0.38)' }}>Angler&apos;s message</p>
          <p className="text-sm f-body leading-relaxed italic" style={{ color: '#0A2E4D' }}>
            &ldquo;{inquiry.message}&rdquo;
          </p>
        </div>
      )}

      {/* Guide offer form */}
      <GuideTodoList
        inquiryId={inquiry.id}
        initialDetails={tripDetails}
        guideSpecies={(guide as { id: string; fish_expertise?: string[] }).fish_expertise ?? []}
        externalOfferSent={inquiry.external_offer_sent ?? false}
      />

    </div>
  )
}
