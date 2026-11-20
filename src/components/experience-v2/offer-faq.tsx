/**
 * S13 FAQ (FA-1.55) — the page's own questions.
 *
 * Like every other section: no entries, no section. The "FA vs direct" question used to be
 * appended to every page; since feedback round 1 (2026-10-13) the founders write it per page,
 * in the page's own FAQ, so the section prints only what is stored.
 *
 * `<details>` rather than React state: the accordion then works before the page hydrates and
 * is keyboard- and screen-reader-correct without any of it being written here. Both halves of
 * every entry are rendered as text — the answers are admin-typed, so no `dangerouslySetInnerHTML`.
 *
 * Drawn as the site's FAQ (2026-11 mockup): the heading on the left of a grain block, each
 * question its own frosted `.fq` block — the shared `FaqList`, not a copy.
 */

import type { FaqEntry } from '@/lib/experience-v2-content'
import { FaqList } from '@/components/site/faq'
import { Eyebrow, ON_DARK } from '@/components/site/ui'
import grain from '@/components/site/grain.module.css'

export type OfferFaqProps = { faq: FaqEntry[] }

export default function OfferFaq({ faq }: OfferFaqProps) {
  // The empty-field guard: no stored question, no section.
  if (faq.length === 0) return null

  return (
    <section
      id="faq"
      data-section="S13"
      className={`${grain.blur} ${grain.guide} mt-14 flex scroll-mt-24 flex-wrap items-start gap-x-12 gap-y-7 rounded-3xl`}
      style={{ padding: 'clamp(16px, 4vw, 48px)' }}
    >
      <div className="flex max-w-[360px] flex-[1_1_240px] flex-col gap-3.5 px-2 pt-2 sm:px-0">
        <Eyebrow dark>Good to know</Eyebrow>
        <h2 className="f-display text-[30px] font-bold leading-[1.12] tracking-[-0.01em] text-white sm:text-[36px]">Questions anglers ask</h2>
        <p className="text-[16px] leading-relaxed" style={{ color: ON_DARK }}>Answers for this trip, from the guide.</p>
      </div>
      <div className="flex min-w-0 flex-[999_1_420px]" data-testid="offer-faq">
        <FaqList entries={faq} />
      </div>
    </section>
  )
}
