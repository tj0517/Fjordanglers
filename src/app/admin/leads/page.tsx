import { createClient } from '@/lib/supabase/server'
import LeadActions from '@/components/admin/lead-actions'
import type { LeadStatus } from '@/actions/admin'
import { CountryFlag } from '@/components/ui/country-flag'

/**
 * /admin/leads — Lead pipeline page.
 *
 * Shows all guide applications submitted via /guides/apply.
 * For each lead the admin can:
 *   • Create a beta listing (→ /admin/guides/new?lead_id=X, form pre-filled)
 *   • Mark as contacted
 *   • Reject
 *
 * Notes column stores a JSON blob with email, bio, plan, languages, etc.
 */

export const metadata = {
  title: 'Leads — FjordAnglers Admin',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadNotes = {
  email?: string
  phone?: string | null
  city?: string | null
  years_experience?: string
  languages?: string[]
  bio?: string | null
  certifications?: string | null
  youtube?: string | null
  website?: string | null
  plan?: string
  submitted_at?: string
}

function parseNotes(raw: string | null): LeadNotes {
  if (raw == null || raw === '') return {}
  try {
    return JSON.parse(raw) as LeadNotes
  } catch {
    return {}
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  new:       { label: 'New',       bg: 'rgba(59,130,246,0.1)',  color: '#2563EB' },
  contacted: { label: 'Contacted', bg: 'rgba(217,119,6,0.1)',   color: '#D97706' },
  responded: { label: 'Responded', bg: 'rgba(139,92,246,0.1)',  color: '#7C3AED' },
  onboarded: { label: 'Onboarded', bg: 'rgba(74,222,128,0.1)',  color: '#16A34A' },
  rejected:  { label: 'Rejected',  bg: 'rgba(239,68,68,0.1)',   color: '#DC2626' },
}

const PLAN_LABELS: Record<string, string> = {
  listing:  'Listing €20/mo',
  bookable: 'Bookable 10%',
  founding: 'Founding 8%',
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminLeadsPage() {
  const supabase = await createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, country, fish_types, instagram_handle, status, notes, created_at')
    .order('created_at', { ascending: false })

  const allLeads = leads ?? []

  // ── Stats ─────────────────────────────────────────────────────────────────
  const newCount       = allLeads.filter(l => l.status === 'new').length
  const contactedCount = allLeads.filter(l => l.status === 'contacted').length
  const onboardedCount = allLeads.filter(l => l.status === 'onboarded').length
  const rejectedCount  = allLeads.filter(l => l.status === 'rejected').length

  return (
    <div className="px-10 py-10 max-w-[1100px]">

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            Admin → Leads
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            Guide <span style={{ fontStyle: 'italic' }}>Applications</span>
          </h1>
          <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
            {allLeads.length} total · <span style={{ color: '#2563EB' }}>{newCount} new</span> · {onboardedCount} onboarded
          </p>
        </div>
      </div>

      {/* ─── Pipeline stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 mb-7">
        {[
          { ...STATUS_CONFIG.new,       count: newCount },
          { ...STATUS_CONFIG.contacted, count: contactedCount },
          { ...STATUS_CONFIG.onboarded, count: onboardedCount },
          { ...STATUS_CONFIG.rejected,  count: rejectedCount },
        ].map(stat => (
          <div
            key={stat.label}
            className="px-5 py-4 rounded-2xl flex items-center justify-between"
            style={{
              background: '#FDFAF7',
              border: '1px solid rgba(10,46,77,0.07)',
              boxShadow: '0 2px 8px rgba(10,46,77,0.04)',
            }}
          >
            <div>
              <p className="text-[#0A2E4D]/40 text-[10px] uppercase tracking-[0.16em] f-body mb-1">{stat.label}</p>
              <p className="text-[#0A2E4D] text-2xl font-bold f-display leading-none">{stat.count}</p>
            </div>
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: stat.color, opacity: 0.7 }}
            />
          </div>
        ))}
      </div>

      {/* ─── Leads table ────────────────────────────────────────── */}
      <div
        style={{
          background: '#FDFAF7',
          borderRadius: '24px',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div
          className="grid px-6 py-3"
          style={{
            gridTemplateColumns: '2fr 1.2fr 1.4fr 0.8fr 2.4fr',
            borderBottom: '1px solid rgba(10,46,77,0.07)',
            background: 'rgba(10,46,77,0.02)',
          }}
        >
          {['Applicant', 'Location', 'Fish / Plan', 'Status', 'Actions'].map(col => (
            <p key={col} className="text-[10px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {col}
            </p>
          ))}
        </div>

        {allLeads.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(10,46,77,0.05)' }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="rgba(10,46,77,0.3)" strokeWidth="1.4">
                <rect x="2" y="2" width="18" height="18" rx="3" />
                <path d="M2 13h4.5l1.5 3h6l1.5-3H20" />
              </svg>
            </div>
            <p className="text-[#0A2E4D]/30 text-sm f-body">No applications yet.</p>
            <p className="text-[#0A2E4D]/22 text-xs f-body mt-1">
              Applications from /guides/apply will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.05)' }}>
            {allLeads.map(lead => {
              const notes    = parseNotes(lead.notes)
              const status   = (lead.status ?? 'new') as LeadStatus
              const sCfg     = STATUS_CONFIG[status] ?? STATUS_CONFIG.new
              const topFish  = (lead.fish_types ?? []).slice(0, 2).join(', ')
              const moreFish = (lead.fish_types ?? []).length - 2
              const planLabel = PLAN_LABELS[notes.plan ?? ''] ?? notes.plan ?? '—'
              const date     = new Date(lead.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short',
              })

              return (
                <div
                  key={lead.id}
                  className="grid items-center px-6 py-4 hover:bg-[#F8F4EE] transition-colors"
                  style={{ gridTemplateColumns: '2fr 1.2fr 1.4fr 0.8fr 2.4fr' }}
                >
                  {/* Applicant */}
                  <div className="min-w-0 pr-4">
                    <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate leading-tight">
                      {lead.name ?? '—'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {notes.email != null && notes.email !== '' && (
                        <a
                          href={`mailto:${notes.email}`}
                          className="text-[11px] f-body truncate transition-colors hover:text-[#E67E50]"
                          style={{ color: 'rgba(10,46,77,0.45)' }}
                        >
                          {notes.email}
                        </a>
                      )}
                      {lead.instagram_handle != null && lead.instagram_handle !== '' && (
                        <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                          @{lead.instagram_handle}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.28)' }}>
                      {date}
                    </p>
                  </div>

                  {/* Location */}
                  <p className="text-[#0A2E4D]/65 text-sm f-body">
                    <CountryFlag country={lead.country} /> {lead.country ?? '—'}
                  </p>

                  {/* Fish / Plan */}
                  <div className="min-w-0 pr-2">
                    <p className="text-[#0A2E4D]/60 text-xs f-body truncate">
                      {topFish !== '' ? topFish : '—'}
                      {moreFish > 0 && ` +${moreFish}`}
                    </p>
                    <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.35)' }}>
                      {planLabel}
                    </p>
                  </div>

                  {/* Status */}
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full self-start f-body"
                    style={{ background: sCfg.bg, color: sCfg.color }}
                  >
                    {sCfg.label}
                  </span>

                  {/* Actions */}
                  <LeadActions leadId={lead.id} status={status} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Info footer ────────────────────────────────────────── */}
      <div
        className="mt-5 px-5 py-4 rounded-2xl flex items-start gap-3"
        style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.06)' }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="rgba(10,46,77,0.35)" strokeWidth="1.4" className="flex-shrink-0 mt-0.5">
          <circle cx="7.5" cy="7.5" r="6" />
          <line x1="7.5" y1="5" x2="7.5" y2="8" />
          <circle cx="7.5" cy="10.5" r="0.5" fill="rgba(10,46,77,0.35)" />
        </svg>
        <p className="text-[11px] leading-relaxed f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          <strong style={{ color: 'rgba(10,46,77,0.65)' }}>Lead pipeline:</strong>{' '}
          "Create Listing" pre-fills the guide form with this application&apos;s data.
          After saving, the lead is automatically marked as <em>Onboarded</em> and a bridge
          field (<code style={{ background: 'rgba(10,46,77,0.06)', padding: '1px 5px', borderRadius: '4px' }}>invite_email</code>) is stored on the listing
          — so the guide can later claim their dashboard by registering with the same email.
        </p>
      </div>
    </div>
  )
}
