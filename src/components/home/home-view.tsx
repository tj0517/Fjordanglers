/**
 * The home page (`/`) in the 2026-11 redesign — docs/design/site-2026-11/home.dc.html is the source
 * of truth for layout, colours, type and spacing. Order: hero with the globe → countries (bento) →
 * trips → how it works → review → guides → articles → FAQ → closing CTA → footer.
 *
 * Everything comes from the existing reads: the country hubs (`getDestinationHub`, one per hub —
 * counts, prices, seasons, species, regions, pins and the trip cards), `getFeaturedGuides`,
 * `getTestimonial` (one, tj 2026-11-17) and `getLatestBlogPosts`. A section with no data is not
 * rendered.
 */

import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { anglerCountryName } from '@/lib/angler-countries'
import { formatCents } from '@/lib/format-price'
import { hubCrumbName } from '@/lib/seo/hub-jsonld'
import type { DestinationHubData, FeaturedGuide, HubOffer } from '@/lib/supabase/queries'
import type { Testimonial } from '@/lib/supabase/testimonials'
import type { BlogPostSummary } from '@/lib/blog/post'
import { SiteNav, PLAN_YOUR_TRIP_HREF } from '@/components/layout/nav'
import { SiteFooter } from '@/components/layout/footer'
import { GuideLink } from '@/components/guides/guide-link'
import { monthRange } from '@/components/destination-hub/destination-hub-view'
import { ContactExpertButton } from '@/components/ui/contact-expert-button'
import { FaqList } from '@/components/site/faq'
import { TripCard, tripCardFromOffer } from '@/components/site/trip-card'
import {
  CREAM, LINE, MUTED, NAVY, ON_DARK, PAGE_BG, PrimaryButton, SALMON, SALMON_ON_DARK, SecondaryButton, SectionHeading,
} from '@/components/site/ui'
import grain from '@/components/site/grain.module.css'
import { GlobeHero, type GlobeDestination } from './globe-hero'
import { LatestArticles } from './latest-articles'
import s from './home.module.css'

export type HomeData = {
  /** The hubs that could be read, any order. */
  hubs:        DestinationHubData[]
  guides:      FeaturedGuide[]
  testimonial: Testimonial | null
  posts:       BlogPostSummary[]
  mapboxToken: string | null
}

type Tile = { slug: string; span: string; tall: boolean; photo: string | null; overlay: string }

/** The bento, in the mockup's order: three tall tiles, then three short ones. */
const TILES: Tile[] = [
  { slug: 'iceland',     span: s.s5, tall: true,  photo: '/hub/canyon.jpg',  overlay: s.ovIceland },
  { slug: 'patagonia',   span: s.s4, tall: true,  photo: null,               overlay: s.ovPatagonia },
  { slug: 'new-zealand', span: s.s3, tall: true,  photo: '/hub/nzriver.jpg', overlay: s.ovNewZealand },
  { slug: 'norway',      span: s.s4, tall: false, photo: '/hub/norway.jpg',  overlay: s.ovNorway },
  { slug: 'sweden',      span: s.s4, tall: false, photo: '/hub/sweden.jpg',  overlay: s.ovSweden },
  { slug: 'finland',     span: s.s4, tall: false, photo: '/hub/finland.jpg', overlay: s.ovFinland },
]

/** Where the globe turns for each hub, and which countries it fills (the mockup's coordinates). */
const GLOBE: Record<string, { center: [number, number]; iso: string[] }> = {
  iceland:       { center: [-20.5, 64.8], iso: ['IS'] },
  norway:        { center: [9.5, 61.5],   iso: ['NO'] },
  sweden:        { center: [15.5, 62.5],  iso: ['SE'] },
  finland:       { center: [26, 63.5],    iso: ['FI'] },
  'new-zealand': { center: [172, -41.5],  iso: ['NZ'] },
  patagonia:     { center: [-70, -44],    iso: ['AR', 'CL'] },
}

