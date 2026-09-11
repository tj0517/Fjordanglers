import { describe, it, expect } from 'vitest'
import { estimateLeadValue } from './leadValue'

describe('estimateLeadValue', () => {
  describe('group size multiplier', () => {
    it('1 angler → half base (×0.5)', () => {
      expect(estimateLeadValue({ tripLength: '1', groupSize: 1 })).toBe(325)
    })
    it('2 anglers → full base (×1.0)', () => {
      expect(estimateLeadValue({ tripLength: '1', groupSize: 2 })).toBe(650)
    })
    it('4 anglers → double base (×2.0)', () => {
      expect(estimateLeadValue({ tripLength: '1', groupSize: 4 })).toBe(1300)
    })
    it('capped at 4 — 6 anglers same as 4', () => {
      expect(estimateLeadValue({ tripLength: '1', groupSize: 6 })).toBe(1300)
    })
  })

  describe('trip length base values (2 anglers, Nordic)', () => {
    it('1 day → 650', () => {
      expect(estimateLeadValue({ tripLength: '1', groupSize: 2 })).toBe(650)
    })
    it('2-3 days → 2500', () => {
      expect(estimateLeadValue({ tripLength: '2-3', groupSize: 2 })).toBe(2500)
    })
    it('4-7 days → 5000', () => {
      expect(estimateLeadValue({ tripLength: '4-7', groupSize: 2 })).toBe(5000)
    })
    it('7+ days → 7500', () => {
      expect(estimateLeadValue({ tripLength: '7+', groupSize: 2 })).toBe(7500)
    })
  })

  it('location param does not affect value', () => {
    expect(estimateLeadValue({ tripLength: '4-7', groupSize: 2, location: 'Norway' })).toBe(5000)
  })

  it('combined: 4-7 days, 4 anglers → 10000', () => {
    expect(estimateLeadValue({ tripLength: '4-7', groupSize: 4 })).toBe(10000)
  })

  describe('region group rates (FA-0.13)', () => {
    it('Argentina, 2-3 days, 2 anglers → 2500 (Patagonia rate)', () => {
      expect(estimateLeadValue({ tripLength: '2-3', groupSize: 2, location: 'Argentina' })).toBe(2500)
    })
    it('Chile, 4-7 days, 2 anglers → 5000 (Patagonia rate)', () => {
      expect(estimateLeadValue({ tripLength: '4-7', groupSize: 2, location: 'Chile' })).toBe(5000)
    })
    it('New Zealand, 2-3 days, 2 anglers → 1200 (NZ own rate, tj 2026-09-11)', () => {
      expect(estimateLeadValue({ tripLength: '2-3', groupSize: 2, location: 'New Zealand' })).toBe(1200)
    })
    it('unknown location "Atlantis" falls back to Nordic, not NaN/undefined/throw', () => {
      expect(estimateLeadValue({ tripLength: '4-7', groupSize: 2, location: 'Atlantis' })).toBe(5000)
    })
  })
})
