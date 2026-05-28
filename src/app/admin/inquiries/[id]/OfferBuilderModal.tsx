'use client'

/**
 * OfferBuilderModal
 *
 * A button that opens the full OfferBuilder in a centered modal overlay.
 * Clicking the backdrop or the × button closes the modal.
 */

import { useState, useEffect } from 'react'
import { X, FileText } from 'lucide-react'
import { OfferBuilder } from '@/app/dashboard/inquiries/[id]/OfferBuilder'

interface Props {
  inquiryId: string
  tripTitle: string
  estimatedTotalEur: number
  disabled?: boolean
}

export function OfferBuilderModal({
  inquiryId,
  tripTitle,
  estimatedTotalEur,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold f-body transition-all"
        style={{
          background: disabled ? 'rgba(230,126,80,0.4)' : '#E67E50',
          color:      '#fff',
          cursor:     disabled ? 'not-allowed' : 'pointer',
          boxShadow:  disabled ? 'none' : '0 4px 16px rgba(230,126,80,0.35)',
        }}
      >
        <FileText size={15} />
        Build &amp; Send Offer
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
          style={{ background: 'rgba(10,46,77,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            className="relative w-full rounded-3xl shadow-2xl my-auto"
            style={{
              maxWidth:   '540px',
              background: '#F8FAFB',
              border:     '1px solid rgba(10,46,77,0.1)',
              boxShadow:  '0 24px 80px rgba(10,46,77,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >

            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5 rounded-t-3xl"
              style={{ background: '#0A2E4D', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Personalised offer
                </p>
                <h2 className="text-base font-bold f-display mt-0.5" style={{ color: '#FFFFFF' }}>
                  {tripTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-full transition-all hover:opacity-70"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body — scrollable */}
            <div
              className="px-6 py-5 overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 12rem)' }}
            >
              <OfferBuilder
                inquiryId={inquiryId}
                tripTitle={tripTitle}
                estimatedTotalEur={estimatedTotalEur}
              />
            </div>

          </div>
        </div>
      )}
    </>
  )
}
