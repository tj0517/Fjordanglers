import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Legal Notice',
  description: 'Impressum / Legal Notice for the FjordAnglers platform — company information and legal details.',
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

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl px-6 py-5 mb-4"
      style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}
    >
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LegalNoticePage() {
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
          Legal <span style={{ fontStyle: 'italic' }}>Notice</span>
        </h1>
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
          fjordanglers.com &nbsp;·&nbsp; Impressum &nbsp;·&nbsp; In accordance with Directive 2000/31/EC on Electronic Commerce
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

          {/* Company Information */}
          <section>
            <SalmonRule />
            <SectionHeading>Company Information</SectionHeading>
            <Prose>The owner and operator of the FjordAnglers platform is:</Prose>
            <InfoCard>
              <ul className="flex flex-col gap-2.5">
                {[
                  { label: 'Company',   value: 'FjordAnglers' },
                  { label: 'Owner',     value: 'Tymon Jezionek' },
                  { label: 'Address',   value: 'Otwarta 38b/11, 80-169 Gdańsk, Poland' },
                  { label: 'Country',   value: 'Poland' },
                  { label: 'Contact',   value: 'contact@fjordanglers.com', href: 'mailto:contact@fjordanglers.com' },
                ].map(item => (
                  <li key={item.label} className="flex items-center gap-3 text-sm f-body">
                    <span className="font-semibold flex-shrink-0" style={{ color: '#0A2E4D', minWidth: '80px' }}>
                      {item.label}
                    </span>
                    {'href' in item && item.href ? (
                      <a
                        href={item.href}
                        className="font-semibold transition-opacity hover:opacity-70"
                        style={{ color: '#E67E50' }}
                      >
                        {item.value}
                      </a>
                    ) : (
                      <span style={{ color: 'rgba(10,46,77,0.65)' }}>{item.value}</span>
                    )}
                  </li>
                ))}
              </ul>
            </InfoCard>
          </section>

          <Divider />

          {/* Registration and Tax */}
          <section>
            <SalmonRule />
            <SectionHeading>Registration and Tax Identification</SectionHeading>
            <InfoCard>
              <ul className="flex flex-col gap-2.5">
                {[
                  {
                    label: 'Registration authority',
                    value: 'Central Register and Information on Economic Activity (CEIDG) maintained by the Minister responsible for economic affairs of the Republic of Poland',
                  },
                  { label: 'Tax ID (NIP)', value: '5833564870' },
                  { label: 'REGON',        value: '544350813' },
                ].map(item => (
                  <li key={item.label} className="flex items-start gap-3 text-sm f-body">
                    <span className="font-semibold flex-shrink-0" style={{ color: '#0A2E4D', minWidth: '160px' }}>
                      {item.label}
                    </span>
                    <span style={{ color: 'rgba(10,46,77,0.65)' }}>{item.value}</span>
                  </li>
                ))}
              </ul>
            </InfoCard>
          </section>

          <Divider />

          {/* Consumer Dispute Resolution */}
          <section>
            <SalmonRule />
            <SectionHeading>Consumer Dispute Resolution</SectionHeading>
            <Prose>
              In accordance with the EU consumer protection system (Consumer Redress), the current list of
              entities authorized to conduct out-of-court consumer dispute resolution in individual EU member
              states is available on the official European Commission websites.
            </Prose>
            <Prose>
              FjordAnglers is not legally obligated to, and does not declare willingness to, participate in
              alternative dispute resolution procedures before consumer arbitration bodies (including in
              accordance with the German Consumer Dispute Resolution Act — VSBG).
            </Prose>
          </section>

          <Divider />

          {/* Liability */}
          <section>
            <SalmonRule />
            <SectionHeading>Liability for Content and External Links</SectionHeading>
            <Prose>
              FjordAnglers is responsible for its own content published on the Platform in accordance with
              generally applicable legal provisions. However, the Platform contains links to external third-party
              websites (including profiles and private websites of Guides), over whose content FjordAnglers has
              no influence. For this reason, FjordAnglers bears no responsibility for content posted on these
              websites. Responsibility for the content of externally linked pages always rests with the
              respective provider or operator of such website.
            </Prose>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
