import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTestimonialForAdmin } from '@/lib/supabase/testimonials'
import { TestimonialForm } from '@/components/admin/testimonial-form'

export default async function EditTestimonialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const row = await getTestimonialForAdmin(id)

  if (row == null) notFound()

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[960px]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/testimonials" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Testimonials</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#0A2E4D' }}>Edit</span>
      </div>

      <h1 className="text-[#0A2E4D] text-xl font-bold f-display mb-2">Edit testimonial</h1>
      <p className="text-sm f-body mb-8" style={{ color: 'rgba(10,46,77,0.5)' }}>{row.authorName}</p>

      <TestimonialForm
        mode="edit"
        testimonialId={row.id}
        initialValues={{
          quote:                row.quote,
          author_name:          row.authorName,
          author_country:       row.authorCountry,
          trip_country:         row.tripCountry,
          rating:               row.rating,
          photo_url:            row.photoUrl,
          source:               row.source,
          source_url:           row.sourceUrl,
          consent_confirmed:    row.consentConfirmedAt != null,
          consent_confirmed_at: row.consentConfirmedAt,
          consent_note:         row.consentNote,
          is_active:            row.isActive,
        }}
      />
    </div>
  )
}
