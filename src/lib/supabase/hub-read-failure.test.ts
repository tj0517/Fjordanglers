/**
 * What happens when the hub table cannot be read (FA-1.85). The Supabase client is replaced by one
 * whose every read fails, so no database is involved.
 *
 *   getHubContents        throws — a hub page built from an empty answer would be a blank page that
 *                         search engines index; a thrown error keeps the last good page (ISR) and is not cached
 *   getDestinationHub     throws for the same reason
 *   getPrerenderableHubSlugs returns no slugs and logs — a build with no database (CI) must not fail; the hubs
 *                         then render on their first request and are cached (ISR)
 *   getHubCrumbForCountry returns null and logs — an offer page must not fail because of its parent's label
 */
import { vi, describe, it, expect, afterEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag:  vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ select: async () => ({ data: null, error: { message: 'simulated outage' } }) }),
  }),
}))

import { getDestinationHub, getHubContents, getHubCrumbForCountry, getPrerenderableHubSlugs } from './queries'

afterEach(() => vi.restoreAllMocks())

describe('a hub table that cannot be read', () => {
  it('getHubContents throws, naming the cause', async () => {
    await expect(getHubContents()).rejects.toThrow('[getHubContents] simulated outage')
  })

  it('getDestinationHub throws instead of rendering an empty hub', async () => {
    await expect(getDestinationHub('norway')).rejects.toThrow('[getHubContents] simulated outage')
  })

  it('getDestinationHub still answers null for a slug that is not a hub, without reading the table', async () => {
    await expect(getDestinationHub('atlantis')).resolves.toBeNull()
  })

  it('no hub is prerendered at build time, and the build does not fail', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(getPrerenderableHubSlugs()).resolves.toEqual([])
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('[getPrerenderableHubSlugs]'), '[getHubContents] simulated outage')
  })

  it('the offer breadcrumb degrades to no hub and logs', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(getHubCrumbForCountry('Norway')).resolves.toBeNull()
    expect(errors).toHaveBeenCalledWith('[getHubCrumbForCountry] hub label unavailable:', '[getHubContents] simulated outage')
  })
})
