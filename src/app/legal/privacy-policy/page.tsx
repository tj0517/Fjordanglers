import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How FjordAnglers collects, uses, and protects your personal data — GDPR compliant.',
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

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[#0A2E4D] text-sm font-bold uppercase tracking-[0.16em] mb-3 mt-6 f-body">
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

interface ProcessingRow {
  purpose: string
  basis: string
  data: string
}

function ProcessingTable({ rows }: { rows: ProcessingRow[] }) {
  return (
    <div
      className="overflow-x-auto rounded-2xl mb-4"
      style={{ border: '1px solid rgba(10,46,77,0.09)' }}
    >
      <table className="w-full text-sm f-body">
        <thead>
          <tr style={{ background: 'rgba(10,46,77,0.04)', borderBottom: '1px solid rgba(10,46,77,0.09)' }}>
            {['Purpose', 'Legal Basis (GDPR Art. 6)', 'Data Involved'].map(h => (
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
                style={{ color: '#0A2E4D', minWidth: '200px' }}
              >
                {row.purpose}
              </td>
              <td
                className="px-5 py-3.5 align-top leading-relaxed"
                style={{ color: 'rgba(10,46,77,0.65)', minWidth: '200px' }}
              >
                {row.basis}
              </td>
              <td
                className="px-5 py-3.5 align-top leading-relaxed"
                style={{ color: 'rgba(10,46,77,0.55)', minWidth: '160px' }}
              >
                {row.data}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface SharingRow {
  provider: string
  purpose: string
  location: string
  safeguards: string
}

function SharingTable({ rows }: { rows: SharingRow[] }) {
  return (
    <div
      className="overflow-x-auto rounded-2xl mb-4"
      style={{ border: '1px solid rgba(10,46,77,0.09)' }}
    >
      <table className="w-full text-sm f-body">
        <thead>
          <tr style={{ background: 'rgba(10,46,77,0.04)', borderBottom: '1px solid rgba(10,46,77,0.09)' }}>
            {['Provider', 'Purpose', 'Location', 'Safeguards'].map(h => (
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
              <td className="px-5 py-3.5 font-semibold align-top" style={{ color: '#0A2E4D', minWidth: '100px' }}>{row.provider}</td>
              <td className="px-5 py-3.5 align-top leading-relaxed" style={{ color: 'rgba(10,46,77,0.65)', minWidth: '180px' }}>{row.purpose}</td>
              <td className="px-5 py-3.5 align-top whitespace-nowrap" style={{ color: 'rgba(10,46,77,0.5)', minWidth: '80px' }}>{row.location}</td>
              <td className="px-5 py-3.5 align-top leading-relaxed" style={{ color: 'rgba(10,46,77,0.55)', minWidth: '200px' }}>{row.safeguards}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface RetentionRow {
  dataType: string
  period: string
  reason: string
}

function RetentionTable({ rows }: { rows: RetentionRow[] }) {
  return (
    <div
      className="overflow-x-auto rounded-2xl mb-4"
      style={{ border: '1px solid rgba(10,46,77,0.09)' }}
    >
      <table className="w-full text-sm f-body">
        <thead>
          <tr style={{ background: 'rgba(10,46,77,0.04)', borderBottom: '1px solid rgba(10,46,77,0.09)' }}>
            {['Data Type', 'Retention Period', 'Reason'].map(h => (
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
              <td className="px-5 py-3.5 font-semibold align-top" style={{ color: '#0A2E4D', minWidth: '180px' }}>{row.dataType}</td>
              <td className="px-5 py-3.5 align-top whitespace-nowrap" style={{ color: 'rgba(10,46,77,0.65)', minWidth: '160px' }}>{row.period}</td>
              <td className="px-5 py-3.5 align-top leading-relaxed" style={{ color: 'rgba(10,46,77,0.55)', minWidth: '200px' }}>{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrivacyPolicyPage() {
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
          Privacy <span style={{ fontStyle: 'italic' }}>Policy</span>
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

          {/* 1. Introduction */}
          <section>
            <SalmonRule />
            <SectionHeading>1. Introduction</SectionHeading>
            <Prose>
              This Privacy Policy explains how Fjordanglers (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses, stores, shares,
              and protects your personal data when you use our website and services at{' '}
              <a href="https://fjordanglers.com" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                fjordanglers.com
              </a>{' '}
              (the &ldquo;Platform&rdquo;).
            </Prose>
            <Prose>
              Fjordanglers is operated as a sole proprietorship (Jednoosobowa Działalność Gospodarcza) registered in Poland.
              We are committed to protecting your privacy in accordance with the General Data Protection Regulation
              (EU) 2016/679 (&ldquo;GDPR&rdquo;), the Polish Act on Personal Data Protection, and other applicable data protection laws.
            </Prose>
            <InfoCard>
              <ul className="flex flex-col gap-2">
                {[
                  { label: 'Data Controller', value: 'Fjordanglers' },
                  { label: 'Email', value: 'contact@fjordanglers.com', href: 'mailto:contact@fjordanglers.com' },
                  { label: 'Website', value: 'fjordanglers.com', href: 'https://fjordanglers.com' },
                ].map(item => (
                  <li key={item.label} className="flex items-center gap-3 text-sm f-body">
                    <span className="font-semibold flex-shrink-0" style={{ color: '#0A2E4D', minWidth: '120px' }}>
                      {item.label}
                    </span>
                    {item.href ? (
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
            <Prose>
              If you have questions about this Privacy Policy or wish to exercise your rights,
              contact us at{' '}
              <a href="mailto:contact@fjordanglers.com" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                contact@fjordanglers.com
              </a>.
            </Prose>
          </section>

          <Divider />

          {/* 2. What Data We Collect */}
          <section>
            <SalmonRule />
            <SectionHeading>2. What Data We Collect</SectionHeading>
            <Prose>
              We collect personal data in several ways, depending on how you interact with the Platform.
            </Prose>

            <SubHeading>2.1 Data You Provide to Us</SubHeading>
            <ul className="flex flex-col gap-3 mb-5 pl-1">
              {[
                {
                  label: 'When you create a Guide Account',
                  desc: 'first name, surname, email address, website URL (optional), business name and description, photos and media uploaded to Listings, and payout/bank information (processed and stored by Stripe, not by Fjordanglers).',
                },
                {
                  label: 'When you create an Angler Account',
                  desc: 'first name, surname, and email address.',
                },
                {
                  label: 'When you make or receive a Booking',
                  desc: 'booking dates, trip selection, number of participants, special requests or notes, and payment information (processed by Stripe).',
                },
                {
                  label: 'When you communicate through the Platform',
                  desc: 'messages exchanged between Guides and Anglers, reviews and ratings, and support requests submitted to Fjordanglers.',
                },
              ].map(item => (
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

            <SubHeading>2.2 Data We Collect Automatically</SubHeading>
            <Prose>
              When you use the Platform, we automatically collect: device information (browser type, operating system,
              device type, screen resolution), usage data (pages visited, features used, time spent, clicks, search queries),
              IP address (used for security, fraud prevention, and approximate geolocation), referral source (how you found
              the Platform), and cookies and similar technologies (see our{' '}
              <Link href="/legal/cookie-policy" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                Cookie Policy
              </Link>).
            </Prose>

            <SubHeading>2.3 Data from Third-Party Sources</SubHeading>
            <ul className="flex flex-col gap-3 mb-5 pl-1">
              {[
                {
                  label: 'Publicly available information',
                  desc: 'When a Guide authorizes us to create a Listing preview, we collect business information from their public website and social media profiles (business name, services, pricing, photos, location, contact details).',
                },
                {
                  label: 'Payment provider (Stripe)',
                  desc: 'Payment confirmation data, transaction status, payout status, and fraud signals. Stripe acts as an independent data controller for payment data.',
                },
              ].map(item => (
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

            <SubHeading>2.4 Sensitive Data</SubHeading>
            <Prose>
              We do not intentionally collect sensitive personal data (racial or ethnic origin, health data,
              biometric data, etc.). If an Angler voluntarily discloses health information to a Guide (e.g., allergies,
              mobility limitations), that data is shared directly with the Guide and is not stored by Fjordanglers.
            </Prose>
          </section>

          <Divider />

          {/* 3. Why We Process Your Data */}
          <section>
            <SalmonRule />
            <SectionHeading>3. Why We Process Your Data</SectionHeading>
            <ProcessingTable rows={[
              { purpose: 'Account creation and management',                                basis: 'Performance of contract (Art. 6(1)(b))',  data: 'Name, email, account details' },
              { purpose: 'Processing bookings and payments',                               basis: 'Performance of contract (Art. 6(1)(b))',  data: 'Booking details, payment data' },
              { purpose: 'Facilitating communication between Users',                       basis: 'Performance of contract (Art. 6(1)(b))',  data: 'Messages, booking details' },
              { purpose: 'Creating Listing previews from Guide\'s public data',            basis: 'Consent (Art. 6(1)(a))',                  data: 'Public website data, business info' },
              { purpose: 'Sending booking confirmations and transactional emails',         basis: 'Performance of contract (Art. 6(1)(b))',  data: 'Name, email, booking details' },
              { purpose: 'Sending marketing emails and newsletters',                       basis: 'Consent (Art. 6(1)(a)) — opt-in only',   data: 'Name, email' },
              { purpose: 'Displaying reviews and ratings',                                 basis: 'Legitimate interest (Art. 6(1)(f))',      data: 'Name (first name + last initial), review content' },
              { purpose: 'Fraud prevention and platform security',                         basis: 'Legitimate interest (Art. 6(1)(f))',      data: 'IP address, device data, usage patterns' },
              { purpose: 'Improving the Platform and analytics',                           basis: 'Legitimate interest (Art. 6(1)(f))',      data: 'Usage data, device data (anonymized where possible)' },
              { purpose: 'Complying with legal obligations (tax, accounting, AML)',        basis: 'Legal obligation (Art. 6(1)(c))',         data: 'Transaction records, account data' },
              { purpose: 'Handling disputes and support requests',                         basis: 'Legitimate interest (Art. 6(1)(f))',      data: 'Communications, booking data' },
              { purpose: 'Enforcing our Terms of Service',                                 basis: 'Legitimate interest (Art. 6(1)(f))',      data: 'Account data, usage data' },
            ]} />
            <Prose>
              Where we rely on legitimate interest, we have conducted a balancing test to ensure our interests
              do not override your fundamental rights and freedoms.
            </Prose>
          </section>

          <Divider />

          {/* 4. How We Share Your Data */}
          <section>
            <SalmonRule />
            <SectionHeading>4. How We Share Your Data</SectionHeading>
            <Prose>
              We do not sell, rent, or trade your personal data.
            </Prose>

            <SubHeading>4.1 Between Users</SubHeading>
            <Prose>
              When a Booking is confirmed: the Guide receives the Angler&apos;s name, number of participants,
              and any special requests or notes; the Angler receives the Guide&apos;s name, business name, meeting
              point details, and contact information necessary for the Trip. This sharing is necessary for the
              performance of the contract between the Guide and Angler.
            </Prose>

            <SubHeading>4.2 With Service Providers</SubHeading>
            <Prose>
              We share data with trusted third-party service providers who process data on our behalf:
            </Prose>
            <SharingTable rows={[
              { provider: 'Stripe',              purpose: 'Payment processing and payouts',  location: 'US/EU', safeguards: 'PCI-DSS certified, SCCs, independent data controller' },
              { provider: 'Email provider',      purpose: 'Transactional and marketing emails', location: 'EU', safeguards: 'Data Processing Agreement (DPA)' },
              { provider: 'Hosting provider',    purpose: 'Data storage and platform infrastructure', location: 'EU', safeguards: 'DPA, ISO 27001 certified' },
              { provider: 'Analytics provider',  purpose: 'Website usage analytics',         location: 'EU', safeguards: 'Anonymized/pseudonymized data, DPA' },
            ]} />

            <SubHeading>4.3 With Law Enforcement and Regulators</SubHeading>
            <Prose>
              We may disclose personal data when required by law, regulation, legal process, or governmental
              request. We may also disclose data when we believe in good faith that disclosure is necessary to
              protect the safety of any person, investigate fraud, or respond to a government request.
            </Prose>

            <SubHeading>4.4 In Connection with Business Transfers</SubHeading>
            <Prose>
              If Fjordanglers is involved in a merger, acquisition, or sale of assets, your personal data may
              be transferred. We will notify you via email or a prominent notice on the Platform before your data
              is transferred and becomes subject to a different privacy policy.
            </Prose>
          </section>

          <Divider />

          {/* 5. International Data Transfers */}
          <section>
            <SalmonRule />
            <SectionHeading>5. International Data Transfers</SectionHeading>
            <Prose>
              Your data is primarily processed within the European Economic Area (EEA). Where data is transferred
              outside the EEA (e.g., to Stripe&apos;s US-based infrastructure), we ensure adequate protection through:
            </Prose>
            <ul className="flex flex-col gap-2.5 mb-5 pl-1">
              {[
                'EU Standard Contractual Clauses (SCCs)',
                'Adequacy decisions by the European Commission',
                'Binding corporate rules of the service provider',
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{ background: '#E67E50', marginTop: '7px' }}
                  />
                  <span className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.68)' }}>{item}</span>
                </li>
              ))}
            </ul>
            <Prose>
              You may request a copy of the safeguards in place by contacting us at{' '}
              <a href="mailto:contact@fjordanglers.com" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                contact@fjordanglers.com
              </a>.
            </Prose>
          </section>

          <Divider />

          {/* 6. Data Retention */}
          <section>
            <SalmonRule />
            <SectionHeading>6. Data Retention</SectionHeading>
            <Prose>
              We retain personal data only for as long as necessary to fulfill the purposes described in this
              policy and to comply with legal obligations.
            </Prose>
            <RetentionTable rows={[
              { dataType: 'Account data (name, email)',    period: 'Until account deletion + 30 days', reason: 'Allows account recovery' },
              { dataType: 'Booking records',               period: '5 years after the booking',        reason: 'Polish tax and accounting law' },
              { dataType: 'Payment data',                  period: 'Stored by Stripe per their policy', reason: 'Stripe acts as independent controller' },
              { dataType: 'Messages between Users',        period: 'Until account deletion or on request', reason: 'Contract performance' },
              { dataType: 'Reviews and ratings',           period: 'Until account deletion or on request', reason: 'Legitimate interest (platform trust)' },
              { dataType: 'Marketing consent records',     period: 'Until consent withdrawn + 3 years', reason: 'Proof of consent (GDPR accountability)' },
              { dataType: 'Analytics data (anonymized)',   period: '26 months',                         reason: 'Platform improvement' },
              { dataType: 'Support tickets',               period: '3 years after resolution',          reason: 'Dispute handling' },
              { dataType: 'IP address logs',               period: '12 months',                         reason: 'Security and fraud prevention' },
            ]} />
            <Prose>
              After the retention period, data is securely deleted or irreversibly anonymized.
            </Prose>
          </section>

          <Divider />

          {/* 7. Your Rights Under GDPR */}
          <section>
            <SalmonRule />
            <SectionHeading>7. Your Rights Under GDPR</SectionHeading>
            <Prose>
              You have the following rights regarding your personal data:
            </Prose>
            <ul className="flex flex-col gap-4 mb-6 pl-1">
              {[
                { right: 'Right of Access (Art. 15)', desc: 'Request a copy of all personal data we hold about you, including information about how it is processed.' },
                { right: 'Right to Rectification (Art. 16)', desc: 'Request correction of inaccurate or incomplete data. You can also update most data directly through your account settings.' },
                { right: 'Right to Erasure (Art. 17)', desc: 'Request deletion of your personal data. We will comply unless we have a legal obligation to retain it (e.g., tax records).' },
                { right: 'Right to Restrict Processing (Art. 18)', desc: 'Request that we limit how we use your data while a dispute or request is being resolved.' },
                { right: 'Right to Data Portability (Art. 20)', desc: 'Receive your data in a structured, commonly used, machine-readable format (JSON or CSV) and transmit it to another controller.' },
                { right: 'Right to Object (Art. 21)', desc: 'Object to processing based on legitimate interest, including direct marketing. We will stop processing unless we demonstrate compelling legitimate grounds.' },
                { right: 'Right to Withdraw Consent (Art. 7(3))', desc: 'Withdraw consent at any time (e.g., for marketing emails or Listing preview creation). Withdrawal does not affect the lawfulness of processing before withdrawal.' },
                { right: 'Right to Lodge a Complaint', desc: 'File a complaint with a supervisory authority. In Poland: the President of the Personal Data Protection Office (UODO), ul. Stawki 2, 00-193 Warsaw.' },
              ].map(item => (
                <li key={item.right} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{ background: '#E67E50', marginTop: '8px' }}
                  />
                  <span className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.68)' }}>
                    <span className="font-semibold" style={{ color: '#0A2E4D' }}>{item.right}</span>
                    {' '}— {item.desc}
                  </span>
                </li>
              ))}
            </ul>
            <InfoCard>
              <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.68)' }}>
                <span className="font-semibold" style={{ color: '#0A2E4D' }}>How to exercise your rights:</span>
                {' '}Contact us at{' '}
                <a href="mailto:contact@fjordanglers.com" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                  contact@fjordanglers.com
                </a>.
                {' '}We will verify your identity and respond within 30 days. If a request is complex, we may extend this
                by up to 60 additional days (with notice). Exercising your rights is free of charge, unless requests
                are manifestly unfounded or excessive.
              </p>
            </InfoCard>
          </section>

          <Divider />

          {/* 8. Data Security */}
          <section>
            <SalmonRule />
            <SectionHeading>8. Data Security</SectionHeading>
            <Prose>
              We implement appropriate technical and organizational measures to protect your personal data, including:
            </Prose>
            <ul className="flex flex-col gap-2.5 mb-5 pl-1">
              {[
                'Encryption of data in transit (TLS/SSL) and at rest',
                'Secure authentication and access controls',
                'Regular security assessments',
                'Access limited to personnel who need it for their duties',
                'Incident response procedures for data breaches',
                'Regular backups with secure storage',
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{ background: '#E67E50', marginTop: '7px' }}
                  />
                  <span className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.68)' }}>{item}</span>
                </li>
              ))}
            </ul>
            <Prose>
              In the event of a personal data breach that poses a risk to your rights and freedoms, we will notify
              the relevant supervisory authority within 72 hours and affected individuals without undue delay,
              as required by GDPR Article 33.
            </Prose>
            <Prose>
              While we take reasonable measures to protect your data, no system is completely secure. We encourage
              you to use strong, unique passwords and report any suspected security issues to{' '}
              <a href="mailto:contact@fjordanglers.com" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                contact@fjordanglers.com
              </a>.
            </Prose>
          </section>

          <Divider />

          {/* 9. Automated Decision-Making */}
          <section>
            <SalmonRule />
            <SectionHeading>9. Automated Decision-Making</SectionHeading>
            <Prose>
              We do not currently use automated decision-making or profiling that produces legal effects or
              similarly significant effects on Users.
            </Prose>
            <Prose>
              If we introduce such processing in the future, we will update this policy and provide you with
              the right to obtain human intervention, express your point of view, and contest the decision
              (GDPR Art. 22).
            </Prose>
          </section>

          <Divider />

          {/* 10. Children's Privacy */}
          <section>
            <SalmonRule />
            <SectionHeading>10. Children&apos;s Privacy</SectionHeading>
            <Prose>
              The Platform is not intended for use by individuals under 18 years of age. We do not knowingly
              collect personal data from children. If we discover that we have collected data from a minor
              without verified parental consent, we will delete it promptly. If you believe we have collected
              data from a child, contact us at{' '}
              <a href="mailto:contact@fjordanglers.com" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                contact@fjordanglers.com
              </a>.
            </Prose>
          </section>

          <Divider />

          {/* 11. Marketing Communications */}
          <section>
            <SalmonRule />
            <SectionHeading>11. Marketing Communications</SectionHeading>
            <Prose>
              We send marketing communications (newsletters, promotions, tips, platform updates) only to Users
              who have given explicit opt-in consent. You can withdraw consent at any time by:
            </Prose>
            <ul className="flex flex-col gap-2.5 mb-5 pl-1">
              {[
                'Clicking the "unsubscribe" link in any marketing email',
                'Updating your preferences in your account settings',
                'Contacting us at contact@fjordanglers.com',
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{ background: '#E67E50', marginTop: '7px' }}
                  />
                  <span className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.68)' }}>{item}</span>
                </li>
              ))}
            </ul>
            <Prose>
              Transactional emails (booking confirmations, payout notifications, security alerts, account-related
              messages) are not marketing and are sent as necessary for the performance of our contract with you.
              You cannot opt out of transactional emails while maintaining an active account.
            </Prose>
          </section>

          <Divider />

          {/* 12. Cookies */}
          <section>
            <SalmonRule />
            <SectionHeading>12. Cookies and Tracking Technologies</SectionHeading>
            <Prose>
              We use cookies and similar technologies to operate the Platform, analyze usage, and improve your
              experience. For detailed information about the cookies we use and how to manage your preferences,
              please see our{' '}
              <Link
                href="/legal/cookie-policy"
                className="font-semibold transition-opacity hover:opacity-70"
                style={{ color: '#E67E50' }}
              >
                Cookie Policy
              </Link>.
            </Prose>
          </section>

          <Divider />

          {/* 13. Third-Party Links */}
          <section>
            <SalmonRule />
            <SectionHeading>13. Third-Party Links and Services</SectionHeading>
            <Prose>
              The Platform may contain links to third-party websites, services, or integrations. We are not
              responsible for the privacy practices of these third parties. We encourage you to read their
              privacy policies before providing any personal data.
            </Prose>
            <Prose>
              Specifically, payment processing is handled by Stripe, which operates as an independent data
              controller. When you use Stripe&apos;s services through our Platform,{' '}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
                style={{ color: '#E67E50' }}
              >
                Stripe&apos;s Privacy Policy
              </a>{' '}
              governs their processing of your data.
            </Prose>
          </section>

          <Divider />

          {/* 14. DPO */}
          <section>
            <SalmonRule />
            <SectionHeading>14. Data Protection Officer</SectionHeading>
            <Prose>
              Given our current size and the nature of our processing, we have not appointed a Data Protection
              Officer (DPO) as we do not meet the thresholds requiring one under GDPR Article 37. For all privacy
              inquiries, please contact:{' '}
              <a href="mailto:contact@fjordanglers.com" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                contact@fjordanglers.com
              </a>.
            </Prose>
            <Prose>
              If our processing activities expand to require a DPO, we will update this policy accordingly.
            </Prose>
          </section>

          <Divider />

          {/* 15. Changes */}
          <section>
            <SalmonRule />
            <SectionHeading>15. Changes to This Privacy Policy</SectionHeading>
            <Prose>
              We may update this Privacy Policy from time to time to reflect changes in our practices,
              technology, or legal requirements. We will notify you of material changes via email and/or a
              prominent notice on the Platform at least 14 days before they take effect.
            </Prose>
            <Prose>
              We encourage you to review this policy periodically. The &ldquo;Last updated&rdquo; date at the top
              indicates when this policy was last revised.
            </Prose>
          </section>

          <Divider />

          {/* 16. Contact */}
          <section>
            <SalmonRule />
            <SectionHeading>16. Contact Us</SectionHeading>
            <Prose>
              For any questions, concerns, or requests related to this Privacy Policy or your personal data:
            </Prose>
            <InfoCard>
              <ul className="flex flex-col gap-3">
                {[
                  { label: 'Privacy inquiries',  value: 'contact@fjordanglers.com',  href: 'mailto:contact@fjordanglers.com' },
                  { label: 'Security issues',    value: 'contact@fjordanglers.com', href: 'mailto:contact@fjordanglers.com' },
                  { label: 'General support',    value: 'contact@fjordanglers.com',  href: 'mailto:contact@fjordanglers.com' },
                  { label: 'Website',            value: 'fjordanglers.com',          href: 'https://fjordanglers.com' },
                ].map(item => (
                  <li key={item.label} className="flex items-center gap-3 text-sm f-body">
                    <span className="font-semibold flex-shrink-0" style={{ color: '#0A2E4D', minWidth: '140px' }}>
                      {item.label}
                    </span>
                    <a
                      href={item.href}
                      target={item.href.startsWith('http') ? '_blank' : undefined}
                      rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="font-semibold transition-opacity hover:opacity-70"
                      style={{ color: '#E67E50' }}
                    >
                      {item.value}
                    </a>
                  </li>
                ))}
              </ul>
            </InfoCard>

            <SubHeading>Supervisory Authority</SubHeading>
            <InfoCard>
              <ul className="flex flex-col gap-2 text-sm f-body">
                <li className="font-semibold" style={{ color: '#0A2E4D' }}>
                  Prezes Urzędu Ochrony Danych Osobowych (UODO)
                </li>
                <li style={{ color: 'rgba(10,46,77,0.65)' }}>ul. Stawki 2, 00-193 Warsaw, Poland</li>
                <li>
                  <a
                    href="https://uodo.gov.pl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold transition-opacity hover:opacity-70"
                    style={{ color: '#E67E50' }}
                  >
                    uodo.gov.pl
                  </a>
                </li>
              </ul>
            </InfoCard>
          </section>

          <Divider />

          {/* Disclaimer */}
          <p
            className="text-xs f-body leading-relaxed italic"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            This Privacy Policy is provided as a template and does not constitute legal advice.
            We strongly recommend having it reviewed by a qualified legal professional in Poland before publication.
          </p>

        </div>
      </main>

      <Footer />
    </div>
  )
}
