import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'GDPR Privacy Notice — how FjordAnglers collects, uses, and protects your personal data.',
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
          Privacy <span style={{ fontStyle: 'italic' }}>Notice</span>
        </h1>
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
          fjordanglers.com &nbsp;·&nbsp; GDPR Privacy Notice &nbsp;·&nbsp; Last updated: April 1, 2026
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

          {/* 1. Data Controller and Contact Details */}
          <section>
            <SalmonRule />
            <SectionHeading>1. Data Controller and Contact Details</SectionHeading>
            <Prose>
              The controller of the User&apos;s personal data is: FjordAnglers [Tymon Jezionek, NIP: 5833564870,
              REGON: 544350813], registered in Poland. All questions regarding data protection, privacy, and
              requests related to the exercise of User rights may be directed to:{' '}
              <a href="mailto:contact@fjordanglers.com" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                contact@fjordanglers.com
              </a>.
            </Prose>
            <InfoCard>
              <ul className="flex flex-col gap-2">
                {[
                  { label: 'Controller',  value: 'FjordAnglers — Tymon Jezionek' },
                  { label: 'NIP',         value: '5833564870' },
                  { label: 'REGON',       value: '544350813' },
                  { label: 'Address',     value: 'Otwarta 38b/11, 80-169 Gdańsk, Poland' },
                  { label: 'Contact',     value: 'contact@fjordanglers.com', href: 'mailto:contact@fjordanglers.com' },
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

          {/* 2. Purposes and Legal Bases */}
          <section>
            <SalmonRule />
            <SectionHeading>2. Purposes and Legal Bases for Data Processing</SectionHeading>
            <Prose>
              FjordAnglers processes User data exclusively for strictly defined purposes: to perform contracts,
              fulfill legal obligations, and pursue legitimate business interests.
            </Prose>
            <BoldBulletList items={[
              {
                label: 'Performance of the Agreement with the User',
                desc: 'We process User data (first name, last name, email address, phone number, reservation history, and payment data) to enable the User to use the Platform, create a profile, and book fishing trips (Article 6(1)(b) GDPR).',
              },
              {
                label: 'Fulfillment of Legal Obligations',
                desc: 'We process business documents, payout history, and approximate location data (based on IP) for necessary tax and accounting settlements (Article 6(1)(c) GDPR).',
              },
              {
                label: 'Legitimate Interests (Article 6(1)(f) GDPR)',
                desc: 'Service provision: managing profiles, photos, and fishing reports. Security and fraud prevention: monitoring IP addresses, change history, and online communication to prevent dishonest practices and protect Platform integrity. Platform improvement: analyzing notification preferences, usage statistics, and NPS ratings to optimize service operation.',
              },
            ]} />

            <SubHeading>No Profiling and Listing Ranking Principles (Omnibus Directive)</SubHeading>
            <Prose>
              FjordAnglers does not make any decisions regarding Users based on automated processing of personal
              data. The Platform does not employ algorithmic profiling, behavioral tracking, or price
              personalization for individual Users.
            </Prose>
            <Prose>
              The display order and positioning of Guide Listings in search results depends exclusively on:
            </Prose>
            <BulletList items={[
              'Objective criteria and search filters entered independently by the Customer (e.g., selected location, date, price range, fish species).',
              'A random factor ensuring equal exposure opportunities for all Guides meeting the search criteria.',
            ]} />
          </section>

          <Divider />

          {/* 3. Communication Monitoring */}
          <section>
            <SalmonRule />
            <SectionHeading>3. Communication Monitoring and Call Recording</SectionHeading>
            <BoldBulletList items={[
              {
                label: 'Message analysis',
                desc: 'FjordAnglers provides an internal messaging system to facilitate arrangements between Customer and Guide. The Platform does not use automated tools for mass content scanning. However, pursuant to the controller\'s legitimate interest (Article 6(1)(f) GDPR), authorized FjordAnglers personnel reserve the right to conduct random, manual review of message content. This action is intended solely for: preventing financial fraud, protecting the integrity of the booking system (detecting attempts to circumvent the Platform booking process before deposit payment), and gathering evidence in case of reported complaints or Terms violations.',
              },
              {
                label: 'Call recording',
                desc: 'Calls with FjordAnglers support may be recorded for training purposes, information verification, and service quality monitoring. Recordings are stored only for the time necessary to fulfill these purposes (typically no longer than 3 months) and are then permanently deleted.',
              },
            ]} />
          </section>

          <Divider />

          {/* 4. Data Recipients and International Transfer */}
          <section>
            <SalmonRule />
            <SectionHeading>4. Data Recipients and International Transfer</SectionHeading>
            <Prose>
              We share User personal data exclusively with two categories of trusted recipients:
            </Prose>
            <BoldBulletList items={[
              {
                label: 'Data Processors',
                desc: 'External companies, including payment operators (e.g., Stripe) and hosting and analytics service providers, which enable FjordAnglers to operate the service efficiently and securely.',
              },
              {
                label: 'Other Users (Reservation Parties)',
                desc: 'We transfer necessary data between Customer and Guide to enable execution of the booked trip. First and last name may be visible at the inquiry stage, while full contact details (phone, email) are shared with both parties only after deposit payment.',
              },
              {
                label: 'Transfer outside the European Economic Area (EEA)',
                desc: 'User data may be stored in the United States or other countries outside the EEA due to the global nature of our technology providers. In such cases, we apply Standard Contractual Clauses (SCCs) approved by the European Commission to ensure a level of data protection consistent with European standards.',
              },
              {
                label: 'Data retention period',
                desc: 'We retain User personal data for the duration of the active account on the Platform. After account deletion, data may be retained only for the time necessary to pursue or defend against claims and for the period required by tax and accounting regulations (typically 5 years).',
              },
            ]} />
          </section>

          <Divider />

          {/* 5. User Rights Under GDPR */}
          <section>
            <SalmonRule />
            <SectionHeading>5. User Rights Under GDPR</SectionHeading>
            <Prose>
              Under the EU General Data Protection Regulation (GDPR), every User has the right to:
            </Prose>
            <BulletList items={[
              'Access their personal data and receive a copy thereof.',
              'Rectification of incorrect or outdated information.',
              'Erasure of data ("right to be forgotten"), provided it does not conflict with our overriding legal obligations (e.g., retention of accounting documentation).',
              'Restriction of data processing.',
              'Object to data processing based on our legitimate interest (including objection to profiling for direct marketing purposes).',
              'Data portability — receiving their data in a structured format for transfer to another controller.',
              'Lodge a complaint with the local supervisory authority (in Poland, this is the President of the Personal Data Protection Office — PUODO).',
            ]} />
            <InfoCard>
              <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.68)' }}>
                <span className="font-semibold" style={{ color: '#0A2E4D' }}>How to exercise your rights:</span>
                {' '}Contact us at{' '}
                <a href="mailto:contact@fjordanglers.com" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                  contact@fjordanglers.com
                </a>.
                {' '}We will verify your identity and respond within 30 days.
              </p>
            </InfoCard>
          </section>

          <Divider />

          {/* 6. Additional Information */}
          <section>
            <SalmonRule />
            <SectionHeading>6. Additional Information and Limitations</SectionHeading>
            <BoldBulletList items={[
              {
                label: 'Voluntary nature of data provision',
                desc: 'Providing personal data is voluntary; however, it is necessary to create an account and use the Platform\'s booking services.',
              },
              {
                label: 'Sensitive data',
                desc: 'FjordAnglers does not knowingly collect sensitive data (concerning racial origin, religion, health status, or sexual orientation). We strongly request that Users do not share such information through our communication channels.',
              },
              {
                label: 'Protection of minors',
                desc: 'The Platform is intended exclusively for persons who are at least 18 years of age. If you become aware that a minor has shared their personal data with us, please contact us immediately for its deletion.',
              },
            ]} />
          </section>

          <Divider />

          {/* DPA */}
          <section>
            <SalmonRule />
            <SectionHeading>Data Protection Addendum (DPA)</SectionHeading>
            <Prose>
              This Addendum forms an integral part of the FjordAnglers Terms of Use and Privacy Policy. It is a
              binding agreement between FjordAnglers and the Guide who, as part of provided services, receives
              Customer personal data.
            </Prose>

            <SubHeading>1. Definitions and Roles of Parties</SubHeading>
            <BoldBulletList items={[
              {
                label: 'Customer Personal Data',
                desc: 'Means the first name, last name, phone number, and email address provided by FjordAnglers to enable contact and reservation execution.',
              },
              {
                label: 'Independent Data Controller',
                desc: 'Pursuant to the EU GDPR, upon transfer of Customer data, the Guide becomes an independent data controller. This means that FjordAnglers and the Guide are not joint controllers — each party independently and on its own responsibility decides on the methods of securing and processing such data in its jurisdiction.',
              },
            ]} />

            <SubHeading>2. Guide Obligations</SubHeading>
            <Prose>The Guide receiving Customer data from FjordAnglers unconditionally undertakes to:</Prose>
            <BoldBulletList items={[
              { label: 'Purpose limitation', desc: 'Use data exclusively for the purpose of executing the booked fishing trip. It is strictly prohibited to use this data for marketing purposes (e.g., adding to newsletters) without the Customer\'s prior, explicit, and documented consent.' },
              { label: 'Platform non-circumvention', desc: 'Prohibition of using Customer contact data to induce them to cancel the Platform reservation and enter into a direct agreement.' },
              { label: 'Confidentiality', desc: 'Prohibition of disclosing, selling, renting, or sharing Customer data with third parties without their consent.' },
              { label: 'Legal compliance', desc: 'Compliance with GDPR and local privacy protection laws.' },
              { label: 'Data security', desc: 'Implementing appropriate technical and organizational measures (e.g., screen locks, secure passwords) to protect data from unauthorized access. The Guide bears full responsibility for compliance with these principles by their employees and subcontractors.' },
            ]} />

            <SubHeading>3. Data Breach Notification</SubHeading>
            <Prose>
              In the event of a personal data breach involving Customer data (e.g., device theft, email account
              hack), the Guide is obligated to inform FjordAnglers without undue delay, no later than 48 hours
              from discovery of the incident, at:{' '}
              <a href="mailto:contact@fjordanglers.com" className="font-semibold transition-opacity hover:opacity-70" style={{ color: '#E67E50' }}>
                contact@fjordanglers.com
              </a>.
            </Prose>

            <SubHeading>4. Indemnification</SubHeading>
            <Prose>
              If FjordAnglers is held legally or financially liable (including fines) due to improper or unlawful
              processing of Customer data by the Guide (including data leaks attributable to the Guide), the Guide
              undertakes to fully compensate FjordAnglers for all losses, legal costs, and damages incurred.
            </Prose>

            <SubHeading>5. Data Deletion and Customer Rights</SubHeading>
            <Prose>
              Customer data may be retained by the Guide only for the period necessary to complete the trip and
              fulfill local tax and accounting obligations. In the event of a data deletion request by the Customer
              (&ldquo;right to be forgotten&rdquo;), the Guide undertakes to cooperate promptly and permanently delete the
              data from their systems, unless mandatory legal provisions require further retention.
            </Prose>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
