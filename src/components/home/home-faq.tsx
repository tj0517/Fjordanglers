'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: 'How does the booking process work?',
    a: "You send us a short request — where you want to fish, when, how many in your group, and what species you're after. We read every request ourselves, check with the right guide, and come back to you with a concrete offer. Once you confirm, dates are locked. It usually takes 24–48 hours. No automated funnels.",
  },
  {
    q: 'How much does a guided trip cost?',
    a: "Trips typically run from around €200 for a half-day session to €1,200+ for multi-day expeditions. Most full-day guided days land between €300–600 per person depending on the guide, the river, and group size. You'll see the full number before you commit — no surprises.",
  },
  {
    q: "What's included and what isn't?",
    a: "Included: the guide, their local knowledge, and usually fishing gear (rods, reels, flies or lures — confirm per trip). Not included: your flights, accommodation, and fishing permits. Your guide handles the permit for the beat you'll fish — we'll give you the full picture in your trip brief before you arrive.",
  },
  {
    q: 'How do fishing permits work?',
    a: "Depends on the country. In Iceland the licence is often the biggest part of the price. In Chile Alex includes it. Every offer lists it as a separate line so you can see it.",
  },
  {
    q: 'Do I need to bring my own gear?',
    a: "No. Most of our guides provide rods, reels, and flies. If you have your own kit and prefer to use it, great — just mention it when you send your request.",
  },
  {
    q: "Can I bring my partner or a friend who doesn't fish?",
    a: "Yes. Iceland, Norway, Sweden, Finland, Argentina, Chile and New Zealand are worth the trip even without a rod. Non-fishing companions are welcome on most trips, just mention it when you enquire so the guide can plan the day accordingly.",
  },
  {
    q: 'What if the weather or water conditions are bad?',
    a: "Depends on where you go. Iceland and Norway fish from May to September, Patagonia and New Zealand from November to April. Your guide picks the water for the day; if a day is not fishable he tells you the evening before and proposes another day or another river.",
  },
  {
    q: 'Who do I pay — you or the guide?',
    a: "You pay a booking fee to us when you confirm — that's our commission, handled securely via Stripe. The trip price itself is paid directly to your guide. We'll send you full payment instructions when the booking is locked.",
  },
  {
    q: 'What languages do you speak?',
    a: "Polish, English, and German. Every inquiry is read and answered by a real person — not a bot. We reply within 24 hours.",
  },
  {
    q: "You're based in Poland. Why should I trust a Polish company for Nordic fishing?",
    a: "Iceland, Norway, Sweden, Finland, Argentina, Chile and New Zealand. A country appears here only after we have a guide there we have met.",
  },
]

export function HomeFaq() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="divide-y" style={{ borderTop: '1px solid rgba(10,46,77,0.09)', borderBottom: '1px solid rgba(10,46,77,0.09)' }}>
      {FAQS.map((faq, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-start justify-between gap-6 py-6 text-left"
          >
            <span
              className="f-body font-semibold"
              style={{ fontSize: '15px', color: '#0A2E4D', lineHeight: 1.5 }}
            >
              {faq.q}
            </span>
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-200"
              style={{
                background: open === i ? '#E67E50' : 'rgba(10,46,77,0.08)',
                transform: open === i ? 'rotate(45deg)' : 'none',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke={open === i ? '#fff' : '#0A2E4D'} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          </button>
          {open === i && (
            <p
              className="f-body pb-6 pr-10"
              style={{ fontSize: '14px', color: 'rgba(10,46,77,0.58)', lineHeight: 1.85 }}
            >
              {faq.a}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
