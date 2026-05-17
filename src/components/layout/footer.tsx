import Image from 'next/image'
import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer style={{ background: '#070D1A' }}>
      <div className="mx-auto px-4 sm:px-6 lg:px-10" style={{ maxWidth: '1280px', paddingTop: '64px', paddingBottom: '32px' }}>

        {/* Main grid: 1 col → 2 col → 4 col */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 lg:gap-12" style={{ marginBottom: '56px' }}>

          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 no-underline mb-4" style={{ textDecoration: 'none' }}>
              <Image src="/brand/sygnet.png" alt="" width={28} height={28} style={{ objectFit: 'contain' }} />
              <span className="f-display text-[18px]" style={{ color: '#fff' }}>
                <span style={{ fontWeight: 700 }}>Fjord</span>
                <span style={{ fontWeight: 400 }}>Anglers</span>
              </span>
            </Link>
            <p className="f-body text-[14px] leading-relaxed mt-4 mb-6" style={{ color: 'rgba(255,255,255,0.4)', maxWidth: '220px' }}>
              Connecting anglers with the best fishing trips in Scandinavia.
            </p>
            <a
              href="https://instagram.com/fjordanglers"
              target="_blank"
              rel="noopener noreferrer"
              className="f-body text-[13px] inline-flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
              </svg>
              @fjordanglers
            </a>
          </div>

          {/* Explore */}
          <div>
            <p className="f-body text-[11px] font-semibold uppercase mb-5" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>
              Explore
            </p>
            <div className="flex flex-col gap-3">
              {[
                ['/trips', 'All Trips'],
                ['/guides', 'Find Guides'],
                ['/trips?species=atlantic-salmon', 'Atlantic Salmon'],
                ['/trips?species=trout', 'Trout Fishing'],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="f-body text-[14px] hover:opacity-70 transition-opacity" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Destinations */}
          <div>
            <p className="f-body text-[11px] font-semibold uppercase mb-5" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>
              Destinations
            </p>
            <div className="flex flex-col gap-3">
              {[
                ['/trips?country=norway',  '🇳🇴', 'Norway'],
                ['/trips?country=sweden',  '🇸🇪', 'Sweden'],
                ['/trips?country=finland', '🇫🇮', 'Finland'],
                ['/trips?country=iceland', '🇮🇸', 'Iceland'],
                ['/trips?country=denmark', '🇩🇰', 'Denmark'],
              ].map(([href, flag, name]) => (
                <Link key={href} href={href} className="f-body text-[14px] inline-flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
                  <span>{flag}</span>
                  <span>{name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* For Guides */}
          <div>
            <p className="f-body text-[11px] font-semibold uppercase mb-5" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>
              For Guides
            </p>
            <div className="flex flex-col gap-3">
              {[
                ['/guides/apply', 'Apply as Guide'],
                ['/dashboard',    'Guide Dashboard'],
                ['/login',        'Sign in'],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="f-body text-[14px] hover:opacity-70 transition-opacity" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '28px' }}
        >
          <p className="f-body text-[13px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            © 2026 FjordAnglers. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-2">
            {[
              ['/legal/terms-of-service', 'Terms of Service'],
              ['/legal/privacy-policy',   'Privacy Policy'],
              ['/legal/cookie-policy',    'Cookie Policy'],
              ['/legal/legal-notice',     'Legal Notice'],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="f-body text-[13px] hover:opacity-70 transition-opacity" style={{ color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </footer>
  )
}
