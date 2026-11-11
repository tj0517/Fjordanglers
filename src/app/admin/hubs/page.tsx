import Link from 'next/link'
import { Globe, ExternalLink } from 'lucide-react'
import { listHubsForAdmin } from '@/lib/supabase/hubs-admin'
import { formatPostDate } from '@/lib/blog/post'

export default async function AdminHubsPage() {
  const hubs = await listHubsForAdmin()

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1100px]">

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={18} strokeWidth={1.6} style={{ color: '#0A2E4D' }} />
          <h1 className="text-[#0A2E4D] text-xl font-bold f-display">Destination hubs</h1>
        </div>
        <p className="text-sm f-body max-w-xl" style={{ color: 'rgba(10,46,77,0.5)' }}>
          The text of the six country pages. A saved change shows on the site within a moment — no deploy.
          Which hubs exist, and which countries each one covers, is set in code.
        </p>
      </div>

      <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(10,46,77,0.07)' }}>
        <div
          className="hidden sm:grid grid-cols-[1fr_200px_150px] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] f-body"
          style={{ background: 'rgba(10,46,77,0.04)', color: 'rgba(10,46,77,0.5)' }}
        >
          <span>Hub</span><span>Countries</span><span>Updated</span>
        </div>
        {hubs.map((hub, i) => (
          <div
            key={hub.slug}
            data-testid={`hub-row-${hub.slug}`}
            className="grid sm:grid-cols-[1fr_200px_150px] gap-x-4 gap-y-1 px-5 py-4 items-center"
            style={{ background: i % 2 === 0 ? '#FDFAF7' : '#FAF6F0', borderTop: i > 0 ? '1px solid rgba(10,46,77,0.05)' : undefined }}
          >
            <div className="min-w-0">
              {hub.row != null ? (
                <Link href={`/admin/hubs/${hub.slug}`} className="text-sm font-semibold f-body hover:underline" style={{ color: '#0A2E4D' }}>
                  {hub.row.h1}
                </Link>
              ) : (
                <span className="text-sm font-semibold f-body" style={{ color: '#B3261E' }}>No content row for this hub</span>
              )}
              <p className="text-[11px] f-body mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'rgba(10,46,77,0.5)' }}>
                <span>/{hub.slug}</span>
                <Link href={`/${hub.slug}`} target="_blank" className="inline-flex items-center gap-1 underline">
                  View <ExternalLink size={10} />
                </Link>
              </p>
            </div>
            <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>{hub.countries.join(', ')}</span>
            <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
              {hub.row != null ? formatPostDate(hub.row.updated_at) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
