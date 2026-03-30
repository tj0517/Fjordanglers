'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

const SORT_OPTIONS = [
  { value: '',              label: 'Recommended'       },
  { value: 'price-asc',    label: 'Price: Low → High' },
  { value: 'price-desc',   label: 'Price: High → Low' },
  { value: 'duration-asc', label: 'Shortest first'    },
]

export default function SortSelect() {
  const router = useRouter()
  const sp     = useSearchParams()
  const sort   = sp.get('sort') ?? ''

  function handleChange(value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set('sort', value)
    else p.delete('sort')
    router.push(`/trips?${p.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs f-body hidden sm:inline"
        style={{ color: 'rgba(10,46,77,0.4)' }}
      >
        Sort:
      </span>

      {/* Custom-styled select wrapper */}
      <div className="relative">
        <select
          value={sort}
          onChange={e => handleChange(e.target.value)}
          className="f-body cursor-pointer rounded-xl appearance-none outline-none"
          style={{
            fontSize: '13px',
            fontWeight: sort ? 600 : 400,
            background: sort ? 'rgba(10,46,77,0.09)' : 'rgba(10,46,77,0.05)',
            border: `1.5px solid ${sort ? 'rgba(10,46,77,0.22)' : 'rgba(10,46,77,0.10)'}`,
            color: sort ? '#0A2E4D' : 'rgba(10,46,77,0.55)',
            padding: '6px 32px 6px 12px',
            fontFamily: 'inherit',
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Custom chevron */}
        <div
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: sort ? '#0A2E4D' : 'rgba(10,46,77,0.4)' }}
        >
          <ChevronDown size={12} strokeWidth={1.6} />
        </div>
      </div>
    </div>
  )
}
