import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/layout/nav'
import { SiteFooter } from '@/components/layout/footer'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that apply when you send an inquiry or book a guided fishing trip through FjordAnglers.',
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


const OPERATOR = [
  { label: 'Business',  value: 'FjordAnglers — Tymon Jezionek (sole proprietorship, CEIDG)' },
  { label: 'NIP',       value: '5833564870' },
  { label: 'REGON',     value: '544350813' },
  { label: 'Address',   value: 'Otwarta 38b/11, 80-169 Gdańsk, Poland' },
  { label: 'Email',     value: 'contact@fjordanglers.com', href: 'mailto:contact@fjordanglers.com' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TermsOfServicePage() {
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
          Terms of <span style={{ fontStyle: 'italic' }}>Service</span>
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

          {/* 1. Who we are */}
          <section>
            <SalmonRule />
            <SectionHeading>1. Who We Are and What These Terms Cover</SectionHeading>
            <Prose>
              FjordAnglers (&ldquo;FjordAnglers&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a booking agency for
              guided fishing trips. We are a sole proprietorship registered in Poland and operate the website{' '}
              <SLink href={SITE_URL} external>fjordanglers.com</SLink>.
            </Prose>
            <InfoCard>
              <ul className="flex flex-col gap-2.5">
                {OPERATOR.map(item => (
                  <li key={item.label} className="flex items-start gap-3 text-sm f-body">
                    <span className="font-semibold flex-shrink-0" style={{ color: '#0A2E4D', minWidth: '80px' }}>
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
              These Terms apply to anyone who sends us an inquiry or books a trip through us (&ldquo;you&rdquo;,
              the &ldquo;Angler&rdquo;). Guides who work with us are covered by a separate partner cooperation
              agreement; these Terms do not replace it.
            </Prose>
            <WarningCard>
              <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.72)' }}>
                By sending an inquiry or paying a deposit, you accept these Terms. The version in force on the day
                you pay your deposit applies to that booking.
              </p>
            </WarningCard>
          </section>

          <Divider />

          {/* 2. Our role */}
          <section>
            <SalmonRule />
            <SectionHeading>2. Our Role</SectionHeading>
            <Prose>
              We take your inquiry, find a guide who fits it, prepare an offer together with that guide and in the
              guide&apos;s name, arrange the booking and put you and the guide in touch. For this booking service we
              charge a fee, collected as the deposit described in Section 5.
            </Prose>
            <Prose>
              The fishing trip itself is provided by the guide. When your booking is confirmed, the contract for the
              trip is made directly between you and the guide. Guides are independent businesses — not our
              employees or agents.
            </Prose>
            <SubHeading>FjordAnglers is not:</SubHeading>
            <BulletList items={[
              'A fishing guide service, outfitter or tour operator.',
              'An organiser of package travel — each booking is with one guide, and we do not combine services from different providers into a package.',
              'An insurer or a provider of safety guarantees.',
              'A payment institution — we never collect or hold the guide’s price on the guide’s behalf.',
            ]} />
          </section>

          <Divider />

          {/* 3. Definitions */}
          <section>
            <SalmonRule />
            <SectionHeading>3. Definitions</SectionHeading>
            <InfoCard>
              <ul className="flex flex-col gap-3">
                {[
                  { term: 'Inquiry', def: 'your request for a trip, sent through our website, by email or by another channel.' },
                  { term: 'Guide', def: 'the independent guide, camp or outfitter who provides the Trip.' },
                  { term: 'Offer', def: 'the proposal we send you for a specific Trip, prepared with and on behalf of the Guide.' },
                  { term: 'Trip', def: 'the guided fishing service described in the Offer.' },
                  { term: 'Guide’s Price', def: 'the part of the total price that you pay directly to the Guide.' },
                  { term: 'Deposit', def: 'the amount you pay to FjordAnglers to confirm the booking. The Deposit is our booking fee.' },
                  { term: 'Booking', def: 'a Trip confirmed by the Guide for a specific date and secured by a paid Deposit.' },
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

          {/* 4. How booking works */}
          <section>
            <SalmonRule />
            <SectionHeading>4. How Booking Works</SectionHeading>

            <SubHeading>4.1 Inquiry</SubHeading>
            <Prose>
              You do not need an account. You send us an Inquiry with your dates, group size and what you are
              looking for. To prepare an Offer we share the trip details of your Inquiry with one or more Guides.
              You must be at least 18 years old to send an Inquiry or make a Booking.
            </Prose>

            <SubHeading>4.2 Offer</SubHeading>
            <Prose>
              The Offer describes the Trip, the total price, what is and is not included, the Deposit and how and
              when the Guide&apos;s Price is paid. Prices we mention before the Offer are indicative. Trip titles and
              descriptions on our website are examples; the Offer is what we agree on. An Offer does not reserve a
              date until the Guide has confirmed it.
            </Prose>

            <SubHeading>4.3 Confirmation</SubHeading>
            <Prose>
              We send you the Deposit payment link only after the Guide has confirmed the date. Your Booking is
              confirmed when the Deposit is paid. After that we send you the Guide&apos;s contact details and send the
              Guide yours.
            </Prose>

            <SubHeading>4.4 Your Booking Party</SubHeading>
            <Prose>
              The person who makes the Booking is responsible for everyone in their group: that each person meets
              the requirements stated in the Offer, follows the Guide&apos;s instructions and complies with these
              Terms.
            </Prose>
          </section>

          <Divider />

          {/* 5. Prices and payments */}
          <section>
            <SalmonRule />
            <SectionHeading>5. Prices and Payments</SectionHeading>
            <BulletList items={[
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Deposit to FjordAnglers.</span> The Deposit amount is stated in the Offer and is part of the total price. It is our fee for the booking service. You pay it online through Stripe Checkout to FjordAnglers&apos; own account.</>,
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Guide&apos;s Price to the Guide.</span> You pay the rest of the price directly to the Guide, by the method and on the schedule stated in the Offer or agreed with the Guide. Some Guides take their own advance payment; where they do, the Offer says so.</>,
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Currency.</span> The Offer states the currency. If your card is in another currency, your bank or card issuer&apos;s exchange rate and fees apply.</>,
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>What is not included.</span> Unless the Offer says otherwise, fishing licences, travel to the meeting point, accommodation, food and tips are not included.</>,
            ]} />
            <Prose>
              Payments to us are processed by Stripe, under{' '}
              <SLink href="https://stripe.com/legal" external>Stripe&apos;s terms</SLink>. If you need an invoice for
              your Deposit, write to us.
            </Prose>
          </section>

          <Divider />

          {/* 6. Cancellations and refunds */}
          <section>
            <SalmonRule />
            <SectionHeading>6. Cancellations and Refunds</SectionHeading>

            <SubHeading>6.1 If you cancel</SubHeading>
            <Prose>
              Once the Guide has confirmed the date and you have paid, the Deposit is non-refundable, because our
              booking work is done at that point. What happens to the Guide&apos;s Price is governed by the Guide&apos;s
              cancellation terms stated in the Offer or agreed with the Guide. If you want to change dates, tell us
              as early as possible — we will ask the Guide whether the Booking can be moved, but we cannot
              guarantee it.
            </Prose>

            <SubHeading>6.2 If the Guide cancels</SubHeading>
            <Prose>
              If the Guide cancels a confirmed Booking or cannot provide the Trip, we refund your Deposit in full,
              and the Guide refunds anything you paid to them. If you prefer, we can instead try to find you
              another Guide or another date.
            </Prose>

            <SubHeading>6.3 Weather and safety</SubHeading>
            <BulletList items={[
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Unsafe conditions:</span> the Guide decides whether conditions are safe. If the Guide cancels a Trip for safety reasons (for example storms, dangerous water, flooding), you get a full refund of the Deposit, or a new date if you prefer.</>,
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Poor but safe conditions:</span> rain, wind, coloured water or poor catches are part of fishing and do not entitle you to a refund.</>,
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Shortened trips:</span> if a Trip is cut short for safety reasons, any partial refund or extra time is up to the Guide.</>,
              <><span className="font-semibold" style={{ color: '#0A2E4D' }}>Trip-specific terms:</span> some Offers and trip pages include their own weather terms. Where they do, they apply in addition to this section.</>,
            ]} />

            <SubHeading>6.4 Extraordinary events</SubHeading>
            <Prose>
              If the Trip cannot take place because of events beyond anyone&apos;s reasonable control — natural
              disasters, official travel restrictions, regional emergencies — we refund your Deposit in full.
            </Prose>

            <SubHeading>6.5 How refunds are paid</SubHeading>
            <Prose>
              Refunds of the Deposit go back through Stripe to the original payment method, in the currency you
              paid. Processing times depend on your bank. Refunds of the Guide&apos;s Price are made by the Guide.
            </Prose>
          </section>

          <Divider />

          {/* 7. Risk and insurance */}
          <section>
            <SalmonRule />
            <SectionHeading>7. Risk and Insurance</SectionHeading>
            <Prose>
              Fishing trips involve real risks: weather, cold water, boats, wading, slippery ground, hooks, remote
              locations far from medical help, and wildlife. You take part voluntarily and are responsible for
              judging your own fitness and experience. Tell the Guide about any medical condition, allergy or
              physical limitation before the Trip.
            </Prose>
            <Prose>
              We strongly recommend travel and health insurance that covers outdoor and water-based activities.
              Neither we nor the Guide cover medical, evacuation or repatriation costs.
            </Prose>
          </section>

          <Divider />

          {/* 8. Responsibilities */}
          <section>
            <SalmonRule />
            <SectionHeading>8. Responsibilities</SectionHeading>

            <SubHeading>8.1 Yours</SubHeading>
            <BulletList items={[
              'Give us accurate information in your Inquiry — dates, group size, experience.',
              'Hold valid fishing licences for everyone in your group, unless the Offer says they are included.',
              'Arrive on time and follow the Guide’s safety instructions at all times.',
              'Respect local fishing rules, catch-and-release regulations and the environment.',
              'Pay for any damage your group causes to the Guide’s equipment, boat or property beyond normal wear.',
            ]} />

            <SubHeading>8.2 The Guide&apos;s</SubHeading>
            <Prose>
              The Guide is responsible for providing the Trip as described in the Offer, for holding the licences,
              permits and insurance their work requires, and for the safety of the Trip. We choose the Guides we
              work with carefully, but we do not inspect their licences, insurance, boats or equipment, and we do
              not guarantee them.
            </Prose>
          </section>

          <Divider />

          {/* 9. Communication */}
          <section>
            <SalmonRule />
            <SectionHeading>9. How We Communicate</SectionHeading>
            <Prose>
              We contact you about your Inquiry and Booking by email and, if you give us your number, by phone, SMS
              or WhatsApp. Some of our replies are prepared, and some first replies sent, with the help of AI tools;
              offers and bookings are handled by our team. Before your Trip we may contact you to help with
              logistics and to confirm the details.
            </Prose>
          </section>

          <Divider />

          {/* 10. Reviews */}
          <section>
            <SalmonRule />
            <SectionHeading>10. Reviews</SectionHeading>
            <Prose>
              After your Trip we may send you a link to review it. Reviews must be honest and based on your actual
              experience. We publish a review on fjordanglers.com, with your first name, country and photos, only if
              you agree to it in the review form. We may decline to publish or remove reviews that are abusive,
              fraudulent, contain personal data or are unrelated to the Trip. We may also invite you to review us on
              external sites such as Trustpilot; those reviews are governed by that site&apos;s terms.
            </Prose>
          </section>

          <Divider />

          {/* 11. Intellectual property */}
          <section>
            <SalmonRule />
            <SectionHeading>11. Intellectual Property</SectionHeading>
            <Prose>
              The content of our website (texts, design, logos, photos) belongs to FjordAnglers or its licensors and
              may not be copied without our written consent. Content you send us — such as review texts and photos
              — remains yours; you allow us to use it for the purposes you agreed to.
            </Prose>
          </section>

          <Divider />

          {/* 12. Liability */}
          <section>
            <SalmonRule />
            <SectionHeading>12. Limitation of Liability</SectionHeading>
            <Prose>
              We are responsible for our own booking service. We are not a party to the contract for the Trip.
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
                  'We are not liable for the quality, safety, legality or performance of the Trip, or for the acts or omissions of the Guide.',
                  'We are not liable for injury, illness, loss or damage arising during the Trip.',
                  'We are not liable for indirect or consequential losses, such as missed flights, accommodation or other travel costs.',
                  'Our total liability to you is limited to the greater of (a) the Deposits you paid us in the 12 months before the claim, or (b) EUR 100.',
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
              Nothing in these Terms limits liability that cannot be limited by law, including for fraud, gross
              negligence or wilful misconduct, or your mandatory rights as a consumer.
            </Prose>
          </section>

          <Divider />

          {/* 13. Complaints */}
          <section>
            <SalmonRule />
            <SectionHeading>13. Complaints and Disputes</SectionHeading>
            <Prose>
              If something goes wrong, write to us at{' '}
              <SLink href="mailto:contact@fjordanglers.com">contact@fjordanglers.com</SLink> with your booking
              details. We reply to complaints within 30 days. If you have a dispute with the Guide about the Trip,
              tell us — we will help you and the Guide reach a solution, although the decision on the Trip itself
              rests with the Guide.
            </Prose>
          </section>

          <Divider />

          {/* 14. Withdrawal */}
          <section>
            <SalmonRule />
            <SectionHeading>14. Consumer Right of Withdrawal (EU)</SectionHeading>
            <Prose>
              Consumers in the EU generally have 14 days to withdraw from a distance contract without giving a
              reason (Directive 2011/83/EU).
            </Prose>
            <WarningCard>
              <p className="text-sm f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.72)' }}>
                This right does not apply to services related to leisure activities where the contract provides for
                a specific date or period of performance (Article 16(l) of Directive 2011/83/EU). Every Booking is
                made for a specific date, so cancellations are governed by Section 6.
              </p>
            </WarningCard>
          </section>

          <Divider />

          {/* 15. Law */}
          <section>
            <SalmonRule />
            <SectionHeading>15. Governing Law and Jurisdiction</SectionHeading>
            <Prose>
              These Terms are governed by Polish law. If you are a consumer, you keep the protection of the mandatory
              consumer laws of your country of residence and may bring proceedings in its courts. Disputes with
              non-consumers are resolved by the competent courts in Poland.
            </Prose>
          </section>

          <Divider />

          {/* 16. Changes and final provisions */}
          <section>
            <SalmonRule />
            <SectionHeading>16. Changes and Final Provisions</SectionHeading>
            <Prose>
              We may update these Terms. Changes do not affect Bookings whose Deposit was paid before the change.
              If any provision is found invalid, the rest remains in force. These Terms, the Offer, our{' '}
              <SLink href="/legal/privacy-policy">Privacy Policy</SLink> and{' '}
              <SLink href="/legal/cookie-policy">Cookie Policy</SLink> together form the agreement between you and
              FjordAnglers. If the Offer and these Terms differ, the Offer prevails for that Booking.
            </Prose>
          </section>

          <Divider />

          {/* 17. Contact */}
          <section>
            <SalmonRule />
            <SectionHeading>17. Contact</SectionHeading>
            <Prose>
              Questions about these Terms or your Booking:{' '}
              <SLink href="mailto:contact@fjordanglers.com">contact@fjordanglers.com</SLink>.
            </Prose>
          </section>

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
