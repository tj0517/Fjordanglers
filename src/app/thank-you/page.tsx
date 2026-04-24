import Link from 'next/link'
import { HomeNav } from '@/components/home/home-nav'
import { Footer } from '@/components/layout/footer'

export const metadata = {
  title: 'Thanks — FjordAnglers',
  description: 'Your trip plan is with us. We\'ll be in touch within 24 hours.',
}

export default function ThankYouPage() {
  return (
    <>
      <HomeNav pinned initialVariant="light" />

      <main

        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#F3EDE4', paddingTop: '90px' }}
      >
        <div className="w-full max-w-xl text-center py-16">

          {/* Icon */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
            style={{ background: 'rgba(230,126,80,0.12)' }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14L11 20L23 8" stroke="#E67E50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Heading */}
          <h1
            className="f-display text-[40px] md:text-[52px] font-bold mb-4 leading-tight"
            style={{ color: '#0A2E4D' }}
          >
            Got it.
          </h1>
          <p
            className="f-body text-[17px] md:text-[19px] mb-3 leading-relaxed"
            style={{ color: '#0A2E4D' }}
          >
            Your trip plan is with us.
          </p>
          <p
            className="f-body text-[15px] mb-10 leading-relaxed"
            style={{ color: 'rgba(10,46,77,0.55)' }}
          >
            A real person — not a bot — reads every inquiry. We'll reply within 24 hours with options, availability, and honest advice.
          </p>

          {/* Expectation box */}
          <div
            className="rounded-2xl p-6 mb-10 text-left"
            style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.08)' }}
          >
            <p
              className="f-body text-[12px] font-semibold uppercase tracking-[0.1em] mb-4"
              style={{ color: '#E67E50' }}
            >
              What happens next
            </p>
            <ol className="flex flex-col gap-3">
              {[
                { step: '1', text: 'We review your trip plan and match it with the right guides and locations.' },
                { step: '2', text: 'We get back to you within 24 hours — often much sooner.' },
                { step: '3', text: 'You receive curated options with real availability and honest pricing.' },
              ].map(({ step, text }) => (
                <li key={step} className="flex items-start gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 f-body text-[12px] font-bold mt-0.5"
                    style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
                  >
                    {step}
                  </span>
                  <span className="f-body text-[14px] leading-relaxed" style={{ color: 'rgba(10,46,77,0.7)' }}>
                    {text}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/trips"
              className="px-6 py-3 rounded-xl f-body text-[15px] font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#E67E50' }}
            >
              Browse all trips →
            </Link>
            <Link
              href="/"
              className="px-6 py-3 rounded-xl f-body text-[15px] font-medium transition-all hover:opacity-80"
              style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
            >
              Back to home
            </Link>
          </div>

          {/* Social proof */}
          <p
            className="f-body text-[13px] mt-10"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            Already have questions? Email us directly at{' '}
            <a
              href="mailto:contact@fjordanglers.com"
              className="underline transition-colors hover:opacity-70"
              style={{ color: 'rgba(10,46,77,0.55)' }}
            >
              contact@fjordanglers.com
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
