/**
 * The country hub (FA-1.65) — what `/[destination]` renders, from one `getDestinationHub()`
 * result and nothing else, so the same view renders a fixture in the tests.
 *
 * Layout: the hub redesign accepted by tj on 2026-11-17 (docs/design/blog-hubs-2026-11/README.md
 * and hub.dc.html — the source of truth for layout, colours, type and spacing). Order: hero →
 * trips (species filter above the grid, no map) → season → guides → how it works → angler quote →
 * articles → FAQ → more destinations → plan-your-trip block. The site's nav sits on the hero photo
 * here (`SiteNav overlay`), which is why the hub renders it itself rather than under the (public) layout.
 *
 * A section with no data is not rendered at all — no empty heading. The sections the hub funnel
 * measures (`HUB_SECTIONS`: season, trips, faq, reviews) carry `data-section`; the rest carry
 * `data-block`.
 *
 * There is no inquiry form here on purpose: the hub leads to an offer page, and the offer page
 * asks. The hub's GA4 events (`hub_view`, `section_view`, `hub_card_click`) come from
 * `HubFunnelProvider`.
 */

import Image from 'next/image'
import Link from 'next/link'
import { HubFunnelProvider } from '@/components/analytics/hub-funnel'
import { GuideLink } from '@/components/guides/guide-link'
import { BlogImage } from '@/components/blog/article-blocks'
import { anglerCountryName } from '@/lib/angler-countries'
import { formatPostDate } from '@/lib/blog/post'
import { getHubForSlug } from '@/lib/destinations'
import { formatCents } from '@/lib/format-price'
import { hubCrumbName } from '@/lib/seo/hub-jsonld'
import type { DestinationHubData } from '@/lib/supabase/queries'
import HubTrips from './hub-trips'
import { SiteNav, PLAN_YOUR_TRIP_HREF } from '@/components/layout/nav'
import { SiteFooter } from '@/components/layout/footer'
import { FaqList } from '@/components/site/faq'
import {
  CREAM, DEEP_NAVY, Eyebrow, GhostButton, HeadingLink, MUTED, NAVY, ON_DARK, PrimaryButton,
  SALMON_ON_DARK, SectionHeading, Tag,
} from '@/components/site/ui'
import s from '@/components/site/grain.module.css'

/** Where every "Plan your trip" button leads — the site-wide one (tj, 2026-11-17). */
const PLAN_HREF = PLAN_YOUR_TRIP_HREF

/**
 * The three steps of "How it works". The booking answer every hub's FAQ ends with ("How do I book a
 * guided fishing trip in …?") repeats them, but since FA-1.85 that answer is plain text in
 * `destination_hubs.faq` (norway, sweden, finland, new-zealand) and nothing keeps it in step with
 * these. When the booking process changes, edit these steps and those four answers together
 * (docs/deferred-tasks.md, FA-1.85).
 */
const HOW_IT_WORKS = [
  { title: 'Tell us your dates',               body: 'Dates, group size, what you want to catch.', bg: s.iceland },
  { title: 'We check with the guide',          body: 'We come back with availability and a price within two business days.', bg: s.guide },
  { title: 'Deposit once dates are confirmed', body: 'You pay nothing to ask.', bg: s.fjord },
] as const

/** Photos of the other hubs' tiles (from the mockup); a hub without one gets a navy tile. */
const HUB_TILE_PHOTOS: Partial<Record<string, string>> = {
  iceland:       '/hub/iceland.jpg',
  norway:        '/hub/norway.jpg',
  sweden:        '/hub/sweden.jpg',
  finland:       '/hub/finland.jpg',
  'new-zealand': '/hub/nzriver.jpg',
}

/** The hero photo when the hub has none set in /admin/hubs and no offer has a photo. */
const HERO_FALLBACK = '/hub/canyon.jpg'

const MONTHS      = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

/**
 * "April to September" from [4..9]; a season across the new year reads "October to April";
 * gaps give "May to June, September"; all twelve months read "All year". Null when empty.
 */
export function monthRange(months: readonly number[]): string | null {
  const set = new Set(months.filter(m => m >= 1 && m <= 12))
  if (set.size === 0) return null
  if (set.size === 12) return 'All year'

  // Start each run at a month whose predecessor is not in the set — that also handles Dec → Jan.
  const runs: string[] = []
  for (let m = 1; m <= 12; m++) {
    const prev = m === 1 ? 12 : m - 1
    if (!set.has(m) || set.has(prev)) continue
    let end = m
    while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1
    runs.push(end === m ? MONTH_NAMES[m - 1] : `${MONTH_NAMES[m - 1]} to ${MONTH_NAMES[end - 1]}`)
  }
  return runs.join(', ')
}

