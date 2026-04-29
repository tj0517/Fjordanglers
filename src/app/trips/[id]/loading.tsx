export default function TripLoading() {
  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* ─── HERO SKELETON ────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ minHeight: '480px', paddingTop: '92px', background: '#07111C' }}
      >
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: 'linear-gradient(135deg, #0e2236 0%, #07111C 60%)' }}
        />
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '65%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(4,12,22,0.55) 50%, rgba(4,12,22,0.88) 100%)',
            zIndex: 2,
          }}
        />

        {/* Text skeletons */}
        <div className="absolute bottom-0 inset-x-0 px-4 md:px-8 pb-8 md:pb-12" style={{ zIndex: 3 }}>
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-5">
              <div className="h-3 w-20 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>›</span>
              <div className="h-3 w-14 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.12)' }} />
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>›</span>
              <div className="h-3 w-32 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.12)' }} />
            </div>
            {/* Badges */}
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              <div className="h-6 w-24 rounded-full animate-pulse" style={{ background: 'rgba(230,126,80,0.3)' }} />
              <div className="h-6 w-20 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>
            {/* Title */}
            <div className="h-10 w-[min(480px,85vw)] rounded-xl mb-2 animate-pulse" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <div className="h-7 w-64 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
            {/* Location */}
            <div className="h-4 w-32 rounded mt-3 animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pb-12 md:pb-24">
        <div className="max-w-7xl mx-auto">

          {/* Meta strip */}
          <div className="flex items-center gap-3 flex-wrap pt-8 mb-4">
            <div className="h-3 w-24 rounded animate-pulse" style={{ background: '#D5C9B8' }} />
            <div className="h-3 w-1 rounded" style={{ background: '#D5C9B8' }} />
            <div className="h-3 w-20 rounded animate-pulse" style={{ background: '#D5C9B8' }} />
          </div>

          {/* Gallery skeleton */}
          <div
            className="hidden md:block mb-8 animate-pulse rounded-3xl overflow-hidden"
            style={{ height: '460px', background: '#C8B89E' }}
          />
          <div
            className="md:hidden mb-8 animate-pulse rounded-3xl overflow-hidden"
            style={{ height: '300px', background: '#C8B89E' }}
          />

          {/* Two-column skeleton */}
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">

            {/* Left column */}
            <div className="flex-1 min-w-0 space-y-8">
              {/* Section skeleton (repeated 2×) */}
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse space-y-3">
                  <div className="w-10 h-px" style={{ background: '#E67E50' }} />
                  <div className="h-3 w-20 rounded" style={{ background: '#D5C9B8' }} />
                  <div className="h-6 w-52 rounded-lg" style={{ background: '#D5C9B8' }} />
                  <div className="h-4 w-full rounded" style={{ background: '#D5C9B8' }} />
                  <div className="h-4 w-[90%] rounded" style={{ background: '#D5C9B8' }} />
                  <div className="h-4 w-[75%] rounded" style={{ background: '#D5C9B8' }} />
                </div>
              ))}
            </div>

            {/* Right column — widget skeleton */}
            <div className="hidden lg:block w-[380px] flex-shrink-0 sticky top-28 self-start">
              <div
                className="animate-pulse rounded-3xl p-6 space-y-4"
                style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 16px rgba(10,46,77,0.05)' }}
              >
                {/* Price */}
                <div className="h-4 w-32 rounded" style={{ background: '#D5C9B8' }} />
                <div className="h-8 w-20 rounded" style={{ background: '#D5C9B8' }} />
                {/* Divider */}
                <div className="h-px" style={{ background: '#EDE6DB' }} />
                {/* Date picker label */}
                <div className="h-4 w-24 rounded" style={{ background: '#D5C9B8' }} />
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded"
                      style={{ background: i % 7 === 0 || i % 7 === 6 ? '#EDE6DB' : '#E8DDD0' }}
                    />
                  ))}
                </div>
                {/* CTA */}
                <div className="h-12 rounded-2xl" style={{ background: 'rgba(230,126,80,0.25)' }} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
