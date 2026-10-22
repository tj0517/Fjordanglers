/**
 * FA-1.64 — the photo library of one experience page: every photo already on the page, so an
 * admin picks it into another field ("Choose from this page") instead of uploading it again.
 * Per page, never global (O-41 a): what goes in is the form's own fields and the page's guide
 * photos — nothing is listed from the bucket.
 */

/** Anything on the page that carries photos: one `image_url`, a gallery `image_urls`, or both. */
export type PhotoHolder = {
  image_url?:  string | null
  image_urls?: readonly string[] | null
}

/** The page's photo fields as they stand in the form now — not only what was saved. */
export type PagePhotoFields = {
  hero:           string | null
  gallery:        readonly string[]
  contentPhotos:  readonly string[]
  views:          readonly string[]
  /** Waters and Programs blocks. */
  blocks:         readonly PhotoHolder[]
  species:        readonly PhotoHolder[]
  boats:          readonly PhotoHolder[]
  accommodations: readonly PhotoHolder[]
  attractions:    readonly PhotoHolder[]
  /** Photos inside trip options — their blocks, boats and attractions. */
  options:        readonly PhotoHolder[]
  guidePhotos:    readonly string[]
}

function holderPhotos({ image_url, image_urls }: PhotoHolder): readonly (string | null | undefined)[] {
  return [image_url, ...(image_urls ?? [])]
}

/**
 * Unique, non-empty photo URLs of the page, in the order the form shows its fields, guide photos
 * last. A URL is kept exactly as stored, so a field's own photos match their tiles.
 */
export function collectPagePhotos(fields: PagePhotoFields): string[] {
  const all = [
    fields.hero,
    ...fields.gallery,
    ...fields.contentPhotos,
    ...fields.views,
    ...[...fields.blocks, ...fields.species, ...fields.boats, ...fields.accommodations, ...fields.attractions, ...fields.options]
      .flatMap(holderPhotos),
    ...fields.guidePhotos,
  ]
  return [...new Set(all.filter((url): url is string => url != null && url.trim() !== ''))]
}
