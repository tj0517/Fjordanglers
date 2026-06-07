'use client'

import { useState, useTransition } from 'react'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import {
  addFixedCost,
  updateFixedCost,
  deleteFixedCost,
  type FixedCostRow,
  type FixedCostInput,
  type BillingCycle,
  type CostCategory,
} from '@/actions/finances'

function toMonthlyPln(row: FixedCostRow): number {
  if (row.billing_cycle === 'yearly') return row.amount_pln / 12
  if (row.billing_cycle === 'one_time') return 0
  return row.amount_pln
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly:  'Monthly',
  yearly:   'Yearly',
  one_time: 'One-time',
}

const CATEGORY_LABELS: Record<CostCategory, string> = {
  infrastructure: 'Infrastructure',
  tools:          'Tools',
  marketing:      'Marketing',
  other:          'Other',
}

const CATEGORY_COLORS: Record<CostCategory, string> = {
  infrastructure: 'rgba(10,46,77,0.12)',
  tools:          'rgba(230,126,80,0.12)',
  marketing:      'rgba(22,163,74,0.1)',
  other:          'rgba(100,100,100,0.1)',
}

const CATEGORY_TEXT: Record<CostCategory, string> = {
  infrastructure: '#0A2E4D',
  tools:          '#C05621',
  marketing:      '#16A34A',
  other:          '#555',
}

// ─── Empty form state ─────────────────────────────────────────────────────────

const emptyForm = (): FixedCostInput => ({
  name:          '',
  amount_pln:    0,
  billing_cycle: 'monthly',
  category:      'infrastructure',
  notes:         '',
})

// ─── Row form (inline add / edit) ─────────────────────────────────────────────

function InlineForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: FixedCostInput
  onSave: (data: FixedCostInput) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FixedCostInput>(initial)

  function set<K extends keyof FixedCostInput>(k: K, v: FixedCostInput[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleSave() {
    if (!form.name.trim()) return
    onSave(form)
  }

  const inputCls = 'w-full text-sm f-body rounded-lg px-2 py-1.5 outline-none focus:ring-1'
  const inputStyle = {
    background: 'rgba(10,46,77,0.04)',
    border: '1px solid rgba(10,46,77,0.15)',
    color: '#0A2E4D',
  }

  return (
    <tr style={{ background: 'rgba(230,126,80,0.04)' }}>
      <td className="px-4 py-2">
        <input
          className={inputCls}
          style={inputStyle}
          placeholder="Name"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          autoFocus
        />
      </td>
      <td className="px-4 py-2">
        <input
          className={inputCls}
          style={{ ...inputStyle, textAlign: 'right' }}
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={form.amount_pln}
          onChange={e => set('amount_pln', parseFloat(e.target.value) || 0)}
        />
      </td>
      <td className="px-4 py-2">
        <select
          className={inputCls}
          style={inputStyle}
          value={form.billing_cycle}
          onChange={e => set('billing_cycle', e.target.value as BillingCycle)}
        >
          {Object.entries(CYCLE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <select
          className={inputCls}
          style={inputStyle}
          value={form.category}
          onChange={e => set('category', e.target.value as CostCategory)}
        >
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          className={inputCls}
          style={inputStyle}
          placeholder="Optional notes"
          value={form.notes ?? ''}
          onChange={e => set('notes', e.target.value || null)}
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}
            title="Save"
          >
            <Check size={14} strokeWidth={2} />
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
            title="Cancel"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FinancesClient({ rows }: { rows: FixedCostRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(data: FixedCostInput) {
    startTransition(async () => {
      const res = await addFixedCost(data)
      if (!res.success) { setError(res.error ?? 'Failed'); return }
      setAdding(false)
      setError(null)
    })
  }

  function handleUpdate(id: string, data: FixedCostInput) {
    startTransition(async () => {
      const res = await updateFixedCost(id, data)
      if (!res.success) { setError(res.error ?? 'Failed'); return }
      setEditingId(null)
      setError(null)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteFixedCost(id)
      if (!res.success) setError(res.error ?? 'Failed')
    })
  }

  return (
    <div>
      {error != null && (
        <p className="text-sm f-body mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
          {error}
        </p>
      )}

      <div
        className="rounded-[18px] overflow-hidden"
        style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.05)' }}
      >
        <table className="w-full text-sm f-body">
          <thead>
            <tr style={{ background: 'rgba(10,46,77,0.04)', borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
              {['Name', 'Amount (PLN)', 'Billing cycle', 'Category', 'Notes', ''].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.18em] font-semibold"
                  style={{ color: 'rgba(10,46,77,0.4)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody style={{ background: '#FDFAF7' }}>
            {rows.map(row => (
              editingId === row.id ? (
                <InlineForm
                  key={row.id}
                  initial={{
                    name:          row.name,
                    amount_pln:    row.amount_pln,
                    billing_cycle: row.billing_cycle,
                    category:      row.category,
                    notes:         row.notes,
                  }}
                  onSave={data => handleUpdate(row.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr
                  key={row.id}
                  style={{ borderBottom: '1px solid rgba(10,46,77,0.05)', opacity: isPending ? 0.6 : 1 }}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: '#0A2E4D' }}>
                    {row.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-right" style={{ color: '#0A2E4D' }}>
                    {row.amount_pln.toFixed(2)} zł
                  </td>
                  <td className="px-4 py-3" style={{ color: 'rgba(10,46,77,0.6)' }}>
                    {CYCLE_LABELS[row.billing_cycle]}
                    {row.billing_cycle === 'yearly' && (
                      <span className="ml-1.5 text-[10px]" style={{ color: 'rgba(10,46,77,0.35)' }}>
                        ({(row.amount_pln / 12).toFixed(2)} zł/mo)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: CATEGORY_COLORS[row.category],
                        color: CATEGORY_TEXT[row.category],
                      }}
                    >
                      {CATEGORY_LABELS[row.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    {row.notes ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingId(row.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'rgba(10,46,77,0.4)' }}
                        title="Edit"
                      >
                        <Pencil size={13} strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'rgba(220,38,38,0.5)' }}
                        title="Archive"
                      >
                        <Trash2 size={13} strokeWidth={1.8} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            ))}

            {adding && (
              <InlineForm
                initial={emptyForm()}
                onSave={handleAdd}
                onCancel={() => setAdding(false)}
              />
            )}
          </tbody>
        </table>

        {/* Add row footer */}
        <div
          style={{ borderTop: '1px solid rgba(10,46,77,0.07)', background: '#FDFAF7', borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}
          className="px-4 py-3"
        >
          <button
            onClick={() => { setAdding(true); setEditingId(null) }}
            disabled={adding}
            className="flex items-center gap-2 text-sm f-body font-medium transition-opacity"
            style={{ color: '#E67E50', opacity: adding ? 0.4 : 1 }}
          >
            <Plus size={15} strokeWidth={2} />
            Add cost
          </button>
        </div>
      </div>
    </div>
  )
}

