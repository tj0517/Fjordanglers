import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms and conditions governing your use of the FjordAnglers platform.',
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

function WarningCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl px-6 py-5 mb-5"
      style={{ background: 'rgba(230,126,80,0.05)', border: '1px solid rgba(230,126,80,0.18)' }}
    >
      {children}
    </div>
  )
}

function CancellationMode({
  mode,
  title,
  items,
}: {
  mode: string
  title: string
  items: string[]
}) {
  return (
    <div
      className="rounded-2xl px-6 py-5 mb-4"
      style={{ background: 'rgba(10,46,77,0.025)', border: '1px solid rgba(10,46,77,0.08)' }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1 f-body"
        style={{ color: '#E67E50' }}
      >
        {mode}
      </p>
      <p className="text-sm font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
        {title}
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
              style={{ background: '#E67E50', marginTop: '7px' }}
            />
            <span className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.65)' }}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SLink({
  href,
  external,
  children,
}: {
  href: string
  external?: boolean
  children: React.ReactNode
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
        style={{ color: '#E67E50' }}
      >
        {children}
      </a>
    )
  }
  return (
    <Link
      href={href}
      className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
      style={{ color: '#E67E50' }}
    >
      {children}
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TermsOfServicePage() {
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
          Terms of <span style={{ fontStyle: 'italic' }}>Service</span>
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
              Welcome to Fjordanglers (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;).
              Fjordanglers is an online marketplace connecting fishing guides, camps, and outfitters
              (&ldquo;Guides&rdquo;) with anglers seeking guided fishing experiences (&ldquo;Anglers&rdquo;).
              Together, Guides and Anglers are referred to as &ldquo;Users.&rdquo;
            </Prose>
            <Prose>
              Fjordanglers is operated as a sole proprietorship (Jednoosobowa Działalność Gospodarcza) registered
              in Poland. Website:{' '}
              <SLink href="https://fjordanglers.com" external>fjordanglers.com</SLink>
            </Prose>
            <WarningCard>
              <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.72)' }}>
                By accessing or using the Platform, you agree to be bound by these Terms of Service
                (&ldquo;Terms&rdquo;). If you do not agree, please do not use the Platform.
              </p>
            </WarningCard>
          </section>

          <Divider />

          {/* 2. Fjordanglers' Role */}
          <section>
            <SalmonRule />
            <SectionHeading>2. Fjordanglers&apos; Role</SectionHeading>
            <Prose>
              Fjordanglers is an online marketplace that enables Guides to publish Listings and Anglers
              to discover, book, and pay for guided fishing experiences. We facilitate the connection between
              Guides and Anglers and process payments on their behalf.
            </Prose>
            <SubHeading>Fjordanglers is not:</SubHeading>
            <BulletList items={[
              'A fishing guide service, outfitter, or tour operator.',
              'A travel agency, travel advisor, or tourism company.',
              'An insurer or provider of safety guarantees.',
              'A party to any agreement between a Guide and an Angler.',
            ]} />
            <Prose>
              When an Angler books a trip, a direct contract is formed between the Angler and the Guide.
              Fjordanglers acts solely as an intermediary platform. We do not own, operate, manage, or control
              any Listings, fishing trips, boats, equipment, or Guide services. All Guides on the Platform are
              independent service providers — not employees, agents, or contractors of Fjordanglers.
            </Prose>
          </section>

          <Divider />

          {/* 3. Definitions */}
          <section>
            <SalmonRule />
            <SectionHeading>3. Definitions</SectionHeading>
            <InfoCard>
              <ul className="flex flex-col gap-3">
                {[
                  { term: 'Platform', def: 'the website fjordanglers.com and all associated services.' },
                  { term: 'Guide', def: 'a registered user who offers guided fishing trips, camps, or charter services through the Platform.' },
                  { term: 'Angler', def: 'a registered user who browses, books, or purchases fishing experiences through the Platform.' },
                  { term: 'Listing', def: "a Guide's published offer for a fishing trip or experience on the Platform." },
                  { term: 'Booking', def: "a confirmed reservation made by an Angler for a Guide's Listing." },
                  { term: 'Service Fee', def: 'the commission charged by Fjordanglers on each completed Booking.' },
                  { term: 'Booking Party', def: 'the Angler who made the Booking, including any additional participants in the trip.' },
                  { term: 'Trip', def: 'the fishing experience or service as described in the Listing.' },
                ].map(item => (
                  <li key={item.term} className="flex items-start gap-3 text-sm f-body">
                    <span className="font-bold flex-shrink-0" style={{ color: '#0A2E4D', minWidth: '120px' }}>
                      {item.term}
                    </span>
                    <span style={{ color: 'rgba(10,46,77,0.65)' }}>— {item.def}</span>
                  </li>
                ))}
              </ul>
            </InfoCard>
          </section>

          <Divider />

          {/* 4. Eligibility */}
          <section>
            <SalmonRule />
            <SectionHeading>4. Eligibility</SectionHeading>
            <Prose>To use the Platform, you must:</Prose>
            <BulletList items={[
              'Be at least 18 years of age.',
              'Have the legal capacity to enter into binding agreements.',
              'Provide accurate and complete registration information.',
              'Comply with all applicable laws in your jurisdiction.',
            ]} />
            <Prose>
              Guides must additionally hold all permits, licenses, and insurance required by local law to operate
              fishing guide services in their region.
            </Prose>
          </section>

          <Divider />

          {/* 5. Account Registration */}
          <section>
            <SalmonRule />
            <SectionHeading>5. Account Registration</SectionHeading>

            <SubHeading>5.1 Guide Accounts</SubHeading>
            <Prose>
              Guides register by providing their name, surname, email address, and website (if applicable).
              Upon registration, Guides may:
            </Prose>
            <BulletList items={[
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Self-create a Listing</span> — build and manage their own Listing through the Guide Dashboard.</>,
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Authorize a Platform-Created Preview</span> — grant Fjordanglers permission to create an initial Listing preview based on the Guide&apos;s publicly available online information (website, social media). The Guide retains full control to edit, modify, or remove this Listing at any time.</>,
            ]} />
            <Prose>
              By authorizing a Platform-Created Preview, the Guide confirms that the information on their public
              website and online profiles is accurate and that they consent to Fjordanglers using it to generate
              a Listing on their behalf.
            </Prose>

            <SubHeading>5.2 Angler Accounts</SubHeading>
            <Prose>
              Anglers register by providing their name, surname, and email address.
            </Prose>

            <SubHeading>5.3 Account Responsibility</SubHeading>
            <Prose>
              You are responsible for maintaining the confidentiality of your account credentials. You are liable
              for all activity that occurs under your account. You must not transfer or share your account with any
              third party. Notify us immediately at{' '}
              <SLink href="mailto:contact@fjordanglers.com">contact@fjordanglers.com</SLink> if you suspect
              unauthorized access.
            </Prose>

            <SubHeading>5.4 Account Verification</SubHeading>
            <Prose>
              Fjordanglers may, but is not obligated to, verify the identity, qualifications, or credentials of
              Users. Any &ldquo;verified&rdquo; badges or labels on the Platform indicate only that a User has
              completed a specific verification step — they do not constitute an endorsement, certification, or
              guarantee of quality, safety, or trustworthiness by Fjordanglers.
            </Prose>
          </section>

          <Divider />

          {/* 6. Listings */}
          <section>
            <SalmonRule />
            <SectionHeading>6. Listings</SectionHeading>

            <SubHeading>6.1 Listing Content</SubHeading>
            <Prose>
              Guides are solely responsible for the accuracy, completeness, and legality of their Listings,
              including but not limited to: trip descriptions and itineraries, pricing and availability, photos and
              media, licensing and safety information, equipment provided or required, group size limits, and any
              specific requirements or restrictions. Guides must ensure that their Listings comply with all
              applicable local laws, regulations, and licensing requirements.
            </Prose>

            <SubHeading>6.2 Platform-Created Previews</SubHeading>
            <Prose>Where a Guide authorizes Fjordanglers to create a Listing preview from their public online data:</Prose>
            <BulletList items={[
              'The preview is generated from publicly available information only.',
              'Fjordanglers makes reasonable efforts to ensure accuracy but does not guarantee it.',
              'The Guide is responsible for reviewing, correcting, and approving the Listing before it goes live.',
              'The Guide may edit or delete the Listing at any time through their Dashboard.',
              'Until the Guide reviews and approves the preview, it will be clearly marked as "Unverified by Guide."',
            ]} />

            <SubHeading>6.3 Listing Ranking and Display</SubHeading>
            <Prose>
              Fjordanglers determines how Listings are ranked and displayed in search results based on factors
              including (but not limited to) relevance, reviews, response rate, pricing, and availability.
              Fjordanglers reserves the right to modify ranking criteria at any time.
            </Prose>

            <SubHeading>6.4 Prohibited Content</SubHeading>
            <Prose>Listings must not contain:</Prose>
            <BulletList items={[
              'Misleading or false information.',
              'Illegal services.',
              'Discriminatory language.',
              'Content that infringes on third-party intellectual property rights.',
              'Contact information intended to circumvent the Platform\'s booking system.',
              'Content that violates our Community Standards.',
            ]} />
          </section>

          <Divider />

          {/* 7. Searching and Booking */}
          <section>
            <SalmonRule />
            <SectionHeading>7. Searching and Booking (Angler Terms)</SectionHeading>

            <SubHeading>7.1 Searching</SubHeading>
            <Prose>
              Anglers may browse and search Listings on the Platform. Search results are based on relevance,
              availability, and other factors. Fjordanglers does not guarantee the accuracy of search results
              or the availability of any Listing.
            </Prose>

            <SubHeading>7.2 Booking</SubHeading>
            <Prose>
              When an Angler submits a Booking request, they agree to pay the total price displayed (including
              any applicable Service Fees and taxes). A Booking is confirmed when the Guide accepts the request
              (or immediately, if the Guide has enabled instant booking).
            </Prose>
            <Prose>
              By completing a Booking, the Angler enters into a direct agreement with the Guide for the Trip as
              described in the Listing. The Angler agrees to comply with the Guide&apos;s terms, rules, and instructions
              for the Trip.
            </Prose>

            <SubHeading>7.3 Booking Party Responsibility</SubHeading>
            <Prose>
              The Angler who makes a Booking is responsible for the conduct of all members of the Booking Party
              (all persons participating in the Trip). The booking Angler must ensure that all participants meet
              any age, fitness, experience, or licensing requirements specified in the Listing; follow the
              Guide&apos;s safety instructions; and comply with these Terms. If any member of the Booking Party
              causes damage to the Guide&apos;s equipment, boat, or property, the booking Angler is financially
              responsible.
            </Prose>

            <SubHeading>7.4 Angler&apos;s Own Fishing Licenses</SubHeading>
            <Prose>
              Unless the Listing explicitly states that fishing licenses are included, each member of the Booking
              Party is individually responsible for obtaining and carrying valid fishing licenses as required by
              local regulations. Fjordanglers and the Guide are not liable for any fines or penalties resulting
              from unlicensed fishing.
            </Prose>
          </section>

          <Divider />

          {/* 8. Assumption of Risk */}
          <section>
            <SalmonRule />
            <SectionHeading>8. Assumption of Risk</SectionHeading>

            <SubHeading>8.1 Inherent Risks of Fishing Activities</SubHeading>
            <Prose>
              Fishing trips and outdoor activities involve inherent risks, including but not limited to:
            </Prose>
            <BulletList items={[
              'Adverse weather conditions and rough water or sea conditions.',
              'Risks associated with boats and watercraft.',
              'Physical injury from hooks, equipment, or environmental hazards.',
              'Drowning or water-related accidents.',
              'Remoteness and limited access to emergency services.',
              'Hypothermia or heat-related illness.',
              'Wildlife encounters and allergic reactions.',
            ]} />

            <SubHeading>8.2 Angler&apos;s Acknowledgment</SubHeading>
            <Prose>
              By booking a Trip through the Platform, the Angler acknowledges and voluntarily assumes all risks
              associated with the Trip. The Angler is responsible for assessing their own fitness, health,
              swimming ability, and experience level before booking. If the Listing specifies requirements (e.g.,
              minimum fitness level, swimming ability, prior experience), the Angler warrants that they and all
              members of their Booking Party meet those requirements.
            </Prose>

            <SubHeading>8.3 Angler&apos;s Responsibility</SubHeading>
            <Prose>
              The Angler understands that Fjordanglers has not assessed the safety, qualifications, or competence
              of any Guide and makes no representations or warranties regarding the same. It is the Angler&apos;s
              responsibility to ask the Guide any relevant safety questions before booking.
            </Prose>

            <SubHeading>8.4 Travel and Health Insurance</SubHeading>
            <Prose>
              Fjordanglers strongly recommends that Anglers obtain appropriate travel and health insurance covering
              outdoor and water-based activities before participating in any Trip. Neither Fjordanglers nor the
              Guide is responsible for any medical, evacuation, or repatriation costs.
            </Prose>
          </section>

          <Divider />

          {/* 9. Bookings and Payments */}
          <section>
            <SalmonRule />
            <SectionHeading>9. Bookings and Payments</SectionHeading>

            <SubHeading>9.1 Payment Processing</SubHeading>
            <Prose>
              All payments are processed through <span className="font-semibold" style={{ color: '#0A2E4D' }}>Stripe</span>,
              our third-party payment provider. By making or receiving payments through the Platform, you agree to{' '}
              <SLink href="https://stripe.com/legal" external>Stripe&apos;s Terms of Service</SLink> and{' '}
              <SLink href="https://stripe.com/privacy" external>Stripe&apos;s Privacy Policy</SLink>.
              Fjordanglers is not a payment institution — Stripe acts as the payment service provider and holds funds
              on behalf of Users in compliance with applicable financial regulations.
            </Prose>

            <SubHeading>9.2 Payment Flow</SubHeading>
            <BulletList items={[
              'Anglers pay the full Booking amount (Trip price + Service Fee) at the time of reservation.',
              'Guides receive the Trip price minus the applicable Service Fee. Payouts are processed typically within 24–48 hours after the Trip is completed.',
            ]} />

            <SubHeading>9.3 Service Fee</SubHeading>
            <Prose>
              Fjordanglers charges a commission (Service Fee) on each completed Booking. The applicable Service Fee
              rates are transparently displayed to both Guides (in the Guide Dashboard) and Anglers (during the
              Booking process) before the transaction is confirmed. Fjordanglers reserves the right to modify the
              Service Fee with at least 30 days&apos; written notice to Guides.
            </Prose>

            <SubHeading>9.4 Currency and Conversion</SubHeading>
            <Prose>
              Prices are displayed in the currency set by the Guide. Where currency conversion is necessary,
              Stripe&apos;s applicable exchange rate and conversion fees will apply. Fjordanglers is not responsible
              for exchange rate fluctuations.
            </Prose>

            <SubHeading>9.5 Taxes</SubHeading>
            <Prose>
              Guides are solely responsible for determining, collecting, and remitting any applicable taxes (VAT,
              income tax, tourism taxes, etc.) in their jurisdiction. Anglers are responsible for any consumption
              taxes applicable in their country. Fjordanglers does not provide tax advice.
            </Prose>

            <SubHeading>9.6 Off-Platform Payments</SubHeading>
            <Prose>
              Users must not use the Platform to arrange bookings and then complete payment outside the Platform
              in order to avoid Service Fees. Violations may result in account suspension.
            </Prose>
          </section>

          <Divider />

          {/* 10. Cancellation Policy */}
          <section>
            <SalmonRule />
            <SectionHeading>10. Cancellation Policy</SectionHeading>
            <Prose>
              Each Guide selects one of the following three cancellation modes for their Listings. The applicable
              mode is clearly displayed on each Listing before the Angler completes a Booking.
            </Prose>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <CancellationMode
                mode="Mode 1"
                title="Flexible"
                items={[
                  'Free cancellation up to 48 hours before the trip — full refund.',
                  'Within 48 hours — 50% refund.',
                  'No-shows — no refund.',
                ]}
              />
              <CancellationMode
                mode="Mode 2"
                title="Moderate"
                items={[
                  'Free cancellation up to 7 days before the trip — full refund.',
                  'Between 7 days and 48 hours — 50% refund.',
                  'Within 48 hours or no-shows — no refund.',
                ]}
              />
              <CancellationMode
                mode="Mode 3"
                title="Strict"
                items={[
                  'Free cancellation up to 14 days before the trip — full refund.',
                  'Between 14 and 7 days — 50% refund.',
                  'Within 7 days or no-shows — no refund.',
                ]}
              />
            </div>

            <SubHeading>10.1 Weather Cancellations</SubHeading>
            <Prose>
              Fishing is an outdoor activity and weather conditions are inherently unpredictable.
            </Prose>
            <BulletList items={[
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Guide-initiated cancellation:</span> The Guide has sole authority to determine whether weather conditions are safe. If the Guide cancels due to unsafe conditions (storm warnings, dangerous seas, lightning, severe fog), the Angler receives a <span className="font-semibold" style={{ color: '#0A2E4D' }}>full refund</span>.</>,
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Angler-requested weather cancellation:</span> If the Angler wishes to cancel due to weather but the Guide has not cancelled, the standard cancellation policy (Flexible, Moderate, or Strict) applies.</>,
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Suboptimal but safe conditions:</span> If the Guide operates the Trip and conditions are less favorable than expected (rain, choppy water, poor catches) but not dangerous, <span className="font-semibold" style={{ color: '#0A2E4D' }}>no refund is owed</span>. Weather is unpredictable and suboptimal conditions do not entitle the Angler to a refund.</>,
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Shortened trips:</span> If a Trip is cut short due to deteriorating safety conditions, the Guide may at their sole discretion offer a partial refund or a rescheduled trip. Fjordanglers does not mandate partial refunds for shortened trips.</>,
            ]} />

            <SubHeading>10.2 Refund Method</SubHeading>
            <Prose>
              All refunds are processed through Stripe to the original payment method. Refund processing times
              depend on the Angler&apos;s bank or card issuer and are outside Fjordanglers&apos; control.
            </Prose>

            <SubHeading>10.3 Guide Cancellations</SubHeading>
            <Prose>
              If a Guide cancels a confirmed Booking, the Angler receives a full refund. Repeated cancellations
              by a Guide may result in account penalties, reduced search visibility, or account suspension.
              Weather-related cancellations initiated by the Guide in good faith will not count toward
              cancellation penalties.
            </Prose>

            <SubHeading>10.4 Major Disruptive Events (Force Majeure)</SubHeading>
            <Prose>
              In cases of natural disasters, government-imposed travel restrictions, pandemics, regional
              emergencies, or other extraordinary events beyond reasonable control (&ldquo;Major Disruptive Events&rdquo;),
              either party may cancel without penalty and Fjordanglers will facilitate a full refund. Ordinary bad
              weather does not qualify as a Major Disruptive Event unless it constitutes an extreme regional
              weather emergency (e.g., hurricane, typhoon, severe storm warning covering the entire region).
            </Prose>

            <SubHeading>10.5 Trip Modification by Guide</SubHeading>
            <Prose>
              If a Guide needs to modify a confirmed Booking (e.g., change of vessel, time adjustment, alternate
              location), the Guide must notify the Angler as soon as possible. The Angler may accept the
              modification or cancel for a full refund.
            </Prose>

            <SubHeading>10.6 Disputes</SubHeading>
            <Prose>
              If a dispute arises regarding a cancellation or refund, Users should first attempt to resolve it
              directly. If unresolved, either party may contact Fjordanglers at{' '}
              <SLink href="mailto:contact@fjordanglers.com">contact@fjordanglers.com</SLink> for mediation.
              Fjordanglers will review the dispute in good faith and issue a final decision within the scope of
              the Platform. Both parties agree to provide relevant evidence when requested.
            </Prose>
          </section>

          <Divider />

          {/* 11. Guide Obligations */}
          <section>
            <SalmonRule />
            <SectionHeading>11. Guide Obligations</SectionHeading>
            <Prose>By registering as a Guide, you represent and warrant that:</Prose>
            <BulletList items={[
              'You hold all required fishing guide licenses, permits, and certifications in your operating jurisdiction.',
              'You carry adequate liability insurance for the services you offer, covering all participants.',
              "Your boats, equipment, and vehicles meet all applicable safety standards and are regularly maintained.",
              'You carry appropriate safety equipment (life jackets, first aid kit, communication devices) as required by local maritime law.',
              'You comply with all local maritime, environmental, and fishing regulations.',
              'You will provide the services as described in your Listing.',
              'You will not exceed the maximum passenger capacity of your vessel.',
              'You will not operate under the influence of alcohol or drugs.',
              'You will respond to Booking requests within 48 hours.',
            ]} />
            <Prose>
              Fjordanglers does not verify Guide credentials, licenses, or insurance. Anglers should
              independently verify Guide qualifications before booking.
            </Prose>

            <SubHeading>11.1 Guide&apos;s Obligation to Refuse Unsafe Conditions</SubHeading>
            <Prose>
              Guides have the right and obligation to cancel or refuse to operate a Trip if conditions are unsafe
              (e.g., severe weather, equipment failure, intoxicated participants). In such cases, the applicable
              cancellation policy applies, or a full refund may be issued at the Guide&apos;s or
              Fjordanglers&apos; discretion.
            </Prose>
          </section>

          <Divider />

          {/* 12. Angler Obligations */}
          <section>
            <SalmonRule />
            <SectionHeading>12. Angler Obligations</SectionHeading>
            <Prose>By booking through the Platform, Anglers agree to:</Prose>
            <BulletList items={[
              'Arrive on time for the scheduled trip.',
              "Follow the Guide's safety instructions at all times, including wearing life jackets when required.",
              'Hold valid fishing licenses required by local regulations (unless explicitly stated as included in the Listing).',
              'Disclose any relevant medical conditions, allergies, or physical limitations to the Guide before the Trip.',
              'Behave respectfully toward the Guide, crew, other anglers, and the natural environment.',
              'Not bring prohibited items (weapons, illegal substances, unauthorized fishing equipment) on the Trip.',
              'Comply with catch-and-release regulations and local fishing laws.',
              'Not engage in any illegal fishing practices (poaching, using prohibited gear, exceeding catch limits).',
            ]} />
          </section>

          <Divider />

          {/* 13. Damage and Equipment */}
          <section>
            <SalmonRule />
            <SectionHeading>13. Damage and Equipment Policy</SectionHeading>

            <SubHeading>13.1 Angler Liability for Damage</SubHeading>
            <Prose>
              If an Angler or any member of the Booking Party causes damage to the Guide&apos;s equipment, boat,
              or property during a Trip (beyond normal wear and tear), the booking Angler is liable for the
              reasonable cost of repair or replacement.
            </Prose>

            <SubHeading>13.2 Damage Claims</SubHeading>
            <Prose>
              Guides must report any damage to Fjordanglers within 48 hours of the Trip&apos;s conclusion,
              providing photographic evidence and a reasonable estimate of repair costs. Fjordanglers will
              facilitate communication between the parties. If the parties cannot agree, Fjordanglers may, at its
              discretion, mediate the dispute. Fjordanglers is not a party to damage claims and does not
              guarantee any resolution.
            </Prose>
          </section>

          <Divider />

          {/* 14. Reviews */}
          <section>
            <SalmonRule />
            <SectionHeading>14. Reviews and Ratings</SectionHeading>
            <Prose>
              After a completed trip, Anglers may leave a review and rating. Reviews must be honest, factual, and
              based on the actual experience. Fjordanglers reserves the right to remove reviews that:
            </Prose>
            <BulletList items={[
              'Contain hate speech, threats, or discriminatory language.',
              'Are spam or clearly fraudulent.',
              'Contain personal information or off-platform contact details.',
              'Are defamatory or unrelated to the actual Trip experience.',
              'Were obtained through coercion or incentives.',
            ]} />
            <Prose>
              Guides may publicly respond to reviews through their Dashboard. Fjordanglers does not verify the
              accuracy of reviews and is not liable for the content of User-generated reviews.
            </Prose>
          </section>

          <Divider />

          {/* 15. Community Standards */}
          <section>
            <SalmonRule />
            <SectionHeading>15. Community Standards</SectionHeading>
            <Prose>All Users agree to abide by the following community standards:</Prose>
            <BulletList items={[
              'Treat other Users with respect and dignity.',
              'Communicate honestly and in good faith.',
              'Do not discriminate based on race, ethnicity, nationality, religion, gender, sexual orientation, disability, or age.',
              'Do not harass, threaten, or intimidate other Users.',
              'Do not circumvent the Platform\'s systems (e.g., encouraging off-platform payments to avoid fees).',
              'Do not create multiple accounts or false identities.',
              'Report any safety concerns, violations, or suspicious activity to Fjordanglers.',
            ]} />
            <Prose>
              Violations of these standards may result in warnings, account suspension, or permanent termination.
            </Prose>
          </section>

          <Divider />

          {/* 16. Intellectual Property */}
          <section>
            <SalmonRule />
            <SectionHeading>16. Intellectual Property</SectionHeading>

            <SubHeading>16.1 Platform Content</SubHeading>
            <Prose>
              All content on the Platform (design, logos, text, software, trademarks) is owned by Fjordanglers
              or its licensors and is protected by applicable intellectual property laws. Users may not copy,
              reproduce, distribute, or create derivative works from Platform content without prior written consent.
            </Prose>

            <SubHeading>16.2 User Content</SubHeading>
            <Prose>
              By uploading content (photos, descriptions, etc.) to the Platform, you grant Fjordanglers a
              non-exclusive, worldwide, royalty-free, sublicensable license to use, display, reproduce, and
              distribute that content for the purpose of operating, promoting, and improving the Platform.
            </Prose>
            <Prose>
              You retain ownership of your content and may remove it at any time by deleting it from your account.
              Removal terminates the license, except where the content has been shared with or relied upon by other
              Users (e.g., in completed Bookings or reviews). You represent that you own or have the right to use
              all content you upload and that it does not infringe on any third party&apos;s rights.
            </Prose>
          </section>

          <Divider />

          {/* 17. Limitation of Liability */}
          <section>
            <SalmonRule />
            <SectionHeading>17. Limitation of Liability</SectionHeading>
            <Prose>
              Fjordanglers is a marketplace platform. We do not provide fishing guide services, and we are not a
              party to the agreement between Guides and Anglers.
            </Prose>
            <WarningCard>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 f-body"
                style={{ color: '#E67E50' }}
              >
                To the maximum extent permitted by law
              </p>
              <ul className="flex flex-col gap-2.5">
                {[
                  'Fjordanglers is not liable for the quality, safety, legality, or availability of any fishing trip or Guide service.',
                  'Fjordanglers is not liable for any injury, disability, property damage, loss, or death arising from a fishing trip booked through the Platform.',
                  'Fjordanglers is not liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits or data.',
                  'Fjordanglers is not liable for any acts, omissions, or negligence of any Guide, Angler, or third party.',
                  'Fjordanglers is not liable for the accuracy of any Listing, review, or user-generated content.',
                  'Our total aggregate liability shall not exceed the greater of (a) Service Fees received from you in the 12 months preceding the claim, or (b) EUR 100.',
                ].map((item, i) => (
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
            </WarningCard>
            <Prose>
              The Platform and all content are provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
              warranties of any kind. Nothing in these Terms excludes liability that cannot be excluded under
              applicable law (including liability for fraud, gross negligence, or willful misconduct).
            </Prose>
          </section>

          <Divider />

          {/* 18. Indemnification */}
          <section>
            <SalmonRule />
            <SectionHeading>18. Indemnification</SectionHeading>
            <Prose>
              You agree to indemnify, defend, and hold harmless Fjordanglers, its owner, employees, and affiliates
              from any claims, demands, damages, losses, liabilities, or expenses (including reasonable legal fees)
              arising from or related to:
            </Prose>
            <BulletList items={[
              'Your use of the Platform.',
              'Your violation of these Terms or any applicable law.',
              'Your Listing or the Trip you provided (for Guides).',
              'Your participation in a Trip (for Anglers).',
              'Any dispute between a Guide and an Angler.',
              'Any claim by a third party related to your content or activity on the Platform.',
            ]} />
          </section>

          <Divider />

          {/* 19. Account Suspension and Termination */}
          <section>
            <SalmonRule />
            <SectionHeading>19. Account Suspension and Termination</SectionHeading>

            <SubHeading>19.1 Suspension by Fjordanglers</SubHeading>
            <Prose>
              Fjordanglers may suspend or terminate your account, at its sole discretion, if you:
            </Prose>
            <BulletList items={[
              'Violate these Terms or Community Standards.',
              'Provide false or misleading information.',
              'Engage in fraudulent or illegal activity.',
              'Receive repeated valid complaints from other Users.',
              'Fail to respond to Booking requests or communications.',
              "Engage in conduct harmful to other Users or the Platform's reputation.",
            ]} />

            <SubHeading>19.2 Effect of Termination</SubHeading>
            <Prose>Upon termination:</Prose>
            <BulletList items={[
              'Access to the Platform is revoked immediately.',
              'Pending Bookings may be cancelled with refunds to Anglers.',
              'Pending payouts will be processed according to the standard schedule, minus any applicable fees, chargebacks, or damage claims.',
              "The Guide's Listings will be removed.",
            ]} />

            <SubHeading>19.3 Account Deletion by User</SubHeading>
            <Prose>
              You may delete your account at any time by contacting{' '}
              <SLink href="mailto:contact@fjordanglers.com">contact@fjordanglers.com</SLink> or through your
              account settings. Deletion does not affect obligations arising from previous Bookings. Financial
              records will be retained as required by law.
            </Prose>
          </section>

          <Divider />

          {/* 20. Dispute Resolution */}
          <section>
            <SalmonRule />
            <SectionHeading>20. Dispute Resolution</SectionHeading>

            <SubHeading>20.1 Between Users</SubHeading>
            <Prose>
              Disputes between Guides and Anglers regarding Trips, cancellations, refunds, or damage claims
              should first be resolved directly between the parties. If unresolved, either party may submit the
              dispute to Fjordanglers at{' '}
              <SLink href="mailto:contact@fjordanglers.com">contact@fjordanglers.com</SLink> for mediation.
              Fjordanglers will review in good faith and provide a recommendation, but is not obligated to resolve
              the dispute.
            </Prose>

            <SubHeading>20.2 Between Users and Fjordanglers</SubHeading>
            <Prose>
              If you have a complaint about the Platform or our services, please contact us at{' '}
              <SLink href="mailto:contact@fjordanglers.com">contact@fjordanglers.com</SLink>. We will aim to
              resolve your complaint within 30 days.
            </Prose>

            <SubHeading>20.3 EU Online Dispute Resolution</SubHeading>
            <Prose>
              For Users residing in the European Union, the European Commission provides an Online Dispute
              Resolution (ODR) platform at{' '}
              <SLink href="https://ec.europa.eu/consumers/odr" external>
                ec.europa.eu/consumers/odr
              </SLink>. Our email for ODR purposes is:{' '}
              <SLink href="mailto:contact@fjordanglers.com">contact@fjordanglers.com</SLink>.
            </Prose>
          </section>

          <Divider />

          {/* 21. Modifications */}
          <section>
            <SalmonRule />
            <SectionHeading>21. Modifications to These Terms</SectionHeading>
            <Prose>
              We may update these Terms from time to time. We will notify registered Users of material changes
              via email at least 30 days before they take effect. Non-material changes take effect upon posting.
            </Prose>
            <Prose>
              If you do not agree with the updated Terms, you may terminate your account before the effective
              date. Continued use of the Platform after the effective date constitutes acceptance of the
              updated Terms.
            </Prose>
          </section>

          <Divider />

          {/* 22. Governing Law */}
          <section>
            <SalmonRule />
            <SectionHeading>22. Governing Law and Jurisdiction</SectionHeading>
            <Prose>
              These Terms are governed by the laws of the Republic of Poland.
            </Prose>
            <Prose>
              For Users who are consumers residing in the European Union, nothing in these Terms affects your
              rights under mandatory consumer protection laws in your country of residence. Consumers may bring
              proceedings in the courts of their country of residence.
            </Prose>
            <Prose>
              For non-consumer Users, any disputes arising from these Terms shall be resolved exclusively by
              the competent courts in Poland.
            </Prose>
          </section>

          <Divider />

          {/* 23. Consumer Right of Withdrawal */}
          <section>
            <SalmonRule />
            <SectionHeading>23. Consumer Right of Withdrawal (EU)</SectionHeading>
            <Prose>
              If you are an Angler and a consumer residing in the EU, you have the right to withdraw from a
              distance contract within 14 days without giving a reason, in accordance with Directive 2011/83/EU.
            </Prose>
            <WarningCard>
              <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.72)' }}>
                However, by booking a Trip with a specific date, you acknowledge and agree that the right of
                withdrawal does not apply to contracts for the provision of leisure services where the contract
                provides for a specific date or period of performance (Article 16(l) of Directive 2011/83/EU).
              </p>
            </WarningCard>
          </section>

          <Divider />

          {/* 24. Severability */}
          <section>
            <SalmonRule />
            <SectionHeading>24. Severability</SectionHeading>
            <Prose>
              If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions
              shall continue in full force and effect.
            </Prose>
          </section>

          <Divider />

          {/* 25. Entire Agreement */}
          <section>
            <SalmonRule />
            <SectionHeading>25. Entire Agreement</SectionHeading>
            <Prose>
              These Terms, together with the{' '}
              <SLink href="/legal/privacy-policy">Privacy Policy</SLink>,{' '}
              <SLink href="/legal/cookie-policy">Cookie Policy</SLink>, and any additional terms referenced
              herein (including Stripe&apos;s terms), constitute the entire agreement between you and Fjordanglers
              regarding the use of the Platform.
            </Prose>
          </section>

          <Divider />

          {/* 26. No Waiver */}
          <section>
            <SalmonRule />
            <SectionHeading>26. No Waiver</SectionHeading>
            <Prose>
              Fjordanglers&apos; failure to enforce any right or provision of these Terms shall not constitute
              a waiver of that right or provision.
            </Prose>
          </section>

          <Divider />

          {/* 27. Contact */}
          <section>
            <SalmonRule />
            <SectionHeading>27. Contact</SectionHeading>
            <Prose>
              For any questions regarding these Terms, please contact us:
            </Prose>
            <InfoCard>
              <ul className="flex flex-col gap-3">
                {[
                  { label: 'Email',   value: 'contact@fjordanglers.com', href: 'mailto:contact@fjordanglers.com' },
                  { label: 'Website', value: 'fjordanglers.com',          href: 'https://fjordanglers.com' },
                ].map(item => (
                  <li key={item.label} className="flex items-center gap-3 text-sm f-body">
                    <span className="font-semibold flex-shrink-0" style={{ color: '#0A2E4D', minWidth: '80px' }}>
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
          </section>

          <Divider />

          {/* Disclaimer */}
          <p
            className="text-xs f-body leading-relaxed italic"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            These Terms of Service are provided as a template and do not constitute legal advice.
            We strongly recommend having them reviewed by a qualified legal professional in Poland before publication.
          </p>

        </div>
      </main>

      <Footer />
    </div>
  )
}
