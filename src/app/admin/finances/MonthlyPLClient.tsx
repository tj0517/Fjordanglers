'use client'

import { Fragment, useState, useMemo, useTransition } from 'react'
import { Plus, X, Trash2, Check, ChevronDown, ChevronRight } from 'lucide-react'
import {
  addManualCostEntry,
  deleteManualCostEntry,
  updateEurRate,
  type ManualCostEntryRow,
  type CostCategory,
} from '@/actions/finances'

// ─── Public type (used by page.tsx and FinancesPageTabs) ─────────────────────

export interface MonthRaw {
  month: string           // YYYY-MM
  label: string           // "Jun 2026"
  deals: number
  revenue_eur: number     // paid deals
  potential_eur: number   // open deals (in_negotiation / deposit_sent) with price set
  ad_spend_pln: number
  fixed_costs_pln: number
  manual_entries: ManualCostEntryRow[]
  manual_costs_pln: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<CostCategory, string> = {
  infrastructure: 'Infrastructure',
  tools:          'Tools',
  marketing:      'Marketing',
  other:          'Other',
}

const inputStyle = {
  background: 'rgba(10,46,77,0.04)',
  border:     '1px solid rgba(10,46,77,0.15)',
  color:      '#0A2E4D',
} as const

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmtPln  = (n: number) =>
  n.toLocaleString('pl', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'
const fmtEur  = (n: number) =>
  '€' + n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNet  = (n: number) =>
  (n >= 0 ? '+' : '') + fmtPln(n)

// ─── Component ───────────────────────────────────────────────────────────────

export function MonthlyPLClient({
  months,
  defaultEurRate,
}: {
  months: MonthRaw[]
  defaultEurRate: number
}) {
  const [eurRate,    setEurRate]    = useState(defaultEurRate)
  const [rateInput,  setRateInput]  = useState(String(defaultEurRate))
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [addingTo,   setAddingTo]   = useState<string | null>(null)
  const [addName,    setAddName]    = useState('')
  const [addAmt,     setAddAmt]     = useState('')
  const [addCat,     setAddCat]     = useState<CostCategory>('other')
  const [error,      setError]      = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  // ── Derived data ────────────────────────────────────────────────────────────

  const computed = useMemo(() => months.map(m => {
    const rev    = m.revenue_eur * eurRate
    const costs  = m.ad_spend_pln + m.fixed_costs_pln + m.manual_costs_pln
    return { ...m, revenue_pln: rev, potential_pln: m.potential_eur * eurRate, total_costs: costs, net: rev - costs }
  }), [months, eurRate])

  const totals = useMemo(() => computed.reduce((acc, m) => ({
    deals:         acc.deals         + m.deals,
    revenue_eur:   acc.revenue_eur   + m.revenue_eur,
    revenue_pln:   acc.revenue_pln   + m.revenue_pln,
    potential_eur: acc.potential_eur + m.potential_eur,
    potential_pln: acc.potential_pln + m.potential_pln,
    ad:            acc.ad            + m.ad_spend_pln,
    fixed:         acc.fixed         + m.fixed_costs_pln,
    manual:        acc.manual        + m.manual_costs_pln,
    costs:         acc.costs         + m.total_costs,
    net:           acc.net           + m.net,
  }), { deals: 0, revenue_eur: 0, revenue_pln: 0, potential_eur: 0, potential_pln: 0, ad: 0, fixed: 0, manual: 0, costs: 0, net: 0 }),
  [computed])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function applyRate() {
    const n = parseFloat(rateInput)
    if (!isNaN(n) && n > 0) {
      setEurRate(n)
      startTransition(() => { updateEurRate(n) })
    }
  }

  function openAdd(month: string) {
    setAddingTo(month)
    setExpanded(month)
    setAddName('')
    setAddAmt('')
    setAddCat('other')
  }

  function handleAdd(month: string) {
    if (!addName.trim() || !addAmt) return
    const amount = parseFloat(addAmt)
    if (isNaN(amount) || amount <= 0) return
    startTransition(async () => {
      const res = await addManualCostEntry({ month, name: addName.trim(), amount_pln: amount, category: addCat })
      if (!res.success) { setError(res.error ?? 'Failed'); return }
      setAddingTo(null)
      setError(null)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteManualCostEntry(id)
      if (!res.success) setError(res.error ?? 'Failed')
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── EUR rate bar ───────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-3 mb-6 px-4 py-3 rounded-[14px]"
        style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
      >
        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
          EUR rate
        </span>
        <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>1 EUR =</span>
        <input
          className="w-20 text-sm f-body rounded-lg px-2 py-1 outline-none text-right font-mono"
          style={inputStyle}
          value={rateInput}
          onChange={e => setRateInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applyRate() }}
        />
        <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>PLN</span>
        <button
          onClick={applyRate}
          className="text-xs f-body px-3 py-1.5 rounded-lg font-semibold"
          style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
        >
          Apply
        </button>
        <span className="text-xs f-body ml-auto hidden md:block" style={{ color: 'rgba(10,46,77,0.3)' }}>
          Revenue converted at this rate · saved automatically
        </span>
      </div>

      {error != null && (
        <p className="text-sm mb-4 px-3 py-2 rounded-xl f-body" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
          {error}
        </p>
      )}

      {/* ── Table ──────────────────────────────────────────────── */}
      <div
        className="rounded-[18px] overflow-hidden"
        style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.05)', opacity: isPending ? 0.7 : 1 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm f-body" style={{ minWidth: 820 }}>

            {/* ── Head ───────────────────────────────────────────── */}
            <thead>
              <tr style={{ background: 'rgba(10,46,77,0.04)', borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
                {[
                  ['Month',        'text-left',  ''],
                  ['Deals',        'text-right', ''],
                  ['Revenue',      'text-right', 'EUR'],
                  ['→ PLN',        'text-right', ''],
                  ['Potential',    'text-right', 'EUR'],
                  ['Ad Spend',     'text-right', 'PLN'],
                  ['Fixed',        'text-right', 'PLN'],
                  ['Manual',       'text-right', 'PLN'],
                  ['Total Costs',  'text-right', 'PLN'],
                  ['Net P&L',      'text-right', 'PLN'],
                ].map(([label, align, unit]: string[]) => (
                  <th
                    key={label}
                    className={`px-4 py-3 text-[10px] uppercase tracking-[0.18em] font-semibold whitespace-nowrap ${align}`}
                    style={{ color: 'rgba(10,46,77,0.4)' }}
                  >
                    {label}
                    {unit && <span className="ml-1 normal-case" style={{ color: 'rgba(10,46,77,0.25)' }}>{unit}</span>}
                  </th>
                ))}
              </tr>
            </thead>

            {/* ── Body ───────────────────────────────────────────── */}
            <tbody style={{ background: '#FDFAF7' }}>
              {computed.map(m => {
                const isExp    = expanded === m.month
                const isAdding = addingTo === m.month
                const netColor = m.net > 0 ? '#16A34A' : m.net < 0 ? '#DC2626' : 'rgba(10,46,77,0.45)'

                return (
                  <Fragment key={m.month}>

                    {/* ── Month row ─────────────────────────────── */}
                    <tr style={{ borderBottom: isExp ? 'none' : '1px solid rgba(10,46,77,0.05)' }}>

                      {/* Month label + expand toggle */}
                      <td className="px-4 py-3">
                        <button
                          className="flex items-center gap-1.5 font-semibold"
                          style={{ color: '#0A2E4D' }}
                          onClick={() => setExpanded(isExp ? null : m.month)}
                        >
                          <span style={{ color: 'rgba(10,46,77,0.3)', flexShrink: 0 }}>
                            {isExp
                              ? <ChevronDown size={13} strokeWidth={1.8} />
                              : <ChevronRight size={13} strokeWidth={1.8} />
                            }
                          </span>
                          {m.label}
                        </button>
                      </td>

                      {/* Deals */}
                      <td className="px-4 py-3 text-right font-mono" style={{ color: m.deals > 0 ? '#0A2E4D' : 'rgba(10,46,77,0.25)' }}>
                        {m.deals > 0 ? m.deals : '—'}
                      </td>

                      {/* Revenue EUR */}
                      <td className="px-4 py-3 text-right font-mono" style={{ color: m.revenue_eur > 0 ? '#16A34A' : 'rgba(10,46,77,0.25)' }}>
                        {m.revenue_eur > 0 ? fmtEur(m.revenue_eur) : '—'}
                      </td>

                      {/* Revenue PLN */}
                      <td className="px-4 py-3 text-right font-mono" style={{ color: m.revenue_eur > 0 ? '#0A2E4D' : 'rgba(10,46,77,0.25)' }}>
                        {m.revenue_eur > 0 ? fmtPln(m.revenue_pln) : '—'}
                      </td>

                      {/* Potential (open deals) */}
                      <td className="px-4 py-3 text-right font-mono" style={{ color: m.potential_eur > 0 ? '#7C3AED' : 'rgba(10,46,77,0.2)' }}>
                        {m.potential_eur > 0
                          ? <span title={`≈ ${fmtPln(m.potential_pln)}`}>~{fmtEur(m.potential_eur)}</span>
                          : '—'
                        }
                      </td>

                      {/* Ad spend */}
                      <td className="px-4 py-3 text-right font-mono" style={{ color: m.ad_spend_pln > 0 ? '#DC2626' : 'rgba(10,46,77,0.25)' }}>
                        {m.ad_spend_pln > 0 ? fmtPln(m.ad_spend_pln) : '—'}
                      </td>

                      {/* Fixed costs */}
                      <td className="px-4 py-3 text-right font-mono" style={{ color: 'rgba(10,46,77,0.55)' }}>
                        {fmtPln(m.fixed_costs_pln)}
                      </td>

                      {/* Manual costs + add button */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-mono" style={{ color: m.manual_costs_pln > 0 ? '#C05621' : 'rgba(10,46,77,0.25)' }}>
                            {m.manual_costs_pln > 0 ? fmtPln(m.manual_costs_pln) : '—'}
                          </span>
                          <button
                            onClick={() => isAdding ? setAddingTo(null) : openAdd(m.month)}
                            className="p-0.5 rounded transition-opacity"
                            style={{ color: '#E67E50', opacity: 0.7 }}
                            title="Add manual cost"
                          >
                            <Plus size={12} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>

                      {/* Total costs */}
                      <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: '#0A2E4D' }}>
                        {fmtPln(m.total_costs)}
                      </td>

                      {/* Net P&L */}
                      <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: netColor }}>
                        {fmtNet(m.net)}
                      </td>
                    </tr>

                    {/* ── Expanded detail ───────────────────────── */}
                    {isExp && (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-6 pb-4 pt-2"
                          style={{
                            background: 'rgba(10,46,77,0.02)',
                            borderBottom: '1px solid rgba(10,46,77,0.07)',
                          }}
                        >

                          {/* Existing manual entries */}
                          {m.manual_entries.length > 0 && (
                            <div className="mb-3">
                              <p className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-2 f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                                Manual costs
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {m.manual_entries.map(e => (
                                  <div key={e.id} className="flex items-center gap-3 text-xs f-body" style={{ color: '#0A2E4D' }}>
                                    <span className="flex-1">{e.name}</span>
                                    <span
                                      className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
                                      style={{ background: 'rgba(230,126,80,0.1)', color: '#C05621' }}
                                    >
                                      {CATEGORY_LABELS[e.category]}
                                    </span>
                                    <span className="font-mono" style={{ color: '#C05621' }}>
                                      {fmtPln(e.amount_pln)}
                                    </span>
                                    <button
                                      onClick={() => handleDelete(e.id)}
                                      className="p-1 rounded transition-colors"
                                      style={{ color: 'rgba(220,38,38,0.45)' }}
                                    >
                                      <Trash2 size={12} strokeWidth={1.8} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* No entries placeholder */}
                          {m.manual_entries.length === 0 && !isAdding && (
                            <p className="text-xs f-body mb-2" style={{ color: 'rgba(10,46,77,0.35)' }}>
                              No manual costs for {m.label}.{' '}
                              <button onClick={() => openAdd(m.month)} style={{ color: '#E67E50' }}>
                                Add one →
                              </button>
                            </p>
                          )}

                          {/* Inline add form */}
                          {isAdding && (
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <input
                                className="flex-1 min-w-[140px] text-xs f-body rounded-lg px-2 py-1.5 outline-none"
                                style={inputStyle}
                                placeholder="Cost name"
                                value={addName}
                                onChange={e => setAddName(e.target.value)}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleAdd(m.month) }}
                              />
                              <input
                                className="w-24 text-xs f-body font-mono rounded-lg px-2 py-1.5 outline-none text-right"
                                style={inputStyle}
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={addAmt}
                                onChange={e => setAddAmt(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAdd(m.month) }}
                              />
                              <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>PLN</span>
                              <select
                                className="text-xs f-body rounded-lg px-2 py-1.5 outline-none"
                                style={inputStyle}
                                value={addCat}
                                onChange={e => setAddCat(e.target.value as CostCategory)}
                              >
                                {(Object.entries(CATEGORY_LABELS) as [CostCategory, string][]).map(([v, l]) => (
                                  <option key={v} value={v}>{l}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleAdd(m.month)}
                                className="p-1.5 rounded-lg"
                                style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}
                              >
                                <Check size={13} strokeWidth={2} />
                              </button>
                              <button
                                onClick={() => setAddingTo(null)}
                                className="p-1.5 rounded-lg"
                                style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
                              >
                                <X size={13} strokeWidth={2} />
                              </button>
                            </div>
                          )}

                          {/* Show "add" button if entries exist but form isn't open */}
                          {m.manual_entries.length > 0 && !isAdding && (
                            <button
                              onClick={() => openAdd(m.month)}
                              className="mt-2 flex items-center gap-1.5 text-xs f-body font-medium"
                              style={{ color: '#E67E50' }}
                            >
                              <Plus size={11} strokeWidth={2.2} /> Add another
                            </button>
                          )}

                        </td>
                      </tr>
                    )}

                  </Fragment>
                )
              })}

              {/* ── Totals row ─────────────────────────────────────── */}
              {computed.length > 1 && (
                <tr style={{ borderTop: '2px solid rgba(10,46,77,0.1)', background: 'rgba(10,46,77,0.03)' }}>
                  <td className="px-4 py-3 font-bold f-body" style={{ color: '#0A2E4D' }}>Total</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: 'rgba(10,46,77,0.6)' }}>
                    {totals.deals}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: '#16A34A' }}>
                    {fmtEur(totals.revenue_eur)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: '#0A2E4D' }}>
                    {fmtPln(totals.revenue_pln)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: '#7C3AED' }}>
                    {totals.potential_eur > 0 ? `~${fmtEur(totals.potential_eur)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: '#DC2626' }}>
                    {fmtPln(totals.ad)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: 'rgba(10,46,77,0.6)' }}>
                    {fmtPln(totals.fixed)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: '#C05621' }}>
                    {fmtPln(totals.manual)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: '#0A2E4D' }}>
                    {fmtPln(totals.costs)}
                  </td>
                  <td
                    className="px-4 py-3 text-right font-mono font-bold"
                    style={{ color: totals.net > 0 ? '#16A34A' : totals.net < 0 ? '#DC2626' : 'rgba(10,46,77,0.45)' }}
                  >
                    {fmtNet(totals.net)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {computed.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>
              No financial data yet. Add ad spend or wait for the first deal.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
