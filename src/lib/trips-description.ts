/**
 * The one fixed sentence for /trips without a country filter. It names the countries
 * that have an active offer right now (data layer, ordered Nordic → Patagonia → NZ),
 * so it cannot go stale when an offer goes live or is taken down. No count, no "20+".
 */
export function defaultTripsDescription(countries: readonly string[]): string {
  const where =
    countries.length === 0 ? '' :
    countries.length === 1 ? ` in ${countries[0]}` :
    ` in ${countries.slice(0, -1).join(', ')} and ${countries[countries.length - 1]}`
  return `Browse hand-picked guided fishing trips with local guides${where}.`
}
