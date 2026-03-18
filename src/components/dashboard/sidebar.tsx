'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

type SidebarGuide = {
  id: string
  full_name: string
  avatar_url: string | null
  pricing_model: string
  stripe_charges_enabled: boolean
  stripe_payouts_enabled: boolean
  status: string
} | null

// ─── Constants ────────────────────────────────────────────────────────────────

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── SVG icons ────────────────────────────────────────────────────────────────

const IconOverview = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </svg>
)

const IconCompass = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="7.5" cy="7.5" r="6" />
    <path d="M9.5 5.5L7.5 10 5.5 7.5 10 5.5z" fill="currentColor" stroke="none" />
  </svg>
)

const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" />
    <line x1="1.5" y1="6" x2="13.5" y2="6" />
    <line x1="4.5" y1="1" x2="4.5" y2="4" />
    <line x1="10.5" y1="1" x2="10.5" y2="4" />
  </svg>
)

const IconBookings = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1.5" y="2" width="12" height="11" rx="1.5" />
    <line x1="4.5" y1="5.5" x2="10.5" y2="5.5" />
    <line x1="4.5" y1="8"   x2="10.5" y2="8"   />
    <line x1="4.5" y1="10.5" x2="8"  y2="10.5" />
  </svg>
)

const IconTrending = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <polyline points="1,11 4.5,7 7.5,9 13,3.5" />
    <polyline points="9.5,3.5 13,3.5 13,7" />
  </svg>
)

const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="7.5" cy="5" r="2.5" />
    <path d="M2 13.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
  </svg>
)

const IconArrowLeft = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
    <polyline points="7,2 3,6 7,10" />
    <line x1="3" y1="6" x2="11" y2="6" />
  </svg>
)

const IconLogout = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h3" />
    <polyline points="9,9 12,6.5 9,4" />
    <line x1="5" y1="6.5" x2="12" y2="6.5" />
  </svg>
)

const IconInquiries = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M1.5 2.5h12a1 1 0 011 1v7a1 1 0 01-1 1H4l-3 2.5V3.5a1 1 0 011-1z" />
  </svg>
)

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_ACTIVE = [
  { label: 'Listings',   href: '/dashboard/trips',        icon: <IconCompass />    },
  { label: 'Profile',    href: '/dashboard/profile',      icon: <IconUser />       },
] as const

const NAV_SOON = [
  { label: 'Bookings',   icon: <IconBookings />   },
  { label: 'Inquiries',  icon: <IconInquiries />  },
  { label: 'Calendar',   icon: <IconCalendar />   },
  { label: 'Earnings',   icon: <IconTrending />   },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardSidebar({ guide }: { guide: SidebarGuide }) {
  const pathname = usePathname()

  // Resolve display values — fallback to placeholder when not authenticated
  const displayName    = guide?.full_name ?? 'Guide'
  const displayAvatar  = guide?.avatar_url ?? null
  const isFounder      = guide?.pricing_model === 'commission'
  const payoutsActive  = (guide?.stripe_charges_enabled === true) && (guide?.stripe_payouts_enabled === true)
  const isPending      = guide?.status === 'pending'

  return (
    <aside
      className="fixed inset-y-0 left-0 flex flex-col"
      style={{
        width: '240px',
        background: '#07111C',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        zIndex: 40,
      }}
    >
      {/* Grain texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: GRAIN_BG,
          backgroundSize: '200px 200px',
          opacity: 0.055,
          mixBlendMode: 'screen',
        }}
      />

      {/* Logo */}
      <div
        className="relative px-6 pt-6 pb-5"
        style={{ zIndex: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <Link href="/">
          <Image
            src="/brand/white-logo.png"
            alt="FjordAnglers"
            width={140}
            height={36}
            className="h-7 w-auto"
            style={{ opacity: 0.7 }}
          />
        </Link>
        <p className="text-[10px] uppercase tracking-[0.22em] mt-1.5 f-body" style={{ color: 'rgba(255,255,255,0.22)' }}>
          Guide Dashboard
        </p>
      </div>

      {/* Guide profile card */}
      <div
        className="relative px-4 py-3"
        style={{ zIndex: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="flex items-center gap-3 px-3 py-3 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
            style={{ border: '2px solid rgba(230,126,80,0.35)' }}
          >
            {displayAvatar != null ? (
              <Image
                src={displayAvatar}
                alt={displayName}
                width={36}
                height={36}
                className="object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white text-sm f-body"
                style={{ background: '#0A2E4D' }}
              >
                {displayName[0]}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold truncate f-body leading-tight">{displayName}</p>
            <span
              className="inline-block text-[9px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full mt-0.5 f-body"
              style={{ background: 'rgba(230,126,80,0.15)', color: '#E67E50' }}
            >
              {isFounder ? 'Founding Guide' : 'Guide'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto" style={{ zIndex: 1 }}>
        {NAV_ACTIVE.map((item) => {
          const isActive = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all f-body"
              style={{
                background: isActive ? 'rgba(230,126,80,0.1)' : 'transparent',
                color: isActive ? '#E67E50' : 'rgba(255,255,255,0.45)',
                border: isActive ? '1px solid rgba(230,126,80,0.15)' : '1px solid transparent',
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.65 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}

        {/* Coming soon */}
        <div className="mt-3 mb-1 px-3">
          <p className="text-[9px] uppercase tracking-[0.2em] f-body" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Coming soon
          </p>
        </div>
        {NAV_SOON.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm f-body"
            style={{ color: 'rgba(255,255,255,0.2)', cursor: 'default' }}
          >
            <div className="flex items-center gap-3">
              <span style={{ opacity: 0.4 }}>{item.icon}</span>
              {item.label}
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full f-body"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }}
            >
              Soon
            </span>
          </div>
        ))}
      </nav>

      {/* Bottom: payout status + sign out + back to site */}
      <div
        className="relative px-4 pb-5 pt-4"
        style={{ zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Account status */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: payoutsActive ? '#4ADE80' : isPending ? '#E67E50' : '#94A3B8',
              boxShadow: payoutsActive ? '0 0 6px rgba(74,222,128,0.5)' : 'none',
            }}
          />
          <div>
            <p className="text-white/55 text-xs f-body leading-tight">
              {payoutsActive ? 'Payouts active' : isPending ? 'Awaiting review' : 'Stripe not set up'}
            </p>
            <p className="text-white/25 text-[10px] f-body">
              {payoutsActive ? 'Stripe Connect' : isPending ? 'We\'ll email you soon' : 'Connect in Settings'}
            </p>
          </div>
        </div>

        {/* Sign out — submits to Server Action which clears session + redirects */}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all f-body hover:bg-white/[0.06] mb-0.5"
            style={{ color: 'rgba(255,255,255,0.35)', cursor: 'pointer', border: 'none', background: 'transparent' }}
          >
            <IconLogout />
            Sign out
          </button>
        </form>

        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all f-body hover:bg-white/[0.04]"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          <IconArrowLeft />
          Back to site
        </Link>
      </div>
    </aside>
  )
}