/** The globe buttons' order, and the order the trip cards take one offer from each hub. */
const GLOBE_ORDER = ['iceland', 'norway', 'sweden', 'finland', 'new-zealand', 'patagonia'] as const
const TRIP_ORDER  = ['iceland', 'norway', 'new-zealand', 'finland', 'sweden', 'patagonia'] as const

const HOW_IT_WORKS = [
  { title: 'Browse trips & pick a guide', body: 'Send your dates, how many rods, and what you want to catch.' },
  { title: 'Send a booking request',      body: 'We ask the guide. You get one offer with the real price, what is included, and what is not.' },
  { title: 'Guide confirms within 48h',   body: 'Pay a deposit to hold the dates. The rest goes straight to the guide when you meet.' },
] as const

const FAQ = [
  { question: 'Does it cost anything to ask?', answer: 'No. You pay nothing to ask. Tell us your dates, group size and what you want to catch.' },
  { question: 'How fast do I get an offer?',   answer: 'We check with the guide and come back with availability and a price within two business days.' },
  { question: 'When do I pay?',                answer: 'You pay a deposit once the dates are confirmed. The rest you pay directly to your guide.' },
  { question: 'Who will I fish with?',         answer: 'A local guide who fishes that water every week of the season. You talk to the guide who takes you out.' },
  { question: 'What if I need to cancel?',     answer: '[ANSWER: cancellation and refund terms]' },
] as const

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/**
 * The tile's tag: "Season open now" in a season month, else "Season Apr–Oct" for a single run of
 * months (across the new year too). Null for no season or a split one.
 */
function seasonTag(months: readonly number[], now: number): string | null {
  const set = new Set(months.filter(m => m >= 1 && m <= 12))
  if (set.size === 0) return null
  if (set.has(now)) return 'Season open now'
  const starts = [...set].filter(m => !set.has(m === 1 ? 12 : m - 1))
  if (starts.length !== 1) return null
  let end = starts[0]
  while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1
  return `Season ${SHORT_MONTHS[starts[0] - 1]}–${SHORT_MONTHS[end - 1]}`
}

/** "€700" — the hub's lowest price as its hero prints it, without a unit (that differs per offer). */
function priceAmount(hub: DestinationHubData): string | null {
  return hub.priceFrom == null ? null : formatCents(hub.priceFrom.cents, hub.priceFrom.currency)
}

function tripsLine(hub: DestinationHubData, sep: string): string | null {
  const n = hub.offers.length
  if (n === 0) return null
  const price = priceAmount(hub)
  return `${n} ${n === 1 ? 'trip' : 'trips'}${price != null ? `${sep}from ${price}` : ''}`
}

function regions(hub: DestinationHubData): string | null {
  const list = [...new Set(hub.offers.map(o => o.page.region.trim()).filter(r => r !== ''))].slice(0, 4)
  return list.length === 0 ? null : list.join(' · ')
}

function Pill({ children, center = false }: { children: string; center?: boolean }) {
  return <span className={`${s.pill} ${center ? s.pillCenter : ''} f-body`}>{children}</span>
}

function H2({ children, style }: { children: string; style?: CSSProperties }) {
  return <h2 className={`${s.h2} f-display m-0`} style={{ color: NAVY, ...style }}>{children}</h2>
}

// ─── Countries (bento) ───────────────────────────────────────────────────────

