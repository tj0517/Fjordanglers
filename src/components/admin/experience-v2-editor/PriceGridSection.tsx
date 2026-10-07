'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveExperienceV2Prices, type ExperienceV2EditorData } from '@/actions/experience-pages'
import {
  bpToPercentText,
  centsToMoneyText,
  parseMoneyToCents,
  parseWholeNumber,
  type EditorPriceCell,
} from '@/lib/experiences/v2-editor'
import { Field, MoneyInput, Notice, SaveBar, Section, useSave } from './fields'

/** One season: a days × anglers grid that shares valid_from / valid_to. Everything is text until saved. */
interface Season {
  key:       string
  validFrom: string
  validTo:   string
  days:      string[]
  anglers:   string[]
  /** cells[dayIndex][anglerIndex] — an empty string means "no price row". */
  cells:     string[][]
}

interface Props {
  experienceId: string
  prices:       ExperienceV2EditorData['prices']
  currency:     string
  maxAnglersPerGuide: number
  feeBp:        number
  today:        string
}

function emptySeason(key: string, maxAnglersPerGuide: number): Season {
  const days    = ['1', '2', '3']
  const anglers: string[] = []
  for (let count = 1; count <= maxAnglersPerGuide; count++) anglers.push(String(count))
  return { key, validFrom: '', validTo: '', days, anglers, cells: days.map(() => anglers.map(() => '')) }
}

