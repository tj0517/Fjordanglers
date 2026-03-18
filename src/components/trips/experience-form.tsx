'use client'

/**
 * ExperienceForm — shared form for creating / editing an experience.
 *
 * Used from:
 *   /admin/guides/[id]/trips/new  → context='admin', mode='create'
 *   /dashboard/trips/new          → context='guide', mode='create'
 *   /dashboard/trips/[id]/edit    → context='guide', mode='edit', expId provided
 *
 * Security is enforced server-side in createExperience / updateExperience actions.
 */

import { useCallback, useState, useTransition } from 'react'
import type * as GeoJSON from 'geojson'
import type { LocationSpot } from '@/types'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import ImageUpload from '@/components/admin/image-upload'
import MultiImageUpload, { type GalleryImage } from '@/components/admin/multi-image-upload'
import { ImageCropModal } from '@/components/ui/image-crop'
import { createClient } from '@/lib/supabase/client'
import { LANDSCAPE_LIBRARY } from '@/lib/landscapes'
import {
  createExperience,
  updateExperience,
  type ExperiencePayload,
  type ImageInput,
  type DurationOptionPayload,
  type GroupPricingPayload,
  type ItineraryStep,
} from '@/actions/experiences'

// ─── Dynamic map (Leaflet — client only, no SSR) ──────────────────────────────
const LocationPickerMap = dynamic(
  () => import('@/components/trips/location-picker-map'),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full animate-pulse"
        style={{ height: '280px', background: 'rgba(10,46,77,0.06)', borderRadius: '14px' }}
      />
    ),
  }
)

import { FISH_ALL } from '@/lib/fish'
import { COUNTRIES } from '@/lib/countries'

// ─── Constants ────────────────────────────────────────────────────────────────

const FISH_OPTIONS = FISH_ALL

const DIFFICULTY_OPTIONS = [
  { value: 'beginner',     label: 'All levels',    color: '#16A34A', bg: 'rgba(74,222,128,0.12)' },
  { value: 'intermediate', label: 'Intermediate',  color: '#D97706', bg: 'rgba(217,119,6,0.12)' },
  { value: 'expert',       label: 'Expert only',   color: '#DC2626', bg: 'rgba(239,68,68,0.12)' },
] as const

const FISHING_METHODS = [
  'Fly fishing', 'Spinning', 'Trolling', 'Jigging',
  'Ice fishing', 'Baitcasting', 'Shore fishing',
]

const MONTHS = [
  { value: 1,  label: 'Jan' }, { value: 2,  label: 'Feb' },
  { value: 3,  label: 'Mar' }, { value: 4,  label: 'Apr' },
  { value: 5,  label: 'May' }, { value: 6,  label: 'Jun' },
  { value: 7,  label: 'Jul' }, { value: 8,  label: 'Aug' },
  { value: 9,  label: 'Sep' }, { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
]

type PricingType = 'per_person' | 'per_boat' | 'per_group'

const PRICING_TYPE_OPTIONS: { value: PricingType; label: string; hint: string }[] = [
  { value: 'per_person', label: '€ / person', hint: 'Price per angler' },
  { value: 'per_boat',   label: 'Flat (boat)', hint: 'One price for the whole group' },
  { value: 'per_group',  label: 'By group',   hint: 'Different price per group size' },
]

// Form-local shape (inputs as strings for easier controlled inputs)
type DurationOptionRow = {
  label: string
  hours: string                        // '' = not set
  days: string                         // '' = not set
  pricing_type: PricingType
  price_eur: string                    // for per_person / per_boat; '' = not set
  group_prices: Record<number, string> // for per_group; key = angler count
  includes_lodging: boolean
}

const EMPTY_DURATION_ROW: DurationOptionRow = {
  label: '', hours: '', days: '',
  pricing_type: 'per_person',
  price_eur: '',
  group_prices: {},
  includes_lodging: false,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExperienceFormDefaults = {
  title?: string
  description?: string
  fish_types?: string[]
  technique?: string
  difficulty?: 'beginner' | 'intermediate' | 'expert' | null
  catch_and_release?: boolean
  // Legacy scalar fields — used to seed a single duration row when duration_options is absent
  duration_type?: 'hours' | 'days'
  duration_value?: string
  max_guests?: string
  price_per_person_eur?: string
  location_country?: string
  location_city?: string
  meeting_point?: string
  location_lat?: number | null
  location_lng?: number | null
  location_area?: GeoJSON.Polygon | null
  location_spots?: LocationSpot[] | null
  booking_type?: 'classic' | 'icelandic'
  // Legacy arrays (still accepted for old records)
  what_included?: string[]
  what_excluded?: string[]
  published?: boolean
  images?: Array<{ url: string; is_cover: boolean; sort_order: number }>
  // ── New structured fields ─────────────────────────────────────────────────
  season_from?: number | null
  season_to?: number | null
  fishing_methods?: string[]
  duration_options?: DurationOptionPayload[]
  group_pricing?: GroupPricingPayload | null
  inclusions_data?: Record<string, unknown> | null
  landscape_url?: string | null
  // ── Trip content fields ───────────────────────────────────────────────────
  itinerary?: ItineraryStep[] | null
  location_description?: string | null
  boat_description?: string | null
  accommodation_description?: string | null
  food_description?: string | null
  license_description?: string | null
  gear_description?: string | null
  transport_description?: string | null
}

type Props = {
  guideId: string
  mode: 'create' | 'edit'
  expId?: string
  defaultValues?: ExperienceFormDefaults
  /** Where to go on success. Defaults based on context. */
  successPath: string
  /** Optional label to show in the form title */
  guideName?: string
  context: 'admin' | 'guide'
}

// ─── Micro-components ─────────────────────────────────────────────────────────

const inputBase = {
  background: '#F3EDE4',
  border: '1.5px solid rgba(10,46,77,0.1)',
  color: '#0A2E4D',
}

function Field({ label, required, children }: { label: React.ReactNode; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
        {label}
        {required === true && <span className="ml-1" style={{ color: '#E67E50' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// Bug #2 fix: merge className via cn() so callers can add utility classes (e.g. mt-2)
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all',
        props.className,
      )}
      style={{ ...inputBase, ...(props.style ?? {}) }}
      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
    />
  )
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all resize-none"
      style={{ ...inputBase, ...(props.style ?? {}) }}
      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
    />
  )
}

function SectionCard({ title, subtitle, optional, children }: { title: string; subtitle?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div
      className="p-8 mb-5 rounded-3xl"
      style={{
        background: '#FDFAF7',
        border: '1px solid rgba(10,46,77,0.07)',
        boxShadow: '0 2px 16px rgba(10,46,77,0.04)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-[#0A2E4D] text-base font-bold f-display">{title}</h3>
        {optional === true && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full f-body"
            style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.38)' }}
          >
            Optional
          </span>
        )}
      </div>
      {subtitle != null && (
        <p className="text-[#0A2E4D]/40 text-xs f-body mb-5">{subtitle}</p>
      )}
      {subtitle == null && <div className="mb-5" />}
      {children}
    </div>
  )
}

function OptionalTag() {
  return (
    <span
      className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full f-body normal-case tracking-normal"
      style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.35)' }}
    >
      optional
    </span>
  )
}

function Pill({
  label, active, onClick, activeColor, activeBg,
}: {
  label: string
  active: boolean
  onClick: () => void
  activeColor?: string
  activeBg?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium px-3.5 py-1.5 rounded-full transition-all f-body"
      style={
        active
          ? { background: activeBg ?? '#0A2E4D', color: activeColor ?? '#fff' }
          : { background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)', border: '1px solid rgba(10,46,77,0.1)' }
      }
    >
      {label}
    </button>
  )
}

// ─── MonthSelect — reusable for Season from/to ───────────────────────────────

function MonthSelect({
  value,
  onChange,
  placeholder,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder: string
}) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all appearance-none cursor-pointer"
      style={inputBase}
      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
    >
      <option value="">{placeholder}</option>
      {MONTHS.map(m => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  )
}

// ─── Toggle — reusable switch button ─────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
      style={{ background: checked ? '#E67E50' : 'rgba(10,46,77,0.15)' }}
      role="switch"
      aria-checked={checked}
    >
      <span
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? '22px' : '4px' }}
      />
    </button>
  )
}

