'use client'

/**
 * GuidePhotosManager — Client Component for the /dashboard/photos page.
 *
 * Wraps MultiImageUpload and syncs changes to the DB via saveGuidePhotos().
 * Guide can upload up to 20 photos. First photo becomes the cover image.
 * FjordAnglers uses these photos when building the guide's experience pages.
 */

import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import MultiImageUpload, { type GalleryImage } from '@/components/admin/multi-image-upload'
import { saveGuidePhotos } from '@/actions/guide-photos'

type Props = {
  initialPhotos: GalleryImage[]
  /** Guide's own ID — new uploads land at {guideId}/{uuid}.ext in the bucket. */
  guideId: string
}

export default function GuidePhotosManager({ initialPhotos, guideId }: Props) {
  const [photos,      setPhotos]      = useState<GalleryImage[]>(initialPhotos)
  const [saved,       setSaved]       = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending,   startTransition] = useTransition()

  const handleSave = () => {
    setSaved(false)
    setServerError(null)

    startTransition(async () => {
      const result = await saveGuidePhotos(photos)
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3500)
      } else {
        setServerError(result.error)
      }
    })
  }

  return (
    <div className="space-y-6">

      <MultiImageUpload
        label="Your photo gallery"
        initial={initialPhotos}
        max={20}
        onChange={setPhotos}
        guideId={guideId}
      />

      {/* Save controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold f-body transition-all"
          style={{
            background: isPending ? 'rgba(230,126,80,0.45)' : '#E67E50',
            color:      '#fff',
            cursor:     isPending ? 'not-allowed' : 'pointer',
            boxShadow:  isPending ? 'none' : '0 4px 12px rgba(230,126,80,0.3)',
          }}
        >
          {isPending ? (
            <><Loader2 size={14} className="animate-spin" />Saving…</>
          ) : (
            'Save photos'
          )}
        </button>

        {saved && (
          <p className="text-sm f-body flex items-center gap-1.5" style={{ color: '#16A34A' }}>
            <Check size={13} strokeWidth={2.2} />
            Photos saved successfully
          </p>
        )}

        {serverError != null && (
          <p className="text-sm f-body" style={{ color: '#DC2626' }}>{serverError}</p>
        )}
      </div>

      <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.4)', maxWidth: '540px' }}>
        Upload your best fishing photos here. FjordAnglers will select from these when building your public experience pages.
        The first photo becomes your <strong>cover image</strong>. Photos are stored securely and only shared with FjordAnglers&apos; team.
      </p>

    </div>
  )
}
