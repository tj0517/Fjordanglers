import Link from 'next/link'
import Image from 'next/image'
import { Plus, Quote, ImageIcon, ExternalLink } from 'lucide-react'
import { listTestimonialsForAdmin } from '@/lib/supabase/testimonials'
import { anglerCountryName } from '@/lib/angler-countries'
import { TestimonialRowActions } from './TestimonialRowActions'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TestimonialsPage() {
  const rows = await listTestimonialsForAdmin()

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1100px]">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Quote size={18} strokeWidth={1.6} style={{ color: '#0A2E4D' }} />
            <h1 className="text-[#0A2E4D] text-xl font-bold f-display">Testimonials</h1>
          </div>
          <p className="text-sm f-body max-w-xl" style={{ color: 'rgba(10,46,77,0.5)' }}>
            The banner shows one testimonial per page: the first active one from the page&rsquo;s
            country, otherwise the first active general one. Order decides.
          </p>
        </div>
        <Link
          href="/admin/testimonials/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold f-body transition-all hover:brightness-90"
          style={{ background: '#0A2E4D', color: '#F8FAFB' }}
        >
          <Plus size={14} strokeWidth={2} />
          New testimonial
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          No testimonials yet.{' '}
          <Link href="/admin/testimonials/new" style={{ color: '#E67E50' }}>Add the first one.</Link>
        </p>
      ) : (
        <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(10,46,77,0.07)' }}>
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="flex items-start gap-4 px-5 py-4 flex-wrap sm:flex-nowrap"
              style={{
                background: i % 2 === 0 ? '#FDFAF7' : '#FAF6F0',
                borderTop:  i > 0 ? '1px solid rgba(10,46,77,0.05)' : undefined,
              }}
            >
              {/* Order */}
              <span
                className="flex-shrink-0 w-6 pt-1 text-xs font-semibold f-body tabular-nums"
                style={{ color: 'rgba(10,46,77,0.4)' }}
                title="Position in the list"
              >
                {i + 1}.
              </span>

              {/* Thumbnail */}
              <div
                className="relative flex-shrink-0 w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center"
                style={{ background: 'rgba(10,46,77,0.06)' }}
              >
                {row.photoUrl != null ? (
                  <Image src={row.photoUrl} alt="" fill sizes="56px" className="object-cover" />
                ) : (
                  <ImageIcon size={16} strokeWidth={1.5} style={{ color: 'rgba(10,46,77,0.3)' }} />
                )}
              </div>

              {/* Quote + meta */}
              <div className="flex-1 min-w-0" style={{ opacity: row.isActive ? 1 : 0.65 }}>
                <p className="text-sm f-body line-clamp-2" style={{ color: '#0A2E4D' }}>
                  &ldquo;{row.quote}&rdquo;
                </p>
                <p className="text-[11px] f-body mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  <span className="font-semibold" style={{ color: '#0A2E4D' }}>{row.authorName}</span>
                  {row.authorCountry != null && <span>· {anglerCountryName(row.authorCountry)}</span>}
                  {row.rating != null && <span>· {row.rating}/5</span>}
                  <span>· {row.tripCountry ?? 'General — any page'}</span>
                  <span>·</span>
                  {row.source === 'trustpilot' && row.sourceUrl != null ? (
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 underline"
                      style={{ color: 'rgba(10,46,77,0.6)' }}
                    >
                      Trustpilot <ExternalLink size={10} strokeWidth={1.8} />
                    </a>
                  ) : (
                    <span>Sent directly</span>
                  )}
                  {row.consentConfirmedAt == null && (
                    <span className="font-semibold" style={{ color: '#DC2626' }}>· No consent recorded</span>
                  )}
                </p>
              </div>

              {/* Status */}
              <span
                className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full f-body"
                style={row.isActive
                  ? { background: 'rgba(22,163,74,0.1)', color: '#16A34A' }
                  : { background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.5)' }}
              >
                {row.isActive ? 'Active' : 'Inactive'}
              </span>

              {/* Actions */}
              <div className="flex items-start gap-2 flex-shrink-0">
                <Link
                  href={`/admin/testimonials/${row.id}/edit`}
                  className="text-xs font-medium px-3 py-1.5 rounded-xl f-body transition-all hover:brightness-90"
                  style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
                >
                  Edit
                </Link>
                <TestimonialRowActions
                  id={row.id}
                  active={row.isActive}
                  isFirst={i === 0}
                  isLast={i === rows.length - 1}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
