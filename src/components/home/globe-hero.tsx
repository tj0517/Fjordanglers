'use client'

/**
 * The home hero with the globe (docs/design/site-2026-11/home.dc.html): the photo frame with the
 * headline on the left (`children`) and a Mapbox GL globe on the right that turns to the selected
 * destination; the destination buttons sit under the frame. The globe is Mapbox GL v3 (tj,
 * 2026-11-17), not the mockup's d3 canvas: light style, sea and land recoloured to the mockup's,
 * the selected destination's countries filled salmon, one pin per offer with coordinates.
 *
 * Without `NEXT_PUBLIC_MAPBOX_TOKEN` there is no globe and no destination buttons — the hero is the
 * headline alone. `mapbox-gl` is imported inside the effect, so it never reaches the server bundle
 * or a page without the globe. On a touch screen the globe does not take drag gestures (the page
 * must still scroll); it turns only from the buttons. Reduced motion: no idle spin, no fly.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Map as MapboxMap } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { CREAM, LINE, NAVY, SALMON_ON_DARK } from '@/components/site/ui'
import s from './home.module.css'

export type GlobeDestination = {
  slug:      string
  name:      string
  /** Where the globe turns to: [lng, lat]. */
  center:    [number, number]
  /** ISO 3166-1 alpha-2 codes filled when the destination is selected. */
  iso:       string[]
  tripCount: number
  priceFrom: string | null
  pins:      [number, number][]
}

const SEA  = '#8CC6F0'
const LAND = '#E3EDD6'
const SELECTED_LAND = '#F6CDB5'
const PIN = '#E67E50'

function pinsGeoJson(destinations: GlobeDestination[]): GeoJSON.FeatureCollection<GeoJSON.Point, { slug: string }> {
  return {
    type: 'FeatureCollection',
    features: destinations.flatMap(d => d.pins.map(([lng, lat]) => ({
      type: 'Feature' as const,
      properties: { slug: d.slug },
      geometry: { type: 'Point' as const, coordinates: [lng, lat] },
    }))),
  }
}

