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
 */

import type { FaqEntry } from '@/lib/experience-v2-content'
import OfferSection from './offer-section'
import { mutedStyle } from './offer-box'

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

/** The questions themselves, without the section frame — the country hub uses it too (FA-1.65). */
export function FaqList({ faq }: OfferFaqProps) {
  return (
    <div data-testid="offer-faq" className="border-t" style={{ borderColor: 'rgba(10,46,77,0.14)' }}>
      {faq.map((entry, i) => <Entry key={`${i}-${entry.question}`} {...entry} />)}
    </div>
  )
}

export default function OfferFaq({ faq }: OfferFaqProps) {
  // The empty-field guard: no stored question, no section.
  if (faq.length === 0) return null

  return (
    <OfferSection section="S13" anchor="faq" eyebrow="Good to know" title="Questions anglers ask" accordion={{ defaultOpen: true }}>
      <FaqList faq={faq} />
    </OfferSection>
  )
}
