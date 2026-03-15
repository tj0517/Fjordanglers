'use client'

import { useRouter, useSearchParams } from 'next/navigation'

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
      <select
        value={sort}
        onChange={e => handleChange(e.target.value)}
        className="f-body outline-none cursor-pointer rounded-xl"
        style={{
          fontSize: '13px',
          background: 'rgba(10,46,77,0.05)',
          border: '1px solid rgba(10,46,77,0.10)',
          color: '#0A2E4D',
          padding: '6px 12px',
          fontFamily: 'inherit',
        }}
      >
        {SORT_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
