import Link from 'next/link'
import { getForms } from '@/actions/guide-forms'
import { Plus, ExternalLink, FileText, CheckCircle2, XCircle } from 'lucide-react'

export const metadata = {
  title: 'Intake Forms — Admin',
}

export default async function FormsPage() {
  const forms = await getForms()

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            FjordAnglers Admin
          </p>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
            Intake <span style={{ fontStyle: 'italic' }}>Forms</span>
          </h1>
          <p className="text-sm f-body mt-1.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Custom questionnaires sent to prospective guides. Shareable link, no login required.
          </p>
        </div>
        <Link
          href="/admin/forms/new"
          className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 f-body flex-shrink-0"
          style={{ background: '#E67E50' }}
        >
          <Plus size={14} strokeWidth={2} />
          New Form
        </Link>
      </div>

      {/* ── Forms list ────────────────────────────────────────────────── */}
      {forms.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-[20px]"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
        >
          <FileText size={36} style={{ color: 'rgba(10,46,77,0.2)', marginBottom: '12px' }} />
          <p className="text-base font-semibold f-display mb-1" style={{ color: '#0A2E4D' }}>
            No forms yet
          </p>
          <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Create your first intake form to share with guides.
          </p>
          <Link
            href="/admin/forms/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold f-body text-white"
            style={{ background: '#E67E50' }}
          >
            <Plus size={14} strokeWidth={2} />
            New Form
          </Link>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-[20px]"
          style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.04)' }}
        >
          <div className="divide-y" style={{ borderColor: 'rgba(10,46,77,0.06)' }}>
            {forms.map(form => (
              <div key={form.id} className="flex items-center gap-4 px-6 py-4">

                {/* Status dot */}
                <div className="flex-shrink-0">
                  {form.is_active ? (
                    <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                  ) : (
                    <XCircle size={16} style={{ color: 'rgba(10,46,77,0.25)' }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                    {form.title}
                  </p>
                  <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    {form.questions.length} question{form.questions.length !== 1 ? 's' : ''}
                    &nbsp;·&nbsp;
                    {new Date(form.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>

                {/* Response count badge */}
                <div
                  className="flex-shrink-0 text-xs font-bold f-body px-2.5 py-1 rounded-full"
                  style={{
                    background: (form.response_count ?? 0) > 0
                      ? 'rgba(10,46,77,0.08)'
                      : 'rgba(10,46,77,0.04)',
                    color: (form.response_count ?? 0) > 0
                      ? '#0A2E4D'
                      : 'rgba(10,46,77,0.3)',
                  }}
                >
                  {form.response_count ?? 0} response{(form.response_count ?? 0) !== 1 ? 's' : ''}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  <a
                    href={`${process.env.NEXT_PUBLIC_APP_URL}/guide-intake/${form.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold f-body transition-colors hover:bg-black/5"
                    style={{ color: 'rgba(10,46,77,0.5)' }}
                    title="Open public form"
                  >
                    <ExternalLink size={12} strokeWidth={1.8} />
                    Preview
                  </a>
                  <Link
                    href={`/admin/forms/${form.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold f-body transition-all hover:brightness-110"
                    style={{ background: '#0A2E4D', color: '#fff' }}
                  >
                    Manage →
                  </Link>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
