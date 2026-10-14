'use client'

/**
 * "Season periods" of the Content section (feedback round 1, change 1): what each part of the
 * season is like, shown on the v2 page under the season bar when one of its months is picked.
 *
 * A controlled field — the drafts live in ContentSection and go out with its one save
 * (saveExperienceV2Content), which re-checks everything with `seasonPeriodsSchema`. The form
 * only helps: a month that already belongs to another period is shown as taken and cannot be
 * switched on here.
 */

import type { Dispatch, SetStateAction } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export interface SeasonPeriodDraft { key: string; title: string; months: number[]; text: string }

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function SeasonPeriodsField({
  value,
  onChange,
}: {
  value:    SeasonPeriodDraft[]
  /** The state setter itself: every change is an updater, so quick successive clicks never overwrite each other. */
  onChange: Dispatch<SetStateAction<SeasonPeriodDraft[]>>
}) {
  const patch = (key: string, change: (row: SeasonPeriodDraft) => Partial<SeasonPeriodDraft>) =>
    onChange(current => current.map(row => (row.key === key ? { ...row, ...change(row) } : row)))

  // month → the period that has it, for showing "taken" on the other rows.
  const owner = new Map<number, SeasonPeriodDraft>()
  for (const row of value) for (const month of row.months) if (!owner.has(month)) owner.set(month, row)

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="f-body mb-1 text-xs font-semibold text-muted-foreground">Season periods</legend>
      <p className="f-body -mt-1 text-xs text-muted-foreground">
        Shown under the season bar when a visitor hovers or taps one of the period&apos;s months. A month can be in one period only.
      </p>

      {value.map((row, index) => (
        <div key={row.key} className="flex flex-col gap-2 rounded-lg border border-border p-3" data-testid="season-period-row">
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Season period ${index + 1} title`}
              placeholder="Winter (June – August)"
              maxLength={80}
              value={row.title}
              onChange={e => { const title = e.target.value; patch(row.key, () => ({ title })) }}
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove season period ${index + 1}`} onClick={() => onChange(current => current.filter(r => r.key !== row.key))}>
              <Trash2 />
            </Button>
          </div>

          <div role="group" aria-label={`Months of season period ${index + 1}`} className="grid grid-cols-6 gap-1 sm:grid-cols-12">
            {MONTHS_SHORT.map((label, i) => {
              const month = i + 1
              const on    = row.months.includes(month)
              const takenBy = owner.get(month)
              const taken = !on && takenBy != null && takenBy.key !== row.key
              return (
                <button
                  key={month}
                  type="button"
                  aria-pressed={on}
                  disabled={taken}
                  title={taken ? `In “${takenBy.title || 'another period'}”` : undefined}
                  onClick={() => patch(row.key, current => ({
                    months: current.months.includes(month)
                      ? current.months.filter(m => m !== month)
                      : [...current.months, month].sort((a, b) => a - b),
                  }))}
                  className={cn(
                    'f-body rounded-md border px-1 py-1 text-xs font-semibold transition-colors',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-foreground',
                    taken && 'cursor-not-allowed border-dashed text-muted-foreground opacity-50',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <Textarea
            aria-label={`Season period ${index + 1} description`}
            placeholder="Prime time for sight-fishing, nymphing, and dry-fly action…"
            maxLength={1500}
            value={row.text}
            onChange={e => { const text = e.target.value; patch(row.key, () => ({ text })) }}
          />
        </div>
      ))}

      <div>
        <Button type="button" variant="outline" size="xs" onClick={() => onChange(current => [...current, { key: crypto.randomUUID(), title: '', months: [], text: '' }])}>
          <Plus /> season period
        </Button>
      </div>
    </fieldset>
  )
}
