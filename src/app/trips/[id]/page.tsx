import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Calendar } from 'lucide-react'
import { getExperience, getMoreFromGuide } from '@/lib/supabase/queries'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ExperienceGallery } from '@/components/trips/experience-gallery'
import { AccommodationGallery } from '@/components/trips/accommodation-gallery'
import { ExperienceLocationMap } from '@/components/trips/experience-location-map-client'
import { SpeciesCard } from '@/components/trips/species-card'
import { BookingWidget, MobileBookingBar } from '@/components/trips/booking-widget'
import DurationCardsSelector from '@/components/trips/duration-cards-selector'
import type { AvailConfigRow } from '@/components/trips/booking-widget'
import type { SpeciesInfo, FishVariant } from '@/components/trips/species-card'
import type { ExperienceWithGuide } from '@/types'
import type { DurationOptionPayload, ItineraryStep } from '@/actions/experiences'
import { FISH_IMG } from '@/lib/fish'
import { heroFull, gallerySlide, cardThumb, avatarImg } from '@/lib/image'
import { getLandscapeUrl } from '@/lib/landscapes'
import { CountryFlag } from '@/components/ui/country-flag'
import { TripDetailNav } from '@/components/trips/trip-detail-nav'
import { AvailabilityPreviewCalendar } from '@/components/trips/availability-preview-calendar'
import { getPaymentModel } from '@/lib/payment-model'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'All Levels', intermediate: 'Intermediate', expert: 'Expert',
}

// ─── License guide article URLs per country ───────────────────────────────────
// Link to a blog post explaining how to get a fishing license in each country.
// Add the slug once the article is published; null = no link yet.

const LICENSE_ARTICLE: Record<string, string | null> = {
  Norway:  null, // e.g. '/blog/fishing-license-norway'
  Sweden:  null,
  Finland: null,
  Iceland: null,
}

// satisfies ensures every entry conforms to SpeciesInfo (with correct variant literal)
const v = (x: FishVariant) => x

