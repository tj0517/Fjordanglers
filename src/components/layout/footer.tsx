import Image from 'next/image'
import Link from 'next/link'

export function Footer() {
  return (
    <footer style={{ background: '#05101A' }}>

      {/* Main footer content */}
      <div className="max-w-[1440px] mx-auto px-6 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">

          {/* Brand column */}
          <div className="lg:col-span-1">
            <Image
              src="/brand/white-logo.png"
              alt="FjordAnglers"
              width={140}
              height={36}
              className="h-7 w-auto mb-4"
              style={{ opacity: 0.65 }}
            />
            <p
              className="text-sm leading-relaxed mb-6 f-body"
              style={{ color: 'rgba(255,255,255,0.28)', maxWidth: '200px' }}
            >
              Connecting anglers with the best fishing experiences in Scandinavia.
            </p>
            <a
              href="https://instagram.com/fjordanglers"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 text-[13px] f-body transition-colors hover:text-white/55"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              @fjordanglers
            </a>
          </div>

          {/* Explore */}
          <div>
            <h4
              className="text-[10px] font-bold uppercase tracking-[0.24em] mb-5 f-body"
              style={{ color: 'rgba(255,255,255,0.22)' }}
            >
              Explore
            </h4>
            <ul className="flex flex-col gap-3">
              {[
                { label: 'All Experiences', href: '/experiences' },
                { label: 'Find Guides', href: '/guides' },
                { label: 'Atlantic Salmon', href: '/species/salmon' },
                { label: 'Trout Fishing', href: '/species/trout' },
              ].map(item => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-[13px] f-body transition-colors hover:text-white/55"
                    style={{ color: 'rgba(255,255,255,0.32)' }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Destinations */}
          <div>
            <h4
              className="text-[10px] font-bold uppercase tracking-[0.24em] mb-5 f-body"
              style={{ color: 'rgba(255,255,255,0.22)' }}
            >
              Destinations
            </h4>
            <ul className="flex flex-col gap-3">
              {[
                { label: '🇳🇴 Norway', href: '/experiences?country=Norway' },
                { label: '🇸🇪 Sweden', href: '/experiences?country=Sweden' },
                { label: '🇫🇮 Finland', href: '/experiences?country=Finland' },
                { label: '🇮🇸 Iceland', href: '/experiences?country=Iceland' },
                { label: '🇩🇰 Denmark', href: '/experiences?country=Denmark' },
              ].map(item => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-[13px] f-body transition-colors hover:text-white/55"
                    style={{ color: 'rgba(255,255,255,0.32)' }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Guides */}
          <div>
            <h4
              className="text-[10px] font-bold uppercase tracking-[0.24em] mb-5 f-body"
              style={{ color: 'rgba(255,255,255,0.22)' }}
            >
              For Guides
            </h4>
            <ul className="flex flex-col gap-3">
              {[
                { label: 'Apply as Guide', href: '/guides/apply' },
                { label: 'Guide Dashboard', href: '/dashboard' },
                { label: 'Sign in', href: '/login' },
              ].map(item => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-[13px] f-body transition-colors hover:text-white/55"
                    style={{ color: 'rgba(255,255,255,0.32)' }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div
          className="max-w-[1440px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-4"
        >
          <p className="text-[12px] f-body" style={{ color: 'rgba(255,255,255,0.18)' }}>
            © 2026 FjordAnglers. All rights reserved.
          </p>
          <p className="text-[12px] f-body" style={{ color: 'rgba(255,255,255,0.14)' }}>
            Norway · Sweden · Finland · Iceland · Denmark
          </p>
        </div>
      </div>
    </footer>
  )
}