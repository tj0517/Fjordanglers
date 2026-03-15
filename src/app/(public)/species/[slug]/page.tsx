import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getExperiences } from '@/lib/supabase/queries'
import type { ExperienceWithGuide } from '@/types'
import { FISH_IMG_BY_PAGE_SLUG } from '@/lib/fish'

export const revalidate = 3600

// ─── TYPES ────────────────────────────────────────────────────────────────────

type SeasonStatus = 'closed' | 'possible' | 'good' | 'peak'

type MonthData = {
  name: string
  short: string
  status: SeasonStatus
}

type FishData = {
  name: string
  dbSlug: string
  tagline: string
  description: string
  image: string
  stats: Array<{ label: string; value: string }>
  season: MonthData[]
  seasonNote: string
}

// ─── SEASON HELPERS ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SeasonStatus, { bg: string; dot: string; label: string; text: string }> = {
  closed:   { bg: 'rgba(255,255,255,0.04)', dot: 'rgba(255,255,255,0.12)', label: 'Closed',   text: 'rgba(255,255,255,0.22)' },
  possible: { bg: 'rgba(230,126,80,0.12)',  dot: 'rgba(230,126,80,0.55)', label: 'Possible', text: 'rgba(230,126,80,0.7)'  },
  good:     { bg: 'rgba(230,126,80,0.30)',  dot: '#E67E50',                label: 'Good',     text: '#E67E50'               },
  peak:     { bg: 'rgba(230,126,80,0.72)',  dot: '#fff',                   label: 'Peak',     text: '#fff'                  },
}

const MONTHS = [
  { name: 'January',   short: 'Jan' },
  { name: 'February',  short: 'Feb' },
  { name: 'March',     short: 'Mar' },
  { name: 'April',     short: 'Apr' },
  { name: 'May',       short: 'May' },
  { name: 'June',      short: 'Jun' },
  { name: 'July',      short: 'Jul' },
  { name: 'August',    short: 'Aug' },
  { name: 'September', short: 'Sep' },
  { name: 'October',   short: 'Oct' },
  { name: 'November',  short: 'Nov' },
  { name: 'December',  short: 'Dec' },
]

function makeSeason(statuses: SeasonStatus[]): MonthData[] {
  return MONTHS.map((m, i) => ({ ...m, status: statuses[i] }))
}

// ─── FISH DATA ────────────────────────────────────────────────────────────────

