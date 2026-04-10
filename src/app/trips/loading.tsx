import Image from 'next/image'

function CardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Image */}
      <div
        className="rounded-xl mb-3"
        style={{ height: '200px', background: '#C8B89E' }}
      />
      {/* Title */}
      <div className="h-4 w-3/4 rounded mb-1.5" style={{ background: '#D5C9B8' }} />
      {/* Location */}
      <div className="h-3 w-1/2 rounded mb-2" style={{ background: '#D5C9B8' }} />
      {/* Guide row */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: '#D5C9B8' }} />
        <div className="h-3 w-28 rounded" style={{ background: '#D5C9B8' }} />
      </div>
      {/* Price */}
      <div className="h-4 w-20 rounded mt-2" style={{ background: '#D5C9B8' }} />
    </div>
  )
}

export default function TripsLoading() {
  return (
    <div style={{ background: '#F3EDE4', minHeight: '100vh' }}>

      {/* ─── NAV SKELETON ─────────────────────────────────────────── */}
      <div
        className="fixed top-0 inset-x-0 z-[1100]"
        style={{ background: 'rgba(243,237,228,0.92)', borderBottom: '1px solid rgba(10,46,77,0.08)', backdropFilter: 'blur(20px)' }}
      >
        {/* Top bar */}
        <div className="flex items-center px-4 md:px-8 h-14 md:h-[88px] gap-4">
          {/* Logo */}
          <div className="flex-shrink-0 w-32 md:w-40">
            <Image src="/brand/dark-logo.png" alt="FjordAnglers" width={140} height={36} className="h-7 md:h-8 w-auto" priority />
          </div>
          {/* Search bar skeleton — desktop only */}
          <div className="hidden md:flex flex-1 items-center justify-center gap-3">
            <div
              className="animate-pulse rounded-full"
              style={{ flex: 1, maxWidth: '480px', height: '44px', background: 'rgba(10,46,77,0.06)' }}
            />
            <div
              className="animate-pulse rounded-xl flex-shrink-0"
              style={{ width: '96px', height: '44px', background: 'rgba(10,46,77,0.06)' }}
            />
          </div>
          {/* Right side */}
          <div className="flex-1 md:flex-none flex items-center justify-end gap-3">
            <div className="hidden md:block animate-pulse rounded-xl" style={{ width: '120px', height: '36px', background: 'rgba(230,126,80,0.2)' }} />
            <div className="animate-pulse rounded-xl" style={{ width: '36px', height: '36px', background: 'rgba(10,46,77,0.08)' }} />
          </div>
        </div>
        {/* Mobile search row */}
        <div className="md:hidden px-4 pb-3 flex items-center gap-2">
          <div className="animate-pulse rounded-full flex-1" style={{ height: '40px', background: 'rgba(10,46,77,0.06)' }} />
          <div className="animate-pulse rounded-xl flex-shrink-0" style={{ width: '80px', height: '40px', background: 'rgba(10,46,77,0.06)' }} />
        </div>
      </div>

      {/* Nav spacer */}
      <div style={{ height: 'var(--nav-h, 120px)' }} />

      {/* ─── MAIN CONTENT ─────────────────────────────────────────── */}
      <div className="flex" style={{ minHeight: 'calc(100vh - 120px)' }}>

        {/* ── LEFT — card grid ──────────────────────────────────── */}
        <div className="flex-1 min-w-0 px-4 md:px-6 py-6">

          {/* Result count skeleton */}
          <div className="animate-pulse h-4 w-32 rounded mb-5" style={{ background: '#D5C9B8' }} />

          {/* Card grid — 2 cols on md, 3 on xl */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 9 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* ── RIGHT — map placeholder (desktop only) ────────────── */}
        <div
          className="hidden lg:block flex-shrink-0 sticky top-0"
          style={{ width: '40%', height: '100vh', background: '#C8B89E' }}
        >
          <div className="w-full h-full animate-pulse" style={{ background: 'linear-gradient(135deg, #C4B49A 0%, #BBA88C 100%)' }} />
        </div>

      </div>
    </div>
  )
}
