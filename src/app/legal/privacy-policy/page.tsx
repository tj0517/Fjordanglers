import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/layout/nav'
import { SiteFooter } from '@/components/layout/footer'

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
          Privacy <span style={{ fontStyle: 'italic' }}>Notice</span>
        </h1>
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
          fjordanglers.com &nbsp;·&nbsp; GDPR Privacy Notice &nbsp;·&nbsp; Last updated: November 27, 2026
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
                label: 'Handling your inquiry and booking',
                desc: 'We process the data you give us — first and last name, email address, phone number, country, trip dates, group size, experience and preferences, and the messages we exchange — to answer your inquiry, prepare an offer with a guide, take your deposit and arrange the trip (Article 6(1)(b) GDPR: steps taken at your request before a contract, and performance of the contract). Card details are entered on Stripe’s page; we do not see or store them.',
              },
              {
                label: 'Fulfillment of Legal Obligations',
                desc: 'We keep payment records and invoices for tax and accounting purposes (Article 6(1)(c) GDPR).',
              },
              {
                label: 'Legitimate Interests (Article 6(1)(f) GDPR)',
                desc: 'Following up on your inquiry, contacting you before your trip to confirm the details, asking for a review after it, protecting against fraud and misuse, and improving our service based on how our website and inquiry process are used.',
              },
              {
                label: 'Consent (Article 6(1)(a) GDPR)',
                desc: 'Publishing your review, name, country and photos, and using optional analytics and advertising cookies. You can withdraw consent at any time.',
              },
            ]} />

            <SubHeading>Automated Processing and AI Tools</SubHeading>
            <Prose>
              We use an AI model to help us read inquiries and prepare replies; some first replies are sent
              automatically. These tools do not make decisions that have legal or similarly significant effects on
              you — offers and bookings are decided by our team. We do not personalise prices for individual users.
            </Prose>
          </section>

          <Divider />

          {/* 3. Communication Monitoring */}
          <section>
            <SalmonRule />
            <SectionHeading>3. Communication Channels and Call Recording</SectionHeading>
            <BoldBulletList items={[
              {
                label: 'How we communicate',
                desc: 'We talk to you by email and, if you give us your number, by phone, SMS or WhatsApp; we talk to guides by email, WhatsApp and Instagram. We keep the messages about your inquiry together with it in our system so that our team can handle your booking and any later complaint.',
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
              We share User personal data only with these recipients:
            </Prose>
            <BoldBulletList items={[
              {
                label: 'Service providers (processors)',
                desc: 'Supabase (database and file storage), Vercel (website hosting), Stripe (payments), Resend and Zoho (email), Anthropic (AI model used to read inquiries and draft replies), Meta (WhatsApp and Instagram messaging), Sentry (error monitoring), wFirma (invoicing and accounting), and — only with your cookie consent — Google, Microsoft Clarity and Meta for analytics and advertising (see the Cookie Policy).',
              },
              {
                label: 'Guides',
                desc: 'To prepare an offer we share the trip details of your inquiry — and your first and last name — with the guides we ask. Full contact details (phone, email) are exchanged between you and the guide only after your deposit is paid.',
              },
              {
                label: 'Transfer outside the European Economic Area (EEA)',
                desc: 'User data may be stored in the United States or other countries outside the EEA due to the global nature of our technology providers. In such cases, we apply Standard Contractual Clauses (SCCs) approved by the European Commission to ensure a level of data protection consistent with European standards.',
              },
              {
                label: 'Data retention period',
                desc: 'We keep inquiry and booking data for as long as we need it to handle your inquiry, your trip and any follow-up or complaint, and you can ask us to delete it at any time. Payment and invoice records are kept for the period required by tax and accounting regulations (typically 5 years), and data needed to pursue or defend legal claims for as long as such claims are possible.',
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
                desc: 'Providing personal data is voluntary; however, without your name and contact details we cannot answer your inquiry or arrange a booking.',
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
            <SubHeading>Publication of reviews</SubHeading>
            <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.68)' }}>
              After your trip we may send you a link to review it. We publish your review on fjordanglers.com —
              together with your first name, country and the photos you add — only if you tick the publication
              consent in the review form. Without that consent the review is used only internally. You can withdraw
              consent at any time by writing to contact@fjordanglers.com, and we will remove the review from the
              website. Reviews you post on external sites such as Trustpilot are governed by those sites&apos; own
              privacy policies. We use trip photos you send us in our marketing only with your separate permission.
            </p>
          </section>

          <Divider />

          {/* DPA */}
          <section>
            <SalmonRule />
            <SectionHeading>Data Protection Addendum (DPA)</SectionHeading>
            <Prose>
              This Addendum applies, together with the partner cooperation agreement, between FjordAnglers and every
              Guide who receives Customer personal data from FjordAnglers.
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
              { label: 'Platform non-circumvention', desc: 'Prohibition of using Customer contact data to induce them to cancel the booking made through FjordAnglers and enter into a direct agreement instead.' },
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
      <SiteFooter />
    </div>
  )
}