function CountryTile({ tile, hub, month }: { tile: Tile; hub: DestinationHubData; month: number }) {
  const name   = hubCrumbName(hub.hub)
  const big    = tile.tall && tile.span !== s.s3
  const photo  = tile.photo ?? hub.hub.heroImageUrl ?? hub.ogImage
  const tag    = seasonTag(hub.hub.seasonMonths ?? [], month)
  const season = monthRange(hub.hub.seasonMonths ?? [])
  const where  = regions(hub)
  const days   = tripsLine(hub, ', ')
  const facts = (tile.tall
    ? [['Season', season], ['Species', hub.species.slice(0, 3).join(', ') || null], ['Where', where], ['Guided days', days]]
    : [['Where', where], ['Guided days', days]]
  ).filter((f): f is [string, string] => f[1] != null)
  const nameStyle: CSSProperties = { fontWeight: 700, fontSize: big ? 40 : 28, lineHeight: 1.05, color: '#FFFFFF' }

  return (
    <Link href={`/${hub.hub.slug}`} className={`${s.tile} ${tile.span} ${tile.tall ? s.tall : s.short}`}>
      {photo != null && (
        <Image src={photo} alt="" fill sizes="(min-width: 1080px) 520px, 100vw" className="object-cover" />
      )}
      <span aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(6,20,34,.82) 0%, rgba(6,20,34,0) 58%)' }} />
      {tag != null && (
        <span
          className="f-body absolute left-5 top-5"
          style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: NAVY, background: CREAM, borderRadius: 5, padding: '6px 9px' }}
        >
          {tag}
        </span>
      )}
      <span className={s.cap}>
        <span className="f-display" style={nameStyle}>{name}</span>
        {tripsLine(hub, ' · ') != null && <span className="f-body text-[14.5px]" style={{ color: '#E3EAF0' }}>{tripsLine(hub, ' · ')}</span>}
      </span>
      <span className={`${s.ov} ${tile.overlay}`} aria-hidden="true">
        <span className="f-display" style={nameStyle}>{name}</span>
        {facts.length > 0 && (
          <span className="grid gap-x-5 gap-y-3" style={{ gridTemplateColumns: big ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' }}>
            {facts.map(([label, value]) => (
              <span key={label} className="flex flex-col gap-0.5">
                <span className="f-body" style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: SALMON_ON_DARK }}>{label}</span>
                <span className="f-body" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: '#FFFFFF' }}>{value}</span>
              </span>
            ))}
          </span>
        )}
        <span
          className="f-body inline-flex min-h-[44px] items-center self-start px-4"
          style={{ borderRadius: 10, background: SALMON, color: PAGE_BG, border: `1.5px solid ${NAVY}`, fontWeight: 700, fontSize: '14.5px' }}
        >
          Explore {name} →
        </span>
      </span>
    </Link>
  )
}

