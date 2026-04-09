'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold f-body transition-colors hover:bg-[rgba(10,46,77,0.06)] flex-1"
      style={{
        background: 'transparent',
        border:     '1.5px solid rgba(10,46,77,0.15)',
        color:      '#0A2E4D',
      }}
    >
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Print receipt
    </button>
  )
}