export function GlobeHero({
  token, destinations, initial, children,
}: { token: string | null; destinations: GlobeDestination[]; initial: string | null; children: ReactNode }) {
  const [selected, setSelected] = useState(initial ?? destinations[0]?.slug ?? null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const readyRef = useRef(false)
  const selectedRef = useRef(selected)
  const destinationsRef = useRef(destinations)
  /** No idle spin before this time (ms): after a fly to a destination, and after a drag. */
  const idleUntilRef = useRef(0)
  const hasGlobe = token != null && token !== '' && destinations.length > 0

  // Create the map once.
  useEffect(() => {
    if (!hasGlobe || containerRef.current == null) return
    let cancelled = false
    let spinTimer: ReturnType<typeof setTimeout> | undefined
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches

    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelled || containerRef.current == null) return
      const destinations = destinationsRef.current
      const start = destinations.find(d => d.slug === selectedRef.current) ?? destinations[0]
      const map = new mapboxgl.Map({
        accessToken:        token ?? undefined,
        container:          containerRef.current,
        style:              'mapbox://styles/mapbox/light-v11',
        projection:         'globe',
        center:             start != null ? [start.center[0] + 25, start.center[1]] : [0, 30],
        zoom:               1.35,
        attributionControl: false,
        scrollZoom:         false,
        doubleClickZoom:    false,
        boxZoom:            false,
        dragRotate:         false,
        pitchWithRotate:    false,
        touchZoomRotate:    false,
        dragPan:            !coarse,
        renderWorldCopies:  false,
      })
      mapRef.current = map
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

      let interacting = false
      // Idle spin: a slow eastward drift, paused while the user drags, for 4 s after a drag and
      // for 6 s after the globe turns to a destination (as the mockup's canvas does).
      const spin = () => {
        if (reduceMotion || interacting || cancelled) return
        const wait = idleUntilRef.current - performance.now()
        if (wait > 0) { spinTimer = setTimeout(spin, wait); return }
        const c = map.getCenter()
        map.easeTo({ center: [c.lng - 6, c.lat], duration: 1000, easing: t => t })
      }
      map.on('mousedown', () => { interacting = true; clearTimeout(spinTimer) })
      map.on('mouseup', () => { interacting = false; idleUntilRef.current = performance.now() + 4000 })
      map.on('moveend', () => { clearTimeout(spinTimer); spinTimer = setTimeout(spin, 0) })

      map.on('style.load', () => {
        map.setFog({
          color:            'rgba(0, 0, 0, 0)',
          // Transparent: any colour here fills the whole canvas square behind the sphere (tj, 2026-11-17).
          'high-color':     'rgba(0, 0, 0, 0)',
          'horizon-blend':  0.04,
          'space-color':    'rgba(0, 0, 0, 0)',
          'star-intensity': 0,
        })
        if (map.getLayer('water') != null) map.setPaintProperty('water', 'fill-color', SEA)
        if (map.getLayer('land') != null) map.setPaintProperty('land', 'background-color', LAND)

        const firstSymbol = map.getStyle()?.layers.find(l => l.type === 'symbol')?.id
        map.addSource('fa-countries', { type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1' })
        map.addLayer({
          id: 'fa-selected-country',
          type: 'fill',
          source: 'fa-countries',
          'source-layer': 'country_boundaries',
          paint: { 'fill-color': SELECTED_LAND, 'fill-opacity': 0.95 },
          filter: ['in', ['get', 'iso_3166_1'], ['literal', []]],
        }, firstSymbol)

        map.addSource('fa-pins', { type: 'geojson', data: pinsGeoJson(destinations) })
        map.addLayer({
          id: 'fa-pins',
          type: 'circle',
          source: 'fa-pins',
          paint: {
            'circle-radius':       ['case', ['==', ['get', 'slug'], ''], 8, 6],
            'circle-color':        PIN,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 2,
          },
        })
        readyRef.current = true
        paintSelection(map, destinations, selectedRef.current)
        if (start != null) flyTo(map, start, reduceMotion, 1800, idleUntilRef)
      })
    })

    return () => {
      cancelled = true
      clearTimeout(spinTimer)
      readyRef.current = false
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Built once per token; the destinations are fixed for the page's life, a new selection is
    // applied by the effect below.
  }, [hasGlobe, token])

  // Turn to the selected destination.
  useEffect(() => {
    selectedRef.current = selected
    const map = mapRef.current
    if (map == null || !readyRef.current) return
    paintSelection(map, destinations, selected)
    const d = destinations.find(x => x.slug === selected)
    if (d != null) flyTo(map, d, window.matchMedia('(prefers-reduced-motion: reduce)').matches, 1500, idleUntilRef)
  }, [selected, destinations])

  const current = destinations.find(d => d.slug === selected) ?? null

  return (
    <>
      <section
        data-block="hero"
        className="relative mx-auto mt-3 flex items-end overflow-hidden pt-[120px]"
        style={{ width: 'calc(100% - 24px)', maxWidth: 1560, minHeight: 'calc(100svh - 24px)', borderRadius: 28, paddingBottom: 'clamp(28px, 4vw, 48px)', background: NAVY }}
      >
        <Image src="/hub/canyon.jpg" alt="" fill priority sizes="(min-width: 1584px) 1560px, 100vw" className="object-cover" style={{ objectPosition: 'center 40%' }} />
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'linear-gradient(100deg, rgba(7,22,36,.86) 0%, rgba(7,22,36,.72) 50%, rgba(7,22,36,.62) 100%)' }}
        />
        <div className="relative mx-auto flex w-full flex-wrap items-center gap-x-12 gap-y-8 px-6" style={{ maxWidth: 1200 }}>
          <div className="flex min-w-0 max-w-[600px] flex-[1_1_420px] flex-col items-start gap-[22px]">
            {children}
          </div>
          {hasGlobe && (
            <div className="flex min-w-0 flex-[1_1_420px] flex-col items-center gap-4">
              <div
                ref={containerRef}
                role="img"
                aria-label="Globe showing FjordAnglers fishing destinations"
                className="w-full max-w-[500px]"
                style={{ aspectRatio: '1 / 1' }}
              />
              {current != null && (
                <p className="f-body m-0 flex flex-wrap items-center justify-center gap-x-[14px] gap-y-[6px] text-[15px]" style={{ color: '#E3EAF0' }}>
                  <span className="f-display text-[22px] font-bold" style={{ color: '#FFFFFF' }}>{current.name}</span>
                  {current.tripCount > 0 && <span>{current.tripCount} {current.tripCount === 1 ? 'trip' : 'trips'}</span>}
                  {current.priceFrom != null && <span>{current.priceFrom}</span>}
                  <Link href={`/${current.slug}`} className="inline-flex min-h-[44px] items-center font-bold" style={{ color: SALMON_ON_DARK, textDecoration: 'none' }}>
                    See trips →
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {hasGlobe && (
        <div className="mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-[10px] px-6 pt-5" style={{ maxWidth: 1200 }}>
          <span className="f-body text-[12.5px] font-bold uppercase" style={{ letterSpacing: '.12em', color: '#E67E50' }}>Spin the globe</span>
          <div role="group" aria-label="Destinations" className="flex flex-wrap justify-center gap-2">
            {destinations.map(d => {
              const on = d.slug === selected
              return (
                <button
                  key={d.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(d.slug)}
                  className={`${s.chip} f-body min-h-[44px] cursor-pointer rounded-full px-[18px] text-[15px] font-medium`}
                  style={{ border: `1px solid ${on ? NAVY : LINE}`, background: on ? NAVY : CREAM, color: on ? '#FFFFFF' : NAVY }}
                >
                  {d.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

function paintSelection(map: MapboxMap, destinations: GlobeDestination[], selected: string | null) {
  const iso = destinations.find(d => d.slug === selected)?.iso ?? []
  map.setFilter('fa-selected-country', ['in', ['get', 'iso_3166_1'], ['literal', iso]])
  map.setPaintProperty('fa-pins', 'circle-radius', ['case', ['==', ['get', 'slug'], selected ?? ''], 8, 6])
}

function flyTo(map: MapboxMap, d: GlobeDestination, reduceMotion: boolean, duration: number, idleUntil: { current: number }) {
  // Aim a little south of the destination so it sits above the globe's centre, as in the mockup.
  const target: [number, number] = [d.center[0], d.center[1] - 6]
  idleUntil.current = performance.now() + duration + 6000
  if (reduceMotion) map.jumpTo({ center: target })
  else map.flyTo({ center: target, zoom: 1.35, duration, essential: false })
}
