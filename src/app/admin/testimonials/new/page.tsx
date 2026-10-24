import Link from 'next/link'
import { TestimonialForm } from '@/components/admin/testimonial-form'

export default function NewTestimonialPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[960px]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/testimonials" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Testimonials</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#0A2E4D' }}>New</span>
      </div>

      <h1 className="text-[#0A2E4D] text-xl font-bold f-display mb-8">New testimonial</h1>

      <TestimonialForm
        mode="create"
        initialValues={{
          quote:                '',
          author_name:          '',
          author_country:       null,
          trip_country:         null,
          rating:               null,
          photo_url:            null,
          source:               'direct',
          source_url:           null,
          consent_confirmed:    false,
          consent_confirmed_at: null,
          consent_note:         null,
          is_active:            false,
        }}
      />
    </div>
  )
}
