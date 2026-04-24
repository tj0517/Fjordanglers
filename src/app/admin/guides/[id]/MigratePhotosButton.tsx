'use client'

/**
 * MigratePhotosButton — Admin tool that moves a guide's existing photos
 * from the old flat bucket structure ({uuid}.ext) to the organised
 * per-guide folder structure ({guide_id}/{uuid}.ext).
 *
 * Also updates all references in guide_photos and experience_pages tables.
 * Safe to run multiple times — already-migrated files are skipped.
 */

import { useState, useTransition } from 'react'
import { migrateGuidePhotosToFolder } from '@/actions/guide-photos'
import { FolderOpen, Check, Loader2, AlertCircle } from 'lucide-react'

type Result = {
  migrated: number
  skipped:  number
  errors:   number
}

export function MigratePhotosButton({ guideId }: { guideId: string }) {
  const [isPending, startTransition] = useTransition()
  const [result,    setResult]       = useState<Result | null>(null)
  const [error,     setError]        = useState<string | null>(null)

  function handleMigrate() {
    setResult(null)
    setError(null)

    startTransition(async () => {
      try {
        const res = await migrateGuidePhotosToFolder(guideId)
        setResult(res)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Migration failed')
      }
    })
  }

  if (result != null) {
    return (
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
        style={{ background: result.errors > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)', border: `1px solid ${result.errors > 0 ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.25)'}` }}>
        <Check size={13} style={{ color: '#16A34A', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p className="text-xs font-bold f-body" style={{ color: '#16A34A' }}>
            Migration done
          </p>
          <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.55)' }}>
            {result.migrated} moved · {result.skipped} already organised · {result.errors} errors
          </p>
        </div>
      </div>
    )
  }

  if (error != null) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={12} style={{ color: '#DC2626', flexShrink: 0 }} />
          <p className="text-[11px] f-body" style={{ color: '#DC2626' }}>{error}</p>
        </div>
        <button type="button" onClick={() => setError(null)}
          className="text-[10px] f-body font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'rgba(10,46,77,0.45)' }}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleMigrate}
      disabled={isPending}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold f-body transition-all"
      style={{
        background: isPending ? 'rgba(10,46,77,0.04)' : 'rgba(10,46,77,0.06)',
        color:      isPending ? 'rgba(10,46,77,0.35)' : 'rgba(10,46,77,0.6)',
        border:     '1px solid rgba(10,46,77,0.1)',
        cursor:     isPending ? 'not-allowed' : 'pointer',
      }}
    >
      {isPending
        ? <><Loader2 size={12} className="animate-spin" /> Migrating…</>
        : <><FolderOpen size={12} /> Move to guide folder</>
      }
    </button>
  )
}
