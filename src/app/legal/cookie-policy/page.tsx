import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'How FjordAnglers uses cookies and how you can manage your preferences.',
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function SalmonRule() {
  return (
    <div
      className="w-8 h-0.5 rounded-full mb-4"
      style={{ background: '#E67E50' }}
    />
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[#0A2E4D] text-xl font-bold mb-4 f-display">
      {children}
    </h2>
  )
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-sm leading-[1.85] f-body mb-4"
      style={{ color: 'rgba(10,46,77,0.68)' }}
    >
      {children}
    </p>
  )
}

function Divider() {
  return (
    <div
      className="my-10"
      style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}
    />
  )
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5 mb-5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
            style={{ background: '#E67E50', marginTop: '7px' }}
          />
          <span className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.68)' }}>
            {item}
          </span>
        </li>
      ))}
    </ul>
  )
}

function BoldBulletList({ items }: { items: { label: string; desc: string }[] }) {
  return (
    <ul className="flex flex-col gap-3 mb-5 pl-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-start gap-3">
          <span
            className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
            style={{ background: '#E67E50', marginTop: '7px' }}
          />
          <span className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.68)' }}>
            <span className="font-semibold" style={{ color: '#0A2E4D' }}>{item.label}:</span>
            {' '}{item.desc}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-5 md:px-8 h-[68px]"
        style={{
          background: 'rgba(243,237,228,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(10,46,77,0.07)',
        }}
      >
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/brand/dark-logo.png"
            alt="FjordAnglers"
            width={120}
            height={32}
            className="h-7 w-auto"
          />
        </Link>
        <Link
          href="/trips"
          className="text-xs font-semibold f-body transition-colors hover:text-[#E67E50]"
          style={{ color: 'rgba(10,46,77,0.5)' }}
        >
          ← Browse trips
        </Link>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="px-5 md:px-8 pt-14 pb-12 max-w-[860px] mx-auto">
        <p
          className="text-[11px] uppercase tracking-[0.26em] font-semibold mb-3 f-body"
          style={{ color: '#E67E50' }}
        >
          Legal
        </p>
        <h1 className="text-[#0A2E4D] text-4xl md:text-5xl font-bold f-display mb-4 leading-tight">
          Cookie <span style={{ fontStyle: 'italic' }}>Policy</span>
        </h1>
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
          fjordanglers.com &nbsp;·&nbsp; Last updated: April 1, 2026
        </p>
      </header>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <main className="max-w-[860px] mx-auto px-5 md:px-8 pb-24">
        <div
          className="rounded-3xl p-8 md:p-12"
          style={{
            background: '#FDFAF7',
            border: '1px solid rgba(10,46,77,0.07)',
            boxShadow: '0 2px 32px rgba(10,46,77,0.05)',
          }}
        >

          {/* 1. What Are Cookies */}
          <section>
            <SalmonRule />
            <SectionHeading>1. What Are Cookies and How Long Are They Stored?</SectionHeading>
            <Prose>
              Cookies and similar tracking technologies (e.g., Local Storage, Session Storage, tracking pixels)
              are small text files or code snippets stored on the User&apos;s device while browsing the FjordAnglers
              platform. They are used to ensure proper website operation, remember preferences, secure payment
              transactions, and for analytical and marketing purposes.
            </Prose>
            <Prose>In terms of storage duration, FjordAnglers uses two types of files:</Prose>
            <BoldBulletList items={[
              {
                label: 'Session cookies',
                desc: 'Temporary files that are deleted from the User\'s device memory upon logging out, leaving the site, or closing the web browser.',
              },
              {
                label: 'Persistent cookies',
                desc: 'Remain on the User\'s device for a specified period (defined in the file parameters) or until manually deleted by the User.',
              },
            ]} />
          </section>

          <Divider />

          {/* 2. Types of Cookies */}
          <section>
            <SalmonRule />
            <SectionHeading>2. What Types of Cookies Does the Platform Use?</SectionHeading>
            <Prose>FjordAnglers uses the following categories of cookies:</Prose>
            <BoldBulletList items={[
              {
                label: 'Essential (Technical)',
                desc: 'Absolutely necessary for the Platform to function. They enable account login, session maintenance, site navigation, and proper operation of the booking system. Without these files, the Platform cannot function properly. The option to disable them is not available.',
              },
              {
                label: 'Security and Payment (Stripe)',
                desc: 'The payment processor Stripe uses strict cookies for device identity verification, fraud prevention, and secure transaction processing. These are treated as essential cookies.',
              },
              {
                label: 'Analytical (Statistical)',
                desc: 'Help understand how Users interact with the Platform (e.g., which listings are most popular, how long visits last). This data is anonymized and used solely to improve service functionality (e.g., via Google Analytics tools).',
              },
              {
                label: 'Marketing and Affiliate',
                desc: 'Used to track advertising campaign effectiveness and properly account for the Affiliate Program. They allow identification of whether a reservation originated from a specific Partner\'s referral, which determines proper commission calculation. They may also be used to display targeted advertisements on other websites (e.g., Meta Pixel, Google Ads).',
              },
            ]} />
          </section>

          <Divider />

          {/* 3. Third-Party Cookies */}
          <section>
            <SalmonRule />
            <SectionHeading>3. Third-Party Cookies</SectionHeading>
            <Prose>
              As part of Platform operations, FjordAnglers uses external service providers that may store their
              own cookies on the User&apos;s device. These include:
            </Prose>
            <div
              className="overflow-x-auto rounded-2xl mb-4"
              style={{ border: '1px solid rgba(10,46,77,0.09)' }}
            >
              <table className="w-full text-sm f-body">
                <thead>
                  <tr style={{ background: 'rgba(10,46,77,0.04)', borderBottom: '1px solid rgba(10,46,77,0.09)' }}>
                    {['Provider', 'Purpose'].map(h => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em]"
                        style={{ color: 'rgba(10,46,77,0.45)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { provider: 'Stripe, Inc.',                  purpose: 'Payment processing and fraud prevention' },
                    { provider: 'Google LLC',                    purpose: 'Traffic analytics (Google Analytics) and advertising tools' },
                    { provider: 'Meta Platforms, Inc.',          purpose: 'Social media advertising effectiveness analysis' },
                    { provider: 'Affiliate software providers',  purpose: 'Verification and management of partner links' },
                  ].map((row, i) => (
                    <tr
                      key={row.provider}
                      style={{
                        background: i % 2 === 0 ? '#FDFAF7' : 'rgba(10,46,77,0.015)',
                        borderBottom: i < 3 ? '1px solid rgba(10,46,77,0.06)' : 'none',
                      }}
                    >
                      <td className="px-5 py-3.5 font-semibold align-top" style={{ color: '#0A2E4D', minWidth: '200px' }}>
                        {row.provider}
                      </td>
                      <td className="px-5 py-3.5 align-top leading-relaxed" style={{ color: 'rgba(10,46,77,0.65)' }}>
                        {row.purpose}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <Divider />

          {/* 4. Managing Cookies */}
          <section>
            <SalmonRule />
            <SectionHeading>4. Managing Cookies and Withdrawing Consent</SectionHeading>
            <Prose>
              During the first visit to the Platform, an information banner is displayed requesting consent for
              the use of optional cookies (analytical and marketing). The User has the full right to withdraw or
              modify their consent at any time.
            </Prose>
            <BoldBulletList items={[
              {
                label: 'On-site settings panel',
                desc: 'The User may change preferences at any time by clicking the "Manage Cookies" link located in the site footer. A full, dynamic list of cookies currently in use is available in the banner information panel.',
              },
              {
                label: 'Browser settings',
                desc: 'Most web browsers allow global blocking or deletion of cookies. However, please note that restricting the use of essential cookies may negatively affect Platform functionality (including preventing reservations).',
              },
            ]} />
          </section>

          <Divider />

          {/* 5. Personal Data Protection */}
          <section>
            <SalmonRule />
            <SectionHeading>5. Personal Data Protection</SectionHeading>
            <Prose>
              Since certain cookies and tracking technologies may collect information constituting personal data
              (e.g., IP address or unique device identifier), their processing is subject to data protection
              regulations. Detailed information about the Data Controller, applicable rights, and privacy
              protection methods can be found in the{' '}
              <Link href="/legal/privacy-policy" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                Privacy Policy
              </Link>.
            </Prose>
          </section>

          <Divider />

          {/* Contact */}
          <section>
            <SalmonRule />
            <SectionHeading>Contact</SectionHeading>
            <Prose>For questions about our use of cookies:</Prose>
            <div
              className="flex flex-col gap-2 px-6 py-5 rounded-2xl"
              style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}
            >
              <div className="flex items-center gap-2 text-sm f-body">
                <span style={{ color: 'rgba(10,46,77,0.4)' }}>Email</span>
                <a
                  href="mailto:contact@fjordanglers.com"
                  className="font-semibold transition-opacity hover:opacity-70"
                  style={{ color: '#E67E50' }}
                >
                  contact@fjordanglers.com
                </a>
              </div>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
