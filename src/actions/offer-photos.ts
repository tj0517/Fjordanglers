'use server'

/**
 * uploadOfferPhoto
 *
 * Uploads a single image to the `offer-photos` Supabase Storage bucket.
 * Called from the OfferBuilder Client Component via a Server Action.
 *
 * Uses the service-role client so the FA doesn't need storage permissions
 * in their own Supabase auth role — only the server action touches storage.
 *
 * Limits:   5 MB · JPEG / PNG / WebP only
 * Returns:  { url: string }  on success
 *           { error: string } on failure
 */

import { createServiceClient } from '@/lib/supabase/server'

export async function uploadOfferPhoto(
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const file = formData.get('file') as File | null
  if (file == null) return { error: 'No file provided' }

  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    return { error: 'Only JPEG, PNG and WebP images are allowed' }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: 'Image must be under 5 MB' }
  }

  const ext = file.type === 'image/webp' ? 'webp'
    : file.type === 'image/png'          ? 'png'
    : 'jpg'
  const fileName = `${crypto.randomUUID()}.${ext}`

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const svc = createServiceClient()

  const { data, error } = await svc.storage
    .from('offer-photos')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert:      false,
    })

  if (error != null) {
    console.error('[uploadOfferPhoto] Storage error:', error)
    return { error: 'Upload failed — please try again.' }
  }

  const { data: { publicUrl } } = svc.storage
    .from('offer-photos')
    .getPublicUrl(data.path)

  return { url: publicUrl }
}
