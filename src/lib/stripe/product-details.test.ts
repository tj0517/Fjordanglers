import { describe, it, expect } from 'vitest'
import { checkProductDetails, PRODUCT_NAME_MAX, PRODUCT_DESCRIPTION_MAX } from './product-details'

describe('checkProductDetails (FA-1.77)', () => {
  it('trims both values', () => {
    expect(checkProductDetails({ name: '  Salmon week  ', description: ' Fee. ' }))
      .toEqual({ ok: true, details: { name: 'Salmon week', description: 'Fee.' } })
  })

  it('accepts both at exactly the limit', () => {
    const res = checkProductDetails({ name: 'n'.repeat(PRODUCT_NAME_MAX), description: 'd'.repeat(PRODUCT_DESCRIPTION_MAX) })
    expect(res.ok).toBe(true)
  })

  it.each([
    ['empty name',              { name: '',    description: 'Fee.' },                               'Product name is required'],
    ['whitespace-only name',    { name: '   ', description: 'Fee.' },                               'Product name is required'],
    ['empty description',       { name: 'Trip', description: '  ' },                                'Description is required'],
    ['name over 250',           { name: 'n'.repeat(PRODUCT_NAME_MAX + 1), description: 'Fee.' },    'Stripe allows 250'],
    ['description over 250',    { name: 'Trip', description: 'd'.repeat(PRODUCT_DESCRIPTION_MAX + 1) }, 'the limit is 250'],
    ['missing fields',          {},                                                                 'required'],
    ['non-string name',         { name: 42, description: 'Fee.' },                                  'required'],
    ['no input at all',         undefined,                                                          'required'],
  ])('rejects %s', (_case, input, message) => {
    const res = checkProductDetails(input)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain(message)
  })
})
