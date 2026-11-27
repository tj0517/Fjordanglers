import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/layout/nav'
import { SiteFooter } from '@/components/layout/footer'

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

      <SiteNav />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="px-5 md:px-8 pt-[120px] pb-12 max-w-[860px] mx-auto">
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
          fjordanglers.com &nbsp;·&nbsp; Last updated: November 27, 2026
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
                desc: 'Necessary for the website to work: remembering your cookie choice, keeping sessions (including the guide and admin login), site navigation and the inquiry form. They cannot be disabled.',
              },
              {
                label: 'Security and Payment (Stripe)',
                desc: 'The payment processor Stripe uses strict cookies for device identity verification, fraud prevention, and secure transaction processing. These are treated as essential cookies.',
              },
              {
                label: 'Analytical (Statistical)',
                desc: 'Used only with your consent. They help us understand how visitors use the website (e.g., which trip pages are visited, where the inquiry form is abandoned) so we can improve it — via Google Analytics (loaded through Google Tag Manager) and Microsoft Clarity, which records anonymised interactions such as clicks and scrolling.',
              },
              {
                label: 'Marketing',
                desc: 'Used only with your consent. They measure whether our ads lead to inquiries and bookings and may be used to show our ads on other websites (Google Ads, Meta Pixel).',
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
                    { provider: 'Google LLC',                    purpose: 'Google Tag Manager, Google Analytics and Google Ads conversion measurement (consent mode)' },
                    { provider: 'Microsoft Corporation',         purpose: 'Microsoft Clarity — website usage analytics (only with consent)' },
                    { provider: 'Meta Platforms, Inc.',          purpose: 'Meta Pixel — advertising effectiveness (only with consent)' },
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
                label: 'Changing your choice',
                desc: 'Your choice is saved in your browser. To change it, clear this site\'s data in your browser settings — the banner will appear again on your next visit — or write to us and we will help.',
              },
              {
                label: 'Browser settings',
                desc: 'Most web browsers allow global blocking or deletion of cookies. However, please note that restricting the use of essential cookies may negatively affect Platform functionality (including preventing inquiries and payments).',
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
      <SiteFooter />
    </div>
  )
}
