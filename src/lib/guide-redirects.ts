/**
 * Guide profiles that were retired in favour of another row (FA-1.86, tj D2: one mapping in code,
 * no table). Key = the retired guide's id, value = the id of the profile it was merged into.
 *
 * The target is resolved to its current slug at request time, so the redirect follows a renamed
 * slug and never points at a UUID: if the target has no public slug the page falls through to
 * its normal 404. The retired row itself is suspended + hidden in the database; its inquiries keep
 * their historical `assigned_guide_id`.
 */
const RETIRED_GUIDE_REDIRECTS: Readonly<Record<string, string>> = {
  // Josh Hart — duplicate row → the profile that carries the offer
  'cd8f48f1-0633-4832-9c56-0f2cb4c7ee6d': '1a30602e-05f8-4a5d-a89f-76b4d53843a4',
}

/** Id of the profile a retired guide id was merged into, or `null` if `idOrSlug` is not retired. */
export function retiredGuideTarget(idOrSlug: string): string | null {
  return RETIRED_GUIDE_REDIRECTS[idOrSlug.toLowerCase()] ?? null
}
