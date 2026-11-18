/**
 * How long ago a calendar last synced, for the admin card and the guide panel (FA-M.09, FA-M.13):
 * "just now", "12 min ago", "5 h ago", then the date ("18 Nov") once it is two days old.
 */
export function syncAge(iso: string | null, now: number = Date.now()): string {
  if (iso == null) return 'never'
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
