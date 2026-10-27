/**
 * Name and description of the Stripe product behind a deposit link (FA-1.77).
 *
 * The angler reads both on the Stripe payment page. Admin input is untrusted: trimmed,
 * required, and capped before any Stripe call.
 *
 * Limits: `name` 250 — documented by Stripe ("The `name` field on product endpoints now
 * has a maximum character length limit of `250`", changelog 2018-10-31). `description`
 * has no documented limit; 250 and required is tj's decision 2026-10-27 (FA-1.77).
 *
 * Pure — imported by the server action and the card alike.
 */

export const PRODUCT_NAME_MAX        = 250
export const PRODUCT_DESCRIPTION_MAX = 250

export interface ProductDetails {
  name:        string
  description: string
}

export type ProductDetailsCheck =
  | { ok: true;  details: ProductDetails }
  | { ok: false; error: string }

export function checkProductDetails(input: unknown): ProductDetailsCheck {
  const raw = (input ?? {}) as { name?: unknown; description?: unknown }
  if (typeof raw.name !== 'string' || typeof raw.description !== 'string') {
    return { ok: false, error: 'Product name and description are required' }
  }
  const name        = raw.name.trim()
  const description = raw.description.trim()
  if (name === '')        return { ok: false, error: 'Product name is required' }
  if (description === '') return { ok: false, error: 'Description is required' }
  if (name.length > PRODUCT_NAME_MAX) {
    return { ok: false, error: `Product name is ${name.length} characters — Stripe allows ${PRODUCT_NAME_MAX}` }
  }
  if (description.length > PRODUCT_DESCRIPTION_MAX) {
    return { ok: false, error: `Description is ${description.length} characters — the limit is ${PRODUCT_DESCRIPTION_MAX}` }
  }
  return { ok: true, details: { name, description } }
}

export interface LinkProduct {
  /** null for links created before FA-1.77 — look it up in Stripe. */
  productId: string | null
  /** null when no event recorded the values (links created before FA-1.77). */
  details:   ProductDetails | null
}

/**
 * What the event log says about a link's product: `payment.link_sent` records the values
 * the link was created with, `payment.link_details_updated` every later change.
 * `events` in log order (oldest first); the latest event for `linkId` wins.
 */
export function linkProductFromEvents(
  events: ReadonlyArray<{ type: string; payload: unknown }>,
  linkId: string,
): LinkProduct {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i]
    if (e.type !== 'payment.link_sent' && e.type !== 'payment.link_details_updated') continue
    const p = (e.payload ?? {}) as { link_id?: unknown; product_id?: unknown; name?: unknown; description?: unknown; after?: unknown }
    if (p.link_id !== linkId) continue
    const values = (e.type === 'payment.link_details_updated' ? p.after ?? {} : p) as { name?: unknown; description?: unknown }
    return {
      productId: typeof p.product_id === 'string' ? p.product_id : null,
      details:   typeof values.name === 'string' && typeof values.description === 'string'
        ? { name: values.name, description: values.description }
        : null,
    }
  }
  return { productId: null, details: null }
}
