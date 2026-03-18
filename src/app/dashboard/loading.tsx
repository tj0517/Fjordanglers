/**
 * Dashboard loading skeleton — shown by Next.js Suspense while
 * the layout/page server components fetch guide data.
 *
 * Mirrors the sidebar + content structure so there's no layout shift.
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex" style={{ background: '#F3EDE4' }}>

      {/* ── Sidebar skeleton ──────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{
          width: '240px',
          background: '#07111C',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          minHeight: '100vh',
        }}
      >
        {/* Logo area */}
        <div className="px-6 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="h-7 w-28 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="h-2.5 w-20 rounded mt-2 animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
        </div>

        {/* Guide card */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div
            className="flex items-center gap-3 px-3 py-3 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <div className="w-9 h-9 rounded-full flex-shrink-0 animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="h-2 w-16 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex-1 px-3 py-4 flex flex-col gap-1">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-xl animate-pulse"
              style={{ background: 'rgba(255,255,255,0.04)', animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </aside>

      {/* ── Mobile top bar skeleton ───────────────────────────────────────── */}
      <div
        className="lg:hidden fixed top-0 inset-x-0 z-50 flex items-center gap-3 px-4 h-14"
        style={{
          background: 'rgba(243,237,228,0.95)',
          borderBottom: '1px solid rgba(10,46,77,0.08)',
        }}
      >
        <div className="w-9 h-9 rounded-xl animate-pulse" style={{ background: 'rgba(10,46,77,0.07)' }} />
        <div className="h-6 w-28 rounded animate-pulse" style={{ background: 'rgba(10,46,77,0.06)' }} />
        <div className="ml-auto w-8 h-8 rounded-full animate-pulse" style={{ background: 'rgba(10,46,77,0.07)' }} />
      </div>

      {/* ── Main content skeleton ─────────────────────────────────────────── */}
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 px-6 lg:px-10 py-8 lg:py-10 max-w-[860px]">

        {/* Page title */}
        <div className="mb-8 flex flex-col gap-2">
          <div className="h-3 w-20 rounded animate-pulse" style={{ background: 'rgba(10,46,77,0.08)' }} />
          <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'rgba(10,46,77,0.08)' }} />
        </div>

        {/* Cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl animate-pulse"
              style={{
                background: '#FDFAF7',
                border: '1px solid rgba(10,46,77,0.06)',
                animationDelay: `${i * 60}ms`,
              }}
            />
          ))}
        </div>

        {/* Table skeleton */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.06)' }}
        >
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
            <div className="h-4 w-32 rounded animate-pulse" style={{ background: 'rgba(10,46,77,0.08)' }} />
          </div>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-6 py-4"
              style={{ borderBottom: i < 4 ? '1px solid rgba(10,46,77,0.04)' : 'none', animationDelay: `${i * 50}ms` }}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: 'rgba(10,46,77,0.1)' }} />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-40 rounded animate-pulse" style={{ background: 'rgba(10,46,77,0.08)' }} />
                <div className="h-2.5 w-24 rounded animate-pulse" style={{ background: 'rgba(10,46,77,0.05)' }} />
              </div>
              <div className="h-3 w-12 rounded animate-pulse" style={{ background: 'rgba(10,46,77,0.08)' }} />
            </div>
          ))}
        </div>

      </main>
    </div>
  )
}
