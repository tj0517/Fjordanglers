/**
 * setDepositAmount — FA-1.28
 *
 * Validates requireAdmin guard, currency derivation from accepted option,
 * unsupported currency rejection, amount > 0 check, FX rate fetch failure,
 * and the happy path for EUR (rate=1) and ISK (fetchEurRate).
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/auth/guards', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth/guards')>()),
  requireAdmin: vi.fn().mockResolvedValue({ userId: 'admin-1' }),
}))

vi.mock('@/lib/fx', () => ({
  fetchEurRate: vi.fn(),
}))

vi.mock('@/lib/events/emit', () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { fetchEurRate } from '@/lib/fx'
import { emitEvent } from '@/lib/events/emit'
import { setDepositAmount } from '../inquiries'

const mockFetchEurRate = vi.mocked(fetchEurRate)
const mockEmitEvent    = vi.mocked(emitEvent)

function makeSvc(overrides: {
  offersRows?: { id: string }[] | null
  optionRow?:  { currency: string } | null
  updateError?: string | null
} = {}) {
  const {
    offersRows = [{ id: 'offer-1' }],
    optionRow  = { currency: 'eur' },
    updateError = null,
  } = overrides

  // offers: .from('offers').select('id').eq(...) → Promise<{data, error}>
  const offersChain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockResolvedValue({ data: offersRows ?? [], error: offersRows === null ? { message: 'db error' } : null }),
  }

  // offer_options: .from('offer_options').select().eq().in().limit().maybeSingle() → Promise
  const optChain = {
    select:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    in:          vi.fn().mockReturnThis(),
    limit:       vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: optionRow, error: null }),
  }

  // inquiries: .from('inquiries').update({}).eq(...) → Promise
  const inquiriesChain = {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: updateError ? { message: updateError } : null }),
    }),
  }

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'offers')        return offersChain
      if (table === 'offer_options') return optChain
      if (table === 'inquiries')     return inquiriesChain
      return {}
    }),
  } as unknown as ReturnType<typeof createServiceClient>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('setDepositAmount', () => {
  it('rejects amount ≤ 0', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSvc())
    const res = await setDepositAmount('inq-1', 0)
    expect(res.success).toBe(false)
    expect((res as { success: false; error: string }).error).toMatch(/positive integer/)
  })

  it('rejects non-integer (float)', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSvc())
    const res = await setDepositAmount('inq-1', 99.5)
    expect(res.success).toBe(false)
  })

  it('returns error when no offers exist', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSvc({ offersRows: [] }))
    const res = await setDepositAmount('inq-1', 5000)
    expect(res.success).toBe(false)
    expect((res as { success: false; error: string }).error).toMatch(/No offer/)
  })

  it('returns error when accepted option has unsupported currency (e.g. NOK)', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSvc({ optionRow: { currency: 'nok' } }))
    const res = await setDepositAmount('inq-1', 5000)
    expect(res.success).toBe(false)
    expect((res as { success: false; error: string }).error).toMatch(/not supported/)
  })

  it('returns error when fetchEurRate returns null (service unavailable)', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSvc({ optionRow: { currency: 'usd' } }))
    mockFetchEurRate.mockResolvedValue(null)
    const res = await setDepositAmount('inq-1', 5000)
    expect(res.success).toBe(false)
    expect((res as { success: false; error: string }).error).toMatch(/rate/)
  })

  it('succeeds for EUR without calling fetchEurRate (rate = 1)', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSvc({ optionRow: { currency: 'eur' } }))
    const res = await setDepositAmount('inq-1', 20000)
    expect(mockFetchEurRate).not.toHaveBeenCalled()
    expect(res.success).toBe(true)
    expect(mockEmitEvent).toHaveBeenCalledOnce()
    const call = mockEmitEvent.mock.calls[0][1]
    expect(call.type).toBe('deposit.amount_set')
    expect(call.payload).toMatchObject({ amount_cents: 20000, currency: 'EUR', eur_rate: 1 })
  })

  it('succeeds for ISK, uppercases currency, uses fetchEurRate result', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSvc({ optionRow: { currency: 'isk' } }))
    mockFetchEurRate.mockResolvedValue(138)
    const res = await setDepositAmount('inq-1', 3_000_000)
    expect(mockFetchEurRate).toHaveBeenCalledWith('ISK')
    expect(res.success).toBe(true)
    const call = mockEmitEvent.mock.calls[0][1]
    expect(call.payload).toMatchObject({ amount_cents: 3_000_000, currency: 'ISK', eur_rate: 138 })
  })
})