const FISH_INFO: Record<string, SpeciesInfo> = {
  'Salmon': {
    variant: v('salmon'),
    tagline: 'The King of the River',
    desc: 'Powerful, acrobatic fighters that run from the sea into Nordic rivers each summer. Fresh-run fish are chrome-bright and explosive on the take.',
    trophy: 'up to 20 kg',
    bg: 'linear-gradient(135deg, rgba(230,126,80,0.14) 0%, rgba(230,126,80,0.06) 100%)',
    accent: '#E67E50',
    photo: FISH_IMG['Salmon'],
  },
  'Atlantic Salmon': {
    variant: v('salmon'),
    tagline: 'The King of the River',
    desc: 'Powerful, acrobatic fighters that run from the sea into Nordic rivers each summer. Fresh-run fish are chrome-bright and explosive on the take.',
    trophy: 'up to 20 kg',
    bg: 'linear-gradient(135deg, rgba(230,126,80,0.14) 0%, rgba(230,126,80,0.06) 100%)',
    accent: '#E67E50',
    photo: FISH_IMG['Salmon'],
  },
  'Sea Trout': {
    variant: v('salmon'),
    tagline: 'The Silver Ghost',
    desc: 'Sea-run brown trout that return to estuaries and rivers — notoriously wary, nocturnally active, and one of fly fishing\'s greatest challenges.',
    trophy: 'up to 10 kg',
    bg: 'linear-gradient(135deg, rgba(100,160,200,0.14) 0%, rgba(100,160,200,0.06) 100%)',
    accent: '#4A9FC0',
    photo: FISH_IMG['Sea Trout'],
  },
  'Brown Trout': {
    variant: v('salmon'),
    tagline: 'The Wild Trout',
    desc: 'Beautifully spotted residents of cold mountain streams. Selective dry-fly feeders that reward precise presentation and careful wading.',
    trophy: 'up to 8 kg',
    bg: 'linear-gradient(135deg, rgba(160,100,50,0.14) 0%, rgba(160,100,50,0.06) 100%)',
    accent: '#A06432',
    photo: FISH_IMG['Brown Trout'],
  },
  'Rainbow Trout': {
    variant: v('salmon'),
    tagline: 'The Acrobat',
    desc: 'Hard-fighting and spectacular jumpers, rainbow trout thrive in fast, cold Nordic streams. Famous for their iridescent lateral stripe and sheer power.',
    trophy: 'up to 5 kg',
    bg: 'linear-gradient(135deg, rgba(180,120,200,0.14) 0%, rgba(180,120,200,0.06) 100%)',
    accent: '#B478C8',
    photo: FISH_IMG['Rainbow Trout'],
  },
  'Trout': {
    variant: v('salmon'),
    tagline: 'The Wild Trout',
    desc: 'Beautifully spotted residents of cold Nordic streams and lakes. Selective feeders that reward precise presentation and careful wading.',
    trophy: 'up to 10 kg',
    bg: 'linear-gradient(135deg, rgba(160,100,50,0.14) 0%, rgba(160,100,50,0.06) 100%)',
    accent: '#A06432',
    photo: FISH_IMG['Trout'],
  },
  'Arctic Char': {
    variant: v('salmon'),
    tagline: 'The Glacial Relic',
    desc: 'A living relic of the Ice Age, found only in the coldest Nordic lakes. Rarely targeted and breathtakingly beautiful — a true bucket-list catch.',
    trophy: 'up to 6 kg',
    bg: 'linear-gradient(135deg, rgba(80,180,220,0.14) 0%, rgba(80,180,220,0.06) 100%)',
    accent: '#50B4DC',
    photo: FISH_IMG['Arctic Char'],
  },
  'Grayling': {
    variant: v('perch'),
    tagline: 'Lady of the Stream',
    desc: 'Fast-water fish with a striking sail-like dorsal fin. Found in the clearest, coldest Scandinavian rivers — a perfect dry-fly quarry.',
    trophy: 'up to 3 kg',
    bg: 'linear-gradient(135deg, rgba(130,100,200,0.14) 0%, rgba(130,100,200,0.06) 100%)',
    accent: '#8264C8',
    photo: FISH_IMG['Grayling'],
  },
  'Whitefish': {
    variant: v('perch'),
    tagline: 'The Nordic Table Fish',
    desc: 'Schooling fish of cold, clear Scandinavian lakes. Delicate on ultra-light tackle and fly — an underrated gem of Nordic freshwater fishing.',
    trophy: 'up to 2 kg',
    bg: 'linear-gradient(135deg, rgba(100,160,180,0.14) 0%, rgba(100,160,180,0.06) 100%)',
    accent: '#64A0B4',
    photo: FISH_IMG['Arctic Char'],
  },
  'Pike': {
    variant: v('pike'),
    tagline: 'The Apex Predator',
    desc: 'Ambush hunters lurking in weed beds and lily pads. Explosive strikers that hit big lures hard — Northern Europe\'s most exciting lure target.',
    trophy: 'up to 20 kg',
    bg: 'linear-gradient(135deg, rgba(60,130,80,0.14) 0%, rgba(60,130,80,0.06) 100%)',
    accent: '#3C8250',
    photo: FISH_IMG['Pike'],
  },
  'Perch': {
    variant: v('perch'),
    tagline: 'The Bold Striker',
    desc: 'Boldly striped schooling predators found throughout Scandinavian lakes. Aggressive biters on small lures — superb on light tackle.',
    trophy: 'up to 3 kg',
    bg: 'linear-gradient(135deg, rgba(80,150,60,0.14) 0%, rgba(80,150,60,0.06) 100%)',
    accent: '#509640',
    photo: FISH_IMG['Perch'],
  },
  'Zander': {
    variant: v('pike'),
    tagline: 'The Shadow Predator',
    desc: 'Elusive deep-water hunters with glassy eyes adapted for low light. Prized for their delicious white flesh and challenging, finesse-focused fishing.',
    trophy: 'up to 12 kg',
    bg: 'linear-gradient(135deg, rgba(60,80,120,0.14) 0%, rgba(60,80,120,0.06) 100%)',
    accent: '#3C5078',
    photo: FISH_IMG['Zander'],
  },
  'Cod': {
    variant: v('pike'),
    tagline: 'The Ocean Giant',
    desc: 'A staple of Nordic coastal fishing, cod are powerful bottom-dwellers found in the cold fjords of Norway. Heavy fighters on light sea gear.',
    trophy: 'up to 40 kg',
    bg: 'linear-gradient(135deg, rgba(100,130,100,0.14) 0%, rgba(100,130,100,0.06) 100%)',
    accent: '#6A8C5A',
    photo: FISH_IMG['Cod'],
  },
  'Pollock': {
    variant: v('pike'),
    tagline: 'The Fjord Fighter',
    desc: 'Fast-moving schooling predators of Norwegian fjords, pollock hit surface lures and jigs with aggression. Excellent eating and a true sport fish.',
    trophy: 'up to 10 kg',
    bg: 'linear-gradient(135deg, rgba(90,130,100,0.14) 0%, rgba(90,130,100,0.06) 100%)',
    accent: '#5A8264',
    photo: FISH_IMG['Cod'],
  },
  'Haddock': {
    variant: v('pike'),
    tagline: 'The Fjord Classic',
    desc: 'Found over rocky and sandy bottoms in Norwegian coastal waters, haddock are reliable targets on bottom rigs and perfect for family fishing trips.',
    trophy: 'up to 7 kg',
    bg: 'linear-gradient(135deg, rgba(110,130,90,0.14) 0%, rgba(110,130,90,0.06) 100%)',
    accent: '#6E825A',
    photo: FISH_IMG['Cod'],
  },
  'Halibut': {
    variant: v('pike'),
    tagline: 'The Ocean Floor King',
    desc: 'The largest flatfish in the sea — halibut can exceed 200 kg and are the ultimate big-game target in Norwegian coastal waters. A bucket-list fish.',
    trophy: 'up to 200 kg',
    bg: 'linear-gradient(135deg, rgba(80,100,130,0.14) 0%, rgba(80,100,130,0.06) 100%)',
    accent: '#506482',
    photo: FISH_IMG['Halibut'],
  },
  'Flounder': {
    variant: v('perch'),
    tagline: 'The Coastal Flatfish',
    desc: 'Small, tasty flatfish found in shallow coastal bays and estuaries. Ideal for light-tackle fishing and a great entry point for sea anglers.',
    trophy: 'up to 1 kg',
    bg: 'linear-gradient(135deg, rgba(90,110,140,0.14) 0%, rgba(90,110,140,0.06) 100%)',
    accent: '#5A6E8C',
    photo: FISH_IMG['Halibut'],
  },
  'Wolffish': {
    variant: v('pike'),
    tagline: 'The Deep-Water Dragon',
    desc: 'Powerful, toothy bottom-dwellers of cold Norwegian waters. Their fierce appearance belies superb eating — one of the most impressive catches on a Nordic sea trip.',
    trophy: 'up to 20 kg',
    bg: 'linear-gradient(135deg, rgba(70,70,100,0.14) 0%, rgba(70,70,100,0.06) 100%)',
    accent: '#464664',
    photo: FISH_IMG['Wolffish'],
  },
  'Norway Redfish': {
    variant: v('perch'),
    tagline: 'The Crimson Deep-Diver',
    desc: 'Brilliantly coloured deep-water fish found in Norwegian fjords. Redfish are reliable biters on jigs and soft plastics — a popular target on sea fishing charters.',
    trophy: 'up to 5 kg',
    bg: 'linear-gradient(135deg, rgba(200,60,60,0.14) 0%, rgba(200,60,60,0.06) 100%)',
    accent: '#C83C3C',
    photo: FISH_IMG['Norway Redfish'],
  },
  'Mackerel': {
    variant: v('perch'),
    tagline: 'The Coastal Sprinter',
    desc: 'Fast, schooling pelagic fish that flood Norwegian coasts every summer. Explosive on light lures and feathers — superb fun for all ages.',
    trophy: 'up to 1 kg',
    bg: 'linear-gradient(135deg, rgba(50,130,150,0.14) 0%, rgba(50,130,150,0.06) 100%)',
    accent: '#328296',
    photo: FISH_IMG['Mackerel'],
  },
  'Garfish': {
    variant: v('perch'),
    tagline: 'The Silver Needle',
    desc: 'Slender, acrobatic pelagic fish that leap clear of the water when hooked. A thrilling summer target on surface lures in Scandinavian coastal waters.',
    trophy: 'up to 1 kg',
    bg: 'linear-gradient(135deg, rgba(60,160,130,0.14) 0%, rgba(60,160,130,0.06) 100%)',
    accent: '#3CA082',
    photo: FISH_IMG['Mackerel'],
  },
  'Ling': {
    variant: v('pike'),
    tagline: 'The Deep Serpent',
    desc: 'Long, powerful members of the cod family found in deep Norwegian waters. Ling are hard fighters on heavy jigs and a prized catch on offshore trips.',
    trophy: 'up to 30 kg',
    bg: 'linear-gradient(135deg, rgba(80,110,80,0.14) 0%, rgba(80,110,80,0.06) 100%)',
    accent: '#506E50',
    photo: FISH_IMG['Cod'],
  },
}