/** "Brown trout, arctic char and sea trout." */
function speciesSentence(species: readonly string[]): string {
  if (species.length === 1) return `${species[0]}.`
  return `${species.slice(0, -1).join(', ')} and ${species[species.length - 1]}.`
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')
}

/** The hub's short name ("Iceland", "Patagonia") — the same one its breadcrumb uses. */
function placeName(slug: string, fallback: string): string {
  const skeleton = getHubForSlug(slug)
  return skeleton == null ? fallback : hubCrumbName(skeleton)
}

function Hero({ data, place }: { data: DestinationHubData; place: string }) {
  const { hub } = data
  const facts: { label: string; value: string; big?: boolean }[] = []
  const season = monthRange(hub.seasonMonths ?? [])
  const peak   = monthRange(hub.peakMonths ?? [])
  if (season != null) facts.push({ label: 'Season', value: season })
  if (peak != null) facts.push({ label: 'Best months', value: peak })
  if (data.species.length > 0) facts.push({ label: 'Species', value: data.species.join(', ') })
  if (data.guideCount > 0) facts.push({ label: 'Guides', value: String(data.guideCount) })
  if (data.priceFrom != null) {
    facts.push({ label: 'Trips from', value: formatCents(data.priceFrom.cents, data.priceFrom.currency), big: true })
  }

  return (
    <section
      data-block="hero"
      className="relative mx-auto mt-3 flex flex-col justify-end overflow-hidden pt-[220px] sm:pt-[120px]"
      style={{ width: 'calc(100% - 24px)', maxWidth: 1560, minHeight: 640, borderRadius: 28, paddingBottom: 'clamp(28px, 4vw, 48px)', background: NAVY }}
    >
      <Image src={hub.heroImageUrl ?? data.ogImage ?? HERO_FALLBACK} alt="" fill priority sizes="(min-width: 1584px) 1560px, 100vw" className="object-cover" />
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(7,22,36,.18) 0%, rgba(7,22,36,.22) 38%, rgba(7,22,36,.84) 100%)' }}
      />
      <div className="relative mx-auto flex w-full flex-col gap-6 px-6" style={{ maxWidth: 1200 }}>
        <nav aria-label="Breadcrumb" className="f-body flex flex-wrap items-center gap-2 text-[14px]">
          <Link href="/" style={{ color: '#E3EAF0', textDecoration: 'none' }}>Home</Link>
          <Chevron />
          <Link href="/trips" style={{ color: '#E3EAF0', textDecoration: 'none' }}>All destinations</Link>
          <Chevron />
          <span aria-current="page" style={{ color: '#FFFFFF' }}>{place}</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="flex max-w-[660px] flex-[1_1_420px] flex-col gap-5">
            <h1
              className="f-display"
              style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(44px, 6vw, 76px)', lineHeight: 1, letterSpacing: '-.02em', color: '#FFFFFF' }}
            >
              {hub.h1}
            </h1>
            <p className="f-body m-0 text-[18px]" style={{ lineHeight: 1.55, color: '#F4F7F9' }}>{hub.intro}</p>
            <div className="flex flex-wrap gap-3">
              <PrimaryButton href={PLAN_HREF}>Plan your trip</PrimaryButton>
              {data.offers.length > 0 && <GhostButton href="#trips">Browse trips</GhostButton>}
            </div>
          </div>
          {facts.length > 0 && (
            <dl className="m-0 flex flex-[0_1_320px] flex-col gap-[10px]" data-testid="hub-facts">
              {facts.map(fact => (
                <div key={fact.label} className={`${s.fq} flex flex-col gap-[3px]`} style={{ padding: '13px 18px' }}>
                  <dt className="f-body text-[11.5px] font-bold uppercase" style={{ letterSpacing: '.1em', color: SALMON_ON_DARK }}>{fact.label}</dt>
                  <dd
                    className={fact.big ? 'f-display' : 'f-body'}
                    style={fact.big
                      ? { margin: 0, fontWeight: 700, fontSize: 26, color: '#FFFFFF' }
                      : { margin: 0, fontSize: '15.5px', fontWeight: 600, lineHeight: 1.35, color: '#FFFFFF' }}
                  >
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}

function Chevron() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9D6E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

const SEASON_COLORS = { peak: NAVY, season: '#8FB3CF', closed: '#DDD3C4' } as const
const SEASON_LABELS = { peak: 'peak', season: 'in season', closed: 'closed' } as const

function Season({ data, place }: { data: DestinationHubData; place: string }) {
  const seasonMonths = data.hub.seasonMonths ?? []
  const peakMonths   = data.hub.peakMonths ?? []
  if (seasonMonths.length === 0 && peakMonths.length === 0) return null

  const note = data.hub.seasonNote?.trim() ?? ''

  return (
    <section
      id="season"
      data-section="season"
      className={`${s.blur} ${s.iceland} flex scroll-mt-24 flex-col gap-7`}
      style={{ borderRadius: 24, padding: 'clamp(24px, 4vw, 48px)' }}
    >
      <SectionHeading eyebrow="When to go" title={`The fishing season in ${place}`} dark size={36} />
      <div className="flex flex-col gap-5" style={{ background: 'rgba(253,250,247,.97)', borderRadius: 16, padding: 24 }}>
        {/* Below `sm` the bar keeps readable cells and scrolls sideways instead of the page. */}
        <div className="overflow-x-auto" data-testid="hub-season-scroll">
          <div className="grid min-w-[480px] gap-[5px] sm:min-w-0" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
            {MONTHS.map((label, i) => {
              const m = i + 1
              const state = peakMonths.includes(m) ? 'peak' : seasonMonths.includes(m) ? 'season' : 'closed'
              return (
                <div key={label} className="flex min-w-0 flex-col items-center gap-3">
                  <span className="f-body text-[14px]" style={{ color: NAVY }}>{label}</span>
                  <span
                    role="img"
                    aria-label={`${label}: ${SEASON_LABELS[state]}`}
                    data-month-state={state}
                    className="block h-[10px] w-full"
                    style={{ borderRadius: 3, background: SEASON_COLORS[state] }}
                  />
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-[10px]">
          {(['peak', 'season', 'closed'] as const).map(state => (
            <span key={state} className="f-body inline-flex items-center gap-2 text-[14px]" style={{ color: NAVY }}>
              <span aria-hidden="true" className="h-3 w-3" style={{ borderRadius: 3, background: SEASON_COLORS[state] }} />
              {state === 'peak' ? 'Peak months' : state === 'season' ? 'In season' : 'Closed'}
            </span>
          ))}
        </div>
      </div>
      {(note !== '' || data.species.length > 0) && (
        <div className="grid gap-x-12 gap-y-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {note !== '' && (
            <p className="f-body m-0 text-[16.5px]" style={{ lineHeight: 1.6, color: ON_DARK }}>{note}</p>
          )}
          {data.species.length > 0 && (
            <div className="flex flex-col gap-2">
              <Eyebrow dark>Target species</Eyebrow>
              <p className="f-display m-0" style={{ fontWeight: 600, fontSize: 22, lineHeight: 1.3, color: '#FFFFFF' }}>
                {speciesSentence(data.species)}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** The guides whose offers the hub lists, each linking to the profile (FA-1.82). */
function Guides({ data }: { data: DestinationHubData }) {
  if (data.guides.length === 0) return null

  return (
    <section data-block="guides" className="flex flex-col gap-7" style={{ background: NAVY, borderRadius: 24, padding: 'clamp(20px, 4vw, 48px)' }}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-[560px]">
          <SectionHeading eyebrow="Who takes you out" title="Your guides" dark>
            <p className="f-body m-0 text-[16px]" style={{ lineHeight: 1.6, color: ON_DARK }}>You talk to the guide who takes you out.</p>
          </SectionHeading>
        </div>
        <HeadingLink href="/guides" dark>All guides</HeadingLink>
      </div>
      <ul className="m-0 grid list-none gap-[18px] p-0" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {data.guides.map(guide => (
          <li key={guide.id}>
            <GuideLink
              slug={guide.slug}
              className="flex h-full items-center gap-4 p-[18px]"
              style={{ borderRadius: 16, textDecoration: 'none', background: 'rgba(253,250,247,.96)', border: '1px solid rgba(255,255,255,.6)', boxShadow: '0 12px 32px rgba(4,14,24,.28)' }}
            >
              {guide.avatarUrl != null ? (
                <span className="relative block h-14 w-14 flex-none overflow-hidden rounded-full" style={{ background: NAVY }}>
                  <Image src={guide.avatarUrl} alt="" fill sizes="56px" className="object-cover" />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="f-body flex h-14 w-14 flex-none items-center justify-center rounded-full text-[17px] font-bold"
                  style={{ background: NAVY, color: '#FFFFFF' }}
                >
                  {initials(guide.name)}
                </span>
              )}
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="f-body text-[17px] font-bold" style={{ color: NAVY }}>{guide.name}</span>
                {guide.tagline != null && guide.tagline.trim() !== '' && (
                  <span className="f-body text-[14.5px]" style={{ color: MUTED }}>{guide.tagline}</span>
                )}
              </span>
            </GuideLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

function HowItWorks() {
  return (
    <section data-block="how-it-works">
      <div className="mb-7"><SectionHeading eyebrow="Booking" title="How it works" /></div>
      <ol className="m-0 grid list-none gap-5 p-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {HOW_IT_WORKS.map((step, i) => (
          <li
            key={step.title}
            data-step={i + 1}
            className={`${s.blur} ${step.bg} flex flex-col justify-end gap-[10px]`}
            style={{ minHeight: 280, padding: 28, borderRadius: 20 }}
          >
            <span aria-hidden="true" className="f-display" style={{ fontWeight: 600, fontSize: 64, lineHeight: 1, color: SALMON_ON_DARK, marginBottom: 'auto' }}>
              {i + 1}
            </span>
            <h3 className="f-display m-0" style={{ fontWeight: 600, fontSize: 24, lineHeight: 1.15, color: '#FFFFFF' }}>{step.title}</h3>
            <p className="f-body m-0 text-[15.5px]" style={{ lineHeight: 1.55, color: ON_DARK }}>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * One angler's words: the newest published review, else the testimonial that stands in for
 * empty reviews (FA-1.69), else the hub's own quote. Nothing when there is none.
 */
function AnglerQuote({ data }: { data: DestinationHubData }) {
  const review = data.reviews.find(r => r.comment != null && r.comment.trim() !== '')
  const quote = review != null
    ? { text: review.comment ?? '', who: [review.firstName, anglerCountryName(review.country)] }
    : data.testimonial != null
      ? { text: data.testimonial.quote, who: [data.testimonial.authorName, anglerCountryName(data.testimonial.authorCountry)] }
      : data.hub.heroQuote != null
        ? { text: data.hub.heroQuote.text, who: [data.hub.heroQuote.author, data.hub.heroQuote.country] }
        : null
  if (quote == null) return null

  const who = quote.who.filter((part): part is string => part != null && part.trim() !== '').join(', ')

  return (
    <figure
      id="reviews"
      data-section="reviews"
      className="m-0 flex scroll-mt-24 flex-col gap-[18px]"
      style={{ background: DEEP_NAVY, borderRadius: 20, padding: '44px clamp(24px, 4vw, 48px)' }}
    >
      <blockquote
        className="f-display m-0"
        style={{ fontWeight: 400, fontStyle: 'italic', fontSize: 'clamp(24px, 3vw, 30px)', lineHeight: 1.3, color: '#FFFFFF' }}
      >
        {quote.text}
      </blockquote>
      {who !== '' && (
        <figcaption className="f-body text-[15px] font-semibold" style={{ color: SALMON_ON_DARK }}>{who}</figcaption>
      )}
    </figure>
  )
}

/** Published articles about the hub's countries, newest first (FA-1.90); the three newest. */
function Articles({ data, place }: { data: DestinationHubData; place: string }) {
  const articles = data.articles.slice(0, 3)
  if (articles.length === 0) return null

  return (
    <section data-block="articles">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <SectionHeading eyebrow="Journal" title="Read before you go" />
        <HeadingLink href="/blog">All {place} articles</HeadingLink>
      </div>
      <div className="grid gap-x-8 gap-y-10" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {articles.map(article => (
          <article key={article.slug} className="flex flex-col gap-[14px]">
            <Link
              href={`/blog/${article.slug}`}
              tabIndex={-1}
              aria-hidden="true"
              className="relative block overflow-hidden"
              style={{ borderRadius: 16, aspectRatio: '4 / 3', background: CREAM }}
            >
              <BlogImage src={article.imageUrl} alt="" className="object-cover" />
              <span className="absolute bottom-3 left-3 flex gap-1.5">
                {article.category.trim() !== '' && <Tag tone="sand">{article.category}</Tag>}
                {article.country != null && <Tag>{article.country}</Tag>}
              </span>
            </Link>
            <div className="flex flex-col gap-2">
              <h3 className="f-display m-0" style={{ fontWeight: 700, fontSize: 22, lineHeight: 1.2 }}>
                <Link href={`/blog/${article.slug}`} style={{ color: NAVY, textDecoration: 'none' }}>{article.title}</Link>
              </h3>
              <p className="f-body m-0 text-[15px]" style={{ lineHeight: 1.55, color: MUTED }}>{article.description}</p>
              <p className="f-body m-0 text-[13.5px]" style={{ color: MUTED }}>
                {formatPostDate(article.publishedAt)} · {article.readMinutes} min read
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Faq({ data, place }: { data: DestinationHubData; place: string }) {
  const faq = data.hub.faq ?? []
  if (faq.length === 0) return null

  const contact = data.hub.contact

  return (
    <section
      id="faq"
      data-section="faq"
      className={`${s.blur} ${s.finland} flex scroll-mt-24 flex-wrap items-start gap-x-12 gap-y-7`}
      style={{ borderRadius: 24, padding: 'clamp(20px, 4vw, 48px)' }}
    >
      <div className="flex max-w-[360px] flex-[1_1_240px] flex-col gap-[14px] pt-2">
        <SectionHeading eyebrow="FAQ" title={`Questions about fishing in ${place}`} dark size={38}>
          <p className="f-body m-0 mt-1 text-[16px]" style={{ lineHeight: 1.6, color: ON_DARK }}>Answers come from the guides who run these trips.</p>
        </SectionHeading>
        {contact != null && (
          <div><GhostButton href={`mailto:${contact.email}`} external>Ask us directly</GhostButton></div>
        )}
      </div>
      <FaqList entries={faq} />
    </section>
  )
}

function MoreDestinations({ data }: { data: DestinationHubData }) {
  if (data.otherHubs.length === 0) return null

  return (
    <section data-block="destinations">
      <div className="mb-7"><SectionHeading eyebrow="Destinations" title="More destinations" /></div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
        {data.otherHubs.map(other => {
          const photo = HUB_TILE_PHOTOS[other.slug]
          return (
            <Link
              key={other.slug}
              href={`/${other.slug}`}
              className="relative flex items-end overflow-hidden"
              style={{ aspectRatio: '3 / 4', borderRadius: 16, textDecoration: 'none', background: NAVY }}
            >
              {photo != null && <Image src={photo} alt="" fill sizes="(min-width: 1024px) 230px, 50vw" className="object-cover" />}
              <span aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(7,22,36,0) 40%, rgba(7,22,36,.78) 100%)' }} />
              <span className="relative flex flex-col gap-0.5 p-4">
                <span className="f-display text-[22px]" style={{ color: '#FFFFFF' }}>{placeName(other.slug, other.h1)}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function PlanYourTrip({ data, place }: { data: DestinationHubData; place: string }) {
  const whatsapp = data.hub.contact?.whatsapp.replace(/\D/g, '') ?? ''

  return (
    <section
      data-block="plan"
      className={`${s.blur} ${s.fjord} flex flex-wrap items-center justify-between gap-8`}
      style={{ borderRadius: 24, padding: '56px clamp(24px, 5vw, 64px)' }}
    >
      <div className="flex max-w-[620px] flex-[1_1_420px] flex-col gap-[14px]">
        <Eyebrow dark>Plan your trip</Eyebrow>
        <h2
          className="f-display m-0"
          style={{ fontWeight: 600, fontSize: 'clamp(30px, 4vw, 44px)', lineHeight: 1.08, letterSpacing: '-.015em', color: '#FFFFFF' }}
        >
          Tell us your dates for {place}
        </h2>
        <p className="f-body m-0 text-[17px]" style={{ lineHeight: 1.55, color: ON_DARK }}>
          Dates, group size, what you want to catch. We come back with availability and a price within two business days.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <PrimaryButton href={PLAN_HREF}>Plan your trip</PrimaryButton>
        {whatsapp !== '' && <GhostButton href={`https://wa.me/${whatsapp}`} external>Message us on WhatsApp</GhostButton>}
      </div>
    </section>
  )
}

export default function DestinationHubView({ data }: { data: DestinationHubData }) {
  const place = hubCrumbName(data.hub)

  return (
    <HubFunnelProvider slug={data.hub.slug}>
      <div className="f-body relative min-h-screen" style={{ background: '#F3EDE4', color: NAVY }}>
        <SiteNav overlay />
        <Hero data={data} place={place} />
        <main className="mx-auto flex flex-col gap-20 px-6 pt-[72px]" style={{ maxWidth: 1200 }}>
          <HubTrips offers={data.offers} species={data.species} place={place} />
          <Season data={data} place={place} />
          <Guides data={data} />
          <HowItWorks />
          <AnglerQuote data={data} />
          <Articles data={data} place={place} />
          <Faq data={data} place={place} />
          <MoreDestinations data={data} />
          <PlanYourTrip data={data} place={place} />
        </main>
        <SiteFooter />
      </div>
    </HubFunnelProvider>
  )
}