const FISH_DATA: Record<string, FishData> = {
  salmon: {
    name: 'Atlantic Salmon',
    dbSlug: 'Salmon',
    tagline: 'The King of the River',
    description:
      'Atlantic Salmon is the most iconic fish in Scandinavia. Returning from the sea each summer, these powerful fish run upriver — offering anglers some of the most thrilling fly fishing in the world. A single hook-up can define an entire season.',
    image: FISH_IMG_BY_PAGE_SLUG.salmon,
    stats: [
      { label: 'Average weight', value: '5–8 kg' },
      { label: 'Record weight',  value: '36 kg' },
      { label: 'Habitat',        value: 'Rivers & Fjords' },
      { label: 'Best technique', value: 'Fly fishing / Spinning' },
      { label: 'Difficulty',     value: 'Intermediate – Expert' },
      { label: 'License',        value: 'Required (river-specific)' },
    ],
    season: makeSeason(['closed','closed','closed','closed','possible','good','peak','peak','good','possible','closed','closed']),
    seasonNote: 'Season opens in June on most Norwegian and Swedish rivers. Always verify local regulations — each river has its own rules and quota.',
  },

  trout: {
    name: 'Brown & Sea Trout',
    dbSlug: 'Trout',
    tagline: 'The Silver Ghost',
    description:
      'Sea trout and brown trout inhabit thousands of Scandinavian lakes, rivers, and coastal waters. Sea trout — running from the sea in autumn — are the prized target: hard-fighting, acrobatic, and unpredictable. Brown trout offer year-round sport in cold mountain streams.',
    image: FISH_IMG_BY_PAGE_SLUG.trout,
    stats: [
      { label: 'Average weight', value: '1–4 kg' },
      { label: 'Record weight',  value: '12 kg' },
      { label: 'Habitat',        value: 'Rivers, Lakes & Coastal' },
      { label: 'Best technique', value: 'Fly fishing / Light spinning' },
      { label: 'Difficulty',     value: 'Beginner – Intermediate' },
      { label: 'License',        value: 'Required' },
    ],
    season: makeSeason(['possible','possible','closed','good','peak','good','good','peak','peak','good','possible','possible']),
    seasonNote: 'Spring and autumn are the prime windows. Many rivers close briefly in March to protect spawning fish.',
  },

  pike: {
    name: 'Northern Pike',
    dbSlug: 'Pike',
    tagline: 'The Apex Predator',
    description:
      'Northern Pike are the top predators of Scandinavian freshwater. Aggressive and territorial, they lurk in weed beds and ambush anything that moves. Available in almost every country, pike are accessible to beginners yet endlessly challenging for veterans chasing true giants.',
    image: FISH_IMG_BY_PAGE_SLUG.pike,
    stats: [
      { label: 'Average weight', value: '3–6 kg' },
      { label: 'Record weight',  value: '25 kg' },
      { label: 'Habitat',        value: 'Lakes & Slow Rivers' },
      { label: 'Best technique', value: 'Lure fishing / Trolling' },
      { label: 'Difficulty',     value: 'Beginner – Intermediate' },
      { label: 'License',        value: 'Check locally' },
    ],
    season: makeSeason(['good','good','closed','closed','good','good','possible','possible','good','peak','peak','good']),
    seasonNote: 'Pike spawn in March–April — check local restrictions. Ice fishing in January–February is a highlight in Finland and Sweden.',
  },

  zander: {
    name: 'Zander',
    dbSlug: 'Zander',
    tagline: 'The Shadow Predator',
    description:
      "Zander (pikeperch) are Scandinavia's most sought-after table fish. Pack hunters that come alive at dusk and in low light, they reward patient anglers who understand their behaviour. Finnish and Swedish lakes hold some of the largest zander in Europe.",
    image: FISH_IMG_BY_PAGE_SLUG.zander,
    stats: [
      { label: 'Average weight', value: '1–3 kg' },
      { label: 'Record weight',  value: '12 kg' },
      { label: 'Habitat',        value: 'Large Lakes & Slow Rivers' },
      { label: 'Best technique', value: 'Jigging / Drop-shot' },
      { label: 'Difficulty',     value: 'Intermediate' },
      { label: 'License',        value: 'Check locally' },
    ],
    season: makeSeason(['possible','possible','possible','good','peak','good','possible','possible','good','peak','peak','possible']),
    seasonNote: 'Pre-spawn (April–May) and autumn (October–November) are peak times. Night fishing in summer can also produce excellent results.',
  },

  grayling: {
    name: 'Grayling',
    dbSlug: 'Grayling',
    tagline: 'Lady of the Stream',
    description:
      "Grayling thrive in cold, crystal-clear Scandinavian rivers and mountain streams. Recognisable by their stunning sail-like dorsal fin, they are one of Europe's most beautiful freshwater fish. Grayling rise to dry flies almost year-round — a fly angler's dream.",
    image: FISH_IMG_BY_PAGE_SLUG.grayling,
    stats: [
      { label: 'Average weight', value: '0.5–1.5 kg' },
      { label: 'Record weight',  value: '3.5 kg' },
      { label: 'Habitat',        value: 'Cold Mountain Rivers' },
      { label: 'Best technique', value: 'Fly fishing (dry fly)' },
      { label: 'Difficulty',     value: 'Beginner – Intermediate' },
      { label: 'License',        value: 'Required' },
    ],
    season: makeSeason(['possible','possible','good','good','peak','good','possible','good','peak','peak','good','possible']),
    seasonNote: 'Grayling can be caught year-round in open rivers. Autumn is spectacular as fish feed heavily before winter sets in.',
  },

  cod: {
    name: 'Atlantic Cod',
    dbSlug: 'Cod',
    tagline: 'The Cold Water King',
    description:
      "Atlantic Cod are the backbone of Norwegian sea fishing. From Lofoten's legendary winter skrei season to year-round fjord fishing, cod offer accessible action for all skill levels — and make for an incredible dinner after a day on the water.",
    image: FISH_IMG_BY_PAGE_SLUG.cod,
    stats: [
      { label: 'Average weight', value: '2–8 kg' },
      { label: 'Record weight',  value: '48 kg' },
      { label: 'Habitat',        value: 'Coastal & Deep Sea' },
      { label: 'Best technique', value: 'Jigging / Sea fishing' },
      { label: 'Difficulty',     value: 'Beginner' },
      { label: 'License',        value: 'Not required (saltwater)' },
    ],
    season: makeSeason(['peak','peak','peak','good','good','possible','closed','closed','possible','good','peak','peak']),
    seasonNote: 'Winter is prime cod season in Norway. The skrei (migratory Atlantic Cod) arrives January–April along the northern coast — world-class fishing.',
  },
}