// ─── MICRO-COMPONENTS ─────────────────────────────────────────────────────────

const GrainOverlay = () => (
  <div
    aria-hidden="true"
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage: GRAIN_BG,
      backgroundSize: '200px 200px',
      opacity: 0.06,
      mixBlendMode: 'screen',
      zIndex: 2,
    }}
  />
)

const SalmonRule = () => (
  <div className="w-10 h-px" style={{ background: '#E67E50' }} />
)

// ─── CANCELLATION POLICY ───────────────────────────────────────────────────────

const POLICY_CONFIG: Record<string, {
  label: string
  days: number
  detail: string
  color: string
  bg: string
  border: string
}> = {
  flexible: {
    label: 'Flexible',
    days: 7,
    detail: 'Cancel up to 7 days before for a full refund.',
    color: '#16A34A',
    bg: 'rgba(22,163,74,0.07)',
    border: 'rgba(22,163,74,0.18)',
  },
  moderate: {
    label: 'Moderate',
    days: 14,
    detail: 'Cancel up to 14 days before for a full refund. After that, the deposit is non-refundable.',
    color: '#D97706',
    bg: 'rgba(217,119,6,0.07)',
    border: 'rgba(217,119,6,0.18)',
  },
  strict: {
    label: 'Strict',
    days: 30,
    detail: 'Cancel up to 30 days before for a full refund. After that, no refund is given.',
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.07)',
    border: 'rgba(220,38,38,0.18)',
  },
}

