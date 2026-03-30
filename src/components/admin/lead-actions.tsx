'use client'

/**
 * LeadActions — inline action buttons for a single lead row.
 *
 * Renders:
 *  • "Create Listing" link → /admin/guides/new?lead_id=X  (only if not onboarded/rejected)
 *  • "Mark Contacted"     → updateLeadStatus(id, 'contacted')
 *  • "Reject"             → updateLeadStatus(id, 'rejected')
 *
 * This is a client component because status-update buttons need
 * loading state and optimistic feedback.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateLeadStatus, deleteLead, type LeadStatus } from '@/actions/admin'
import { Plus } from 'lucide-react'

type Props = {
  leadId: string
  status: LeadStatus
}

export default function LeadActions({ leadId, status }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localStatus, setLocalStatus] = useState<LeadStatus>(status)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState(false)

  const handleStatusChange = (next: LeadStatus) => {
    setError(null)
    startTransition(async () => {
      const result = await updateLeadStatus(leadId, next)
      if ('error' in result) {
        setError(result.error)
      } else {
        setLocalStatus(next)
        router.refresh()
      }
    })
  }

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteLead(leadId)
      if ('error' in result) {
        setError(result.error)
        setPendingDelete(false)
      } else {
        router.refresh()
      }
    })
  }

  const isDone = localStatus === 'onboarded' || localStatus === 'rejected'

  return (
    <div className="flex items-center gap-2 flex-wrap">

      {/* Create Listing — primary action */}
      {!isDone && (
        <Link
          href={`/admin/guides/new?lead_id=${leadId}`}
          className="flex items-center gap-1.5 text-white text-[11px] font-semibold px-3.5 py-1.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body whitespace-nowrap"
          style={{ background: '#E67E50' }}
        >
          <Plus size={10} />
          Create Listing
        </Link>
      )}

      {/* Mark Contacted */}
      {localStatus === 'new' && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleStatusChange('contacted')}
          className="text-[11px] font-medium px-3.5 py-1.5 rounded-full transition-all f-body whitespace-nowrap disabled:opacity-50"
          style={{
            background: 'rgba(10,46,77,0.07)',
            color: 'rgba(10,46,77,0.65)',
            border: '1px solid rgba(10,46,77,0.1)',
          }}
        >
          {isPending ? '…' : 'Mark Contacted'}
        </button>
      )}

      {/* Reject */}
      {localStatus !== 'rejected' && localStatus !== 'onboarded' && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleStatusChange('rejected')}
          className="text-[11px] font-medium px-3.5 py-1.5 rounded-full transition-all f-body whitespace-nowrap disabled:opacity-50"
          style={{
            background: 'rgba(239,68,68,0.07)',
            color: 'rgba(220,38,38,0.7)',
            border: '1px solid rgba(239,68,68,0.15)',
          }}
        >
          {isPending ? '…' : 'Reject'}
        </button>
      )}

      {/* Done state labels */}
      {localStatus === 'onboarded' && (
        <span
          className="text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full f-body"
          style={{ background: 'rgba(74,222,128,0.1)', color: '#16A34A' }}
        >
          ✓ Profile created
        </span>
      )}
      {localStatus === 'rejected' && (
        <span
          className="text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full f-body"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}
        >
          Rejected
        </span>
      )}

      {/* Delete lead — two-step inline confirm */}
      {!pendingDelete ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setPendingDelete(true)}
          className="text-[10px] font-medium f-body transition-all disabled:opacity-40 ml-auto"
          style={{ color: 'rgba(220,38,38,0.45)' }}
          title="Delete this lead permanently"
        >
          Delete
        </button>
      ) : (
        <span className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            disabled={isPending}
            onClick={handleDelete}
            className="text-[10px] font-bold f-body disabled:opacity-50"
            style={{ color: '#DC2626' }}
          >
            {isPending ? '…' : 'Sure?'}
          </button>
          <span style={{ color: 'rgba(10,46,77,0.2)' }}>·</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setPendingDelete(false)}
            className="text-[10px] f-body disabled:opacity-50"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            No
          </button>
        </span>
      )}

      {/* Error inline */}
      {error != null && (
        <span className="text-[10px] f-body" style={{ color: '#DC2626' }}>{error}</span>
      )}
    </div>
  )
}