function toSeasons(prices: Props['prices'], maxAnglersPerGuide: number): Season[] {
  if (prices.length === 0) return [emptySeason('season-0', maxAnglersPerGuide)]

  const groups = new Map<string, Props['prices']>()
  for (const row of prices) {
    const key = `${row.validFrom ?? ''}|${row.validTo ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  // Undated first, then by start date.
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]) => {
    const days    = [...new Set(rows.map(r => r.days))].sort((a, b) => a - b)
    const anglers = [...new Set(rows.map(r => r.anglers))].sort((a, b) => a - b)
    return {
      key:       `season-${key}`,
      validFrom: rows[0].validFrom ?? '',
      validTo:   rows[0].validTo ?? '',
      days:      days.map(String),
      anglers:   anglers.map(String),
      cells:     days.map(d => anglers.map(a =>
        centsToMoneyText(rows.find(r => r.days === d && r.anglers === a)?.guidePriceCents ?? null))),
    }
  })
}

/** Text grid → price rows, or the first thing that is wrong with it. */
function toCells(seasons: Season[]): { cells: EditorPriceCell[] } | { error: string } {
  const cells: EditorPriceCell[] = []

  for (const [index, season] of seasons.entries()) {
    const name = seasons.length === 1 ? 'The grid' : `Season ${index + 1}`

    const days    = season.days.map(parseWholeNumber)
    const anglers = season.anglers.map(parseWholeNumber)
    if (days.some(d => d == null || d < 1))    return { error: `${name}: every row needs a number of days (1 or more)` }
    if (anglers.some(a => a == null || a < 1)) return { error: `${name}: every column needs a number of anglers (1 or more)` }
    if (new Set(days).size !== days.length)       return { error: `${name}: the same number of days appears twice` }
    if (new Set(anglers).size !== anglers.length) return { error: `${name}: the same number of anglers appears twice` }

    for (const [r, row] of season.cells.entries()) {
      for (const [c, text] of row.entries()) {
        if (text.trim() === '') continue
        const guidePriceCents = parseMoneyToCents(text)
        const d = days[r]
        const a = anglers[c]
        if (guidePriceCents == null || d == null || a == null) {
          return { error: `${name}: “${text}” (${season.days[r]} day(s) × ${season.anglers[c]} angler(s)) is not an amount` }
        }
        cells.push({
          days: d, anglers: a, guidePriceCents,
          validFrom: season.validFrom === '' ? null : season.validFrom,
          validTo:   season.validTo === '' ? null : season.validTo,
        })
      }
    }
  }
  return { cells }
}

export function PriceGridSection({ experienceId, prices, currency, maxAnglersPerGuide, feeBp, today }: Props) {
  const [seasons, setSeasons] = useState<Season[]>(() => toSeasons(prices, maxAnglersPerGuide))
  const { pending, state, run, fail } = useSave()

  const otherCurrencies = [...new Set(prices.map(p => p.currency).filter(c => c !== currency))]

  function patch(key: string, change: (season: Season) => Season) {
    setSeasons(current => current.map(season => (season.key === key ? change(season) : season)))
  }

  function nextNumber(values: string[]): string {
    return String(Math.max(0, ...values.map(v => parseWholeNumber(v) ?? 0)) + 1)
  }

  function save() {
    const result = toCells(seasons)
    if ('error' in result) return fail(result.error)
    run(() => saveExperienceV2Prices(experienceId, result.cells))
  }

  return (
    <Section
      id="v2-prices"
      title="Price grid"
      description={`The guide's price per trip in ${currency}, FA fee not included — the angler sees it plus ${bpToPercentText(feeBp)}%. Leave a cell empty when there is no price for that combination.`}
    >
      {otherCurrencies.length > 0 && (
        <Notice tone="warning">
          Stored rows are in {otherCurrencies.join(', ')}, but the page currency is {currency}. Saving
          stores every row as {currency} — check the amounts first.
        </Notice>
      )}

      {seasons.map((season, seasonIndex) => {
        const validToday = (season.validFrom === '' || season.validFrom <= today)
          && (season.validTo === '' || season.validTo >= today)

        return (
          <div key={season.key} className="flex flex-col gap-3 rounded-lg border border-border p-3" data-season={seasonIndex + 1}>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Valid from" hint="Empty = always">
                <Input
                  type="date"
                  aria-label={`Season ${seasonIndex + 1} valid from`}
                  value={season.validFrom}
                  onChange={e => patch(season.key, s => ({ ...s, validFrom: e.target.value }))}
                />
              </Field>
              <Field label="Valid to" hint="Empty = open-ended">
                <Input
                  type="date"
                  aria-label={`Season ${seasonIndex + 1} valid to`}
                  value={season.validTo}
                  onChange={e => patch(season.key, s => ({ ...s, validTo: e.target.value }))}
                />
              </Field>
              {seasons.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setSeasons(current => current.filter(s => s.key !== season.key))}
                >
                  Remove season
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="f-body border-separate border-spacing-1 text-sm">
                <thead>
                  <tr>
                    <th className="pr-2 text-left text-xs font-semibold text-muted-foreground">Days ↓ · Anglers →</th>
                    {season.anglers.map((anglers, c) => (
                      <th key={c} className="font-normal">
                        <span className="flex items-center gap-1">
                          <Input
                            aria-label={`Season ${seasonIndex + 1} anglers column ${c + 1}`}
                            inputMode="numeric"
                            className="w-14 text-center font-semibold"
                            value={anglers}
                            onChange={e => patch(season.key, s => ({ ...s, anglers: s.anglers.map((v, i) => (i === c ? e.target.value : v)) }))}
                          />
                          {season.anglers.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Remove the ${anglers}-angler column`}
                              onClick={() => patch(season.key, s => ({
                                ...s,
                                anglers: s.anglers.filter((_, i) => i !== c),
                                cells:   s.cells.map(row => row.filter((_, i) => i !== c)),
                              }))}
                            >
                              <X />
                            </Button>
                          )}
                        </span>
                      </th>
                    ))}
                    <th>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => patch(season.key, s => ({
                          ...s,
                          anglers: [...s.anglers, nextNumber(s.anglers)],
                          cells:   s.cells.map(row => [...row, '']),
                        }))}
                      >
                        <Plus /> anglers
                      </Button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {season.days.map((days, r) => (
                    <tr key={r}>
                      <th className="font-normal">
                        <span className="flex items-center gap-1">
                          <Input
                            aria-label={`Season ${seasonIndex + 1} days row ${r + 1}`}
                            inputMode="numeric"
                            className="w-14 text-center font-semibold"
                            value={days}
                            onChange={e => patch(season.key, s => ({ ...s, days: s.days.map((v, i) => (i === r ? e.target.value : v)) }))}
                          />
                          <span className="text-xs text-muted-foreground">day(s)</span>
                        </span>
                      </th>
                      {season.anglers.map((anglers, c) => {
                        const text   = season.cells[r]?.[c] ?? ''
                        const isBase = validToday && parseWholeNumber(days) === 1 && parseWholeNumber(anglers) === maxAnglersPerGuide
                        return (
                          <td key={c} className="align-top">
                            <MoneyInput
                              aria-label={`Price for ${days} day(s) × ${anglers} angler(s), season ${seasonIndex + 1}`}
                              className="w-24"
                              value={text}
                              invalid={text.trim() !== '' && parseMoneyToCents(text) == null}
                              onChange={value => patch(season.key, s => ({
                                ...s,
                                cells: s.cells.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)),
                              }))}
                            />
                            {isBase && <Badge variant="secondary" className="mt-1">base row</Badge>}
                          </td>
                        )
                      })}
                      <td>
                        {season.days.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Remove the ${days}-day row`}
                            onClick={() => patch(season.key, s => ({
                              ...s,
                              days:  s.days.filter((_, i) => i !== r),
                              cells: s.cells.filter((_, i) => i !== r),
                            }))}
                          >
                            <X />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => patch(season.key, s => ({
                  ...s,
                  days:  [...s.days, nextNumber(s.days)],
                  cells: [...s.cells, s.anglers.map(() => '')],
                }))}
              >
                <Plus /> day row
              </Button>
            </div>
          </div>
        )
      })}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSeasons(current => [...current, emptySeason(crypto.randomUUID(), maxAnglersPerGuide)])}
        >
          <Plus /> Add a season
        </Button>
      </div>

      <SaveBar label="Save price grid" pending={pending} state={state} onSave={save} />
    </Section>
  )
}
