/**
 * FAQ with each question in its own frosted block (`.fq` in the mockups): a numbered `<details>`
 * per entry, the first one open. The caller puts it on a grain block, next to its heading.
 */

import { SALMON } from './ui'
import s from './grain.module.css'

export type FaqEntry = { question: string; answer: string }

export function FaqList({ entries }: { entries: readonly FaqEntry[] }) {
  return (
    <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-3">
      {entries.map((entry, i) => (
        <details key={entry.question} className={s.fq} open={i === 0}>
          <summary className="flex min-h-[76px] items-center gap-[18px]" style={{ padding: '14px 18px 14px 24px' }}>
            <span aria-hidden="true" className="f-display w-[34px] flex-none" style={{ fontWeight: 600, fontSize: 20, color: SALMON }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="f-display flex-[1_1_auto]" style={{ fontWeight: 600, fontSize: 20, lineHeight: 1.25 }}>{entry.question}</span>
            <span aria-hidden="true" className={`${s.fqIcon} flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full`}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
            </span>
          </summary>
          <p className={`${s.fqAnswer} f-body m-0 text-[16.5px]`} style={{ padding: '0 76px 24px 76px', lineHeight: 1.65 }}>{entry.answer}</p>
        </details>
      ))}
    </div>
  )
}