// ─── Nominatim geocoding helper ───────────────────────────────────────────────

async function geocodeLocation(city: string, country: string): Promise<{ lat: number; lng: number } | 'not_found' | 'error'> {
  const parts = [city.trim(), country.trim()].filter(Boolean)
  if (parts.length === 0) return 'not_found'

  try {
    const q = encodeURIComponent(parts.join(', '))
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    if (!res.ok) return 'error'

    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (data.length === 0) return 'not_found'

    return {
      lat: parseFloat(parseFloat(data[0].lat).toFixed(6)),
      lng: parseFloat(parseFloat(data[0].lon).toFixed(6)),
    }
  } catch {
    return 'error'
  }
}

// ─── Polygon centroid helper ──────────────────────────────────────────────────

function polygonCentroid(polygon: GeoJSON.Polygon): { lat: number; lng: number } {
  const coords = polygon.coordinates[0]
  const n = coords.length - 1 // closed ring: last === first
  const avgLng = coords.slice(0, n).reduce((s: number, c: number[]) => s + c[0], 0) / n
  const avgLat = coords.slice(0, n).reduce((s: number, c: number[]) => s + c[1], 0) / n
  return { lat: parseFloat(avgLat.toFixed(6)), lng: parseFloat(avgLng.toFixed(6)) }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExperienceForm({
  guideId,
  mode,
  expId,
  defaultValues: dv = {},
  successPath,
  guideName,
  context,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Basic ────────────────────────────────────────────────────────────────
  const [title,       setTitle]       = useState(dv.title ?? '')
  const [description, setDescription] = useState(dv.description ?? '')

  // ── Fishing ─────────────────────────────────────────────────────────────
  const [fishTypes, setFishTypes] = useState<string[]>(dv.fish_types ?? [])

  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'expert' | null>(dv.difficulty ?? null)
  const [catchAndRelease, setCatchAndRelease] = useState(dv.catch_and_release ?? false)

  // ── Landscape ────────────────────────────────────────────────────────────
  const [landscapeUrl,    setLandscapeUrl]    = useState<string>(dv.landscape_url ?? '')
  const [landscapeTab,    setLandscapeTab]    = useState<'library' | 'upload'>(
    dv.landscape_url ? 'library' : 'library'
  )
  const [heroCropSrc,     setHeroCropSrc]     = useState<string | null>(null)

  // ── Fishing methods ──────────────────────────────────────────────────────
  const [fishingMethods, setFishingMethods] = useState<string[]>(dv.fishing_methods ?? [])

  // ── Season ───────────────────────────────────────────────────────────────
  const [seasonFrom, setSeasonFrom] = useState<number | null>(dv.season_from ?? null)
  const [seasonTo,   setSeasonTo]   = useState<number | null>(dv.season_to ?? null)

  // ── Duration options ─────────────────────────────────────────────────────
  // Seed from structured data if present, otherwise from legacy scalar fields
  const [durationOptions, setDurationOptions] = useState<DurationOptionRow[]>(() => {
    if (dv.duration_options != null && dv.duration_options.length > 0) {
      return dv.duration_options.map(opt => {
        const pricingType: PricingType =
          opt.pricing_type === 'per_boat' || opt.pricing_type === 'per_group'
            ? opt.pricing_type
            : 'per_person'
        return {
          label:            opt.label,
          hours:            opt.hours != null ? String(opt.hours) : '',
          days:             opt.days  != null ? String(opt.days)  : '',
          pricing_type:     pricingType,
          price_eur:        String(opt.price_eur),
          group_prices:     opt.group_prices != null
            ? Object.fromEntries(
                Object.entries(opt.group_prices).map(([k, v]) => [Number(k), String(v)])
              )
            : {},
          includes_lodging: opt.includes_lodging,
        }
      })
    }
    // Backward compat — build a single row from legacy scalars
    const legacyHours = dv.duration_type === 'hours' ? (dv.duration_value ?? '') : ''
    const legacyDays  = dv.duration_type === 'days'  ? (dv.duration_value ?? '') : ''
    return [{
      label:            '',
      hours:            legacyHours,
      days:             legacyDays,
      pricing_type:     'per_person',
      price_eur:        dv.price_per_person_eur ?? '',
      group_prices:     {},
      includes_lodging: false,
    }]
  })

  // ── Max guests ───────────────────────────────────────────────────────────
  const [maxGuests, setMaxGuests] = useState(dv.max_guests ?? '4')

  // ── Location ─────────────────────────────────────────────────────────────
  const [locationCountry, setLocationCountry] = useState(dv.location_country ?? '')
  const [locationCity,    setLocationCity]    = useState(dv.location_city ?? '')
  const [meetingPoint,    setMeetingPoint]    = useState(dv.meeting_point ?? '')
  const [locationLat,     setLocationLat]     = useState<number | null>(dv.location_lat ?? null)
  const [locationLng,     setLocationLng]     = useState<number | null>(dv.location_lng ?? null)
  const [locationMode,    setLocationMode]    = useState<'pin' | 'area' | 'spots'>(
    dv.location_spots != null && (dv.location_spots as LocationSpot[]).length > 0
      ? 'spots'
      : dv.location_area != null ? 'area' : 'pin'
  )
  const [locationArea,    setLocationArea]    = useState<GeoJSON.Polygon | null>(
    (dv.location_area as unknown as GeoJSON.Polygon) ?? null
  )
  const [locationSpots,   setLocationSpots]   = useState<LocationSpot[]>(
    (dv.location_spots as unknown as LocationSpot[]) ?? []
  )
  const [isGeocoding,     setIsGeocoding]     = useState(false)
  const [geocodeError,    setGeocodeError]    = useState<string | null>(null)

  const handleMapChange = useCallback((lat: number, lng: number) => {
    setLocationLat(lat)
    setLocationLng(lng)
    setGeocodeError(null)
  }, [])

  const handleAreaChange = useCallback((area: GeoJSON.Polygon | null) => {
    setLocationArea(area)
    if (area != null) {
      const { lat, lng } = polygonCentroid(area)
      setLocationLat(lat)
      setLocationLng(lng)
    } else {
      setLocationLat(null)
      setLocationLng(null)
    }
  }, [])

  const handleSpotsChange = useCallback((spots: LocationSpot[]) => {
    setLocationSpots(spots)
    if (spots.length > 0) {
      const lat = parseFloat((spots.reduce((s, p) => s + p.lat, 0) / spots.length).toFixed(6))
      const lng = parseFloat((spots.reduce((s, p) => s + p.lng, 0) / spots.length).toFixed(6))
      setLocationLat(lat)
      setLocationLng(lng)
    } else {
      setLocationLat(null)
      setLocationLng(null)
    }
  }, [])

  // ── Images ───────────────────────────────────────────────────────────────
  const existingImages = dv.images ?? []
  const [coverUrl,      setCoverUrl]      = useState<string | null>(existingImages.find(i => i.is_cover)?.url ?? null)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(
    existingImages
      .filter(i => !i.is_cover)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img, i) => ({ url: img.url, is_cover: false, sort_order: i })),
  )

  // ── Itinerary ────────────────────────────────────────────────────────────
  const [itinerary, setItinerary] = useState<ItineraryStep[]>(
    dv.itinerary != null && dv.itinerary.length > 0 ? dv.itinerary : []
  )

  // ── Trip details (optional text fields) ──────────────────────────────────
  const [locationDescription,      setLocationDescription]      = useState(dv.location_description ?? '')
  const [boatDescription,          setBoatDescription]          = useState(dv.boat_description ?? '')
  const [accommodationDescription, setAccommodationDescription] = useState(dv.accommodation_description ?? '')
  const [foodDescription,          setFoodDescription]          = useState(dv.food_description ?? '')
  const [licenseDescription,       setLicenseDescription]       = useState(dv.license_description ?? '')
  const [gearDescription,          setGearDescription]          = useState(dv.gear_description ?? '')
  const [transportDescription,     setTransportDescription]     = useState(dv.transport_description ?? '')

  // ── Booking type ─────────────────────────────────────────────────────────
  const [bookingType, setBookingType] = useState<'classic' | 'icelandic' | 'both'>(dv.booking_type ?? 'classic')

  // ── Settings ─────────────────────────────────────────────────────────────
  const [published, setPublished] = useState(dv.published ?? false)

  // ── Error / success ──────────────────────────────────────────────────────
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)

  // ── Derived ──────────────────────────────────────────────────────────────
  // Whether any duration option has days > 1 (controls accommodation visibility)
  const hasDaysOption = durationOptions.some(opt => {
    const d = parseInt(opt.days, 10)
    return !isNaN(d) && d > 1
  })

  // ── Helpers ──────────────────────────────────────────────────────────────
  // ── Itinerary helpers ─────────────────────────────────────────────────────
  const addItineraryStep = () => {
    setItinerary(prev => [...prev, { time: '', label: '' }])
  }
  const removeItineraryStep = (i: number) => {
    setItinerary(prev => prev.filter((_, idx) => idx !== i))
  }
  const updateItineraryStep = (i: number, updates: Partial<ItineraryStep>) => {
    setItinerary(prev => {
      const next = [...prev]
      next[i] = { ...next[i], ...updates }
      return next
    })
  }

  const toggleFish = (f: string) =>
    setFishTypes(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])

  const toggleFishingMethod = (m: string) =>
    setFishingMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const updateDurationOption = (i: number, updates: Partial<DurationOptionRow>) => {
    setDurationOptions(prev => {
      const next = [...prev]
      next[i] = { ...next[i], ...updates }
      return next
    })
  }

  const addDurationOption = () => {
    if (durationOptions.length >= 4) return
    setDurationOptions(prev => [...prev, { ...EMPTY_DURATION_ROW }])
  }

  const removeDurationOption = (i: number) => {
    setDurationOptions(prev => prev.filter((_, idx) => idx !== i))
  }

  const syncGroupPricesKeys = (newMax: string) => {
    const n = parseInt(newMax, 10)
    if (isNaN(n) || n < 1) return
    // Sync group_prices keys inside every per_group duration option
    setDurationOptions(prev => prev.map(opt => {
      if (opt.pricing_type !== 'per_group') return opt
      const next: Record<number, string> = {}
      for (let k = 1; k <= n; k++) next[k] = opt.group_prices[k] ?? ''
      return { ...opt, group_prices: next }
    }))
  }

  const handlePricingTypeChange = (i: number, newType: PricingType) => {
    setDurationOptions(prev => {
      const next = [...prev]
      const opt: DurationOptionRow = { ...next[i], pricing_type: newType }
      // Auto-init group_prices keys when switching to per_group for the first time
      if (newType === 'per_group' && Object.keys(opt.group_prices).length === 0) {
        const n = parseInt(maxGuests, 10) || 0
        const prices: Record<number, string> = {}
        for (let k = 1; k <= n; k++) prices[k] = ''
        opt.group_prices = prices
      }
      next[i] = opt
      return next
    })
  }

  // Build images array for payload
  const buildImages = (): ImageInput[] => {
    const result: ImageInput[] = []
    if (coverUrl != null) result.push({ url: coverUrl, is_cover: true, sort_order: 0 })
    galleryImages.forEach((img, i) => {
      result.push({ url: img.url, is_cover: false, sort_order: i + 1 })
    })
    return result
  }

  // Geocode city/country via Nominatim → set map pin
  const handleGeocode = async () => {
    if (locationCity.trim() === '' && locationCountry.trim() === '') {
      setGeocodeError('Enter a city or country first.')
      return
    }
    setIsGeocoding(true)
    setGeocodeError(null)

    const result = await geocodeLocation(locationCity, locationCountry)

    if (result === 'not_found') {
      setGeocodeError('Location not found. Try a more specific city name.')
    } else if (result === 'error') {
      setGeocodeError('Geocoding failed. Check your connection and try again.')
    } else {
      setLocationLat(result.lat)
      setLocationLng(result.lng)
    }

    setIsGeocoding(false)
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // ── Validation ────────────────────────────────────────────────────────
    if (title.trim() === '')       { setError('Title is required.'); return }
    if (description.trim() === '') { setError('Description is required.'); return }
    if (fishTypes.length === 0)    { setError('Select at least one target species.'); return }

    // Duration / pricing validation — skip entirely for "on request" (icelandic) flow
    if (bookingType !== 'icelandic') {
      if (durationOptions.length === 0) {
        setError('Add at least one duration option.')
        return
      }
      for (let i = 0; i < durationOptions.length; i++) {
        const opt = durationOptions[i]
        if (opt.label.trim() === '') {
          setError(`Duration option ${i + 1} needs a label (e.g. "Full day").`)
          return
        }
        if (opt.pricing_type === 'per_group') {
          const hasAnyPrice = Object.values(opt.group_prices).some(v => v !== '' && parseFloat(v) > 0)
          if (!hasAnyPrice) {
            setError(`Option "${opt.label}": set at least one group size price.`)
            return
          }
        } else {
          const p = parseFloat(opt.price_eur)
          if (opt.price_eur === '' || isNaN(p) || p <= 0) {
            setError(`Option "${opt.label || i + 1}" needs a price greater than 0.`)
            return
          }
        }
      }
    }

    if (seasonFrom != null && seasonTo != null && seasonTo < seasonFrom) {
      setError('Season "To" month must be equal to or after the "From" month.')
      return
    }

    // ── Build duration options + pricing payload ──────────────────────────
    // For "on request" (icelandic) booking type: price, duration and options
    // are all null — the guide quotes a price per individual inquiry.
    let durationOptionsPayload: DurationOptionPayload[] | null = null
    let durationHours: number | null = null
    let durationDays:  number | null = null
    let pricePerPerson: number | null = null

    if (bookingType !== 'icelandic') {
      durationOptionsPayload = durationOptions.map(opt => {
        const base = {
          label:            opt.label.trim(),
          hours:            opt.hours !== '' ? parseInt(opt.hours, 10) : null,
          days:             opt.days  !== '' ? parseInt(opt.days,  10) : null,
          pricing_type:     opt.pricing_type,
          includes_lodging: opt.includes_lodging,
        }
        if (opt.pricing_type === 'per_group') {
          const prices: Record<string, number> = {}
          Object.entries(opt.group_prices).forEach(([k, v]) => {
            if (v !== '' && !isNaN(parseFloat(v))) prices[k] = parseFloat(v)
          })
          const vals = Object.values(prices)
          const minPrice = vals.length > 0 ? Math.min(...vals) : 0
          return { ...base, price_eur: minPrice, group_prices: prices }
        }
        return { ...base, price_eur: parseFloat(opt.price_eur) }
      })

      // Derive backward-compat scalars from first duration option
      const firstOpt = durationOptions[0]
      durationHours  = firstOpt.hours !== '' ? parseInt(firstOpt.hours, 10) : null
      durationDays   = firstOpt.days  !== '' ? parseInt(firstOpt.days,  10) : null
      pricePerPerson = durationOptionsPayload[0].price_eur
    }

    const payload: ExperiencePayload = {
      title:                title.trim(),
      description:          description.trim(),
      fish_types:           fishTypes,
      technique:            null,
      difficulty,
      catch_and_release:    catchAndRelease,
      duration_hours:       durationHours,
      duration_days:        durationDays,
      max_guests:           maxGuests !== '' ? parseInt(maxGuests, 10) : null,
      price_per_person_eur: pricePerPerson,
      location_country:     locationCountry.trim() || null,
      location_city:        locationCity.trim() || null,
      meeting_point:        meetingPoint.trim() || null,
      location_lat:         locationLat,
      location_lng:         locationLng,
      location_area:        locationMode === 'area'   ? locationArea  : null,
      location_spots:       locationMode === 'spots'  ? locationSpots : null,
      booking_type:         bookingType,
      what_included:        [],
      what_excluded:        [],
      published,
      images:               buildImages(),
      // Structured fields
      season_from:          seasonFrom,
      season_to:            seasonTo,
      fishing_methods:      fishingMethods,
      duration_options:     durationOptionsPayload,
      group_pricing:        null,
      inclusions_data:      null,
      landscape_url:        landscapeUrl.trim() || null,
      // Trip content fields
      itinerary:                    itinerary.length > 0 ? itinerary.filter(s => s.label.trim() !== '') : null,
      location_description:         locationDescription.trim() || null,
      boat_description:             boatDescription.trim() || null,
      accommodation_description:    accommodationDescription.trim() || null,
      food_description:             foodDescription.trim() || null,
      license_description:          licenseDescription.trim() || null,
      gear_description:             gearDescription.trim() || null,
      transport_description:        transportDescription.trim() || null,
    }

    startTransition(async () => {
      let result

      if (mode === 'create') {
        result = await createExperience(guideId, payload)
        if (result.success && result.data != null) {
          setCreatedId(result.data.id)
          setSuccess(true)
        } else if (!result.success) {
          setError(result.error)
        }
      } else {
        if (expId == null) { setError('Missing experience ID.'); return }
        result = await updateExperience(expId, payload)
        if (result.success) {
          router.push(successPath)
        } else {
          setError(result.error)
        }
      }
    })
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (success && createdId != null) {
    return (
      <div
        className="max-w-[600px] mx-auto text-center px-8 py-16 rounded-3xl"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 32px rgba(10,46,77,0.06)',
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(74,222,128,0.1)', border: '1.5px solid rgba(74,222,128,0.25)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        </div>

        <p className="text-[11px] uppercase tracking-[0.22em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Experience created
        </p>
        <h2 className="text-[#0A2E4D] text-2xl font-bold f-display mb-3">
          <span style={{ fontStyle: 'italic' }}>{title}</span>
        </h2>
        <p className="text-[#0A2E4D]/45 text-sm f-body mb-8 leading-relaxed">
          {published ? 'The experience is now live on the platform.' : 'Saved as draft. Publish it when ready.'}
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href={`/trips/${createdId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:brightness-110 f-body"
            style={{ background: '#E67E50' }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 2h9M11 2v9M11 2L2 11" />
            </svg>
            View experience
          </a>
          {context === 'admin' ? (
            <button
              type="button"
              onClick={() => router.push(successPath)}
              className="text-sm font-semibold px-5 py-2.5 rounded-full transition-all f-body hover:brightness-95"
              style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
            >
              Back to guide →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push(successPath)}
              className="text-sm font-semibold px-5 py-2.5 rounded-full transition-all f-body hover:brightness-95"
              style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
            >
              My experiences →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="max-w-[760px]">

      {/* Error banner */}
      {error != null && (
        <div
          className="flex items-start gap-3 px-5 py-4 rounded-2xl mb-5 f-body text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#DC2626' }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" className="flex-shrink-0 mt-0.5">
            <circle cx="7.5" cy="7.5" r="6" />
            <line x1="7.5" y1="4.5" x2="7.5" y2="8" />
            <circle cx="7.5" cy="10.5" r="0.5" fill="currentColor" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Booking Flow ─────────────────────────────────────────────── */}
      <SectionCard
        title="Booking Flow"
        subtitle="Choose how anglers book this experience."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            {
              value: 'classic' as const,
              label: 'Classic Booking',
              desc: 'Anglers pay directly via Stripe. You receive the payout after the trip.',
            },
            {
              value: 'icelandic' as const,
              label: 'Price on request',
              desc: 'Angler sends an inquiry with preferred dates. You review and send a custom offer with pricing.',
            },
            {
              value: 'both' as const,
              label: 'Both',
              desc: 'Angler chooses: pay instantly via Stripe or send a custom inquiry. You set a base price.',
            },
          ]).map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setBookingType(value)}
              className="flex items-start gap-3 px-5 py-4 rounded-2xl text-left transition-all h-full"
              style={bookingType === value
                ? { background: 'rgba(230,126,80,0.08)', border: '1.5px solid rgba(230,126,80,0.45)' }
                : { background: 'rgba(10,46,77,0.03)', border: '1.5px solid rgba(10,46,77,0.08)' }
              }
            >
              <span
                className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={bookingType === value
                  ? { borderColor: '#E67E50', background: '#E67E50' }
                  : { borderColor: 'rgba(10,46,77,0.25)', background: 'transparent' }
                }
              >
                {bookingType === value && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{label}</p>
                <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 1: Basic Info ────────────────────────────────────── */}
      <SectionCard title="Basic Info">
        <div className="flex flex-col gap-5">
          <Field label="Title" required>
            <TextInput
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Atlantic Salmon Fly Fishing in Hardangerfjord"
            />
          </Field>
          <Field label="Description" required>
            <TextArea
              rows={5}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the experience — what anglers will do, the location, what makes it special…"
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── Section 2: Fishing Details ───────────────────────────────── */}
      <SectionCard title="Fishing Details" subtitle="Target species and difficulty">
        <div className="flex flex-col gap-6">

          {/* Target species */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
              Target species <span style={{ color: '#E67E50' }}>*</span>
              {fishTypes.length > 0 && (
                <span className="ml-2 normal-case tracking-normal font-normal" style={{ color: '#E67E50' }}>
                  · {fishTypes.length} selected
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {FISH_OPTIONS.map(f => (
                <Pill
                  key={f}
                  label={f}
                  active={fishTypes.includes(f)}
                  onClick={() => toggleFish(f)}
                  activeColor="#E67E50"
                  activeBg="rgba(230,126,80,0.15)"
                />
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <Field label="Difficulty level">
            <div className="flex gap-2 flex-wrap">
              {DIFFICULTY_OPTIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(difficulty === d.value ? null : d.value)}
                  className="flex-1 py-3 rounded-2xl text-xs font-semibold transition-all f-body"
                  style={
                    difficulty === d.value
                      ? { background: d.bg, color: d.color, border: `1.5px solid ${d.color}30` }
                      : { background: 'rgba(10,46,77,0.05)', color: 'rgba(10,46,77,0.5)', border: '1.5px solid rgba(10,46,77,0.1)' }
                  }
                >
                  {d.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Catch & Release */}
          <div className="flex items-center gap-3">
            <Toggle checked={catchAndRelease} onChange={setCatchAndRelease} />
            <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.7)' }}>
              Catch &amp; Release only
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 3: Pricing & Logistics (hidden for price-on-request) ── */}
      {bookingType !== 'icelandic' && <SectionCard title="Pricing & Logistics">
        <div className="flex flex-col gap-7">

          {/* A) Season */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
              Season
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.4)' }}>From</p>
                <MonthSelect
                  value={seasonFrom}
                  onChange={setSeasonFrom}
                  placeholder="— Month"
                />
              </div>
              <div>
                <p className="text-[11px] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.4)' }}>To</p>
                <MonthSelect
                  value={seasonTo}
                  onChange={setSeasonTo}
                  placeholder="— Month"
                />
              </div>
            </div>
          </div>

          {/* B) Fishing methods */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
              Fishing methods
            </label>
            <div className="flex flex-wrap gap-2">
              {FISHING_METHODS.map(m => (
                <Pill
                  key={m}
                  label={m}
                  active={fishingMethods.includes(m)}
                  onClick={() => toggleFishingMethod(m)}
                />
              ))}
            </div>
          </div>

          {/* C) Duration options */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] mb-1 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
              Duration &amp; Pricing <span style={{ color: '#E67E50' }}>*</span>
            </label>
            <p className="text-[11px] f-body mb-4" style={{ color: 'rgba(10,46,77,0.4)' }}>
              Add 1–4 options (e.g. Half day, Full day). Anglers pick one when booking.
            </p>

            {/* Column headers */}
            <div className="hidden sm:grid mb-2" style={{ gridTemplateColumns: '1fr 72px 72px 96px auto auto' }}>
              {['Label', 'Hours', 'Days', 'Price €', 'Lodging', ''].map((h, i) => (
                <span key={i} className="text-[10px] font-semibold uppercase tracking-[0.14em] px-1 f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>{h}</span>
              ))}
            </div>

            {/* Duration option cards */}
            <div className="flex flex-col gap-3">
              {durationOptions.map((opt, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-4"
                  style={{
                    background: 'rgba(10,46,77,0.03)',
                    border: '1.5px solid rgba(10,46,77,0.08)',
                  }}
                >
                  {/* ── Row 1: label / duration / lodging / remove ── */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {/* Label */}
                    <TextInput
                      type="text"
                      value={opt.label}
                      onChange={e => updateDurationOption(i, { label: e.target.value })}
                      placeholder="e.g. Full day"
                      style={{ flex: '1 1 130px', minWidth: 0 }}
                    />
                    {/* Hours */}
                    <div className="relative" style={{ width: '68px', flexShrink: 0 }}>
                      <TextInput
                        type="number"
                        min="1"
                        value={opt.hours}
                        onChange={e => updateDurationOption(i, { hours: e.target.value })}
                        placeholder="—"
                        style={{ paddingRight: '22px' }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] f-body pointer-events-none" style={{ color: 'rgba(10,46,77,0.35)' }}>h</span>
                    </div>
                    {/* Days */}
                    <div className="relative" style={{ width: '68px', flexShrink: 0 }}>
                      <TextInput
                        type="number"
                        min="1"
                        value={opt.days}
                        onChange={e => updateDurationOption(i, { days: e.target.value })}
                        placeholder="—"
                        style={{ paddingRight: '22px' }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] f-body pointer-events-none" style={{ color: 'rgba(10,46,77,0.35)' }}>d</span>
                    </div>
                    {/* Lodging — only when days > 1 */}
                    {parseInt(opt.days, 10) > 1 && (
                      <label className="flex items-center gap-1.5 cursor-pointer select-none px-3 py-3 rounded-2xl" style={inputBase}>
                        <input
                          type="checkbox"
                          checked={opt.includes_lodging}
                          onChange={e => updateDurationOption(i, { includes_lodging: e.target.checked })}
                          className="rounded accent-[#E67E50]"
                        />
                        <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.65)' }}>🏠 Lodging</span>
                      </label>
                    )}
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeDurationOption(i)}
                      disabled={durationOptions.length === 1}
                      className="flex-shrink-0 ml-auto w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:brightness-90"
                      style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}
                      aria-label="Remove option"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
                      </svg>
                    </button>
                  </div>

                  {/* ── Row 2: pricing type selector ── */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.13em] f-body mr-1" style={{ color: 'rgba(10,46,77,0.4)' }}>
                      Pricing
                    </span>
                    <div className="flex rounded-2xl overflow-hidden flex-shrink-0" style={{ border: '1.5px solid rgba(10,46,77,0.12)' }}>
                      {PRICING_TYPE_OPTIONS.map(pt => (
                        <button
                          key={pt.value}
                          type="button"
                          onClick={() => handlePricingTypeChange(i, pt.value)}
                          title={pt.hint}
                          className="px-3.5 py-2 text-xs font-semibold transition-all f-body"
                          style={
                            opt.pricing_type === pt.value
                              ? { background: '#0A2E4D', color: '#fff' }
                              : { background: 'transparent', color: 'rgba(10,46,77,0.5)' }
                          }
                        >
                          {pt.label}
                        </button>
                      ))}
                    </div>

                    {/* Price input — only for per_person / per_boat */}
                    {opt.pricing_type !== 'per_group' && (
                      <div className="flex items-center gap-2">
                        <div className="relative" style={{ width: '110px' }}>
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm f-body pointer-events-none" style={{ color: 'rgba(10,46,77,0.4)' }}>€</span>
                          <TextInput
                            type="number"
                            min="1"
                            step="1"
                            value={opt.price_eur}
                            onChange={e => updateDurationOption(i, { price_eur: e.target.value })}
                            placeholder="400"
                            style={{ paddingLeft: '22px' }}
                          />
                        </div>
                        <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                          {opt.pricing_type === 'per_person' ? 'per person' : 'flat rate'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Row 3: per_group price table ── */}
                  {opt.pricing_type === 'per_group' && (
                    <div className="mt-3 flex flex-col gap-1.5 pl-2 border-l-2" style={{ borderColor: 'rgba(10,46,77,0.1)' }}>
                      {Array.from(
                        { length: parseInt(maxGuests, 10) || 0 },
                        (_, idx) => idx + 1,
                      ).map(n => (
                        <div key={n} className="flex items-center gap-2">
                          <span
                            className="text-xs f-body"
                            style={{ color: 'rgba(10,46,77,0.5)', minWidth: '72px' }}
                          >
                            {n} {n === 1 ? 'angler' : 'anglers'}
                          </span>
                          <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>→</span>
                          <div className="relative" style={{ width: '110px' }}>
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm f-body pointer-events-none" style={{ color: 'rgba(10,46,77,0.4)' }}>€</span>
                            <TextInput
                              type="number"
                              min="0"
                              step="1"
                              value={opt.group_prices[n] ?? ''}
                              onChange={e => updateDurationOption(i, {
                                group_prices: { ...opt.group_prices, [n]: e.target.value },
                              })}
                              placeholder="—"
                              style={{ paddingLeft: '22px' }}
                            />
                          </div>
                        </div>
                      ))}
                      {parseInt(maxGuests, 10) < 1 && (
                        <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
                          Set &quot;Max guests&quot; first to fill in group prices.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add option */}
            {durationOptions.length < 4 && (
              <button
                type="button"
                onClick={addDurationOption}
                className="mt-2 w-full py-3 rounded-2xl text-sm font-medium f-body transition-all hover:brightness-95 flex items-center justify-center gap-2"
                style={{
                  border: '1.5px dashed rgba(10,46,77,0.2)',
                  color: 'rgba(10,46,77,0.45)',
                  background: 'transparent',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="5.1" y="1" width="1.8" height="10" rx="0.9" />
                  <rect x="1" y="5.1" width="10" height="1.8" rx="0.9" />
                </svg>
                Add option
                <span className="text-[11px]" style={{ color: 'rgba(10,46,77,0.3)' }}>
                  ({durationOptions.length}/4)
                </span>
              </button>
            )}
          </div>

          {/* Max guests */}
          <Field label={<>Max guests <OptionalTag /></>}>
            <TextInput
              type="number"
              min="1"
              max="20"
              value={maxGuests}
              onChange={e => {
                setMaxGuests(e.target.value)
                syncGroupPricesKeys(e.target.value)
              }}
              placeholder="4"
              style={{ maxWidth: '160px' }}
            />
          </Field>

        </div>
      </SectionCard>}

      {/* ── Section 4: Location ──────────────────────────────────────── */}
      <SectionCard
        title="Location"
        subtitle="Fill in the text fields, then pin the exact spot on the map."
      >
        <div className="flex flex-col gap-5">

          {/* Country + City */}
          <div className="grid grid-cols-2 gap-5">
            <Field label="Country">
              <select
                value={locationCountry}
                onChange={e => setLocationCountry(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-sm f-body transition-all focus:outline-none"
                style={{
                  background: '#F3EDE4',
                  border: '1.5px solid rgba(10,46,77,0.12)',
                  color: locationCountry ? '#0A2E4D' : 'rgba(10,46,77,0.38)',
                }}
              >
                <option value="">Select country…</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="City / Region">
              <TextInput
                type="text"
                value={locationCity}
                onChange={e => setLocationCity(e.target.value)}
                placeholder="Hardangerfjord"
              />
            </Field>
          </div>

          {/* Meeting point */}
          <Field label="Meeting point">
            <TextInput
              type="text"
              value={meetingPoint}
              onChange={e => setMeetingPoint(e.target.value)}
              placeholder="e.g. Bergen Harbor, Bryggen — exact address or description"
            />
          </Field>

          {/* Location description */}
          <Field label={<>About this location <OptionalTag /></>}>
            <TextArea
              rows={3}
              value={locationDescription}
              onChange={e => setLocationDescription(e.target.value)}
              placeholder="Describe the fishing spot — the river, lake, fjord, what makes it special…"
            />
          </Field>

          {/* ── Map pin ─────────────────────────────────────────────── */}
          <div>

            {/* Row: label + coordinates + buttons */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                Map pin
              </label>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Coordinates badge — shown when pin is placed */}
                {locationLat != null && locationLng != null && (
                  <span
                    className="text-xs f-body font-mono px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.5)' }}
                  >
                    {locationLat.toFixed(4)}, {locationLng.toFixed(4)}
                  </span>
                )}

                {/* Clear location — works for pin, drawn area, and multi-spots */}
                {(locationLat != null || locationArea != null || locationSpots.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocationLat(null)
                      setLocationLng(null)
                      setLocationArea(null)
                      setLocationSpots([])
                      setGeocodeError(null)
                    }}
                    className="text-xs px-2.5 py-1 rounded-full f-body font-medium transition-all hover:brightness-95"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}
                  >
                    × Clear location
                  </button>
                )}

                {/* Auto-locate button → Nominatim geocoding */}
                <button
                  type="button"
                  onClick={() => { void handleGeocode() }}
                  disabled={isGeocoding}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full f-body font-semibold transition-all hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
                >
                  {isGeocoding ? (
                    <>
                      <svg className="animate-spin" width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="5.5" cy="5.5" r="4" strokeOpacity="0.25" />
                        <path d="M5.5 1.5a4 4 0 014 4" strokeLinecap="round" />
                      </svg>
                      Locating…
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="5.5" cy="5.5" r="4" />
                        <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" />
                        <line x1="5.5" y1="1" x2="5.5" y2="0" />
                        <line x1="5.5" y1="11" x2="5.5" y2="10" />
                        <line x1="1" y1="5.5" x2="0" y2="5.5" />
                        <line x1="11" y1="5.5" x2="10" y2="5.5" />
                      </svg>
                      Auto-locate
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Geocode error */}
            {geocodeError != null && (
              <p className="text-xs f-body mb-3" style={{ color: '#DC2626' }}>
                {geocodeError}
              </p>
            )}

            {/* Mode toggle */}
            <div className="flex items-center gap-2 mb-3">
              {([
                { value: 'pin',   label: 'Pin' },
                { value: 'area',  label: 'Draw Area' },
                { value: 'spots', label: 'Multi-spot' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLocationMode(value)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold f-body transition-all"
                  style={locationMode === value
                    ? { background: '#0A2E4D', color: '#fff' }
                    : { background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.55)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Map */}
            <div
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1.5px solid rgba(10,46,77,0.1)',
              }}
            >
              <LocationPickerMap
                mode={locationMode}
                lat={locationLat}
                lng={locationLng}
                onChange={handleMapChange}
                area={locationArea}
                onAreaChange={handleAreaChange}
                spots={locationSpots}
                onSpotsChange={handleSpotsChange}
              />
            </div>

            {/* Hint text */}
            <p className="text-xs f-body mt-2" style={{ color: 'rgba(10,46,77,0.35)' }}>
              {locationMode === 'area'
                ? locationArea != null
                  ? 'Area saved — use the edit tool to adjust or delete it'
                  : 'Use the polygon or rectangle tool to draw your trip area'
                : locationMode === 'spots'
                  ? 'Click on the map to add fishing spots · Name each one below'
                  : locationLat != null
                    ? 'Drag the pin to fine-tune · Click anywhere on the map to move it'
                    : 'Click "Auto-locate" to geocode the city/country · Or click directly on the map'}
            </p>

            {/* Area mode — explanation for anglers */}
            {locationMode === 'area' && (
              <div
                className="flex items-start gap-3 mt-3 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(10,46,77,0.4)" strokeWidth="1.4" className="flex-shrink-0 mt-0.5">
                  <circle cx="7" cy="7" r="6" />
                  <line x1="7" y1="5" x2="7" y2="7.5" />
                  <circle cx="7" cy="10" r="0.5" fill="rgba(10,46,77,0.4)" stroke="none" />
                </svg>
                <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  This guide operates across the lakes and rivers within this area. The exact fishing spot will be confirmed with you during the booking process.
                </p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Section 5: Trip Plan ─────────────────────────────────────── */}
      <SectionCard
        title="Trip Plan"
        optional
        subtitle="Describe the day step by step. Only shown on the trip page if filled in."
      >
        <div className="flex flex-col gap-2">
          {itinerary.length > 0 && (
            <div className="flex flex-col gap-2 mb-2">
              {itinerary.map((step, i) => (
                <div key={i} className="flex gap-2 items-center">
                  {/* Step number */}
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold f-body"
                    style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.4)' }}
                  >
                    {i + 1}
                  </span>
                  {/* Time */}
                  <TextInput
                    type="text"
                    value={step.time}
                    onChange={e => updateItineraryStep(i, { time: e.target.value })}
                    placeholder="09:00"
                    style={{ width: '76px', flexShrink: 0, fontSize: '13px' }}
                  />
                  {/* Label */}
                  <TextInput
                    type="text"
                    value={step.label}
                    onChange={e => updateItineraryStep(i, { label: e.target.value })}
                    placeholder="e.g. Depart from harbour"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeItineraryStep(i)}
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:brightness-90"
                    style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
                    aria-label="Remove step"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {itinerary.length === 0 && (
            <p className="text-xs f-body mb-2" style={{ color: 'rgba(10,46,77,0.35)' }}>
              No steps added yet. Click below to start building the trip schedule.
            </p>
          )}

          <button
            type="button"
            onClick={addItineraryStep}
            className="w-full py-3 rounded-2xl text-sm font-medium f-body transition-all hover:brightness-95 flex items-center justify-center gap-2"
            style={{
              border: '1.5px dashed rgba(10,46,77,0.2)',
              color: 'rgba(10,46,77,0.45)',
              background: 'transparent',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="5.1" y="1" width="1.8" height="10" rx="0.9" />
              <rect x="1" y="5.1" width="10" height="1.8" rx="0.9" />
            </svg>
            Add step
          </button>
        </div>
      </SectionCard>

      {/* ── Section 6: Trip Details ───────────────────────────────────── */}
      <SectionCard
        title="Trip Details"
        optional
        subtitle="Fill in only what's relevant — empty sections won't appear on the trip page."
      >
        <div className="flex flex-col gap-5">
          {([
            {
              key: 'boat',
              label: 'Boat',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: 'rgba(10,46,77,0.4)' }}>
                  <path d="M2 20h20M5 20l-1-6h16l-1 6M12 4v10M8 14V9l4-5 4 5v5" />
                </svg>
              ),
              placeholder: 'e.g. 6m aluminium boat, 60HP Yamaha, sonar, capacity 4 anglers',
              value: boatDescription,
              setter: setBoatDescription,
            },
            {
              key: 'accommodation',
              label: 'Accommodation',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: 'rgba(10,46,77,0.4)' }}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              ),
              placeholder: 'e.g. Riverside cabin, 2 bedrooms, kitchen, WiFi included',
              value: accommodationDescription,
              setter: setAccommodationDescription,
            },
            {
              key: 'food',
              label: 'Food & Drinks',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: 'rgba(10,46,77,0.4)' }}>
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />
                </svg>
              ),
              placeholder: 'e.g. Hot lunch and coffee provided. Bring your own snacks.',
              value: foodDescription,
              setter: setFoodDescription,
            },
            {
              key: 'license',
              label: 'Fishing Licence',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: 'rgba(10,46,77,0.4)' }}>
                  <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="9" x2="17" y2="9" /><line x1="7" y1="13" x2="14" y2="13" />
                </svg>
              ),
              placeholder: 'e.g. Licence required, ~€15/day. We help you arrange it — just ask.',
              value: licenseDescription,
              setter: setLicenseDescription,
            },
            {
              key: 'gear',
              label: 'Gear & Equipment',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: 'rgba(10,46,77,0.4)' }}>
                  <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
              ),
              placeholder: 'e.g. All spinning rods provided. Bring your own waders and polarised glasses.',
              value: gearDescription,
              setter: setGearDescription,
            },
            {
              key: 'transport',
              label: 'Getting There',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: 'rgba(10,46,77,0.4)' }}>
                  <circle cx="5.5" cy="17.5" r="2.5" /><circle cx="18.5" cy="17.5" r="2.5" /><path d="M15 6H3L2 12h13V6zM15 6l3 6h2l1-3-3-3h-3z" />
                </svg>
              ),
              placeholder: 'e.g. Meet at Tromsø harbour (free parking). 2h drive from the airport.',
              value: transportDescription,
              setter: setTransportDescription,
            },
          ] as Array<{ key: string; label: string; icon: React.ReactNode; placeholder: string; value: string; setter: (v: string) => void }>).map(field => (
            <div key={field.key}>
              <label
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body"
                style={{ color: 'rgba(10,46,77,0.55)' }}
              >
                {field.icon}
                {field.label}
                <OptionalTag />
              </label>
              <TextArea
                rows={2}
                value={field.value}
                onChange={e => field.setter(e.target.value)}
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 6: Photos ────────────────────────────────────────── */}
      {/* ── Section: Hero Landscape ──────────────────────────────── */}
      <SectionCard
        title="Hero Background"
        subtitle="Full-width landscape shown behind the experience title. Pick from our library or upload your own."
      >
        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-2xl" style={{ background: 'rgba(10,46,77,0.05)', width: 'fit-content' }}>
          {(['library', 'upload'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setLandscapeTab(tab)}
              className="px-5 py-2 rounded-xl text-sm font-semibold f-body transition-all capitalize"
              style={landscapeTab === tab
                ? { background: '#fff', color: '#0A2E4D', boxShadow: '0 1px 4px rgba(10,46,77,0.12)' }
                : { color: 'rgba(10,46,77,0.45)' }
              }
            >
              {tab === 'library' ? 'Pick from library' : 'Upload my own'}
            </button>
          ))}
        </div>

        {landscapeTab === 'library' && (
          <div className="grid grid-cols-3 gap-3">
            {LANDSCAPE_LIBRARY.map(url => {
              const selected = landscapeUrl === url
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => setHeroCropSrc(url)}
                  className="relative overflow-hidden transition-all group"
                  style={{
                    height: '100px',
                    borderRadius: '12px',
                    border: selected ? '2.5px solid #E67E50' : '2px solid rgba(10,46,77,0.1)',
                    boxShadow: selected ? '0 0 0 3px rgba(230,126,80,0.2)' : 'none',
                  }}
                >
                  <Image src={url} alt="" fill className="object-cover" />
                  {selected && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(230,126,80,0.25)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" fill="rgba(230,126,80,0.9)" stroke="none" />
                        <path d="M8 12l3 3 5-5" stroke="white" />
                      </svg>
                    </div>
                  )}
                  {!selected && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(7,17,28,0.55)' }}>
                      <span className="text-[10px] font-semibold f-body" style={{ color: '#fff' }}>Crop &amp; use</span>
                    </div>
                  )}
                </button>
              )
            })}
            {/* None option */}
            <button
              type="button"
              onClick={() => setLandscapeUrl('')}
              className="flex flex-col items-center justify-center gap-1 transition-all"
              style={{
                height: '100px',
                borderRadius: '12px',
                border: landscapeUrl === '' ? '2.5px solid #E67E50' : '2px dashed rgba(10,46,77,0.15)',
                background: 'rgba(10,46,77,0.03)',
              }}
            >
              <span className="text-lg">✕</span>
              <span className="text-[11px] f-body font-medium" style={{ color: 'rgba(10,46,77,0.4)' }}>Auto-assign</span>
            </button>
          </div>
        )}

        {landscapeTab === 'upload' && (
          <div>
            <ImageUpload
              label="Hero landscape"
              currentUrl={landscapeUrl || null}
              aspect="wide"
              variant="cover"
              cropAspect={16 / 9}
              onUpload={url => setLandscapeUrl(url)}
            />
            <p className="text-[11px] f-body mt-2" style={{ color: 'rgba(10,46,77,0.4)' }}>
              Landscape orientation recommended · min 2400px wide
            </p>
          </div>
        )}
      </SectionCard>

      {/* Hero crop modal */}
      {heroCropSrc != null && (
        <ImageCropModal
          src={heroCropSrc}
          aspect={16 / 9}
          onConfirm={async (croppedFile) => {
            setHeroCropSrc(null)
            const ext  = 'jpg'
            const path = `${crypto.randomUUID()}.${ext}`
            const supabase = createClient()
            const { error } = await supabase.storage
              .from('guide-photos')
              .upload(path, croppedFile, { cacheControl: '31536000', upsert: false, contentType: 'image/jpeg' })
            if (error == null) {
              const { data: { publicUrl } } = supabase.storage.from('guide-photos').getPublicUrl(path)
              setLandscapeUrl(publicUrl)
            }
          }}
          onCancel={() => setHeroCropSrc(null)}
        />
      )}

      <SectionCard title="Photos" subtitle="Cover photo is required. Gallery: up to 6 photos, select multiple at once.">
        <div className="flex flex-col gap-6">
          {/* Cover — single image with 16:9 crop */}
          <ImageUpload
            label="Cover photo *"
            aspect="wide"
            variant="cover"
            cropAspect={16 / 9}
            currentUrl={coverUrl}
            onUpload={url => setCoverUrl(url)}
            pickFrom={galleryImages.map(g => g.url)}
            hint="Main card image — crop to 16:9 before upload, full quality"
          />
          {/* Gallery — multi-select, thumbnails + progress */}
          <MultiImageUpload
            label="Gallery photos"
            max={6}
            initial={galleryImages}
            cropAspect={4 / 3}
            onChange={setGalleryImages}
          />
        </div>
      </SectionCard>

      {/* ── Settings ──────────────────────────────────────────────── */}
      <div
        className="px-8 py-6 mb-6 rounded-3xl flex items-center justify-between"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.07)',
          boxShadow: '0 2px 16px rgba(10,46,77,0.04)',
        }}
      >
        <div>
          <p className="text-[#0A2E4D] text-sm font-bold f-body">Publish immediately</p>
          <p className="text-[#0A2E4D]/40 text-xs f-body mt-0.5">
            Visible to anglers on /experiences. You can change this later.
          </p>
        </div>
        <Toggle checked={published} onChange={setPublished} />
      </div>

      {/* ── Submit ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 text-white text-sm font-semibold px-7 py-3.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 f-body"
          style={{ background: '#E67E50' }}
        >
          {isPending ? (
            <>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="7" cy="7" r="5" strokeOpacity="0.25" />
                <path d="M7 2a5 5 0 015 5" strokeLinecap="round" />
              </svg>
              {mode === 'create' ? 'Creating…' : 'Saving…'}
            </>
          ) : (
            <>
              {mode === 'create' ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                    <rect x="5.8" y="1" width="1.4" height="11" rx="0.7" />
                    <rect x="1" y="5.8" width="11" height="1.4" rx="0.7" />
                  </svg>
                  Create Trip
                </>
              ) : (
                'Save Changes →'
              )}
            </>
          )}
        </button>

        {mode === 'create' && (
          <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
            {published
              ? 'Goes live on /experiences immediately'
              : 'Saved as draft — publish later'}
          </p>
        )}
      </div>
    </form>
  )
}
