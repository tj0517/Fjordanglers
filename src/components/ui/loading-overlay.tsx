'use client'

import { Loader2 } from 'lucide-react'

/**
 * LoadingOverlay — frosted-glass spinner overlay for cards and form sections.
 *
 * Usage: place inside a `relative` container.
 *   <div className="relative">
 *     {isPending && <LoadingOverlay />}
 *     ...content...
 *   </div>
 *
 * Pass `rounded` to match the container's border-radius class
 * (default "rounded-2xl"). Use "rounded-none" for full-page forms.
 */
export function LoadingOverlay({ rounded = 'rounded-2xl' }: { rounded?: string }) {
  return (
    <div
      className={`absolute inset-0 z-20 flex items-center justify-center ${rounded}`}
      style={{ background: 'rgba(253,250,247,0.8)', backdropFilter: 'blur(2px)' }}
    >
      <Loader2 className="animate-spin" size={32} style={{ color: '#E67E50' }} />
    </div>
  )
}
