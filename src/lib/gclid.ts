const GCLID_KEY    = 'fa_gclid'
const GCLID_TTL_MS = 90 * 24 * 60 * 60 * 1000  // 90 days

interface GclidEntry {
  value:   string
  expires: number
}

export function storeGclid(gclid: string): void {
  try {
    const entry: GclidEntry = { value: gclid, expires: Date.now() + GCLID_TTL_MS }
    localStorage.setItem(GCLID_KEY, JSON.stringify(entry))
  } catch {
    // localStorage may be blocked (private browsing, storage quota)
  }
}

export function getStoredGclid(): string | null {
  try {
    const raw = localStorage.getItem(GCLID_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as GclidEntry
    if (Date.now() > entry.expires) {
      localStorage.removeItem(GCLID_KEY)
      return null
    }
    return entry.value
  } catch {
    return null
  }
}
