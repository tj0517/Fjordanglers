import { describe, it, expect } from 'vitest'
import { defaultTripsDescription } from './trips-description'

describe('defaultTripsDescription', () => {
  it('no active countries → the sentence without the "in …" part', () => {
    expect(defaultTripsDescription([])).toBe('Browse hand-picked guided fishing trips with local guides.')
  })

  it('one country', () => {
    expect(defaultTripsDescription(['Iceland'])).toBe(
      'Browse hand-picked guided fishing trips with local guides in Iceland.',
    )
  })

  it('three countries → comma list with "and" before the last', () => {
    expect(defaultTripsDescription(['Norway', 'Iceland', 'New Zealand'])).toBe(
      'Browse hand-picked guided fishing trips with local guides in Norway, Iceland and New Zealand.',
    )
  })
})