function Countries({ hubs }: { hubs: Map<string, DestinationHubData> }) {
  const month = new Date().getMonth() + 1
  const tiles = TILES.flatMap(tile => {
    const hub = hubs.get(tile.slug)
    return hub == null ? [] : [{ tile, hub }]
  })
  if (tiles.length === 0) return null

  return (
    <section id="destinations" data-block="destinations" style={{ paddingTop: 160 }}>
      <div className={`${s.wrap} flex flex-col gap-10`}>
        <div className="flex flex-col items-center gap-4 text-center">
          <Pill center>Destinations</Pill>
          <H2 style={{ maxWidth: 820 }}>Water you won’t find on a booking site.</H2>
          <p className="f-body m-0 max-w-[560px] text-[18px]" style={{ lineHeight: 1.55, color: MUTED }}>
            Seven countries, one way of working: local guides who fish these rivers, lakes and fjords every week of the season.
          </p>
        </div>
        <div className={s.bento}>
          {tiles.map(({ tile, hub }) => <CountryTile key={tile.slug} tile={tile} hub={hub} month={month} />)}
          <Link
            href={PLAN_YOUR_TRIP_HREF}
            className={`${s.s12} ${grain.blur} ${grain.fjord} flex flex-wrap items-center justify-between gap-6`}
            style={{ minHeight: 170, padding: '36px 40px', borderRadius: 28, color: '#FFFFFF', textDecoration: 'none' }}
          >
            <span className="flex max-w-[640px] flex-col gap-2">
              <span className="f-body" style={{ fontSize: '12.5px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: SALMON_ON_DARK }}>Not sure where to go?</span>
              <span className="f-display" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>Tell us what you want to catch, and when.</span>
              <span className="f-body text-[16px]" style={{ lineHeight: 1.5, color: ON_DARK }}>We ask the guides and come back with one clear offer.</span>
            </span>
            <span
              className="f-body inline-flex min-h-[50px] items-center whitespace-nowrap px-6"
              style={{ borderRadius: 10, background: SALMON, color: PAGE_BG, border: `1.5px solid ${NAVY}`, fontWeight: 700, fontSize: '15.5px' }}
            >
              Plan a trip →
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Trips ───────────────────────────────────────────────────────────────────

/** One offer from each hub in turn, four in all. */
function featuredTrips(hubs: Map<string, DestinationHubData>) {
  const queues = TRIP_ORDER.map(slug => [...(hubs.get(slug)?.offers ?? [])])
  const picked: HubOffer[] = []
  for (let round = 0; picked.length < 4 && queues.some(q => q.length > round); round++) {
    for (const q of queues) {
      if (picked.length < 4 && q[round] != null) picked.push(q[round])
    }
  }
  return picked
}

function Trips({ hubs }: { hubs: Map<string, DestinationHubData> }) {
  const trips = featuredTrips(hubs)
  if (trips.length === 0) return null
  const total = [...hubs.values()].reduce((n, h) => n + h.offers.length, 0)

  return (
    <section id="trips" data-block="trips" style={{ paddingTop: 140 }}>
      <div className={`${s.wrap} flex flex-col gap-9`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col items-start gap-[14px]">
            <Pill>Featured trips</Pill>
            <H2 style={{ maxWidth: 720 }}>Real trips. Real prices.</H2>
          </div>
          <SecondaryButton href="/trips">All {total} trips →</SecondaryButton>
        </div>
        <div className={s.trips}>
          {trips.map(offer => <TripCard key={offer.id} trip={tripCardFromOffer(offer)} />)}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how" data-block="how-it-works" style={{ paddingTop: 160 }}>
      <div className={`${s.wrap} ${s.split}`}>
        <div className="flex flex-col items-start gap-7">
          <Pill>How it works</Pill>
          <H2>Pick a place. We ask the guide. You get one clear offer.</H2>
          <ol className="m-0 flex w-full list-none flex-col gap-1 p-0">
            {HOW_IT_WORKS.map((step, i) => {
              const last = i === HOW_IT_WORKS.length - 1
              return (
                <li key={step.title} className="flex gap-[18px] py-[18px]" style={{ borderBottom: last ? 'none' : `1px solid ${LINE}` }}>
                  <span
                    aria-hidden="true"
                    className="f-body flex h-10 w-10 flex-none items-center justify-center rounded-full text-[15px] font-bold"
                    style={{ background: last ? SALMON : NAVY, color: last ? NAVY : '#FFFFFF' }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="f-body text-[19px] font-bold">{step.title}</span>
                    <span className="f-body text-[16px]" style={{ lineHeight: 1.5, color: MUTED }}>{step.body}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
        <ExampleOffer />
      </div>
    </section>
  )
}

/** The photo with the mock offer card on it — an illustration, labelled "Example offer". */
function ExampleOffer() {
  return (
    <div className="relative overflow-hidden" style={{ height: 640, borderRadius: 32 }}>
      <Image src="/hub/nzangler.jpg" alt="Angler in waders by a New Zealand stream" fill sizes="(min-width: 1080px) 600px, 100vw" className="object-cover" />
      <span aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(6,20,34,.45) 0%, rgba(6,20,34,0) 50%)' }} />
      <div className="absolute right-6 top-6 flex items-center gap-[10px]" style={{ background: CREAM, borderRadius: 16, padding: '12px 16px', boxShadow: '0 14px 30px rgba(0,0,0,.18)' }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: '#E3F2E6' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F7A3A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
        </span>
        <span className="flex flex-col">
          <span className="f-body text-[14px] font-bold" style={{ color: NAVY }}>Guide confirmed</span>
          <span className="f-body text-[12px]" style={{ color: MUTED }}>Dates held for you</span>
        </span>
      </div>
      <div
        className="absolute bottom-6 left-6 right-6 flex flex-col gap-[14px]"
        style={{ maxWidth: 380, background: CREAM, borderRadius: 22, padding: 20, boxShadow: '0 24px 50px rgba(0,0,0,.25)', color: NAVY }}
      >
        <div className="flex items-center gap-3">
          <span className="relative block h-11 w-11 flex-none overflow-hidden rounded-full">
            <Image src="/hub/kristina.jpg" alt="Kristina Placko" fill sizes="44px" className="object-cover" style={{ objectPosition: 'center 20%' }} />
          </span>
          <span className="flex flex-[1_1_auto] flex-col">
            <span className="f-body text-[15px] font-bold">Kristina Placko</span>
            <span className="f-body text-[13px]" style={{ color: MUTED }}>Southland, New Zealand</span>
          </span>
          <span className="f-body text-[11px] font-semibold" style={{ color: MUTED, background: '#E9DFCF', borderRadius: 999, padding: '4px 9px' }}>Example offer</span>
        </div>
        <div className="f-body flex flex-col gap-2 text-[14px]">
          {[['Full guided day · 2 anglers', 'NZ$1,500'], ['All gear', 'Included'], ['Fishing licence', 'You buy online']].map(([k, v]) => (
            <div key={k} className="flex justify-between"><span style={{ color: MUTED }}>{k}</span><span className="font-semibold">{v}</span></div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #E9DFCF' }}>
          <span className="flex flex-col">
            <span className="f-body text-[12px]" style={{ color: MUTED }}>Deposit to hold the date</span>
            <span className="f-body text-[20px] font-extrabold">[DEPOSIT]</span>
          </span>
          <span className="f-body inline-flex min-h-[44px] items-center rounded-full px-[18px] text-[14px] font-semibold" style={{ background: NAVY, color: '#FFFFFF' }}>
            Pay deposit
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Review ──────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  const n = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <span role="img" aria-label={`${n} out of 5`} className="inline-flex gap-[3px]">
      {Array.from({ length: n }, (_, i) => (
        <svg key={i} aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill={SALMON}>
          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5z" />
        </svg>
      ))}
    </span>
  )
}

function Review({ testimonial }: { testimonial: Testimonial | null }) {
  if (testimonial == null) return null
  const from  = anglerCountryName(testimonial.authorCountry)
  const where = [from, testimonial.tripCountry != null ? `fished in ${testimonial.tripCountry}` : null]
    .filter((p): p is string => p != null).join(' · ')

  return (
    <section id="reviews" data-block="reviews" style={{ paddingTop: 160 }}>
      <div className={`${s.wrap} flex flex-col gap-10`}>
        <div className="flex flex-col items-start gap-[14px]">
          <Pill>Reviews</Pill>
          <H2 style={{ maxWidth: 720 }}>What anglers said.</H2>
        </div>
        <figure
          className={`${grain.blur} ${s.nzriver} m-0 flex flex-col justify-between gap-7`}
          style={{ borderRadius: 28, padding: 36, minHeight: 380 }}
        >
          <div className="flex flex-col gap-[18px]">
            {testimonial.rating != null && <Stars rating={testimonial.rating} />}
            <blockquote className="f-display m-0" style={{ fontWeight: 500, fontSize: 'clamp(24px, 3vw, 30px)', lineHeight: 1.28, color: '#FFFFFF' }}>
              {testimonial.quote}
            </blockquote>
          </div>
          <figcaption className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <span className="flex flex-col gap-0.5">
              <span className="f-body text-[16px] font-bold" style={{ color: '#FFFFFF' }}>{testimonial.authorName}</span>
              {where !== '' && <span className="f-body text-[14px]" style={{ color: '#E3EAF0' }}>{where}</span>}
            </span>
            <span className="f-body" style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#E3EAF0' }}>
              {testimonial.source === 'trustpilot' ? 'Trustpilot' : 'Direct'}
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

// ─── Guides ──────────────────────────────────────────────────────────────────

function Guides({ guides }: { guides: FeaturedGuide[] }) {
  if (guides.length === 0) return null
  const shown   = guides.slice(0, 3)
  const avatars = guides.slice(3).map(g => g.avatar_url).filter((u): u is string => u != null).slice(0, 3)

  return (
    <section id="guides" data-block="guides" style={{ paddingTop: 160 }}>
      <div className={`${s.wrap} flex flex-col gap-9`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col items-start gap-[14px]">
            <Pill>The guides</Pill>
            <H2>People you’ll fish with.</H2>
            <p className="f-body m-0 max-w-[460px] text-[17px]" style={{ lineHeight: 1.55, color: MUTED }}>We list only the ones whose trips we’d actually book.</p>
          </div>
          <SecondaryButton href="/guides">All guides →</SecondaryButton>
        </div>
        <div className={s.guides}>
          {shown.map(guide => {
            const photo = guide.avatar_url ?? guide.cover_url
            const place = [guide.city, guide.country].filter(p => p != null && p.trim() !== '').join(', ')
            return (
              <GuideLink
                key={guide.id}
                slug={guide.slug}
                className={`${s.guideTile} relative block overflow-hidden`}
                style={{ height: 420, borderRadius: 24, textDecoration: 'none', color: '#FFFFFF', background: NAVY }}
              >
                {photo != null && <Image src={photo} alt={guide.full_name} fill sizes="(min-width: 1080px) 300px, 100vw" className="object-cover" style={{ objectPosition: 'center 25%' }} />}
                <span aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(6,20,34,.85) 0%, rgba(6,20,34,0) 50%)' }} />
                <span className="absolute bottom-5 left-5 right-5 flex flex-col gap-1">
                  <span className="f-display text-[22px] font-bold">{guide.full_name}</span>
                  {place !== '' && <span className="f-body text-[14px]" style={{ color: '#E3EAF0' }}>{place}</span>}
                </span>
              </GuideLink>
            )
          })}
          <Link
            href="/guides"
            className={`${s.guideTile} flex flex-col justify-between`}
            style={{ height: 420, borderRadius: 24, padding: 28, background: CREAM, border: `1px solid ${LINE}`, textDecoration: 'none', color: NAVY }}
          >
            <span className="flex">
              {avatars.map((src, i) => (
                <span key={src} className="relative block h-14 w-14 overflow-hidden rounded-full" style={{ border: '3px solid #FFFFFF', marginLeft: i === 0 ? 0 : -14 }}>
                  <Image src={src} alt="" fill sizes="56px" className="object-cover" />
                </span>
              ))}
            </span>
            <span className="flex flex-col gap-[10px]">
              <span className="f-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.1 }}>
                Guides in Iceland, Scandinavia, New Zealand &amp; Patagonia
              </span>
              <span className="f-body text-[15px] font-semibold" style={{ color: SALMON }}>Meet them all →</span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── FAQ and closing CTA ─────────────────────────────────────────────────────

function Faq() {
  return (
    <section id="faq" data-block="faq" style={{ paddingTop: 160 }}>
      <div className={s.wrap}>
        <div
          className={`${grain.blur} ${grain.finland} flex flex-wrap items-start gap-x-12 gap-y-7`}
          style={{ borderRadius: 28, padding: 'clamp(20px, 4vw, 48px)' }}
        >
          <div className="flex max-w-[360px] flex-[1_1_240px] flex-col gap-[14px] pt-2">
            <SectionHeading eyebrow="FAQ" title="Before you ask for a trip." dark size={38}>
              <p className="f-body m-0 mt-1 text-[16px]" style={{ lineHeight: 1.6, color: ON_DARK }}>How asking, booking and paying works.</p>
            </SectionHeading>
          </div>
          <FaqList entries={FAQ} />
        </div>
      </div>
    </section>
  )
}

function ClosingCta() {
  return (
    <section data-block="cta" style={{ paddingTop: 160 }}>
      <div className={s.wrap}>
        <div className="relative flex items-center justify-center overflow-hidden" style={{ borderRadius: 36, minHeight: 560 }}>
          <Image src="/hub/fjord-blur.jpg" alt="" fill sizes="(min-width: 1280px) 1232px, 100vw" className="object-cover" />
          <span aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(4,12,22,.35) 0%, rgba(4,12,22,.55) 100%)' }} />
          <span aria-hidden="true" className={s.grain} />
          <div className="relative flex flex-col items-center gap-5 px-6 py-20 text-center" style={{ color: '#FFFFFF' }}>
            <span
              className="f-body text-[14px] font-medium"
              style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 999, padding: '7px 16px' }}
            >
              Southern season is open
            </span>
            <h2 className={`${s.h2} f-display m-0 max-w-[760px]`}>The best weeks are filling now.</h2>
            <p className="f-body m-0 max-w-[480px] text-[18px]" style={{ lineHeight: 1.6, color: '#DCE5EC' }}>
              Peak weeks go fast. Write to us before the dates you want are gone.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <PrimaryButton href={PLAN_YOUR_TRIP_HREF} size="lg">Explore trips →</PrimaryButton>
              <ContactExpertButton variant="on-dark" popoverPosition="above" />
            </div>
            <span className="f-body text-[13px]" style={{ color: '#C9D6E2' }}>We reply within 24 hours. In Polish, English or German.</span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

function globeDestinations(hubs: Map<string, DestinationHubData>): GlobeDestination[] {
  return GLOBE_ORDER.flatMap(slug => {
    const hub = hubs.get(slug)
    const geo = GLOBE[slug]
    if (hub == null || geo == null || hub.offers.length === 0) return []
    const price = priceAmount(hub)
    return [{
      slug,
      name:      hubCrumbName(hub.hub),
      center:    geo.center,
      iso:       geo.iso,
      tripCount: hub.offers.length,
      priceFrom: price != null ? `from ${price}` : null,
      pins:      hub.offers.flatMap(o => (o.locationLng != null && o.locationLat != null ? [[o.locationLng, o.locationLat] as [number, number]] : [])),
    }]
  })
}

export default function HomeView({ data }: { data: HomeData }) {
  const hubs = new Map(data.hubs.map(h => [h.hub.slug, h]))
  const destinations = globeDestinations(hubs)

  return (
    <div className="f-body relative min-h-screen overflow-hidden" style={{ background: PAGE_BG, color: NAVY }}>
      <SiteNav overlay />
      <GlobeHero token={data.mapboxToken} destinations={destinations} initial={destinations.some(d => d.slug === 'iceland') ? 'iceland' : null}>
        <h1 className={`${s.h1} f-display m-0`} style={{ fontWeight: 700, letterSpacing: '-.02em', color: '#FFFFFF' }}>
          Where do you want to fish next?
        </h1>
        <p className="f-body m-0 max-w-[540px] text-[18px]" style={{ lineHeight: 1.55, color: '#F4F7F9' }}>
          Guided fishing trips with local guides in seven countries. Pick a place, we ask the guide, you get one clear offer.
        </p>
        <PrimaryButton href={PLAN_YOUR_TRIP_HREF} size="lg">Find your trip →</PrimaryButton>
      </GlobeHero>
      <main>
        <Countries hubs={hubs} />
        <Trips hubs={hubs} />
        <HowItWorks />
        <Review testimonial={data.testimonial} />
        <Guides guides={data.guides} />
        <LatestArticles posts={data.posts} />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  )
}
