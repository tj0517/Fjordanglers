'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { saveExperienceV2Guides, type ExperienceV2EditorData } from '@/actions/experience-pages'
import {
  centsToMoneyText,
  isActivePrimary,
  overrideExceedsCap,
  overrideLimitCents,
  parseMoneyToCents,
  parseWholeNumber,
  type GuideRowInput,
} from '@/lib/experiences/v2-editor'
import { MoneyInput, NativeSelect, Notice, SaveBar, Section, useSave } from './fields'

interface DraftGuide {
  guideId:      string
  fullName:     string
  role:         'primary' | 'backup'
  status:       'active' | 'paused'
  showOnPage:   boolean
  sortOrder:    string
  overrideText: string
}

interface Props {
  experienceId: string
  guides:       ExperienceV2EditorData['guides']
  available:    ExperienceV2EditorData['availableGuides']
  /** experience_pages.guide_id — who v1 inquiries go to today. */
  legacyGuideId: string | null
  /** Base price row as stored (1 day × max anglers per guide, valid today); null when there is none. */
  baseCents:    number | null
  maxAnglersPerGuide: number
  currency:     string
}

export function GuidesSection({
  experienceId, guides, available, legacyGuideId, baseCents, maxAnglersPerGuide, currency,
}: Props) {
  const [rows, setRows] = useState<DraftGuide[]>(() => guides.map(g => ({
    guideId:      g.guideId,
    fullName:     g.fullName,
    role:         g.role,
    status:       g.status,
    showOnPage:   g.showOnPage,
    sortOrder:    String(g.sortOrder),
    overrideText: centsToMoneyText(g.overrideCents),
  })))
  const [toAdd, setToAdd] = useState('')
  const { pending, state, run, fail } = useSave()

  const stored = new Map(guides.map(g => [g.guideId, g.overrideCents]))
  const listed = new Set(rows.map(r => r.guideId))
  const addable = available.filter(g => !listed.has(g.id))
  const legacyGuideName = legacyGuideId == null
    ? 'nobody'
    : available.find(g => g.id === legacyGuideId)?.fullName ?? legacyGuideId

  function patch(guideId: string, change: Partial<DraftGuide>) {
    setRows(current => {
      const next = current.map(row => (row.guideId === guideId ? { ...row, ...change } : row))
      const changed = next.find(row => row.guideId === guideId)
      // Naming a new active primary demotes the previous one in the draft — the page has one.
      if (changed != null && isActivePrimary(changed)) {
        return next.map(row => (row.guideId !== guideId && isActivePrimary(row) ? { ...row, role: 'backup' as const } : row))
      }
      return next
    })
  }

  function add() {
    const guide = available.find(g => g.id === toAdd)
    if (guide == null) return
    const lastOrder = Math.max(-1, ...rows.map(r => parseWholeNumber(r.sortOrder) ?? 0))
    setRows(current => [...current, {
      guideId: guide.id, fullName: guide.fullName, role: 'backup', status: 'active',
      showOnPage: true, sortOrder: String(lastOrder + 1), overrideText: '',
    }])
    setToAdd('')
  }

  function save() {
    const payload: GuideRowInput[] = []
    for (const row of rows) {
      const sortOrder = parseWholeNumber(row.sortOrder)
      if (sortOrder == null) return fail(`Order of ${row.fullName} must be a whole number`)

      const overrideCents = row.overrideText.trim() === '' ? null : parseMoneyToCents(row.overrideText)
      if (row.overrideText.trim() !== '' && overrideCents == null) {
        return fail(`Price override of ${row.fullName} is not an amount`)
      }
      payload.push({
        guideId: row.guideId, role: row.role, status: row.status,
        showOnPage: row.showOnPage, sortOrder, overrideCents,
      })
    }
    run(() => saveExperienceV2Guides(experienceId, payload))
  }

  return (
    <Section
      id="v2-guides"
      title="Guides"
      description="Who runs this offer. One active primary; backups can be shown on the page too."
    >
      <Notice tone="info">
        Changing the primary here does not yet change who receives v1 inquiries (FA-1.51).
        v1 inquiries currently go to: <strong>{legacyGuideName}</strong>.
      </Notice>

      {baseCents == null && (
        <Notice tone="warning">
          The price grid has no current base row (1 day × {maxAnglersPerGuide} anglers). Until it
          does, a price override cannot be saved, and a stored one is ignored on the page.
        </Notice>
      )}

      {rows.length === 0 ? (
        <p className="f-body text-sm text-muted-foreground">No guides on this page yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guide</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>On page</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Price override</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => {
              const typed  = row.overrideText.trim() === '' ? null : parseMoneyToCents(row.overrideText)
              const notAmount = row.overrideText.trim() !== '' && typed == null
              const unchanged = typed === (stored.get(row.guideId) ?? null)
              const overCap   = typed != null && baseCents != null && overrideExceedsCap(typed, baseCents)

              return (
                <TableRow key={row.guideId} data-guide={row.fullName}>
                  <TableCell className="f-body font-medium">
                    {row.fullName}
                    {isActivePrimary(row) && <Badge className="ml-2">primary</Badge>}
                  </TableCell>
                  <TableCell>
                    <NativeSelect
                      aria-label={`Role of ${row.fullName}`}
                      className="min-w-[5.25rem]"
                      value={row.role}
                      onChange={e => patch(row.guideId, { role: e.target.value === 'primary' ? 'primary' : 'backup' })}
                    >
                      <option value="primary">Primary</option>
                      <option value="backup">Backup</option>
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <NativeSelect
                      aria-label={`Status of ${row.fullName}`}
                      className="min-w-[5.25rem]"
                      value={row.status}
                      onChange={e => patch(row.guideId, { status: e.target.value === 'paused' ? 'paused' : 'active' })}
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Show ${row.fullName} on the page`}
                      checked={row.showOnPage}
                      onChange={e => patch(row.guideId, { showOnPage: e.target.checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Order of ${row.fullName}`}
                      inputMode="numeric"
                      className="w-12"
                      value={row.sortOrder}
                      onChange={e => patch(row.guideId, { sortOrder: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <MoneyInput
                      aria-label={`Price override of ${row.fullName}`}
                      className="w-24"
                      placeholder="none"
                      currency={currency}
                      value={row.overrideText}
                      invalid={notAmount || (overCap && !unchanged)}
                      onChange={value => patch(row.guideId, { overrideText: value })}
                    />
                    <OverrideHint
                      typed={typed}
                      notAmount={notAmount}
                      unchanged={unchanged}
                      overCap={overCap}
                      baseCents={baseCents}
                      currency={currency}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${row.fullName}`}
                      onClick={() => setRows(current => current.filter(r => r.guideId !== row.guideId))}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="f-body text-xs font-semibold text-muted-foreground">Add a guide</span>
          <NativeSelect aria-label="Guide to add" value={toAdd} onChange={e => setToAdd(e.target.value)}>
            <option value="">Select a guide…</option>
            {addable.map(g => <option key={g.id} value={g.id}>{g.fullName} — {g.country}</option>)}
          </NativeSelect>
        </label>
        <Button type="button" variant="outline" onClick={add} disabled={toAdd === ''}>Add as backup</Button>
      </div>

      <SaveBar label="Save guides" pending={pending} state={state} onSave={save} />
    </Section>
  )
}

function OverrideHint({
  typed, notAmount, unchanged, overCap, baseCents, currency,
}: {
  typed:     number | null
  notAmount: boolean
  unchanged: boolean
  overCap:   boolean
  baseCents: number | null
  currency:  string
}) {
  if (notAmount) return <p className="f-body mt-1 text-xs text-destructive">Not an amount</p>
  if (typed == null) return null

  if (baseCents == null) {
    return (
      <p className="f-body mt-1 text-xs text-amber-800">
        {unchanged ? 'Stored, but there is no base row to apply it to' : 'Cannot be saved: no base row'}
      </p>
    )
  }

  const limit = `max ${centsToMoneyText(overrideLimitCents(baseCents))} ${currency} (115% of ${centsToMoneyText(baseCents)})`
  if (!overCap) return <p className="f-body mt-1 text-xs text-muted-foreground">{limit}</p>

  return (
    <p className={`f-body mt-1 text-xs ${unchanged ? 'text-amber-800' : 'text-destructive'}`}>
      {unchanged ? `Stored earlier; now above the cap — ${limit}` : `Above the cap — ${limit}`}
    </p>
  )
}
