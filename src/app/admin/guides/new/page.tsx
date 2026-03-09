import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CreateGuideForm, { type GuideFormDefaults } from '@/components/admin/create-guide-form'

/**
 * Admin — Add Guide Profile page.
 *
 * Two modes:
 *   1. Blank form    — /admin/guides/new
 *   2. Pre-filled    — /admin/guides/new?lead_id=<uuid>
 *      Fetches the lead, parses notes JSON, pre-fills the form fields.
 *      After submit, createBetaGuide() marks the lead as 'onboarded' automatically.
 */

export const metadata = {
  title: 'Add Guide Profile — FjordAnglers Admin',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadNotes = {
  email?: string
  city?: string | null
  years_experience?: string
  languages?: string[]
  bio?: string | null
  youtube?: string | null
  plan?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNotes(raw: string | null): LeadNotes {
  if (raw == null || raw === '') return {}
  try {
    return JSON.parse(raw) as LeadNotes
  } catch {
    return {}
  }
}

/**
 * Convert a years-of-experience range string (e.g. "5-10") to a numeric string.
 * Takes the upper bound of the range.
 */
function yearsRangeToNumber(range: string | undefined): string {
  if (range == null || range === '') return ''
  if (range.endsWith('+')) return range.replace('+', '')
  const parts = range.split('-')
  return parts[parts.length - 1] ?? ''
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function NewBetaListingPage({
  searchParams,
}: {
  searchParams: Promise<{ lead_id?: string }>
}) {
  const { lead_id } = await searchParams

  let defaultValues: GuideFormDefaults | undefined
  let leadId: string | undefined
  let leadName: string | null = null

  // ── Pre-fill mode: fetch lead data ────────────────────────────────────────
  if (lead_id != null && lead_id !== '') {
    const supabase = await createClient()

    const { data: lead } = await supabase
      .from('leads')
      .select('id, name, country, fish_types, instagram_handle, notes, status')
      .eq('id', lead_id)
      .single()

    if (lead != null) {
      leadId   = lead.id
      leadName = lead.name

      const notes = parseNotes(lead.notes)

      defaultValues = {
        full_name:       lead.name ?? '',
        country:         lead.country ?? undefined,
        city:            notes.city ?? undefined,
        bio:             notes.bio ?? undefined,
        languages:       notes.languages ?? undefined,
        fish_expertise:  lead.fish_types ?? [],
        years_experience: yearsRangeToNumber(notes.years_experience),
        instagram_url:   lead.instagram_handle != null && lead.instagram_handle !== ''
          ? `@${lead.instagram_handle}`
          : undefined,
        youtube_url:     notes.youtube ?? undefined,
        invite_email:    notes.email ?? undefined,
        pricing_model:   (notes.plan === 'flat_fee' ? 'flat_fee' : 'commission'),
      }
    }
  }

  const isFromLead = leadId != null

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
        {isFromLead ? (
          <>
            <Link
              href="/admin/leads"
              className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              Leads
            </Link>
            <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
            <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {leadName ?? 'Lead'}
            </span>
            <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
          </>
        ) : (
          <>
            <Link
              href="/admin/guides"
              className="text-xs f-body transition-colors hover:text-[#0A2E4D]/70"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              Guides
            </Link>
            <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
          </>
        )}
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#E67E50" strokeWidth="1.8">
              <circle cx="6" cy="5.5" r="2.5" />
              <path d="M1 13c0-2.8 2.2-5 5-5s5 2.2 5 5" />
              <line x1="10.5" y1="2" x2="10.5" y2="7" />
              <line x1="8" y1="4.5" x2="13" y2="4.5" />
            </svg>
          </div>
          <p className="text-[11px] uppercase tracking-[0.22em] f-body font-semibold" style={{ color: '#E67E50' }}>
            {isFromLead ? 'From Lead Application' : 'Guide Profile'}
          </p>
        </div>

        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
          {isFromLead && leadName != null
            ? <>Create listing for <span style={{ fontStyle: 'italic' }}>{leadName}</span></>
            : <>Add a guide <span style={{ fontStyle: 'italic' }}>profile</span></>
          }
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm f-body leading-relaxed" style={{ maxWidth: '560px' }}>
          {isFromLead
            ? 'Form pre-filled with the guide\'s application data. Review, add photos, then publish. The lead will be marked as Onboarded automatically.'
            : 'Manually add a guide to the public marketplace without requiring them to sign up. The profile goes live immediately.'
          }
        </p>

        {/* Info pills */}
        <div className="flex flex-wrap items-center gap-3 mt-5">
          {[
            { icon: '⚡', text: 'Goes live immediately' },
            { icon: '🔒', text: 'No guide account needed' },
            isFromLead
              ? { icon: '🌉', text: 'Guide can claim profile later' }
              : { icon: '✏️', text: 'Editable after creation' },
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
      <CreateGuideForm defaultValues={defaultValues} leadId={leadId} />

    </div>
  )
}
