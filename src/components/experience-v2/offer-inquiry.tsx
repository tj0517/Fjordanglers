/**
 * S14 "Check availability" (FA-1.55) — the end of the page, and step 1 of 3 of the form.
 *
 * The section is a frame; the form itself is `InquiryInline`, which shares its state with the
 * full-screen wizard every CTA above opens. `#zapytanie` is the anchor FA-1.53 wired the top
 * bar, the hero CTA and the sticky widget to, so it stays as it is.
 *
 * No accordion: the one section the whole page leads to is never collapsed.
 *
 * Drawn as the 2026-11 mockup's flat navy block. The mockup puts the heading beside the form;
 * here it sits above it, because the form carries its own "your trip so far" column from `md`
 * up and beside a heading the fields would get under 300 px.
 */

import { InquiryInline } from '@/components/inquiry-wizard/inquiry-wizard'
import { Eyebrow, NAVY, ON_DARK_SOFT } from '@/components/site/ui'

export default function OfferInquiry() {
  return (
    <section
      id="zapytanie"
      data-section="S14"
      className="mt-14 flex scroll-mt-24 flex-col gap-7 rounded-3xl"
      style={{ background: NAVY, padding: 'clamp(16px, 4vw, 48px)' }}
    >
      <div className="flex max-w-[560px] flex-col gap-3 px-2 pt-2 sm:px-0 sm:pt-0">
        <Eyebrow dark>Next step</Eyebrow>
        <h2 className="f-display text-[30px] font-bold leading-[1.12] tracking-[-0.01em] text-white sm:text-[36px]">Send your inquiry</h2>
        <p className="text-[16px] leading-relaxed" style={{ color: ON_DARK_SOFT }}>Two minutes, free, no obligation.</p>
      </div>
      <InquiryInline />
    </section>
  )
}
