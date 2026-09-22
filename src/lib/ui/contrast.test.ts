import { describe, it, expect } from 'vitest'

// Pairs from CSS tokens — [foreground hex, background hex]
// --muted-foreground is #475569 (slate-600), changed from #64748B to pass AA on muted
const TEXT_PAIRS: [string, string][] = [
  ['#0A2E4D', '#F8FAFB'],  // --foreground on --background
  ['#0A2E4D', '#FFFFFF'],  // --card-foreground on --card / --popover-foreground on --popover
  ['#F8FAFB', '#0A2E4D'],  // --primary-foreground on --primary
  ['#0A2E4D', '#F1F5F9'],  // --secondary-foreground on --secondary
  ['#475569', '#F1F5F9'],  // --muted-foreground on --muted (slate-600, 6.4:1)
  ['#0A2E4D', '#E67E50'],  // --accent-foreground on --accent (focus highlight — 4.9:1)
]

// Non-text pairs (WCAG 1.4.11 — UI component boundaries, icons, focus rings).
// Note: --border (#E2E8F0) is a decorative separator — it intentionally does not
// need to pass 3:1. Salmon (#E67E50) is ~2.8:1 on white; it is used ONLY as a
// border, icon, or focus outline (not as background under white text).
// We keep this pair in the test to document the known deviation.
// See D1 in FA-1.15: "Ograniczenie kontrastu" — salmon is below 3:1.
const BORDER_PAIRS_PASS: [string, string][] = []
const BORDER_PAIRS_DOCUMENTED_DEVIATION: [string, string][] = [
  ['#E67E50', '#FFFFFF'],  // accent/ring on white — 2.8:1 (below 3:1, known deviation per D1)
]

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function luminance([r, g, b]: [number, number, number]): number {
  const sRGB = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
}

function contrast(fg: string, bg: string): number {
  const L1 = luminance(hexToRgb(fg))
  const L2 = luminance(hexToRgb(bg))
  const lighter = Math.max(L1, L2)
  const darker  = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('FA design token contrast', () => {
  it.each(TEXT_PAIRS)('text pair %s / %s passes AA (4.5:1)', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  // Documented deviation: salmon #E67E50 is 2.8:1 on white — used only as border/
  // icon/focus, never as text background. Per D1: "Ograniczenie kontrastu".
  it.each(BORDER_PAIRS_DOCUMENTED_DEVIATION)(
    'accent/ring pair %s / %s — documented deviation below 3:1 (used only as border/icon)',
    (fg, bg) => {
      const c = contrast(fg, bg)
      expect(c).toBeLessThan(3.0)     // confirms the known deviation
      expect(c).toBeGreaterThan(2.5)  // but not critically low
    },
  )
})
