import Link from 'next/link'
import CreateGuideForm from '@/components/admin/create-guide-form'
import { UserPlus } from 'lucide-react'

/**
 * Admin — Add Guide Profile page (/admin/guides/new).
 */

export const metadata = {
  title: 'Add Guide Profile — FjordAnglers Admin',
}

export default function NewBetaListingPage() {
  return (
    <div className="px-10 py-10 max-w-[840px]">

      {/* ─── Breadcrumb ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8">
        <Link
          href="/admin"
          className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Admin
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link
          href="/admin/guides"
          className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Guides
        </Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#E67E50' }}>
          Add Guide Profile
        </span>
      </div>

      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(230,126,80,0.12)', border: '1px solid rgba(230,126,80,0.2)' }}
          >
            <UserPlus width={14} height={14} stroke="#E67E50" strokeWidth={1.8} />
          </div>
          <p className="text-[11px] uppercase tracking-[0.22em] f-body font-semibold" style={{ color: '#E67E50' }}>
            Guide Profile
          </p>
        </div>

        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
          Add a guide <span style={{ fontStyle: 'italic' }}>profile</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm f-body leading-relaxed" style={{ maxWidth: '560px' }}>
          Manually add a guide to the public site without requiring them to sign up. The profile goes live immediately.
        </p>

        {/* Info pills */}
        <div className="flex flex-wrap items-center gap-3 mt-5">
          {[
            { icon: '⚡', text: 'Goes live immediately' },
            { icon: '🔒', text: 'No guide account needed' },
            { icon: '✏️', text: 'Editable after creation' },
          ].map(pill => (
            <span
              key={pill.text}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full f-body"
              style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)' }}
            >
              <span>{pill.icon}</span>
              {pill.text}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Form ─────────────────────────────────────────────────── */}
      <CreateGuideForm />

    </div>
  )
}
