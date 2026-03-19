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
    <h2
      className="text-[#0A2E4D] text-xl font-bold mb-4 f-display"
    >
      {children}
    </h2>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[#0A2E4D] text-sm font-bold uppercase tracking-[0.16em] mb-3 mt-6 f-body"
    >
      {children}
    </h3>
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

interface TableRow {
  cookie: string
  purpose: string
  duration: string
}

function CookieTable({ rows }: { rows: TableRow[] }) {
  return (
    <div
      className="overflow-x-auto rounded-2xl mb-2"
      style={{ border: '1px solid rgba(10,46,77,0.09)' }}
    >
      <table className="w-full text-sm f-body">
        <thead>
          <tr style={{ background: 'rgba(10,46,77,0.04)', borderBottom: '1px solid rgba(10,46,77,0.09)' }}>
            {['Cookie / Provider', 'Purpose', 'Duration'].map(h => (
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
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                background: i % 2 === 0 ? '#FDFAF7' : 'rgba(10,46,77,0.015)',
                borderBottom: i < rows.length - 1 ? '1px solid rgba(10,46,77,0.06)' : 'none',
              }}
            >
              <td
                className="px-5 py-3.5 font-semibold align-top"
                style={{ color: '#0A2E4D', minWidth: '140px' }}
              >
                {row.cookie}
              </td>
              <td
                className="px-5 py-3.5 align-top leading-relaxed"
                style={{ color: 'rgba(10,46,77,0.65)' }}
              >
                {row.purpose}
              </td>
              <td
                className="px-5 py-3.5 align-top whitespace-nowrap"
                style={{ color: 'rgba(10,46,77,0.5)', minWidth: '120px' }}
              >
                {row.duration}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
      <header
        className="px-5 md:px-8 pt-14 pb-12 max-w-[860px] mx-auto"
      >
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
          fjordanglers.com &nbsp;·&nbsp; Last updated: March 19, 2026
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
            <SectionHeading>1. What Are Cookies?</SectionHeading>
            <Prose>
              Cookies are small text files stored on your device when you visit a website.
              They help the website remember your preferences, understand how you use the site,
              and improve your experience.
            </Prose>
          </section>

          <Divider />

          {/* 2. How We Use Cookies */}
          <section>
            <SalmonRule />
            <SectionHeading>2. How We Use Cookies</SectionHeading>
            <Prose>
              FjordAnglers uses the following categories of cookies:
            </Prose>

            <SubHeading>Strictly Necessary Cookies</SubHeading>
            <Prose>
              These cookies are essential for the Platform to function. They cannot be disabled.
            </Prose>
            <CookieTable rows={[
              { cookie: 'Session cookie',   purpose: 'Keeps you logged in during your visit',                   duration: 'Session' },
              { cookie: 'CSRF token',        purpose: 'Protects against cross-site request forgery attacks',     duration: 'Session' },
              { cookie: 'Cookie consent',    purpose: 'Remembers your cookie preferences',                       duration: '12 months' },
            ]} />

            <SubHeading>Functional Cookies</SubHeading>
            <Prose>
              These cookies remember your choices and preferences to enhance your experience.
            </Prose>
            <CookieTable rows={[
              { cookie: 'Language preference', purpose: 'Remembers your selected language',       duration: '12 months' },
              { cookie: 'Currency preference', purpose: 'Remembers your preferred currency',      duration: '12 months' },
              { cookie: 'Recent searches',     purpose: 'Stores your recent search filters',      duration: '30 days' },
            ]} />

            <SubHeading>Analytics Cookies</SubHeading>
            <Prose>
              These cookies help us understand how visitors interact with the Platform so we can
              improve it. Data is anonymized or aggregated where possible.
            </Prose>
            <CookieTable rows={[
              { cookie: 'Analytics tracking',    purpose: 'Page views, time on site, navigation patterns', duration: '26 months' },
              { cookie: 'Performance monitoring', purpose: 'Page load times and error tracking',            duration: '12 months' },
            ]} />

            <SubHeading>Marketing Cookies (if applicable)</SubHeading>
            <Prose>
              These cookies may be used in the future to deliver relevant advertisements and
              track campaign effectiveness. We will update this policy and request your consent
              before implementing any marketing cookies.
            </Prose>
          </section>

          <Divider />

          {/* 3. Your Cookie Choices */}
          <section>
            <SalmonRule />
            <SectionHeading>3. Your Cookie Choices</SectionHeading>
            <Prose>
              When you first visit fjordanglers.com, a cookie banner will ask for your consent.
              You can:
            </Prose>

            <ul className="flex flex-col gap-3 mb-6 pl-1">
              {[
                { label: 'Accept all cookies', desc: 'enables all cookie categories.' },
                { label: 'Accept necessary only', desc: 'only strictly necessary cookies are used.' },
                { label: 'Customize', desc: 'choose which categories you allow.' },
              ].map(item => (
                <li key={item.label} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{ background: '#E67E50', marginTop: '7px' }}
                  />
                  <span className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.68)' }}>
                    <span className="font-semibold" style={{ color: '#0A2E4D' }}>{item.label}</span>
                    {' '}— {item.desc}
                  </span>
                </li>
              ))}
            </ul>

            <Prose>
              You can change your preferences at any time through the cookie settings link in
              the website footer.
            </Prose>

            <SubHeading>Browser Settings</SubHeading>
            <Prose>
              You can also manage cookies through your browser settings. Note that blocking
              certain cookies may affect the functionality of the Platform. Instructions for
              common browsers:
            </Prose>

            <div
              className="rounded-2xl px-6 py-5 mb-4"
              style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}
            >
              <ul className="flex flex-col gap-2.5">
                {[
                  { browser: 'Chrome',  path: 'Settings → Privacy and Security → Cookies' },
                  { browser: 'Firefox', path: 'Settings → Privacy & Security → Cookies' },
                  { browser: 'Safari',  path: 'Preferences → Privacy → Cookies' },
                  { browser: 'Edge',    path: 'Settings → Cookies and Site Permissions' },
                ].map(item => (
                  <li key={item.browser} className="flex items-center gap-3 text-sm f-body">
                    <span className="font-semibold flex-shrink-0" style={{ color: '#0A2E4D', minWidth: '58px' }}>
                      {item.browser}
                    </span>
                    <span style={{ color: 'rgba(10,46,77,0.5)' }}>{item.path}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <Divider />

          {/* 4. Third-Party Cookies */}
          <section>
            <SalmonRule />
            <SectionHeading>4. Third-Party Cookies</SectionHeading>
            <Prose>
              Some cookies are placed by third-party services we use:
            </Prose>

            <div
              className="overflow-x-auto rounded-2xl mb-4"
              style={{ border: '1px solid rgba(10,46,77,0.09)' }}
            >
              <table className="w-full text-sm f-body">
                <thead>
                  <tr style={{ background: 'rgba(10,46,77,0.04)', borderBottom: '1px solid rgba(10,46,77,0.09)' }}>
                    {['Provider', 'Purpose', 'Privacy Policy'].map(h => (
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
                  <tr style={{ background: '#FDFAF7', borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
                    <td className="px-5 py-3.5 font-semibold align-top" style={{ color: '#0A2E4D' }}>Stripe</td>
                    <td className="px-5 py-3.5 align-top" style={{ color: 'rgba(10,46,77,0.65)' }}>Payment processing and fraud prevention</td>
                    <td className="px-5 py-3.5 align-top">
                      <a
                        href="https://stripe.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold underline underline-offset-2 transition-opacity hover:opacity-70 f-body"
                        style={{ color: '#E67E50' }}
                      >
                        stripe.com/privacy
                      </a>
                    </td>
                  </tr>
                  <tr style={{ background: 'rgba(10,46,77,0.015)' }}>
                    <td className="px-5 py-3.5 font-semibold align-top" style={{ color: '#0A2E4D' }}>Analytics provider</td>
                    <td className="px-5 py-3.5 align-top" style={{ color: 'rgba(10,46,77,0.65)' }}>Website usage analytics</td>
                    <td className="px-5 py-3.5 align-top text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                      Updated when implemented
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Prose>
              We do not allow third-party advertising cookies on the Platform.
            </Prose>
          </section>

          <Divider />

          {/* 5. Changes */}
          <section>
            <SalmonRule />
            <SectionHeading>5. Changes to This Policy</SectionHeading>
            <Prose>
              We may update this Cookie Policy to reflect changes in the cookies we use. We will
              post the updated policy on this page with a new &ldquo;Last updated&rdquo; date.
            </Prose>
          </section>

          <Divider />

          {/* 6. Contact */}
          <section>
            <SalmonRule />
            <SectionHeading>6. Contact</SectionHeading>
            <Prose>
              For questions about our use of cookies:
            </Prose>
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
              <div className="flex items-center gap-2 text-sm f-body">
                <span style={{ color: 'rgba(10,46,77,0.4)' }}>Website</span>
                <a
                  href="https://fjordanglers.com"
                  className="font-semibold transition-opacity hover:opacity-70"
                  style={{ color: '#E67E50' }}
                >
                  fjordanglers.com
                </a>
              </div>
            </div>
          </section>

          <Divider />

          {/* Disclaimer note */}
          <p
            className="text-xs f-body leading-relaxed italic"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            This Cookie Policy is provided as a template and does not constitute legal advice.
            We recommend having it reviewed by a qualified legal professional before publication.
          </p>

        </div>
      </main>

      <Footer />
    </div>
  )
}
