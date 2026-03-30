'use client'

/**
 * DeleteGuideButton — opens a confirmation modal before permanently deleting
 * a guide profile and all associated data (experiences, bookings, payments).
 *
 * If the guide has a linked Supabase Auth account (user_id != null), an
 * optional checkbox lets the admin also delete that auth account.
 *
 * On success: navigates to /admin/guides.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteGuide } from '@/actions/admin'
import { Trash2, AlertTriangle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  guideId: string
  guideName: string
  /** True when guide.user_id != null — show the "also delete auth" checkbox */
  hasAuthUser: boolean
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconTrash = () => <Trash2 size={13} strokeWidth={1.5} />

const IconWarning = () => <AlertTriangle size={22} strokeWidth={1.6} style={{ color: '#DC2626' }} />

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeleteGuideButton({ guideId, guideName, hasAuthUser }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [deleteAuth, setDeleteAuth] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open  = () => { setError(null); setDeleteAuth(false); setIsOpen(true) }
  const close = () => { if (!isPending) { setIsOpen(false); setError(null) } }

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteGuide(guideId, { deleteAuthAccount: deleteAuth })
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push('/admin/guides')
        router.refresh()
      }
    })
  }

  return (
    <>
      {/* ── Trigger ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={open}
        className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full transition-all f-body hover:brightness-95"
        style={{
          background: 'rgba(239,68,68,0.08)',
          color: '#DC2626',
          border: '1px solid rgba(239,68,68,0.18)',
        }}
      >
        <IconTrash />
        Delete guide
      </button>

      {/* ── Modal ─────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(4,12,22,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <div
            className="w-full max-w-[420px] rounded-3xl p-8"
            style={{
              background: '#FDFAF7',
              border: '1px solid rgba(10,46,77,0.1)',
              boxShadow: '0 24px 80px rgba(4,12,22,0.28)',
            }}
          >
            {/* Warning icon */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.18)' }}
            >
              <IconWarning />
            </div>

            <h2
              id="delete-guide-title"
              className="text-[#0A2E4D] text-xl font-bold f-display mb-2"
            >
              Delete &ldquo;{guideName}&rdquo;?
            </h2>
            <p className="text-[#0A2E4D]/52 text-sm f-body leading-relaxed mb-5">
              This will permanently remove the guide profile, all their experiences,
              bookings, and payments. <strong style={{ color: 'rgba(10,46,77,0.7)' }}>
              This cannot be undone.</strong>
            </p>

            {/* Optional: also delete auth account */}
            {hasAuthUser && (
              <label
                className="flex items-start gap-3 px-4 py-3.5 rounded-2xl mb-5 cursor-pointer select-none"
                style={{
                  background: 'rgba(239,68,68,0.05)',
                  border: '1px solid rgba(239,68,68,0.14)',
                }}
              >
                <input
                  id="delete-auth-checkbox"
                  type="checkbox"
                  checked={deleteAuth}
                  onChange={(e) => setDeleteAuth(e.target.checked)}
                  className="mt-0.5 flex-shrink-0 cursor-pointer"
                  style={{ accentColor: '#DC2626', width: '14px', height: '14px' }}
                />
                <div>
                  <p className="text-sm font-semibold f-body" style={{ color: '#DC2626' }}>
                    Also delete Supabase Auth account
                  </p>
                  <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    Removes their login credentials. They won&apos;t be able to sign in again
                    even if re-added later.
                  </p>
                </div>
              </label>
            )}

            {/* Error */}
            {error != null && (
              <p
                className="text-xs f-body mb-4 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}
              >
                {error}
              </p>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-full text-sm font-bold f-body transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-55"
                style={{ background: '#DC2626', color: 'white' }}
              >
                {isPending ? 'Deleting…' : 'Delete permanently'}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-full text-sm font-medium f-body transition-all hover:brightness-95 disabled:opacity-55"
                style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
