/**
 * CountryFlag — renders a flag image from flagcdn.com.
 *
 * Uses <img> (not Next.js Image) since these are tiny 20px inline icons.
 * Works on all platforms including Windows Chrome where emoji flags are blank.
 */

import { getFlagUrl } from '@/lib/countries'

type Props = {
  country: string | null | undefined
  /** Image width in px. Height is auto-calculated (2:3 ratio). Default: 20 */
  size?: number
  className?: string
}

export function CountryFlag({ country, size = 20, className }: Props) {
  if (country == null || country === '') return null
  const url = getFlagUrl(country)
  if (url == null) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={country}
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    />
  )
}
