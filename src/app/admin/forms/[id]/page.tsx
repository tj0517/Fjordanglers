import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react'
import { getFormById } from '@/actions/guide-forms'
import { FormEditorClient } from './FormEditorClient'
import { CopyLinkButton } from './CopyLinkButton'
import type { FormQuestion, GuideIntakeResponse } from '@/actions/guide-forms'

export const metadata = {
  title: 'Intake Form — Admin',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getFormById(id)

  if (data == null) notFound()

  const { form, responses } = data
  const formUrl = `${process.env.NEXT_PUBLIC_APP_URL}/guide-intake/${form.token}`

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-10 max-w-[1100px]">

      {/* ── Back link ─────────────────────────────────────────────────── */}
      <Link
        href="/admin/forms"
        className="inline-flex items-center gap-1.5 text-xs f-body mb-5 transition-colors hover:opacity-70"
        style={{ color: 'rgba(10,46,77,0.45)' }}
      >
        <ArrowLeft size={13} strokeWidth={1.8} />
        All Forms
      </Link>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Intake Form
        </p>
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-3">
          {form.title}
        </h1>

        {/* Share link banner */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] flex-wrap"
          style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.09)' }}>
          <span className="text-xs f-body font-semibold flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Share link
          </span>
          <code
            className="flex-1 text-xs f-body truncate min-w-0"
            style={{ color: '#0A2E4D' }}
          >
            {formUrl}
          </code>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CopyLinkButton url={formUrl} />
            <a
              href={formUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold f-body transition-colors hover:bg-black/5"
              style={{ color: 'rgba(10,46,77,0.5)' }}
            >
              <ExternalLink size={12} strokeWidth={1.8} />
              Preview
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.4fr] gap-8 items-start">

        {/* ── Left: Form Editor ──────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>Edit Form</h2>
          <FormEditorClient form={form} />
        </div>

        {/* ── Right: Responses ──────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
            Responses ({responses.length})
          </h2>
          {responses.length === 0 ? (
            <div
              className="flex flex-col items-center py-14 rounded-[18px] text-center"
              style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
            >
              <p className="text-sm f-body mb-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
                No responses yet.
              </p>
              <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
                Share the link above to start collecting answers.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {responses.map(r => (
                <ResponseCard key={r.id} response={r} questions={form.questions} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── ResponseCard ─────────────────────────────────────────────────────────────

function ResponseCard({
  response,
  questions,
}: {
  response:  GuideIntakeResponse
  questions: FormQuestion[]
}) {
  const submitted = new Date(response.submitted_at)

  return (
    <details
      className="group overflow-hidden rounded-[16px]"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.08)' }}
    >
      <summary
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none list-none"
        style={{ WebkitUserSelect: 'none' }}
      >
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold f-body flex-shrink-0"
          style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
        >
          {response.respondent_name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
            {response.respondent_name}
          </p>
          <p className="text-xs f-body truncate" style={{ color: 'rgba(10,46,77,0.4)' }}>
            {response.respondent_email}
          </p>
        </div>

        <div className="flex-shrink-0 text-right">
          <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
            {submitted.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
          <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.25)' }}>
            {submitted.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Expand chevron */}
        <svg
          width="14" height="14"
          viewBox="0 0 14 14"
          className="flex-shrink-0 transition-transform group-open:rotate-180"
          style={{ color: 'rgba(10,46,77,0.3)' }}
        >
          <path d="M2 4.5L7 9.5L12 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      {/* Answers */}
      <div className="px-5 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
        <div className="pt-3" />
        {questions.map(q => {
          const raw = response.answers[q.id]
          const answer = raw == null
            ? '—'
            : Array.isArray(raw)
              ? raw.join(', ')
              : String(raw)

          return (
            <div key={q.id}>
              <p className="text-[10px] uppercase tracking-[0.12em] font-bold f-body mb-0.5"
                style={{ color: 'rgba(10,46,77,0.38)' }}>
                {q.label}{q.required ? ' *' : ''}
              </p>
              <p className="text-sm f-body whitespace-pre-wrap" style={{ color: '#0A2E4D' }}>
                {answer || '—'}
              </p>
            </div>
          )
        })}
      </div>
    </details>
  )
}
