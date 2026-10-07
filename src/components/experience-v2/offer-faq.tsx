/**
 * S13 FAQ (FA-1.55) — the page's own questions plus one that is on every offer page.
 *
 * The fixed question is the one every angler asks and nobody asks us directly: whether
 * booking through FA costs more than going to the guide. Its answer is **not written yet**
 * (tj 2026-10-07): `FA_VS_DIRECT_ANSWER` is a placeholder, and the real copy lands before
 * FA-1.57 — see docs/deferred-tasks.md. It is exported so the test and the pilot checklist
 * can assert that the placeholder is gone, rather than someone grepping the page by eye.
 *
 * `<details>` rather than React state: the accordion then works before the page hydrates and
 * is keyboard- and screen-reader-correct without any of it being written here. Both halves of
 * every entry are rendered as text — the answers are admin-typed, so no `dangerouslySetInnerHTML`.
 */

import type { FaqEntry } from '@/lib/experience-v2-content'
import OfferSection from './offer-section'
import { mutedStyle } from './offer-box'

/** Placeholder. Replace with tj's copy before the v2 pilot (FA-1.57). */
export const FA_VS_DIRECT_ANSWER = '[FA vs direct — answer from tj]'

export const FA_VS_DIRECT_QUESTION = 'Booking through FjordAnglers vs directly with the guide — what is the difference?'

export type OfferFaqProps = { faq: FaqEntry[] }

function Entry({ question, answer }: FaqEntry) {
  return (
    <details
      className="border-b py-3"
      style={{ borderColor: 'rgba(10,46,77,0.14)' }}
    >
      <summary
        className="flex cursor-pointer items-center justify-between gap-3 text-[15px] font-semibold marker:content-none [&::-webkit-details-marker]:hidden"
        style={{ minHeight: 32 }}
      >
        {question}
        <span aria-hidden className="flex-none text-lg font-normal">+</span>
      </summary>
      <p className="mt-2 whitespace-pre-line text-[15px]" style={mutedStyle}>
        {answer}
      </p>
    </details>
  )
}

export default function OfferFaq({ faq }: OfferFaqProps) {
  // The fixed question is always there, so — unlike every other section — S13 never
  // disappears: "is this more expensive than going direct?" is asked on every page.
  const entries: FaqEntry[] = [
    ...faq,
    { question: FA_VS_DIRECT_QUESTION, answer: FA_VS_DIRECT_ANSWER },
  ]

  return (
    <OfferSection section="S13" anchor="faq" title="Questions anglers ask" accordion={{ defaultOpen: true }}>
      <div data-testid="offer-faq" className="border-t" style={{ borderColor: 'rgba(10,46,77,0.14)' }}>
        {entries.map((entry, i) => <Entry key={`${i}-${entry.question}`} {...entry} />)}
      </div>
    </OfferSection>
  )
}
