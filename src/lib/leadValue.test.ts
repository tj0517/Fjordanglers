import { describe, it, expect } from 'vitest'
import { estimateLeadValue } from './leadValue'

describe('estimateLeadValue', () => {
  describe('group size multiplier', () => {
    it('1 angler → half base (×0.5)', () => {
      expect(estimateLeadValue({ tripLength: '1', groupSize: 1 })).toBe(50)
    })
    it('2 anglers → full base (×1.0)', () => {
      expect(estimateLeadValue({ tripLength: '1', groupSize: 2 })).toBe(100)
    })
    it('4 anglers → double base (×2.0)', () => {
      expect(estimateLeadValue({ tripLength: '1', groupSize: 4 })).toBe(200)
    })
    it('capped at 4 — 6 anglers same as 4', () => {
      expect(estimateLeadValue({ tripLength: '1', groupSize: 6 })).toBe(200)
    })
  })

  describe('trip length base values (2 anglers)', () => {
    it('1 day → 100', () => {
      expect(estimateLeadValue({ tripLength: '1', groupSize: 2 })).toBe(100)
    })
    it('2-3 days → 400', () => {
      expect(estimateLeadValue({ tripLength: '2-3', groupSize: 2 })).toBe(400)
    })
    it('4-7 days → 900', () => {
      expect(estimateLeadValue({ tripLength: '4-7', groupSize: 2 })).toBe(900)
    })
    it('7+ days → 1600', () => {
      expect(estimateLeadValue({ tripLength: '7+', groupSize: 2 })).toBe(1600)
    })
  })

  it('location param does not affect value', () => {
    expect(estimateLeadValue({ tripLength: '4-7', groupSize: 2, location: 'Norway' })).toBe(900)
  })

  it('combined: 4-7 days, 4 anglers → 1800', () => {
    expect(estimateLeadValue({ tripLength: '4-7', groupSize: 4 })).toBe(1800)
  })
})
