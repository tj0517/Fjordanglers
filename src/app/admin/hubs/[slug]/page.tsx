import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HubContentForm } from '@/components/admin/hub-content-form'
import { getHubForAdmin } from '@/lib/supabase/hubs-admin'
import { parseFaq } from '@/lib/experience-v2-content'

export default async function EditHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const hub = await getHubForAdmin(slug)

  if (hub == null) notFound()
  const { row } = hub

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1100px]">

      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Admin</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <Link href="/admin/hubs" className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>Hubs</Link>
        <span style={{ color: 'rgba(10,46,77,0.22)' }}>›</span>
        <span className="text-xs f-body font-semibold" style={{ color: '#0A2E4D' }}>{row.slug}</span>
      </div>

      <h1 className="text-[#0A2E4D] text-xl font-bold f-display mb-2">Edit hub</h1>
      <p className="text-sm f-body mb-8" style={{ color: 'rgba(10,46,77,0.5)' }}>
        /{row.slug} — {row.h1}
      </p>

      <HubContentForm
        slug={row.slug}
        initialValues={{
          h1: row.h1,
          intro: row.intro,
          metaTitle: row.meta_title,
          metaDescription: row.meta_description,
          seasonMonths: row.season_months,
          peakMonths: row.peak_months,
          seasonNote: row.season_note ?? '',
          species: row.species,
          faq: parseFaq(row.faq),
          heroQuoteText: row.hero_quote_text ?? '',
          heroQuoteAuthor: row.hero_quote_author ?? '',
          heroQuoteCountry: row.hero_quote_country ?? '',
          proofNote: row.proof_note ?? '',
          contactName: row.contact_name ?? '',
          contactEmail: row.contact_email ?? '',
          contactWhatsapp: row.contact_whatsapp ?? '',
        }}
      />
    </div>
  )
}