function CancellationPolicyBanner({ policy }: { policy: string | null }) {
  const config = policy != null ? (POLICY_CONFIG[policy] ?? null) : null
  if (config == null) return null

  return (
    <section className="mb-12">
      <SalmonRule />
      <p
        className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-5 f-body"
        style={{ color: '#E67E50' }}
      >
        Cancellation Policy
      </p>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${config.border}`, background: config.bg }}
      >
        {/* Header row — policy badge + headline */}
        <div className="flex items-center gap-3 px-6 py-5">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full f-body flex-shrink-0"
            style={{ background: config.color, color: 'white' }}
          >
            {config.label}
          </span>
          <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
            Free cancellation up to {config.days} days before your trip
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: config.border }} />

        {/* Detail text */}
        <div className="px-6 py-4">
          <p className="text-sm leading-relaxed f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
            {config.detail}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: config.border }} />

        {/* Weather clause — always shown regardless of policy */}
        <div className="flex items-start gap-3 px-6 py-4">
          <span className="text-base flex-shrink-0 mt-0.5" role="img" aria-label="Weather">🌦️</span>
          <p className="text-sm leading-relaxed f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
            <span className="font-semibold" style={{ color: '#0A2E4D' }}>Bad weather? </span>
            Always a full refund or free reschedule — no questions asked.
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── METADATA ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const exp = await getExperience(id)
  if (!exp) return {}

  const coverImg =
    exp.images?.find((img: { url: string; is_cover: boolean }) => img.is_cover) ??
    exp.images?.[0]

  return {
    title: exp.title,
    description: exp.description ?? undefined,
    openGraph: {
      title: exp.title,
      description: exp.description ?? undefined,
      images: coverImg?.url
        ? [{ url: coverImg.url, width: 1200, height: 630, alt: exp.title }]
        : [],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: exp.title,
      description: exp.description ?? undefined,
      images: coverImg?.url ? [coverImg.url] : [],
    },
  }
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function ExperienceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // ── Fetch with auth client (no published filter) ─────────────────────────
  // The auth client respects RLS:
  //   • published + guide.status=active → visible to everyone (anon included)
  //   • draft → visible only to the guide who owns it (via "Guide reads own experiences" policy)
  //   • admins → can preview via /admin; for public page we show their own drafts too
  //
  // This means guides can visit /trips/[id] to preview their draft BEFORE publishing.
  // Anon visitors hitting a draft URL still get 404 (RLS returns null).
  const EXP_SELECT = '*, guide:guides(id, full_name, avatar_url, country, city, average_rating, cancellation_policy, languages), images:experience_images(id, experience_id, url, is_cover, sort_order, created_at)'

  // Try with auth client first (respects RLS — guides see own drafts)
  const supabase = await createClient()
  let { data: rawExp } = await supabase
    .from('experiences')
    .select(EXP_SELECT)
    .eq('id', id)
    .single()

  // If not found, check if admin — admins can preview any draft via service client
  if (rawExp == null) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user != null) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') {
        const svc = createServiceClient()
        const { data } = await svc.from('experiences').select(EXP_SELECT).eq('id', id).single()
        rawExp = data
      }
    }
  }

  if (rawExp == null) notFound()

  // Fetch linked accommodations separately — gracefully returns [] if migration not applied
  let linkedAccommodations: Array<{
    accommodation: { id: string; name: string; type: string; description: string | null; max_guests: number | null; location_note: string | null; images: string[] }
  }> = []
  try {
    const { data: accData } = await supabase
      .from('experience_accommodations')
      .select('accommodation:guide_accommodations ( id, name, type, description, max_guests, location_note, images )')
      .eq('experience_id', id)
    if (accData != null) {
      linkedAccommodations = accData as typeof linkedAccommodations
    }
  } catch {
    // Tables don't exist yet — ignore
  }

  const exp: ExperienceWithGuide = {
    ...(rawExp as unknown as ExperienceWithGuide),
    images: [...(rawExp.images ?? []) as ExperienceWithGuide['images']]
      .sort((a, b) => a.sort_order - b.sort_order),
  }

  // calendar_disabled + payment model flags — queried separately so a missing
  // column never breaks the trip page (falls back to safe defaults).
  const { data: guideFlags } = await supabase
    .from('guides')
    .select('calendar_disabled, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled')
    .eq('id', exp.guide_id)
    .maybeSingle()
  const calendarDisabled = guideFlags?.calendar_disabled ?? false
  const paymentModel = getPaymentModel({
    stripe_account_id:      guideFlags?.stripe_account_id      ?? null,
    stripe_charges_enabled: guideFlags?.stripe_charges_enabled ?? null,
    stripe_payouts_enabled: guideFlags?.stripe_payouts_enabled ?? null,
  })

  const isDraft = !exp.published

  // ── Blocked dates: always read from calendar_blocked_dates ─────────────────
  const svcClient = createServiceClient()
  const { data: calExp } = await svcClient
    .from('calendar_experiences')
    .select('calendar_id')
    .eq('experience_id', id)
    .maybeSingle()

  const [moreFromGuide, availConfigRes, blockedDatesRes] = await Promise.all([
    getMoreFromGuide(exp.guide_id, exp.id, 3),
    supabase
      .from('experience_availability_config')
      .select('available_months, available_weekdays, advance_notice_hours, max_advance_days, slots_per_day, start_time')
      .eq('experience_id', id)
      .maybeSingle(),
    calExp != null
      ? svcClient
          .from('calendar_blocked_dates')
          .select('date_start, date_end')
          .eq('calendar_id', calExp.calendar_id)
      : Promise.resolve({ data: [] as Array<{ date_start: string; date_end: string }> }),
  ])

  const availabilityConfig = (availConfigRes.data ?? null) as AvailConfigRow | null
  const blockedDates = blockedDatesRes.data ?? []
  console.log('[trips/debug] calExp:', calExp, '| blockedDates count:', blockedDates.length, '| first:', blockedDates[0])

  const coverUrl = heroFull(exp.images.find(i => i.is_cover)?.url ?? exp.images[0]?.url)
  const landscapeUrl = exp.landscape_url ?? getLandscapeUrl(exp.location_country, exp.id)
// flag rendered as <CountryFlag> below
  const diffLabel = exp.difficulty != null ? (DIFFICULTY_LABEL[exp.difficulty] ?? exp.difficulty) : null

  // Duration options from JSONB — fall back to legacy scalars
  const durationOptions = (
    Array.isArray(exp.duration_options) && exp.duration_options.length > 0
      ? exp.duration_options
      : null
  ) as DurationOptionPayload[] | null

  // Duration string for the quick-facts strip
  const duration =
    durationOptions != null
      ? durationOptions.length === 1
        ? (() => {
            const o = durationOptions[0]
            if (o.label) return o.label
            if (o.hours != null) return `${o.hours} hours`
            if (o.days  != null) return `${o.days} ${o.days === 1 ? 'day' : 'days'}`
            return '—'
          })()
        : durationOptions.map(o => o.label || (o.hours != null ? `${o.hours}h` : `${o.days}d`)).join(' · ')
      : exp.duration_hours != null
      ? `${exp.duration_hours} hours`
      : exp.duration_days != null
      ? `${exp.duration_days} ${exp.duration_days === 1 ? 'day' : 'days'}`
      : null

  // ── New content fields (added via DB migration 20260316171516) ───────────────
  const expRaw = rawExp as unknown as Record<string, unknown>
  const itinerary    = (expRaw.itinerary as ItineraryStep[] | null) ?? null
  const locationDesc = (expRaw.location_description as string | null) ?? null
  const boatDesc     = (expRaw.boat_description as string | null) ?? null
  const foodDesc     = (expRaw.food_description as string | null) ?? null
  const licenseDesc  = (expRaw.license_description as string | null) ?? null
  const gearDesc     = (expRaw.gear_description as string | null) ?? null
  const transportDesc = (expRaw.transport_description as string | null) ?? null

  const accommodations = linkedAccommodations

  const tripDetailCards = [
    { key: 'boat',      label: 'Boat',             icon: '⛵',  text: boatDesc },
    { key: 'food',      label: 'Food & Drinks',    icon: '🍽️', text: foodDesc },
    { key: 'license',   label: 'Fishing Licence',  icon: '📋', text: licenseDesc },
    { key: 'gear',      label: 'Gear & Equipment', icon: '🎣', text: gearDesc },
    { key: 'transport', label: 'Getting There',    icon: '🚗',  text: transportDesc },
  ].filter(c => c.text != null && c.text.trim() !== '')

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* ─── NAV ─────────────────────────────────────────────────── */}
      <TripDetailNav backHref="/trips" />

      {/* ─── DRAFT PREVIEW BANNER ────────────────────────────────── */}
      {isDraft && (
        <div
          className="fixed inset-x-0 z-[60] flex items-center justify-between px-6 py-2.5"
          style={{ top: '72px', background: '#E67E50' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded f-body"
              style={{ background: 'rgba(0,0,0,0.18)', color: 'white' }}
            >
              Draft
            </span>
            <p className="text-white text-xs font-medium f-body">
              This experience is not published yet — only you can see this preview.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/dashboard/trips"
              className="text-white/80 text-xs f-body hover:text-white transition-colors"
            >
              ← Dashboard
            </Link>
            <Link
              href={`/dashboard/trips/${exp.id}/edit`}
              className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-full f-body transition-opacity hover:opacity-80"
              style={{ background: 'rgba(0,0,0,0.2)', color: 'white' }}
            >
              Edit &amp; Publish →
            </Link>
          </div>
        </div>
      )}

      {/* ─── HERO ────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: '480px', paddingTop: '92px', background: '#07111C' }}
      >
        {/* Landscape background */}
        <Image
          src={landscapeUrl}
          alt=""
          fill
          priority
          className="object-cover"
          style={{ objectPosition: 'center bottom' }}
        />


        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '65%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(4,12,22,0.55) 50%, rgba(4,12,22,0.88) 100%)',
            zIndex: 2,
          }}
        />

        <GrainOverlay />

        <div
          className="absolute bottom-0 inset-x-0 px-4 md:px-8 pb-8 md:pb-12"
          style={{ zIndex: 3 }}
        >
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-5">
              <Link
                href="/trips"
                className="text-white/55 hover:text-white/85 text-xs font-medium transition-colors f-body"
                style={{ textShadow: '0 1px 8px rgba(4,12,22,0.7)' }}
              >
                Experiences
              </Link>
              <span className="text-white/30 text-xs">›</span>
              <span className="text-white/55 text-xs f-body flex items-center gap-1" style={{ textShadow: '0 1px 8px rgba(4,12,22,0.7)' }}>
                <CountryFlag country={exp.location_country} /> {exp.location_country}
              </span>
              <span className="text-white/30 text-xs">›</span>
              <span className="text-white/70 text-xs f-body line-clamp-1 max-w-xs" style={{ textShadow: '0 1px 8px rgba(4,12,22,0.7)' }}>
                {exp.title}
              </span>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              {exp.fish_types.map(fish => (
                <span
                  key={fish}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full f-body"
                  style={{
                    background: 'rgba(230,126,80,0.18)',
                    color: '#FFB899',
                    border: '1px solid rgba(230,126,80,0.25)',
                  }}
                >
                  {fish}
                </span>
              ))}
              {diffLabel != null && (
                <span
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full f-body"
                  style={{
                    background: 'rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.75)',
                    border: '1px solid rgba(255,255,255,0.14)',
                  }}
                >
                  {diffLabel}
                </span>
              )}
            </div>

            {/* Title */}
            <h1
              className="text-white font-bold f-display"
              style={{
                fontSize: 'clamp(28px, 4vw, 48px)',
                lineHeight: 1.08,
                maxWidth: '700px',
                textShadow: '0 2px 24px rgba(4,12,22,0.85), 0 4px 48px rgba(4,12,22,0.6)',
              }}
            >
              {exp.title}
            </h1>

            {/* Location */}
            <p
              className="text-sm mt-3 f-body"
              style={{
                color: 'rgba(255,255,255,0.75)',
                textShadow: '0 1px 16px rgba(4,12,22,0.8)',
              }}
            >
              <CountryFlag country={exp.location_country} /> {exp.location_city != null ? `${exp.location_city}, ` : ''}{exp.location_country}
            </p>
          </div>
        </div>
      </section>

      {/* ─── MAIN CONTENT ────────────────────────────────────────── */}

      <div className="px-4 md:px-8 pb-12 md:pb-24" style={{ background: '#F3EDE4' }}>
        <div className="max-w-7xl mx-auto">

          {/* Gallery */}
          <div className="pt-8 md:pt-10">
            <ExperienceGallery images={exp.images} title={exp.title} />
          </div>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">

            {/* ─── LEFT — main content ─────────────────────────── */}
            <div className="flex-1 min-w-0">

              {/* Description */}
              <section className="mb-12">
                <SalmonRule />
                <p
                  className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
                  style={{ color: '#E67E50' }}
                >
                  About this trip
                </p>
                <h2 className="text-[#0A2E4D] text-2xl font-bold mb-5 f-display">
                  What to expect
                </h2>
                <p
                  className="text-base leading-[1.8] f-body"
                  style={{ color: 'rgba(10,46,77,0.65)', maxWidth: '600px' }}
                >
                  {exp.description}
                </p>
              </section>

              {/* ─── Trip Plan (itinerary) ─────────────────────────────── */}
              {itinerary != null && itinerary.length > 0 && (
                <section className="mb-12">
                  <SalmonRule />
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
                    style={{ color: '#E67E50' }}
                  >
                    Trip plan
                  </p>
                  <h2 className="text-[#0A2E4D] text-2xl font-bold mb-6 f-display">
                    How the day unfolds
                  </h2>

                  <ol className="flex flex-col">
                    {itinerary.map((step, i) => (
                      <li key={i} className="flex gap-4">
                        {/* Step number + vertical line */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold f-body flex-shrink-0"
                            style={{
                              background: 'rgba(230,126,80,0.11)',
                              color: '#E67E50',
                              border: '1.5px solid rgba(230,126,80,0.22)',
                            }}
                          >
                            {i + 1}
                          </div>
                          {i < itinerary.length - 1 && (
                            <div
                              className="w-px flex-1 my-1.5"
                              style={{ background: 'rgba(230,126,80,0.15)', minHeight: '20px' }}
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div className={`flex-1 min-w-0 ${i < itinerary.length - 1 ? 'pb-4' : ''}`}>
                          {step.time != null && step.time.trim() !== '' && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-[0.2em] f-body block mb-0.5"
                              style={{ color: 'rgba(10,46,77,0.35)' }}
                            >
                              {step.time}
                            </span>
                          )}
                          <p
                            className="text-sm font-medium leading-relaxed f-body"
                            style={{ color: '#0A2E4D' }}
                          >
                            {step.label}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Target Species */}
              <section className="mb-12">
                <SalmonRule />
                <p
                  className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
                  style={{ color: '#E67E50' }}
                >
                  Target species
                </p>
                <h2 className="text-[#0A2E4D] text-2xl font-bold mb-6 f-display">
                  What you&apos;ll be chasing
                </h2>
                <div
                  className={
                    exp.fish_types.length >= 4
                      ? 'grid grid-cols-2 sm:grid-cols-3 gap-2'
                      : 'grid grid-cols-1 sm:grid-cols-2 gap-3'
                  }
                >
                  {exp.fish_types.map(fish => (
                    <SpeciesCard
                      key={fish}
                      fish={fish}
                      info={FISH_INFO[fish]}
                      compact={exp.fish_types.length >= 4}
                    />
                  ))}
                </div>
              </section>

              {/* Catch & Release callout */}
              {exp.catch_and_release && (
                <div
                  className="flex items-start gap-4 px-6 py-5 rounded-2xl mb-12"
                  style={{
                    background: 'rgba(46,160,100,0.07)',
                    border: '1px solid rgba(46,160,100,0.18)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                    style={{ background: 'rgba(46,160,100,0.12)' }}
                  >
                    ♻
                  </div>
                  <div>
                    <p className="text-sm font-semibold f-body mb-0.5" style={{ color: '#1d7a4a' }}>
                      Catch &amp; Release
                    </p>
                    <p className="text-xs leading-relaxed f-body" style={{ color: 'rgba(29,122,74,0.72)' }}>
                      All fish are returned alive. This experience follows strict conservation practices to protect Scandinavia&apos;s wild fish populations.
                    </p>
                  </div>
                </div>
              )}

              {/* Quick facts strip */}
              <div
                className="flex flex-wrap gap-4 sm:gap-6 py-5 sm:py-7 px-4 sm:px-8 rounded-3xl mb-6"
                style={{
                  background: '#FDFAF7',
                  border: '1px solid rgba(10,46,77,0.07)',
                  boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                }}
              >
                {[
                  ...(exp.booking_type !== 'icelandic' ? [{ label: 'Duration', value: duration ?? '—' }] : []),
                  { label: 'Group size', value: exp.max_guests != null ? `Max ${exp.max_guests} anglers` : '—' },
                  { label: 'Technique', value: exp.technique ?? '—' },
                  { label: 'Level', value: diffLabel ?? '—' },
                  { label: 'Location', value: exp.location_city ?? exp.location_country ?? '—' },
                ].map(fact => (
                  <div key={fact.label}>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1 f-body"
                      style={{ color: 'rgba(10,46,77,0.35)' }}
                    >
                      {fact.label}
                    </p>
                    <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                      {fact.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Guide languages banner */}
              {Array.isArray(exp.guide.languages) && exp.guide.languages.length > 0 && (
                <div
                  className="flex items-center gap-3 flex-wrap px-6 py-4 rounded-2xl mb-6"
                  style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.35)' }}>
                    Guide speaks
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(exp.guide.languages as string[]).map(lang => (
                      <span
                        key={lang}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full f-body"
                        style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Fishing methods tags ─────────────────────────────────────── */}
              {Array.isArray(exp.fishing_methods) && exp.fishing_methods.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] f-body"
                    style={{ color: 'rgba(10,46,77,0.35)' }}
                  >
                    Methods
                  </span>
                  {(exp.fishing_methods as string[]).map(m => (
                    <span
                      key={m}
                      className="text-xs font-semibold px-3 py-1 rounded-full f-body"
                      style={{
                        background: 'rgba(230,126,80,0.10)',
                        color: '#E67E50',
                        border: '1px solid rgba(230,126,80,0.20)',
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}

              {/* ── Trip Options (duration + pricing) — hidden for price-on-request ── */}
              {durationOptions != null && durationOptions.length > 0 && exp.booking_type !== 'icelandic' && (
                <DurationCardsSelector options={durationOptions} />
              )}

              {/* ─── Accommodations ────────────────────────────────────── */}
              {accommodations.length > 0 && (
                <section className="mb-14">
                  <SalmonRule />
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
                    style={{ color: '#E67E50' }}
                  >
                    Where you&apos;ll stay
                  </p>
                  <h2 className="text-[#0A2E4D] text-2xl font-bold mb-8 f-display">
                    Accommodation
                  </h2>

                  <div className="flex flex-col gap-8">
                    {accommodations.map(({ accommodation: acc }) => (
                      <div
                        key={acc.id}
                        className="rounded-3xl overflow-hidden"
                        style={{
                          background: '#FDFAF7',
                          border: '1px solid rgba(10,46,77,0.07)',
                          boxShadow: '0 4px 32px rgba(10,46,77,0.07)',
                        }}
                      >
                        {/* ── Photo grid ─────────────────────────────────── */}
                        {acc.images != null && acc.images.length > 0 && (
                          <AccommodationGallery images={acc.images} name={acc.name} />
                        )}

                        {/* ── Content ────────────────────────────────────── */}
                        <div className="p-6 sm:p-8">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                              <h3
                                className="text-xl font-bold f-display leading-tight mb-2"
                                style={{ color: '#0A2E4D' }}
                              >
                                {acc.name}
                              </h3>
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span
                                  className="text-[10px] font-bold uppercase tracking-[0.18em] px-3 py-1 rounded-full f-body"
                                  style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.55)' }}
                                >
                                  {acc.type}
                                </span>
                                {acc.max_guests != null && (
                                  <span
                                    className="text-xs f-body font-medium"
                                    style={{ color: 'rgba(10,46,77,0.5)' }}
                                  >
                                    Up to {acc.max_guests} guests
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {acc.description != null && (
                            <p
                              className="text-sm leading-relaxed f-body mb-4"
                              style={{ color: 'rgba(10,46,77,0.68)', maxWidth: '560px' }}
                            >
                              {acc.description}
                            </p>
                          )}

                          {acc.location_note != null && (
                            <div className="flex items-center gap-2">
                              <MapPin size={13} style={{ color: '#E67E50' }} />
                              <p
                                className="text-xs f-body"
                                style={{ color: 'rgba(10,46,77,0.5)' }}
                              >
                                {acc.location_note}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ─── Trip Details ──────────────────────────────────────── */}
              {tripDetailCards.length > 0 && (
                <section className="mb-12">
                  <SalmonRule />
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
                    style={{ color: '#E67E50' }}
                  >
                    Trip details
                  </p>
                  <h2 className="text-[#0A2E4D] text-2xl font-bold mb-6 f-display">
                    What to know
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {tripDetailCards.map(card => (
                      <div
                        key={card.key}
                        className="p-6 rounded-2xl"
                        style={{
                          background: '#FDFAF7',
                          border: '1px solid rgba(10,46,77,0.07)',
                          boxShadow: '0 2px 12px rgba(10,46,77,0.04)',
                        }}
                      >
                        <div className="flex items-center gap-2.5 mb-3">
                          <span className="text-base flex-shrink-0" role="img" aria-label={card.label}>
                            {card.icon}
                          </span>
                          <p
                            className="text-[10px] font-bold uppercase tracking-[0.22em] f-body"
                            style={{ color: 'rgba(10,46,77,0.38)' }}
                          >
                            {card.label}
                          </p>
                        </div>
                        <p
                          className="text-sm leading-relaxed f-body"
                          style={{ color: 'rgba(10,46,77,0.72)' }}
                        >
                          {card.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Location + Map */}
              {(exp.location_lat != null || exp.location_area != null || (exp.location_spots as unknown as import('@/types').LocationSpot[] | null)?.length || exp.meeting_point != null) && (
                <section className="mb-12">
                  <SalmonRule />
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
                    style={{ color: '#E67E50' }}
                  >
                    Location
                  </p>
                  <h2 className="text-[#0A2E4D] text-2xl font-bold mb-5 f-display">
                    Where you&apos;ll fish
                  </h2>

                  {/* Map — react-leaflet, proper anchored marker */}
                  {(exp.location_lat != null && exp.location_lng != null) && (
                    <div
                      className="relative overflow-hidden mb-5"
                      style={{
                        borderRadius: '24px',
                        height: '280px',
                        border: '1.5px solid rgba(10,46,77,0.1)',
                        boxShadow: '0 8px 32px rgba(10,46,77,0.12)',
                        isolation: 'isolate',
                      }}
                    >
                      <ExperienceLocationMap
                        lat={exp.location_lat}
                        lng={exp.location_lng}
                        area={(exp.location_area as unknown as import('geojson').Polygon) ?? null}
                        spots={(exp.location_spots as unknown as import('@/types').LocationSpot[]) ?? null}
                      />

                      {/* Inset vignette — purely decorative, pointer-events:none */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          boxShadow: 'inset 0 0 40px rgba(10,46,77,0.07)',
                          borderRadius: '24px',
                          zIndex: 500,   // above Leaflet's z-index stack
                        }}
                      />

                      {/* Location chip — bottom-left */}
                      {(exp.location_city ?? exp.location_country) != null && (
                        <div
                          className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full"
                          style={{
                            background: 'rgba(255,255,255,0.94)',
                            boxShadow: '0 2px 12px rgba(10,46,77,0.18)',
                            backdropFilter: 'blur(10px)',
                            zIndex: 500,
                            pointerEvents: 'none',
                          }}
                        >
                          <CountryFlag country={exp.location_country} />
                          <span className="text-xs font-semibold f-body" style={{ color: '#0A2E4D' }}>
                            {exp.location_city ?? exp.location_country}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Location description paragraph */}
                  {locationDesc != null && locationDesc.trim() !== '' && (
                    <p
                      className="text-sm leading-[1.8] f-body mb-5"
                      style={{ color: 'rgba(10,46,77,0.65)', maxWidth: '560px' }}
                    >
                      {locationDesc}
                    </p>
                  )}

                  {/* Meeting point row */}
                  {exp.meeting_point != null && (
                    <div
                      className="flex items-center gap-4 px-6 py-4 rounded-2xl"
                      style={{
                        background: '#FDFAF7',
                        border: '1px solid rgba(10,46,77,0.07)',
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                        style={{ background: 'rgba(230,126,80,0.1)' }}
                      >
                        📍
                      </div>
                      <div>
                        <p
                          className="text-[10px] font-bold uppercase tracking-[0.22em] mb-0.5 f-body"
                          style={{ color: 'rgba(10,46,77,0.35)' }}
                        >
                          Meeting point
                        </p>
                        <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                          {exp.meeting_point}
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* ─── Availability preview / period picker calendar ──────────── */}
              {/* Shown when:                                                  */}
              {/*   • calendar disabled → "inquiry-only" notice                */}
              {/*   • availability config set (any booking type)               */}
              {/*   • booking_type is 'classic', 'both', or 'icelandic'        */}
              {/*     (icelandic shows interactive period picker)              */}
              {!isDraft && (
                calendarDisabled ||
                availabilityConfig != null ||
                exp.booking_type === 'classic' ||
                exp.booking_type === 'both' ||
                exp.booking_type === 'icelandic'
              ) && (
                calendarDisabled ? (
                  /* ── Calendar disabled: guide uses inquiry-only mode ── */
                  <section>
                    <div
                      className="rounded-2xl px-5 py-5 flex gap-4 items-start"
                      style={{ background: '#F3EDE4', border: '1px solid rgba(230,126,80,0.18)' }}
                    >
                      {/* Icon */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(230,126,80,0.14)' }}
                      >
                        <Calendar size={17} strokeWidth={1.8} style={{ color: '#E67E50' }} />
                      </div>
                      {/* Text */}
                      <div>
                        <p className="text-sm font-semibold f-body mb-1" style={{ color: '#0A2E4D' }}>
                          Flexible scheduling — dates agreed with guide
                        </p>
                        <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.55)' }}>
                          This guide handles bookings through personal inquiry.
                          Send a request with your preferred dates and group size —
                          the guide will confirm availability and send a custom offer.
                        </p>
                      </div>
                    </div>
                  </section>
                ) : (
                  <div id="availability-calendar">
                    <AvailabilityPreviewCalendar
                      expId={exp.id}
                      availabilityConfig={availabilityConfig}
                      blockedDates={blockedDates}
                      bookingType={exp.booking_type as 'classic' | 'icelandic' | 'both'}
                    />
                  </div>
                )
              )}

              {/* Cancellation policy banner */}
              <CancellationPolicyBanner policy={exp.guide.cancellation_policy} />

              {/* Guide card */}
              <section>
                <SalmonRule />
                <p
                  className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-6 f-body"
                  style={{ color: '#E67E50' }}
                >
                  Your guide
                </p>

                <div
                  className="p-7 rounded-3xl"
                  style={{
                    background: '#FDFAF7',
                    border: '1px solid rgba(10,46,77,0.07)',
                    boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                  }}
                >
                  <div className="flex items-start gap-5">
                    {/* Avatar */}
                    <div
                      className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
                      style={{ border: '2px solid rgba(10,46,77,0.08)' }}
                    >
                      {exp.guide.avatar_url != null ? (
                        <Image
                          src={exp.guide.avatar_url}
                          alt={exp.guide.full_name}
                          width={64}
                          height={64}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#0A2E4D] flex items-center justify-center text-white text-xl f-display">
                          {exp.guide.full_name[0]}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <h3 className="text-[#0A2E4D] font-bold text-lg f-display">
                            {exp.guide.full_name}
                          </h3>
                          <p className="text-sm f-body mt-0.5 mb-3" style={{ color: 'rgba(10,46,77,0.45)' }}>
                            {exp.guide.city != null ? `${exp.guide.city}, ` : ''}
                            {exp.guide.country}
                            {exp.guide.average_rating != null && (
                              <span className="ml-3">★ {exp.guide.average_rating.toFixed(1)}</span>
                            )}
                          </p>

                          {/* Languages */}
                          {Array.isArray(exp.guide.languages) && exp.guide.languages.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                                Speaks
                              </span>
                              {(exp.guide.languages as string[]).map(lang => (
                                <span
                                  key={lang}
                                  className="text-xs font-semibold px-3 py-1 rounded-full f-body"
                                  style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
                                >
                                  {lang}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/guides/${exp.guide_id}`}
                          className="text-xs font-semibold px-4 py-2 rounded-full transition-colors f-body flex-shrink-0"
                          style={{
                            border: '1px solid rgba(10,46,77,0.18)',
                            color: 'rgba(10,46,77,0.6)',
                          }}
                        >
                          View profile →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* ─── RIGHT — booking widget (sticky) ── */}
            <aside
              className="hidden lg:block flex-shrink-0"
              style={{
                width: '380px',
                position: 'sticky',
                top: '81px',
                alignSelf: 'flex-start',
              }}
            >
              <BookingWidget
                expId={exp.id}
                isDraft={isDraft}
                rawDurationOptions={exp.duration_options}
                maxGuests={exp.max_guests ?? 4}
                legacyPricePerPerson={exp.price_per_person_eur}
                difficulty={exp.difficulty}
                durationHours={exp.duration_hours}
                durationDays={exp.duration_days}
                availabilityConfig={availabilityConfig}
                blockedDates={blockedDates}
                bookingType={(exp.booking_type as 'classic' | 'icelandic' | 'both') ?? 'classic'}
                calendarDisabled={calendarDisabled}
                paymentModel={paymentModel}
              />
            </aside>

          </div>
        </div>
      </div>

      {/* ─── MOBILE BOOKING BAR (fixed bottom) — hidden for drafts ─ */}
      <MobileBookingBar
        expId={exp.id}
        isDraft={isDraft}
        rawDurationOptions={exp.duration_options}
        maxGuests={exp.max_guests ?? 4}
        legacyPricePerPerson={exp.price_per_person_eur}
        durationHours={exp.duration_hours}
        durationDays={exp.duration_days}
        bookingType={(exp.booking_type as 'classic' | 'icelandic' | 'both') ?? 'classic'}
        calendarDisabled={calendarDisabled}
        paymentModel={paymentModel}
      />

      {/* ─── MORE FROM GUIDE ─────────────────────────────────────── */}
      {moreFromGuide.length > 0 && (
        <section className="px-4 md:px-8 py-12 md:py-20" style={{ background: '#F3EDE4' }}>
          <div className="max-w-7xl mx-auto">
            <div
              className="mb-12 pb-0 flex items-end justify-between"
              style={{ borderTop: '1px solid rgba(10,46,77,0.09)', paddingTop: '4rem' }}
            >
              <div>
                <SalmonRule />
                <p
                  className="text-xs font-semibold uppercase tracking-[0.25em] mt-4 mb-3 f-body"
                  style={{ color: '#E67E50' }}
                >
                  Same guide
                </p>
                <h2 className="text-[#0A2E4D] text-3xl font-bold f-display">
                  More trips with{' '}
                  <span style={{ fontStyle: 'italic' }}>{exp.guide.full_name}</span>
                </h2>
              </div>
              <Link
                href={`/guides/${exp.guide_id}`}
                className="hidden md:block text-sm font-medium transition-colors hover:text-[#E67E50] f-body"
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                View guide profile →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {moreFromGuide.map(related => {
                const relCover = cardThumb(
                  related.images.find(i => i.is_cover)?.url ?? related.images[0]?.url
                )
                const relDuration =
                  related.duration_hours != null
                    ? `${related.duration_hours}h`
                    : related.duration_days != null
                    ? `${related.duration_days} days`
                    : null

                return (
                  <Link key={related.id} href={`/trips/${related.id}`} className="group block">
                    <article
                      className="overflow-hidden transition-all duration-300 hover:shadow-[0_20px_56px_rgba(10,46,77,0.13)] hover:-translate-y-1"
                      style={{
                        borderRadius: '28px',
                        background: '#FDFAF7',
                        border: '1px solid rgba(10,46,77,0.07)',
                        boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                      }}
                    >
                      <div className="relative overflow-hidden" style={{ height: '220px' }}>
                        {relCover != null ? (
                          <Image
                            src={relCover}
                            alt={related.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          />
                        ) : (
                          <div className="w-full h-full" style={{ background: '#EDE6DB' }} />
                        )}
                        <div
                          className="absolute top-4 right-4 text-white text-sm font-bold px-3.5 py-1.5 rounded-full f-body"
                          style={{ background: 'rgba(5,12,22,0.72)', backdropFilter: 'blur(8px)' }}
                        >
                          €{related.price_per_person_eur}
                          <span className="text-xs font-normal opacity-55">/pp</span>
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                          {related.fish_types.slice(0, 2).map(fish => (
                            <span
                              key={fish}
                              className="text-xs font-medium px-2.5 py-1 rounded-full f-body"
                              style={{ background: 'rgba(201,107,56,0.09)', color: '#9E4820' }}
                            >
                              {fish}
                            </span>
                          ))}
                        </div>
                        <h3
                          className="font-semibold text-sm leading-snug mb-3 line-clamp-2 f-display"
                          style={{ color: '#0A2E4D' }}
                        >
                          {related.title}
                        </h3>
                        <p className="text-xs f-body mb-3" style={{ color: 'rgba(10,46,77,0.38)' }}>
                          {relDuration}
                          {relDuration != null && related.max_guests != null && ' · '}
                          {related.max_guests != null && `max ${related.max_guests}`}
                        </p>
                        {Array.isArray(exp.guide.languages) && exp.guide.languages.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-3 flex-wrap" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.35)' }}>Speaks</span>
                            <div className="flex flex-wrap gap-1">
                              {(exp.guide.languages as string[]).map(lang => (
                                <span key={lang} className="text-[10px] font-semibold px-2 py-0.5 rounded-full f-body" style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
                                  {lang}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── FOOTER ──────────────────────────────────────────────── */}
      <footer
        className="py-14 px-8"
        style={{ background: '#05101A', borderTop: '1px solid rgba(230,126,80,0.12)' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10">
            <div>
              <Image
                src="/brand/white-logo.png"
                alt="FjordAnglers"
                width={140}
                height={36}
                className="h-7 w-auto mb-4"
                style={{ opacity: 0.55 }}
              />
              <p
                className="text-sm leading-relaxed f-body"
                style={{ color: 'rgba(255,255,255,0.22)', maxWidth: '240px' }}
              >
                Connecting anglers with the best fishing trips in Scandinavia.
              </p>
            </div>
            <div className="flex items-center gap-8 md:gap-12">
              {[
                { label: 'Trips', href: '/trips' },
                { label: 'Guides', href: '/guides' },
                { label: 'License Map', href: '/license-map' },
                { label: 'Join as Guide', href: '/guides/apply' },
              ].map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-sm transition-colors f-body hover:text-white/60"
                  style={{ color: 'rgba(255,255,255,0.28)' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div
            className="mt-10 pt-6 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <p className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.18)' }}>© 2026 FjordAnglers</p>
            <p className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.14)' }}>Norway · Sweden · Finland</p>
          </div>
        </div>
      </footer>

      {/* Spacer so mobile booking bar doesn't overlap footer */}
      <div className="lg:hidden h-20" />

    </div>
  )
}
