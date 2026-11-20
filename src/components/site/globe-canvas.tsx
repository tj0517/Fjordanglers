'use client'

/**
 * The site's globe — the home hero and /trips (docs/design/site-2026-11/home.dc.html, the script at
 * its end; chosen over Mapbox by tj, 2026-11-18): an orthographic
 * d3-geo projection drawn on a canvas from /hub/world.json — no tile service, no token, no logo.
 * Sea, land and the selected destination's countries in the mockup's colours, a halo, one pin per
 * offer with coordinates, and our destinations' names only — no other country is named (tj, 2026-11-17). Drag turns it
 * (mouse only — on touch the page scrolls); a new selection flies there; it drifts when idle.
 * Reduced motion: no drift, the fly is a jump.
 *
 * A pin or a destination's name is clickable (tj, 2026-11-20): `onPick` gets its slug — a click,
 * not the end of a drag, and a tap on touch. The pointer turns to a hand over one.
 */

import { useEffect, useRef } from 'react'
import { geoDistance, geoOrthographic, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'

/** A place the globe can turn to: a hub on the home page, a country on /trips. */
export type GlobePlace = {
  slug:   string
  name:   string
  /** Where the globe turns to: [lng, lat]. */
  center: [number, number]
  /** The countries filled when the place is selected, as /hub/world.json names them. */
  countryNames: string[]
  /** One pin per offer with coordinates: [lng, lat]. */
  pins:   [number, number][]
}

type World = FeatureCollection<Geometry, { n: string }>

const WORLD_URL  = '/hub/world.json'
/** The globe aims this many degrees south of a destination, so it sits above the centre. */
const LAT_OFFSET = 6

function target(d: GlobePlace): [number, number, number] {
  return [-d.center[0], Math.max(-85, Math.min(85, -(d.center[1] - LAT_OFFSET))), 0]
}

type GlobeState = {
  rot:       [number, number, number]
  world:     World | null
  drag:      { x: number; y: number; r: [number, number, number]; moved: boolean } | null
  anim:      { from: [number, number, number]; to: [number, number, number]; t0: number; dur: number } | null
  idleUntil: number
  last:      number
  radius:    number
  selected:  string | null
  /** What can be clicked in the last frame, in the canvas's own CSS pixels. */
  hits:      Hit[]
}

type Hit = { slug: string; x: number; y: number; w: number; h: number }

/** A drag shorter than this is a click. */
const CLICK_SLOP = 5
/** Pins are small; the clickable square around one is this wide. */
const PIN_HIT = 28

function hitAt(s: GlobeState, x: number, y: number): string | null {
  // Last drawn is on top: the labels, then the selected destination's pins.
  for (let i = s.hits.length - 1; i >= 0; i--) {
    const h = s.hits[i]!
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.slug
  }
  return null
}

/** The pointer in the canvas's CSS pixels — the hero around it may be scaled while it scrolls away. */
function localPoint(cv: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
  const r = cv.getBoundingClientRect()
  return [(clientX - r.left) * (cv.clientWidth / r.width), (clientY - r.top) * (cv.clientHeight / r.height)]
}

function flyTo(s: GlobeState, d: GlobePlace, dur: number, reduceMotion: boolean) {
  const t = target(d)
  if (reduceMotion) { s.rot = t; s.anim = null; return }
  const from: [number, number, number] = [s.rot[0], s.rot[1], 0]
  const dl = ((t[0] - from[0] + 540) % 360) - 180
  s.anim = { from, to: [from[0] + dl, t[1], 0], t0: performance.now(), dur }
  s.idleUntil = performance.now() + dur + 6000
}

export function GlobeCanvas({
  destinations, selected, onPick,
}: { destinations: readonly GlobePlace[]; selected: string | null; onPick?: (slug: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const state = useRef<GlobeState>({
    rot: [20, -58, 0], world: null, drag: null, anim: null, idleUntil: 0, last: 0, radius: 600, selected, hits: [],
  })

  // Load the outlines, then draw every frame.
  useEffect(() => {
    const s = state.current
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ours = new Set(destinations.flatMap(d => d.countryNames))
    let raf = 0
    let cancelled = false

    fetch(WORLD_URL).then(r => r.json() as Promise<World>).then(w => {
      if (cancelled) return
      s.world = w
    }).catch(() => {})

    const start = destinations.find(d => d.slug === s.selected)
    if (start != null) {
      s.rot = target(start)
      s.rot[0] += 25
      flyTo(s, start, 1800, reduceMotion)
    }

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const cv = canvasRef.current
      if (cv == null) return
      const w = cv.clientWidth, h = cv.clientHeight
      if (w === 0 || h === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      }
      const dt = s.last !== 0 ? Math.min(64, now - s.last) : 16
      s.last = now

      if (s.anim != null) {
        const a = s.anim
        let p = Math.min(1, (now - a.t0) / a.dur)
        p = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
        s.rot = [a.from[0] + (a.to[0] - a.from[0]) * p, a.from[1] + (a.to[1] - a.from[1]) * p, 0]
        if (p >= 1) s.anim = null
      } else if (s.drag == null && !reduceMotion && now > s.idleUntil) {
        s.rot = [s.rot[0] + dt * 0.004, s.rot[1], 0]
      }

      const ctx = cv.getContext('2d')
      if (ctx == null) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const R = Math.max(120, Math.min(w, h) / 2 - 18)
      s.radius = R
      const cx = w / 2, cy = h / 2
      const proj = geoOrthographic().scale(R).translate([cx, cy]).rotate(s.rot).clipAngle(90).precision(0.4)
      const path = geoPath(proj, ctx)

      const halo = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.05)
      halo.addColorStop(0, 'rgba(176, 215, 245, 0.75)')
      halo.addColorStop(1, 'rgba(176, 215, 245, 0)')
      ctx.fillStyle = halo
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2); ctx.fill()

      const sea = ctx.createRadialGradient(cx, cy - R * 0.2, R * 0.2, cx, cy, R)
      sea.addColorStop(0, '#A6D5F7')
      sea.addColorStop(0.75, '#8CC6F0')
      sea.addColorStop(1, '#79B8E8')
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = sea; ctx.fill()

      const sel = destinations.find(d => d.slug === s.selected)
      const selNames = new Set(sel?.countryNames ?? [])
      if (s.world != null) {
        for (const f of s.world.features) {
          ctx.beginPath(); path(f as Feature)
          ctx.fillStyle = selNames.has(f.properties.n) ? '#F6CDB5' : ours.has(f.properties.n) ? '#D3E8C2' : '#E3EDD6'
          ctx.fill()
          ctx.strokeStyle = 'rgba(140, 150, 140, 0.55)'; ctx.lineWidth = 0.6; ctx.stroke()
        }
      }

      const hits: Hit[] = []
      const center: [number, number] = [-s.rot[0], -s.rot[1]]
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      const label = (slug: string, txt: string, ll: [number, number]) => {
        if (geoDistance(ll, center) > 1.3) return
        const xy = proj(ll)
        if (xy == null || xy[1] > h - 60) return
        ctx.font = '600 15px "DM Sans", system-ui, sans-serif'
        ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.strokeText(txt, xy[0], xy[1])
        ctx.fillStyle = '#0A2E4D'
        ctx.fillText(txt, xy[0], xy[1])
        const tw = ctx.measureText(txt).width
        hits.push({ slug, x: xy[0] - tw / 2 - 4, y: xy[1] - 12, w: tw + 8, h: 24 })
      }

      let i = 0
      for (const d of destinations) {
        const on = d.slug === s.selected
        for (const ll of d.pins) {
          i++
          if (geoDistance(ll, center) > 1.48) continue
          const xy = proj(ll)
          if (xy == null) continue
          if (on && !reduceMotion) {
            const ph = ((now / 1000 + i * 0.41) % 2.2) / 2.2
            ctx.beginPath(); ctx.arc(xy[0], xy[1], 8 + ph * 20, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(230, 126, 80, ${(1 - ph) * 0.4})`; ctx.fill()
          }
          ctx.beginPath(); ctx.arc(xy[0], xy[1], on ? 8 : 6, 0, Math.PI * 2)
          ctx.fillStyle = on ? '#E67E50' : 'rgba(226, 96, 47, 0.85)'; ctx.fill()
          ctx.lineWidth = 2; ctx.strokeStyle = '#FFFFFF'; ctx.stroke()
          hits.push({ slug: d.slug, x: xy[0] - PIN_HIT / 2, y: xy[1] - PIN_HIT / 2, w: PIN_HIT, h: PIN_HIT })
        }
      }

      for (const d of destinations) label(d.slug, d.name, [d.center[0], d.center[1] + (d.center[1] > 0 ? 2.2 : -2.2)])
      s.hits = hits

      const edge = ctx.createRadialGradient(cx, cy, R * 0.75, cx, cy, R)
      edge.addColorStop(0, 'rgba(255, 255, 255, 0)')
      edge.addColorStop(1, 'rgba(255, 255, 255, 0.28)')
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = edge; ctx.fill()
    }
    raf = requestAnimationFrame(draw)

    return () => { cancelled = true; cancelAnimationFrame(raf) }
    // Drawn for the page's life; the destinations are fixed, the selection is read from the ref.
  }, [destinations])

  // Fly to a new selection.
  useEffect(() => {
    const s = state.current
    if (s.selected === selected) return
    s.selected = selected
    const d = destinations.find(x => x.slug === selected)
    if (d != null) flyTo(s, d, 1500, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [selected, destinations])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Globe showing FjordAnglers fishing destinations"
      className="block h-full w-full"
      style={{ cursor: 'grab', touchAction: 'pan-y' }}
      onPointerDown={e => {
        if (e.pointerType !== 'mouse') return
        const s = state.current
        s.drag = { x: e.clientX, y: e.clientY, r: [s.rot[0], s.rot[1], 0], moved: false }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        const s = state.current
        const cv = e.currentTarget
        if (s.drag == null) {
          if (onPick != null && e.pointerType === 'mouse') {
            cv.style.cursor = hitAt(s, ...localPoint(cv, e.clientX, e.clientY)) != null ? 'pointer' : 'grab'
          }
          return
        }
        const dx = e.clientX - s.drag.x, dy = e.clientY - s.drag.y
        if (!s.drag.moved && Math.hypot(dx, dy) < CLICK_SLOP) return
        s.drag.moved = true
        s.anim = null
        const k = 120 / Math.max(300, s.radius)
        s.rot = [s.drag.r[0] + dx * k, Math.max(-85, Math.min(85, s.drag.r[1] - dy * k)), 0]
      }}
      onPointerUp={e => {
        const s = state.current
        const drag = s.drag
        s.drag = null
        if (drag?.moved === true) { s.idleUntil = performance.now() + 4000; return }
        // A mouse click here, a tap on touch (touch never starts a drag).
        if (onPick == null) return
        const slug = hitAt(s, ...localPoint(e.currentTarget, e.clientX, e.clientY))
        if (slug != null) onPick(slug)
      }}
      onPointerLeave={() => {
        const s = state.current
        if (s.drag != null) s.idleUntil = performance.now() + 4000
        s.drag = null
      }}
    />
  )
}