// ─── METADATA ─────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const fish = FISH_DATA[slug]
  if (!fish) return {}
  return {
    title: `${fish.name} Fishing in Scandinavia | FjordAnglers`,
    description: fish.description,
  }
}

export function generateStaticParams() {
  return Object.keys(FISH_DATA).map(slug => ({ slug }))
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function SpeciesPage({ params }: Props) {
  const { slug } = await params
  const fish = FISH_DATA[slug]
  if (!fish) notFound()

  const { experiences } = await getExperiences({ fish: fish.dbSlug })

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative" style={{ height: '72vh', minHeight: '520px' }}>
        <Image
          src={fish.image}
          alt={fish.name}
          fill
          className="object-cover"
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(5,12,24,0.52) 0%, rgba(5,12,24,0.22) 40%, rgba(5,12,24,0.9) 100%)',
          }}
        />

        <div
          className="absolute inset-0 flex flex-col justify-end px-6 md:px-12 pb-14"
          style={{ zIndex: 3 }}
        >
          <div className="max-w-[1440px] mx-auto w-full">
            <Link
              href="/experiences"
              className="inline-flex items-center gap-1.5 text-xs font-medium mb-6 f-body transition-opacity hover:opacity-60"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              ← All Experiences
            </Link>

            <p
              className="text-[10px] font-bold uppercase tracking-[0.32em] mb-3 f-body"
              style={{ color: '#E67E50' }}
            >
              Species Guide
            </p>

            <h1
              className="font-bold f-display text-white mb-3"
              style={{ fontSize: 'clamp(42px, 5vw, 82px)', lineHeight: 1.05 }}
            >
              {fish.name}
            </h1>

            <p
              className="text-base f-body mb-8"
              style={{ color: 'rgba(255,255,255,0.48)', fontStyle: 'italic' }}
            >
              {fish.tagline}
            </p>

            {/* Quick stat pills */}
            <div className="flex flex-wrap gap-2.5">
              {fish.stats.slice(0, 3).map(stat => (
                <div
                  key={stat.label}
                  className="px-4 py-2.5 rounded-2xl f-body"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <p
                    className="text-[9px] font-bold uppercase tracking-[0.2em] mb-0.5"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    {stat.label}
                  </p>
                  <p className="text-sm font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── SEASON CALENDAR ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-16 px-6" style={{ background: '#07111C' }}>
        <div className="max-w-[1440px] mx-auto">

          {/* Header */}
          <div className="mb-10">
            <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
            <p
              className="text-[10px] font-bold uppercase tracking-[0.3em] mb-3 f-body"
              style={{ color: '#E67E50' }}
            >
              Season Guide
            </p>
            <h2 className="text-white text-3xl font-bold f-display mb-2">
              When to fish {fish.name}
            </h2>
            <p
              className="text-sm leading-relaxed f-body"
              style={{ color: 'rgba(255,255,255,0.36)', maxWidth: '560px' }}
            >
              {fish.seasonNote}
            </p>
          </div>

          {/* 12-month calendar grid */}
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2 mb-8">
            {fish.season.map(m => {
              const cfg = STATUS_CONFIG[m.status]
              return (
                <div
                  key={m.short}
                  className="flex flex-col items-center justify-between rounded-2xl py-5 px-1.5"
                  style={{ background: cfg.bg, minHeight: '108px' }}
                >
                  {/* Month label */}
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide f-body"
                    style={{ color: m.status === 'closed' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.5)' }}
                  >
                    {m.short}
                  </span>

                  {/* Dot indicator */}
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: cfg.dot,
                      boxShadow: m.status === 'peak' ? '0 0 10px rgba(230,126,80,0.7)' : 'none',
                    }}
                  />

                  {/* Status label */}
                  <span
                    className="text-[9px] font-bold uppercase tracking-[0.1em] f-body text-center"
                    style={{ color: cfg.text }}
                  >
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center flex-wrap gap-6">
            {(Object.entries(STATUS_CONFIG) as [SeasonStatus, typeof STATUS_CONFIG[SeasonStatus]][]).map(
              ([status, cfg]) => (
                <div key={status} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: cfg.dot }}
                  />
                  <span
                    className="text-[11px] f-body"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    {cfg.label}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* ─── QUICK INFO ────────────────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: '#F3EDE4' }}>
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Fish photo */}
            <div
              className="relative overflow-hidden"
              style={{ borderRadius: '28px', aspectRatio: '4/3' }}
            >
              <Image
                src={fish.image}
                alt={fish.name}
                fill
                className="object-cover"
              />
            </div>

            {/* Info side */}
            <div>
              <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
              <p
                className="text-[10px] font-bold uppercase tracking-[0.3em] mb-3 f-body"
                style={{ color: '#E67E50' }}
              >
                Quick Facts
              </p>
              <h2 className="text-[#0A2E4D] text-3xl font-bold f-display mb-4">
                Know your quarry
              </h2>
              <p
                className="text-base leading-relaxed mb-8 f-body"
                style={{ color: 'rgba(10,46,77,0.58)', maxWidth: '480px' }}
              >
                {fish.description}
              </p>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                {fish.stats.map(stat => (
                  <div
                    key={stat.label}
                    className="rounded-2xl px-5 py-4"
                    style={{
                      background: '#FDFAF7',
                      border: '1px solid rgba(10,46,77,0.07)',
                      boxShadow: '0 1px 8px rgba(10,46,77,0.04)',
                    }}
                  >
                    <p
                      className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5 f-body"
                      style={{ color: '#E67E50' }}
                    >
                      {stat.label}
                    </p>
                    <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── EXPERIENCE LISTINGS ───────────────────────────────────────── */}
      <section className="pb-24 px-6" style={{ background: '#F3EDE4' }}>
        <div className="max-w-[1440px] mx-auto">

          <div
            className="pt-16 mb-12 flex items-end justify-between"
            style={{ borderTop: '1px solid rgba(10,46,77,0.09)' }}
          >
            <div>
              <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
              <p
                className="text-[10px] font-bold uppercase tracking-[0.28em] mb-3 f-body"
                style={{ color: '#E67E50' }}
              >
                Available Trips
              </p>
              <h2 className="text-[#0A2E4D] text-4xl font-bold f-display">
                {fish.name} Experiences
              </h2>
            </div>
            {experiences.length > 0 && (
              <Link
                href={`/experiences?fish=${encodeURIComponent(fish.dbSlug)}`}
                className="hidden md:block text-sm font-medium hover:text-[#E67E50] transition-colors f-body"
                style={{ color: 'rgba(10,46,77,0.38)' }}
              >
                View all trips →
              </Link>
            )}
          </div>

          {experiences.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {experiences.map(exp => (
                <ExperienceCard key={exp.id} exp={exp} />
              ))}
            </div>
          ) : (
            <div
              className="text-center py-20 rounded-3xl"
              style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
            >
              <p className="text-5xl mb-5">🎣</p>
              <p className="font-semibold text-lg f-display mb-2" style={{ color: '#0A2E4D' }}>
                No trips listed yet
              </p>
              <p className="text-sm f-body mb-7" style={{ color: 'rgba(10,46,77,0.45)' }}>
                We&apos;re adding {fish.name.toLowerCase()} guides — check back soon.
              </p>
              <Link
                href="/guides/apply"
                className="inline-flex items-center text-white font-semibold text-sm px-6 py-3 rounded-full f-body hover:brightness-110 transition-all"
                style={{ background: '#E67E50' }}
              >
                Join as a Guide →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ─── OTHER SPECIES ─────────────────────────────────────────────── */}
      <section className="py-16 px-6" style={{ background: '#07111C' }}>
        <div className="max-w-[1440px] mx-auto">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.3em] mb-6 f-body"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Also in Scandinavia
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(FISH_DATA)
              .filter(([s]) => s !== slug)
              .map(([s, f]) => (
                <Link
                  key={s}
                  href={`/species/${s}`}
                  className="text-sm font-medium px-4 py-2 rounded-full f-body transition-all hover:brightness-110"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  {f.name}
                </Link>
              ))}
          </div>
        </div>
      </section>

    </div>
  )
}

// ─── EXPERIENCE CARD ──────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  Norway: '🇳🇴', Sweden: '🇸🇪', Finland: '🇫🇮', Denmark: '🇩🇰', Iceland: '🇮🇸',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'All Levels', intermediate: 'Intermediate', expert: 'Expert',
}

function ExperienceCard({ exp }: { exp: ExperienceWithGuide }) {
  const coverUrl = exp.images.find(img => img.is_cover)?.url ?? exp.images[0]?.url ?? null
  const flag      = exp.location_country != null ? (COUNTRY_FLAGS[exp.location_country] ?? '') : ''
  const diffLabel = exp.difficulty != null ? (DIFFICULTY_LABEL[exp.difficulty] ?? exp.difficulty) : null
  const duration  = exp.duration_hours != null
    ? `${exp.duration_hours}h`
    : exp.duration_days != null
    ? `${exp.duration_days} days`
    : null

  return (
    <Link href={`/experiences/${exp.id}`} className="group block">
      <article
        className="overflow-hidden transition-all duration-300 hover:shadow-[0_24px_56px_rgba(10,46,77,0.13)] hover:-translate-y-1.5 h-full flex flex-col"
        style={{
          borderRadius: '24px',
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 14px rgba(10,46,77,0.05)',
        }}
      >
        {/* Image */}
        <div className="relative overflow-hidden flex-shrink-0" style={{ height: '220px' }}>
          {coverUrl != null ? (
            <Image
              src={coverUrl}
              alt={exp.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="w-full h-full" style={{ background: '#EDE6DB' }} />
          )}

          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-center pb-4"
            style={{ background: 'rgba(7,17,28,0.25)' }}
          >
            <span
              className="text-white text-xs font-semibold px-5 py-2 rounded-full f-body translate-y-2 group-hover:translate-y-0 transition-transform duration-200"
              style={{ background: '#E67E50' }}
            >
              View Trip →
            </span>
          </div>

          <div
            className="absolute top-3 right-3 text-white text-sm font-bold px-3 py-1.5 rounded-full f-body"
            style={{ background: 'rgba(5,12,22,0.72)', backdropFilter: 'blur(8px)' }}
          >
            €{exp.price_per_person_eur}
            <span className="text-xs font-normal opacity-55">/pp</span>
          </div>

          {diffLabel != null && (
            <div
              className="absolute top-3 left-3 text-xs font-medium px-2.5 py-1 rounded-full f-body"
              style={{
                background: 'rgba(5,12,22,0.6)',
                color: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {diffLabel}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
            <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
              {flag} {exp.location_country}
            </span>
            {exp.fish_types[0] != null && (
              <>
                <span className="text-xs" style={{ color: 'rgba(10,46,77,0.2)' }}>·</span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full f-body"
                  style={{ background: 'rgba(201,107,56,0.09)', color: '#9E4820' }}
                >
                  {exp.fish_types[0]}
                </span>
              </>
            )}
          </div>

          <h3
            className="font-semibold text-[15px] leading-snug mb-auto f-display line-clamp-2"
            style={{ color: '#0A2E4D' }}
          >
            {exp.title}
          </h3>

          <div
            className="flex items-center justify-between mt-4 pt-4"
            style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
                style={{ border: '1.5px solid rgba(10,46,77,0.07)' }}
              >
                {exp.guide.avatar_url != null ? (
                  <Image
                    src={exp.guide.avatar_url}
                    alt={exp.guide.full_name}
                    width={28}
                    height={28}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#0A2E4D] flex items-center justify-center text-white text-[10px] f-body">
                    {exp.guide.full_name[0]}
                  </div>
                )}
              </div>
              <p
                className="text-xs font-medium f-body truncate max-w-[90px]"
                style={{ color: '#0A2E4D' }}
              >
                {exp.guide.full_name}
              </p>
            </div>
            {duration != null && (
              <p className="text-xs f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.35)' }}>
                {duration}
              </p>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
