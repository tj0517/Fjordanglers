import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { NewFormClient } from './NewFormClient'

export const metadata = {
  title: 'New Intake Form — Admin',
}

export default function NewFormPage() {
  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[760px]">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <Link
          href="/admin/forms"
          className="inline-flex items-center gap-1.5 text-xs f-body mb-5 transition-colors hover:opacity-70"
          style={{ color: 'rgba(10,46,77,0.45)' }}
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          All Forms
        </Link>
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          FjordAnglers Admin
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
          New Intake <span style={{ fontStyle: 'italic' }}>Form</span>
        </h1>
        <p className="text-sm f-body mt-1.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Design a questionnaire to send to prospective guides. You&apos;ll get a shareable link once saved.
        </p>
      </div>

      <NewFormClient />

    </div>
  )
}
