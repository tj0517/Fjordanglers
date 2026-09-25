'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { setInquiryQualified } from '@/actions/inquiries'
import type { QualifiedValue } from '@/lib/inquiries/qualified'

const OPTIONS: { value: QualifiedValue; label: string }[] = [
  { value: 'yes',     label: 'Yes'           },
  { value: 'no',      label: 'No'            },
  { value: 'unknown', label: 'Reset to auto' },
]

export function QualifiedChanger({
  inquiryId,
  currentValue,
  setBy,
}: {
  inquiryId:    string
  currentValue: QualifiedValue
  setBy:        string | null
}) {
  const router          = useRouter()
  const [pending, start] = useTransition()

  function handleClick(value: QualifiedValue) {
    if (value === currentValue) return
    start(async () => {
      await setInquiryQualified(inquiryId, value)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-[0.05em]">
          Qualified
        </span>
        {setBy != null && (
          <span className="text-[11px] text-gray-500">(set by {setBy})</span>
        )}
        {pending && <Loader2 size={12} className="animate-spin text-gray-400" />}
      </div>

      <div
        data-value={currentValue}
        className="qualified-badge inline-flex px-2.5 py-1.5 rounded-md text-[13px] font-semibold mb-1.5"
      >
        {currentValue === 'unknown' ? 'Auto (unknown)' : OPTIONS.find(o => o.value === currentValue)?.label}
      </div>

      <div className="flex flex-col gap-1">
        {OPTIONS.filter(o => o.value !== currentValue).map(opt => (
          <button
            key={opt.value}
            data-value={opt.value}
            onClick={() => handleClick(opt.value)}
            disabled={pending}
            className="qualified-option px-2.5 py-1.5 rounded-md text-xs font-medium text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
