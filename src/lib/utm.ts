const UTM_KEY    = 'fa_utm'
const UTM_TTL_MS = 90 * 24 * 60 * 60 * 1000  // 90 days

const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

export interface UtmParams {
  utm_source?:   string
  utm_medium?:   string
  utm_campaign?: string
  utm_content?:  string
  utm_term?:     string
  [key: string]: string | undefined
}

interface UtmEntry {
  value:   UtmParams
  expires: number
}

export function storeUtm(searchParams: URLSearchParams): void {
  const value: UtmParams = {}
  for (const field of UTM_FIELDS) {
    const v = searchParams.get(field)
    if (v) value[field] = v
  }
  if (Object.keys(value).length === 0) return

  try {
    const entry: UtmEntry = { value, expires: Date.now() + UTM_TTL_MS }
    localStorage.setItem(UTM_KEY, JSON.stringify(entry))
  } catch {
    // localStorage may be blocked (private browsing, storage quota)
  }
}

export function getStoredUtm(): UtmParams | null {
  try {
    const raw = localStorage.getItem(UTM_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as UtmEntry
    if (Date.now() > entry.expires) {
      localStorage.removeItem(UTM_KEY)
      return null
    }
    return entry.value
  } catch {
    return null
  }
}
