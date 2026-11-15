'use server'

/**
 * guide-photos.ts — Server Actions for the guide photo gallery.
 *
 * Guide photos live in the `guide_photos` table and in the `guide-photos` Supabase Storage
 * bucket. Guides no longer upload them — the /dashboard/photos page was removed in FA-M.08;
 * FA maintains the gallery.
 *
 * Storage path convention:
 *   Old (flat):  guide-photos/{uuid}.ext
 *   New (organised): guide-photos/{guide_id}/{uuid}.ext
 *
 * FA can browse a guide's gallery when building an experience_page — the
 * ExperiencePageForm receives the guide's photo URLs and shows them in the
 * "From gallery" picker on the hero image and gallery image uploaders.
 *
 * migrateGuidePhotosToFolder — one-time migration that moves existing flat
 * files to the {guide_id}/ prefix and updates all DB references.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

// ─── Migration ────────────────────────────────────────────────────────────────

/**
 * One-time per-guide migration: moves existing flat-path files in the
 * `guide-photos` bucket to organised `{guide_id}/{filename}` paths.
 *
 * Also updates every reference in:
 *   - guide_photos.url
 *   - experience_pages.hero_image_url
 *   - experience_pages.gallery_image_urls  (array element replacement)
 *
 * Safe to call multiple times — photos already in {guide_id}/ are skipped.
 * Returns counts of migrated / skipped / errored photos.
 */
export async function migrateGuidePhotosToFolder(guideId: string): Promise<{
  migrated: number
  skipped:  number
  errors:   number
}> {
  await requireAdmin()
  const svc    = createServiceClient()
  const BUCKET = 'guide-photos'

  const { data: photos } = await svc
    .from('guide_photos')
    .select('id, url')
    .eq('guide_id', guideId)

  if (photos == null || photos.length === 0) {
    return { migrated: 0, skipped: 0, errors: 0 }
  }

  let migrated = 0
  let skipped  = 0
  let errors   = 0

  for (const photo of photos) {
    try {
      // Extract storage path from the public CDN URL.
      // URL format: https://{project}.supabase.co/storage/v1/object/public/guide-photos/{path}
      const markerIdx = photo.url.indexOf('/guide-photos/')
      if (markerIdx === -1) { errors++; continue }
      const currentPath = photo.url.slice(markerIdx + '/guide-photos/'.length)

      // Skip if already in the guide's folder
      if (currentPath.startsWith(`${guideId}/`)) { skipped++; continue }

      // Build new organised path
      const filename = currentPath.split('/').pop() ?? currentPath
      const newPath  = `${guideId}/${filename}`

      // Move the file within the bucket
      const { error: moveErr } = await svc.storage
        .from(BUCKET)
        .move(currentPath, newPath)

      if (moveErr != null) {
        console.error(`[migrateGuidePhotos] move failed: ${currentPath} →`, moveErr.message)
        errors++
        continue
      }

      // Get the new public URL
      const { data: { publicUrl: newUrl } } = svc.storage
        .from(BUCKET)
        .getPublicUrl(newPath)

      const oldUrl = photo.url

      // 1. Update guide_photos row
      await svc.from('guide_photos').update({ url: newUrl }).eq('id', photo.id)

      // 2. Update experience_pages.hero_image_url where it matches
      await svc
        .from('experience_pages')
        .update({ hero_image_url: newUrl })
        .eq('guide_id', guideId)
        .eq('hero_image_url', oldUrl)

      // 3. Update experience_pages.gallery_image_urls (array element swap)
      const { data: expPages } = await svc
        .from('experience_pages')
        .select('id, gallery_image_urls')
        .eq('guide_id', guideId)
        .contains('gallery_image_urls', [oldUrl])

      if (expPages != null && expPages.length > 0) {
        for (const page of expPages) {
          const updated = ((page.gallery_image_urls as string[] | null) ?? [])
            .map(u => u === oldUrl ? newUrl : u)
          await svc
            .from('experience_pages')
            .update({ gallery_image_urls: updated })
            .eq('id', page.id)
        }
      }

      migrated++
    } catch (err) {
      console.error(`[migrateGuidePhotos] unexpected error for photo ${photo.id}:`, err)
      errors++
    }
  }

  console.log(`[migrateGuidePhotos] guide=${guideId} migrated=${migrated} skipped=${skipped} errors=${errors}`)
  return { migrated, skipped, errors }
}
