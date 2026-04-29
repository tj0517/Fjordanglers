'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: 'How much does a guided fishing trip cost?',
    a: 'Trips range from €200 for a half-day river session to €1,200+ for multi-day expeditions. The price depends on the guide, location, duration, and group size. We show exact pricing on every trip page — no hidden extras.',
  },
  {
    q: "What's included and what isn't?",
    a: "Included: the guide, local knowledge, equipment recommendations, and often gear itself (ask per trip). Not included: flights, accommodation, and fishing licences in some regions (we handle Norwegian licences for you).",
  },
  {
    q: "Can I bring my partner or a friend who doesn't fish?",
    a: "Yes. Nordic nature is extraordinary on its own. Non-fishing companions are welcome on most trips — just let us know when you enquire so the guide can plan accordingly.",
  },
  {
    q: 'Do I need to bring my own gear?',
    a: "No. Most of our guides provide rods, reels, and flies. If you have your own kit and prefer to use it, that's great too — just mention it in your enquiry.",
  },
  {
    q: 'How does the fishing licence work in Norway?',
    a: 'We sort it. Norwegian river licences are bought per stretch of water and per day. Your guide handles the paperwork — you just show up and cast.',
  },
  {
    q: 'What if the weather ruins the trip?',
    a: "Weather is part of fishing in Scandinavia. Our guides know how to adapt — different spots, different techniques. If a trip genuinely can't happen due to extreme conditions, we work with the guide to reschedule at no extra cost.",
  },
  {
    q: 'Who do I pay — you or the guide?',
    a: 'You pay us, securely via Stripe. We handle the booking fee and the rest is settled directly with your guide. Your money is always protected.',
  },
  {
    q: "You're based in Poland. Why should I trust a Polish company for Nordic fishing?",
    a: "Because we're the anglers who kept flying to Norway and couldn't find a service we'd trust ourselves. We built FjordAnglers out of that frustration. We know the guides personally — and we know what it's like to be in your shoes.",
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
