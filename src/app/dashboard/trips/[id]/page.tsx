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
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login')

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
    .select('id, angler_name, angler_country, party_size, requested_dates, trip_id, guide_acceptance, guide_decline_reason, guide_offer_eta, external_offer_sent')
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
    trip_id: string | null
    guide_acceptance: string | null
    guide_decline_reason: string | null
    guide_offer_eta: string | null
    external_offer_sent: boolean
  }

  const { data: trip } = inquiry.trip_id
    ? await svc.from('experiences').select('title').eq('id', inquiry.trip_id).single()
    : { data: null }

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
        {trip?.title != null && (
          <p className="text-sm f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
            {trip.title}
          </p>
        )}
      </div>

      {/* Acceptance panel */}
      <TripAcceptancePanel
        inquiryId={inquiry.id}
        guideAcceptance={inquiry.guide_acceptance}
        guideDeclineReason={inquiry.guide_decline_reason}
        guideOfferEta={inquiry.guide_offer_eta}
      />

      {/* Trip brief */}
      <TripBriefCard
        anglerName={inquiry.angler_name}
        requestedDates={inquiry.requested_dates ?? []}
        partySize={inquiry.party_size}
        experienceTitle={trip?.title ?? null}
        details={tripDetails}
      />

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
