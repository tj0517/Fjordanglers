'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  Plus, X, Loader2, SlidersHorizontal, Check, Settings, Trash2, Pencil,
} from 'lucide-react'
import {
  upsertAdCampaignRows,
  getAdCampaignRows,
  addCampaignDef,
  deleteCampaignDef,
  deleteAdCampaignRow,
} from '@/actions/ads'
import type { AdCampaignRow, AdCampaignInsert, CampaignDefRow } from '@/actions/ads'
import { SpendRevenueChart, ConversionsCpcChart } from './AdsCharts'
import type { ChartPoint } from './AdsCharts'

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_PLATFORMS: { value: string; label: string }[] = [
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'meta',       label: 'Meta'       },
]

const PLATFORM_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  google_ads: { label: 'Google Ads', color: '#1E40AF', bg: 'rgba(59,130,246,0.1)'  },
  meta:       { label: 'Meta',       color: '#7C3AED', bg: 'rgba(139,92,246,0.1)'  },
}

const MAX_DAYS = 92

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = keyof AdCampaignRow | 'ctr' | 'conversions'
type SortDir = 'asc' | 'desc'

interface EnrichedRow extends AdCampaignRow {
  ctr:         number | null
  conversions: number
}

interface ColDef { key: SortKey; label: string; align: 'left' | 'right' }

interface EntryFields {
  spend:       string
  impressions: string
  clicks:      string
  avg_cpc:     string
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS: ColDef[] = [
  { key: 'date',          label: 'Date',        align: 'left'  },
  { key: 'campaign_name', label: 'Campaign',    align: 'left'  },
  { key: 'platform',      label: 'Platform',    align: 'left'  },
  { key: 'spend',         label: 'Spend',       align: 'right' },
  { key: 'impressions',   label: 'Impressions', align: 'right' },
  { key: 'clicks',        label: 'Clicks',      align: 'right' },
  { key: 'ctr',           label: 'CTR',         align: 'right' },
  { key: 'avg_cpc',       label: 'CPC',         align: 'right' },
  { key: 'conversions',   label: 'Conversions', align: 'right' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enrich(rows: AdCampaignRow[], inquiriesByDate: Record<string, number>): EnrichedRow[] {
  return rows.map(r => ({
    ...r,
    ctr:         r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null,
    conversions: inquiriesByDate[r.date] ?? 0,
  }))
}

function fmtPln(n: number) {
  return `${n.toLocaleString('pl', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

function fmtNum(n: number | null, decimals = 2, suffix = ''): string {
  if (n == null) return '—'
  return `${n.toFixed(decimals)}${suffix}`
}

function fmtDateLabel(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function getDaysInRange(from: string, to: string): string[] {
  if (!from || !to || from > to) return []
  const days: string[] = []
  const start   = new Date(from + 'T12:00:00')
  const end     = new Date(to   + 'T12:00:00')
  const current = new Date(start)
  let count = 0
  while (current <= end && count < MAX_DAYS) {
    days.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
    count++
  }
  return days
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdsClient({
  rows,
  dateFrom,
  dateTo,
  platforms,
  inquiriesByDate = {},
  campaignDefs,
}: {
  rows: AdCampaignRow[]
  dateFrom: string
  dateTo: string
  platforms: string
  inquiriesByDate?: Record<string, number>
  campaignDefs: CampaignDefRow[]
}) {
  const router = useRouter()

  // ── Filter state ───────────────────────────────────────────────────────────
  const [localDateFrom,  setLocalDateFrom]  = useState(dateFrom)
  const [localDateTo,    setLocalDateTo]    = useState(dateTo)
  const [localPlatforms, setLocalPlatforms] = useState<string[]>(
    platforms ? platforms.split(',').filter(Boolean) : [],
  )

  useEffect(() => { setLocalDateFrom(dateFrom) }, [dateFrom])
  useEffect(() => { setLocalDateTo(dateTo)     }, [dateTo])
  useEffect(() => {
    setLocalPlatforms(platforms ? platforms.split(',').filter(Boolean) : [])
  }, [platforms])

  const hasActiveFilters = Boolean(dateFrom || dateTo || platforms)

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (localDateFrom)             params.set('date_from', localDateFrom)
    if (localDateTo)               params.set('date_to',   localDateTo)
    if (localPlatforms.length > 0) params.set('platforms', localPlatforms.join(','))
    router.push(`/admin/ads${params.size > 0 ? `?${params.toString()}` : ''}`)
  }, [localDateFrom, localDateTo, localPlatforms, router])

  const clearFilters = useCallback(() => {
    setLocalDateFrom(''); setLocalDateTo(''); setLocalPlatforms([])
    router.push('/admin/ads')
  }, [router])

  // ── Sort state ─────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // ── Enriched + sorted rows ─────────────────────────────────────────────────
  const enrichedRows = useMemo(() => enrich(rows, inquiriesByDate), [rows, inquiriesByDate])

  const sortedRows = useMemo(() => {
    return [...enrichedRows].sort((a, b) => {
      const av = a[sortKey as keyof EnrichedRow]
      const bv = b[sortKey as keyof EnrichedRow]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string' && typeof bv === 'string') {
        const cmp = av.localeCompare(bv)
        return sortDir === 'asc' ? cmp : -cmp
      }
      const cmp = (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [enrichedRows, sortKey, sortDir])

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = useMemo((): ChartPoint[] => {
    const byDate = new Map<string, { spend: number; clicks: number; cpcTotal: number; cpcCount: number }>()
    for (const row of enrichedRows) {
      if (!byDate.has(row.date)) byDate.set(row.date, { spend: 0, clicks: 0, cpcTotal: 0, cpcCount: 0 })
      const e = byDate.get(row.date)!
      e.spend  += row.spend
      e.clicks += row.clicks
      const cpcVal = row.avg_cpc > 0 ? row.avg_cpc : (row.clicks > 0 ? row.spend / row.clicks : 0)
      if (cpcVal > 0) { e.cpcTotal += cpcVal; e.cpcCount++ }
    }
    return Array.from(byDate.entries())
      .map(([date, v]) => ({
        date,
        dateLabel:   fmtDateLabel(date),
        spend:       v.spend,
        conversions: inquiriesByDate[date] ?? 0,
        avgCpc:      v.cpcCount > 0 ? v.cpcTotal / v.cpcCount : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [enrichedRows, inquiriesByDate])

  // ── Local campaign defs (mutable copy for management dialog) ───────────────
  const [localDefs, setLocalDefs] = useState<CampaignDefRow[]>(campaignDefs)

  // Sync when server re-renders with fresh campaignDefs
  useEffect(() => { setLocalDefs(campaignDefs) }, [campaignDefs])

  // ── Data Entry dialog ──────────────────────────────────────────────────────
  const [showEntry,       setShowEntry]       = useState(false)
  const [entryCampaign,   setEntryCampaign]   = useState('')
  const [entryFrom,       setEntryFrom]       = useState('')
  const [entryTo,         setEntryTo]         = useState(today())
  const [entryData,       setEntryData]       = useState<Record<string, EntryFields>>({})
  const [isFetchingEntry, setIsFetchingEntry] = useState(false)
  const [isSavingEntry,   setIsSavingEntry]   = useState(false)
  const [entryError,      setEntryError]      = useState('')
  const [entrySaveOk,     setEntrySaveOk]     = useState(false)

  // Fetch existing rows whenever campaign / dates change
  useEffect(() => {
    if (!entryCampaign || !entryFrom || !entryTo || entryFrom > entryTo) {
      setEntryData({})
      return
    }
    let cancelled = false
    setIsFetchingEntry(true)
    setEntrySaveOk(false)
    setEntryError('')
    getAdCampaignRows(entryCampaign, entryFrom, entryTo).then(existingRows => {
      if (cancelled) return
      const map: Record<string, EntryFields> = {}
      for (const r of existingRows) {
        map[r.date] = {
          spend:       r.spend       > 0 ? String(r.spend)       : '',
          impressions: r.impressions > 0 ? String(r.impressions) : '',
          clicks:      r.clicks      > 0 ? String(r.clicks)      : '',
          avg_cpc:     r.avg_cpc     > 0 ? String(r.avg_cpc)     : '',
        }
      }
      setEntryData(map)
      setIsFetchingEntry(false)
    }).catch(() => { if (!cancelled) setIsFetchingEntry(false) })
    return () => { cancelled = true }
  }, [entryCampaign, entryFrom, entryTo])

  function openEntry() {
    setEntryCampaign(localDefs[0]?.key ?? '')
    setEntryFrom('')
    setEntryTo(today())
    setEntryData({})
    setEntryError('')
    setEntrySaveOk(false)
    setIsSavingEntry(false)
    setShowEntry(true)
  }

  function setEntryField(date: string, field: keyof EntryFields, value: string) {
    setEntryData(prev => ({
      ...prev,
      [date]: { ...{ spend: '', impressions: '', clicks: '', avg_cpc: '' }, ...prev[date], [field]: value },
    }))
    setEntrySaveOk(false)
    setEntryError('')
  }

  async function saveAllEntries() {
    const campaign = localDefs.find(c => c.key === entryCampaign)
    if (!campaign || !entryFrom || !entryTo) return
    const days = getDaysInRange(entryFrom, entryTo)

    const toSave: AdCampaignInsert[] = []
    for (const date of days) {
      const f = entryData[date]
      const spend       = parseFloat(f?.spend       ?? '') || 0
      const impressions = parseInt  (f?.impressions ?? '', 10) || 0
      const clicks      = parseInt  (f?.clicks      ?? '', 10) || 0
      const avg_cpc     = parseFloat(f?.avg_cpc     ?? '') || 0
      // Include if any field is filled
      if (spend > 0 || impressions > 0 || clicks > 0 || avg_cpc > 0) {
        toSave.push({ date, platform: campaign.platform, campaign_name: campaign.key, spend, impressions, clicks, avg_cpc })
      }
    }

    if (toSave.length === 0) {
      setEntryError('No data to save. Fill in at least one field for at least one day.')
      return
    }

    setIsSavingEntry(true)
    setEntryError('')
    const result = await upsertAdCampaignRows(toSave)
    setIsSavingEntry(false)
    if (result.success) {
      setEntrySaveOk(true)
    } else {
      setEntryError(result.error ?? 'Something went wrong.')
    }
  }

  // ── Campaign management dialog ─────────────────────────────────────────────
  const [showMgmt,    setShowMgmt]    = useState(false)
  const [mgmtKey,     setMgmtKey]     = useState('')
  const [mgmtName,    setMgmtName]    = useState('')
  const [mgmtPlatform, setMgmtPlatform] = useState<'google_ads' | 'meta'>('google_ads')
  const [mgmtSaving,  setMgmtSaving]  = useState(false)
  const [mgmtError,   setMgmtError]   = useState('')
  const [deletingId,  setDeletingId]  = useState<string | null>(null)

  async function handleAddCampaign() {
    if (!mgmtKey.trim() || !mgmtName.trim()) {
      setMgmtError('Key and name are required.')
      return
    }
    setMgmtSaving(true)
    setMgmtError('')
    const result = await addCampaignDef({ key: mgmtKey.trim(), name: mgmtName.trim(), platform: mgmtPlatform })
    setMgmtSaving(false)
    if (result.success && result.row) {
      setLocalDefs(prev => [...prev, result.row!])
      setMgmtKey(''); setMgmtName(''); setMgmtPlatform('google_ads')
    } else {
      setMgmtError(result.error ?? 'Something went wrong.')
    }
  }

  async function handleDeleteCampaign(id: string) {
    setDeletingId(id)
    const result = await deleteCampaignDef(id)
    setDeletingId(null)
    if (result.success) {
      setLocalDefs(prev => prev.filter(c => c.id !== id))
    }
  }

  // ── Modal keyboard / scroll ────────────────────────────────────────────────
  const anyModal = showEntry || showMgmt

  useEffect(() => {
    document.body.style.overflow = anyModal ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [anyModal])

  useEffect(() => {
    if (!anyModal) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setShowEntry(false); setShowMgmt(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anyModal])

  // ── Row edit / delete ──────────────────────────────────────────────────────
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null)

  function handleEditRow(row: EnrichedRow) {
    setEntryCampaign(row.campaign_name)
    setEntryFrom(row.date)
    setEntryTo(row.date)
    setEntryData({})
    setEntryError('')
    setEntrySaveOk(false)
    setIsSavingEntry(false)
    setShowEntry(true)
  }

  async function handleDeleteRow(id: string) {
    setDeletingRowId(id)
    await deleteAdCampaignRow(id)
    setDeletingRowId(null)
  }

  // ── Sort icon ──────────────────────────────────────────────────────────────
  function SortIcon({ col }: { col: SortKey }) {
    if (col !== sortKey) return <ChevronsUpDown size={12} style={{ color: 'rgba(10,46,77,0.3)' }} />
    return sortDir === 'asc'
      ? <ChevronUp   size={12} style={{ color: '#E67E50' }} />
      : <ChevronDown size={12} style={{ color: '#E67E50' }} />
  }

  // ── Cell renderer ──────────────────────────────────────────────────────────
  function renderCell(row: EnrichedRow, col: ColDef) {
    switch (col.key) {
      case 'date':
        return (
          <span className="f-body text-sm" style={{ color: '#0A2E4D' }}>
            {new Date(row.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )
      case 'campaign_name': {
        const def = localDefs.find(c => c.key === row.campaign_name)
        return (
          <span className="f-body text-sm font-medium" style={{ color: '#0A2E4D' }}>
            {def?.name ?? row.campaign_name}
          </span>
        )
      }
      case 'platform': {
        const style = PLATFORM_STYLE[row.platform] ?? { label: row.platform, color: '#374151', bg: 'rgba(107,114,128,0.1)' }
        return (
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full f-body whitespace-nowrap" style={{ background: style.bg, color: style.color }}>
            {style.label}
          </span>
        )
      }
      case 'spend':       return <span className="f-body text-sm tabular-nums">{fmtPln(row.spend)}</span>
      case 'impressions': return <span className="f-body text-sm tabular-nums">{row.impressions.toLocaleString('en')}</span>
      case 'clicks':      return <span className="f-body text-sm tabular-nums">{row.clicks.toLocaleString('en')}</span>
      case 'avg_cpc': {
        const cpc = row.avg_cpc > 0 ? row.avg_cpc : (row.clicks > 0 ? row.spend / row.clicks : null)
        return <span className="f-body text-sm tabular-nums">{cpc != null ? fmtPln(cpc) : '—'}</span>
      }
      case 'conversions':
        return (
          <span className="f-body text-sm tabular-nums font-semibold" style={{ color: row.conversions > 0 ? '#E67E50' : 'rgba(10,46,77,0.4)' }}>
            {row.conversions}
          </span>
        )
      case 'ctr': return <span className="f-body text-sm tabular-nums">{fmtNum(row.ctr, 2, '%')}</span>
      default: return null
    }
  }

  // ── Derived entry state ────────────────────────────────────────────────────
  const entryDays            = useMemo(() => getDaysInRange(entryFrom, entryTo), [entryFrom, entryTo])
  const entryTooManyDays     = entryFrom && entryTo && entryFrom <= entryTo && entryDays.length >= MAX_DAYS
  const selectedCampaignDef  = localDefs.find(c => c.key === entryCampaign)
  const entryReady           = Boolean(entryCampaign && entryFrom && entryTo && entryFrom <= entryTo && entryDays.length > 0)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-[20px] mb-5" style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.04)' }}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.4)' }}>Date from</label>
            <input type="date" value={localDateFrom} onChange={e => setLocalDateFrom(e.target.value)} className="rounded-xl px-3 py-2 text-sm f-body outline-none" style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.1)', color: '#0A2E4D', minWidth: '140px' }} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.4)' }}>Date to</label>
            <input type="date" value={localDateTo} onChange={e => setLocalDateTo(e.target.value)} className="rounded-xl px-3 py-2 text-sm f-body outline-none" style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.1)', color: '#0A2E4D', minWidth: '140px' }} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.4)' }}>Platform</label>
            <div className="flex items-center gap-3 py-2">
              {FILTER_PLATFORMS.map(p => (
                <label key={p.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={localPlatforms.includes(p.value)} onChange={() => setLocalPlatforms(prev => prev.includes(p.value) ? prev.filter(x => x !== p.value) : [...prev, p.value])} style={{ accentColor: '#0A2E4D' }} />
                  <span className="text-sm f-body" style={{ color: '#0A2E4D' }}>{p.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm f-body transition-all hover:brightness-95" style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.6)' }}>
                <X size={13} strokeWidth={2} /> Clear
              </button>
            )}
            <button onClick={applyFilters} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold f-body transition-all hover:brightness-110" style={{ background: '#0A2E4D', color: '#fff' }}>
              <SlidersHorizontal size={13} strokeWidth={2} /> Apply Filters
            </button>
            <button onClick={() => setShowMgmt(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold f-body transition-all hover:brightness-110" style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }} title="Manage campaigns">
              <Settings size={14} strokeWidth={1.8} />
              <span className="hidden sm:inline">Campaigns</span>
            </button>
            <button onClick={openEntry} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold f-body transition-all hover:brightness-110" style={{ background: '#E67E50', color: '#fff' }}>
              <Plus size={13} strokeWidth={2.5} /> Add Data
            </button>
          </div>
        </div>
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <SpendRevenueChart   data={chartData} />
        <ConversionsCpcChart data={chartData} />
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-[20px]" style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 12px rgba(10,46,77,0.05)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
          <div>
            <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Campaign Data</h2>
            <p className="text-[10px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
              {sortedRows.length} {sortedRows.length === 1 ? 'entry' : 'entries'}{hasActiveFilters && ' · filtered'} · CPC stored from ad platform
            </p>
          </div>
        </div>
        {sortedRows.length === 0 ? (
          <p className="px-5 py-16 text-sm text-center f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
            No campaign data{hasActiveFilters && ' for the selected filters'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
                  {COLUMNS.map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)} className="px-4 py-3 cursor-pointer select-none transition-colors hover:bg-[#F3EDE4]" style={{ textAlign: col.align, whiteSpace: 'nowrap' }}>
                      <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                        <span className="text-[10px] uppercase tracking-[0.14em] f-body font-semibold" style={{ color: sortKey === col.key ? '#E67E50' : 'rgba(10,46,77,0.45)' }}>
                          {col.label}
                        </span>
                        <SortIcon col={col.key} />
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: i < sortedRows.length - 1 ? '1px solid rgba(10,46,77,0.05)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(10,46,77,0.01)' }}>
                    {COLUMNS.map(col => (
                      <td key={col.key} className="px-4 py-3" style={{ textAlign: col.align, verticalAlign: 'middle' }}>
                        {renderCell(row, col)}
                      </td>
                    ))}
                    <td className="px-3 py-2" style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditRow(row)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-[#F3EDE4]"
                          style={{ color: 'rgba(10,46,77,0.4)' }}
                          title="Edit"
                        >
                          <Pencil size={13} strokeWidth={1.8} />
                        </button>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          disabled={deletingRowId === row.id}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-50 disabled:opacity-40"
                          style={{ color: 'rgba(220,38,38,0.5)' }}
                          title="Delete"
                        >
                          {deletingRowId === row.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Trash2 size={13} strokeWidth={1.8} />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Data Entry Dialog ─────────────────────────────────────────────── */}
      {showEntry && (
        <>
          <div className="fixed inset-0 z-50" style={{ background: 'rgba(10,46,77,0.55)', backdropFilter: 'blur(6px)' }} onClick={() => setShowEntry(false)} />
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full"
            style={{ maxWidth: '740px', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="rounded-3xl overflow-hidden shadow-2xl flex flex-col" style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.1)', maxHeight: 'calc(100vh - 48px)' }}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ background: '#0A2E4D' }}>
                <div>
                  <h3 className="text-base font-bold f-display" style={{ color: '#fff' }}>Add Campaign Data</h3>
                  <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Select campaign · set date range · fill in each day
                  </p>
                </div>
                <button onClick={() => setShowEntry(false)} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <X size={15} strokeWidth={2} />
                </button>
              </div>

              {/* Campaign + date range controls */}
              <div className="px-6 py-4 flex-shrink-0 flex flex-wrap gap-4 items-end" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)', background: 'rgba(10,46,77,0.02)' }}>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.5)' }}>Campaign</label>
                  <select
                    value={entryCampaign}
                    onChange={e => setEntryCampaign(e.target.value)}
                    className="rounded-xl px-3 py-2 text-sm f-body outline-none cursor-pointer"
                    style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.12)', color: '#0A2E4D', minWidth: '180px' }}
                  >
                    {localDefs.length === 0 && (
                      <option value="">No campaigns — add one first</option>
                    )}
                    {localDefs.map(c => (
                      <option key={c.key} value={c.key}>
                        {c.name} ({c.platform === 'google_ads' ? 'Google' : 'Meta'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.5)' }}>From</label>
                  <input
                    type="date"
                    value={entryFrom}
                    onChange={e => setEntryFrom(e.target.value)}
                    className="rounded-xl px-3 py-2 text-sm f-body outline-none"
                    style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.12)', color: '#0A2E4D', minWidth: '148px' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.5)' }}>To</label>
                  <input
                    type="date"
                    value={entryTo}
                    onChange={e => setEntryTo(e.target.value)}
                    className="rounded-xl px-3 py-2 text-sm f-body outline-none"
                    style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.12)', color: '#0A2E4D', minWidth: '148px' }}
                  />
                </div>
                {entryReady && selectedCampaignDef && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg self-end" style={{ background: PLATFORM_STYLE[selectedCampaignDef.platform]?.bg, color: PLATFORM_STYLE[selectedCampaignDef.platform]?.color }}>
                    <span className="text-[11px] font-bold f-body">{PLATFORM_STYLE[selectedCampaignDef.platform]?.label}</span>
                  </div>
                )}
              </div>

              {/* Hint / empty state */}
              {!entryReady && (
                <div className="flex-1 flex items-center justify-center px-6 py-12">
                  <p className="text-sm f-body text-center" style={{ color: 'rgba(10,46,77,0.35)' }}>
                    {localDefs.length === 0
                      ? 'No campaigns yet. Close this dialog and use the Campaigns button to add one.'
                      : 'Select a campaign and a start date to see the day-by-day entry table.'}
                  </p>
                </div>
              )}

              {/* Too many days warning */}
              {entryTooManyDays && (
                <div className="px-6 py-3 flex-shrink-0" style={{ background: 'rgba(234,179,8,0.08)', borderBottom: '1px solid rgba(234,179,8,0.2)' }}>
                  <p className="text-sm f-body" style={{ color: '#92400E' }}>
                    Range limited to {MAX_DAYS} days. Adjust the end date.
                  </p>
                </div>
              )}

              {/* Day-by-day table */}
              {entryReady && !entryTooManyDays && (
                <>
                  {isFetchingEntry ? (
                    <div className="flex items-center justify-center px-6 py-12 flex-1">
                      <Loader2 size={20} className="animate-spin" style={{ color: 'rgba(10,46,77,0.3)' }} />
                    </div>
                  ) : (
                    <div className="overflow-auto flex-1" style={{ minHeight: 0 }}>
                      <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: '560px' }}>
                        <thead className="sticky top-0" style={{ background: '#F3EDE4', zIndex: 1 }}>
                          <tr style={{ borderBottom: '1px solid rgba(10,46,77,0.1)' }}>
                            <th className="px-4 py-2.5 text-left">
                              <span className="text-[10px] uppercase tracking-[0.14em] f-body font-semibold" style={{ color: 'rgba(10,46,77,0.5)' }}>Date</span>
                            </th>
                            <th className="px-3 py-2.5 text-right">
                              <span className="text-[10px] uppercase tracking-[0.14em] f-body font-semibold" style={{ color: 'rgba(10,46,77,0.5)' }}>Spend (zł)</span>
                            </th>
                            <th className="px-3 py-2.5 text-right">
                              <span className="text-[10px] uppercase tracking-[0.14em] f-body font-semibold" style={{ color: 'rgba(10,46,77,0.5)' }}>Impressions</span>
                            </th>
                            <th className="px-3 py-2.5 text-right">
                              <span className="text-[10px] uppercase tracking-[0.14em] f-body font-semibold" style={{ color: 'rgba(10,46,77,0.5)' }}>Clicks</span>
                            </th>
                            <th className="px-3 py-2.5 text-right">
                              <span className="text-[10px] uppercase tracking-[0.14em] f-body font-semibold" style={{ color: 'rgba(10,46,77,0.5)' }}>Avg CPC (zł)</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {entryDays.map((date, i) => {
                            const f = entryData[date]
                            const hasData = f && (f.spend || f.impressions || f.clicks || f.avg_cpc)
                            return (
                              <tr
                                key={date}
                                style={{
                                  borderBottom: i < entryDays.length - 1 ? '1px solid rgba(10,46,77,0.05)' : 'none',
                                  background: hasData ? 'rgba(230,126,80,0.04)' : (i % 2 === 0 ? 'transparent' : 'rgba(10,46,77,0.01)'),
                                }}
                              >
                                <td className="px-4 py-2">
                                  <span className="text-[13px] f-body font-medium whitespace-nowrap" style={{ color: '#0A2E4D' }}>
                                    {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <input
                                    type="number" min="0" step="0.01" placeholder="0.00"
                                    value={f?.spend ?? ''}
                                    onChange={e => setEntryField(date, 'spend', e.target.value)}
                                    className="rounded-lg px-2 py-1.5 text-sm f-body outline-none text-right tabular-nums"
                                    style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.1)', color: '#0A2E4D', width: '90px' }}
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <input
                                    type="number" min="0" step="1" placeholder="0"
                                    value={f?.impressions ?? ''}
                                    onChange={e => setEntryField(date, 'impressions', e.target.value)}
                                    className="rounded-lg px-2 py-1.5 text-sm f-body outline-none text-right tabular-nums"
                                    style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.1)', color: '#0A2E4D', width: '90px' }}
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <input
                                    type="number" min="0" step="1" placeholder="0"
                                    value={f?.clicks ?? ''}
                                    onChange={e => setEntryField(date, 'clicks', e.target.value)}
                                    className="rounded-lg px-2 py-1.5 text-sm f-body outline-none text-right tabular-nums"
                                    style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.1)', color: '#0A2E4D', width: '80px' }}
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <input
                                    type="number" min="0" step="0.0001" placeholder="0.00"
                                    value={f?.avg_cpc ?? ''}
                                    onChange={e => setEntryField(date, 'avg_cpc', e.target.value)}
                                    className="rounded-lg px-2 py-1.5 text-sm f-body outline-none text-right tabular-nums"
                                    style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.1)', color: '#0A2E4D', width: '90px' }}
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Footer: error + save */}
              {entryReady && !entryTooManyDays && !isFetchingEntry && (
                <div className="px-6 py-4 flex-shrink-0 flex items-center gap-3" style={{ borderTop: '1px solid rgba(10,46,77,0.07)', background: 'rgba(10,46,77,0.02)' }}>
                  <div className="flex-1">
                    {entryError && (
                      <p className="text-sm f-body" style={{ color: '#DC2626' }}>{entryError}</p>
                    )}
                    {entrySaveOk && (
                      <p className="flex items-center gap-1.5 text-sm f-body" style={{ color: '#16A34A' }}>
                        <Check size={14} strokeWidth={2.5} /> Saved successfully
                      </p>
                    )}
                    {!entryError && !entrySaveOk && (
                      <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                        {entryDays.length} day{entryDays.length !== 1 ? 's' : ''} · rows with all zeros are skipped
                      </p>
                    )}
                  </div>
                  <button
                    onClick={saveAllEntries}
                    disabled={isSavingEntry}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold f-body transition-all hover:brightness-110 disabled:opacity-60"
                    style={{ background: entrySaveOk ? '#16A34A' : '#E67E50', color: '#fff' }}
                  >
                    {isSavingEntry
                      ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                      : entrySaveOk
                      ? <><Check size={14} strokeWidth={2.5} /> Saved</>
                      : <>Save All Days</>
                    }
                  </button>
                </div>
              )}

            </div>
          </div>
        </>
      )}

      {/* ── Campaign Management Dialog ────────────────────────────────────── */}
      {showMgmt && (
        <>
          <div className="fixed inset-0 z-50" style={{ background: 'rgba(10,46,77,0.55)', backdropFilter: 'blur(6px)' }} onClick={() => setShowMgmt(false)} />
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full"
            style={{ maxWidth: '480px', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="rounded-3xl overflow-hidden shadow-2xl flex flex-col" style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.1)', maxHeight: 'calc(100vh - 48px)' }}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ background: '#0A2E4D' }}>
                <div>
                  <h3 className="text-base font-bold f-display" style={{ color: '#fff' }}>Manage Campaigns</h3>
                  <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Define which campaigns you track</p>
                </div>
                <button onClick={() => setShowMgmt(false)} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <X size={15} strokeWidth={2} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-6">

                {/* Existing campaigns */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-3" style={{ color: 'rgba(10,46,77,0.4)' }}>Active Campaigns</p>
                  {localDefs.length === 0 ? (
                    <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>No campaigns yet. Add one below.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {localDefs.map(c => {
                        const pStyle = PLATFORM_STYLE[c.platform]
                        return (
                          <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.07)' }}>
                            <span className="text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-1 rounded-full f-body flex-shrink-0" style={{ background: pStyle?.bg, color: pStyle?.color }}>
                              {c.platform === 'google_ads' ? 'G' : 'M'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>{c.name}</p>
                              <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>{c.key} · {pStyle?.label}</p>
                            </div>
                            <button
                              onClick={() => handleDeleteCampaign(c.id)}
                              disabled={deletingId === c.id}
                              className="p-1.5 rounded-lg transition-colors hover:bg-red-50 disabled:opacity-40 flex-shrink-0"
                              style={{ color: 'rgba(220,38,38,0.6)' }}
                              title="Remove campaign"
                            >
                              {deletingId === c.id
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Trash2 size={14} strokeWidth={1.8} />
                              }
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Add new campaign */}
                <div style={{ borderTop: '1px solid rgba(10,46,77,0.07)', paddingTop: '20px' }}>
                  <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-3" style={{ color: 'rgba(10,46,77,0.4)' }}>Add Campaign</p>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.18em] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.5)' }}>Key (unique identifier)</label>
                      <input
                        type="text" placeholder="e.g. google_brand"
                        value={mgmtKey}
                        onChange={e => { setMgmtKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')); setMgmtError('') }}
                        className="w-full rounded-xl px-3 py-2.5 text-sm f-body outline-none"
                        style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.12)', color: '#0A2E4D' }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.18em] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.5)' }}>Display Name</label>
                      <input
                        type="text" placeholder="e.g. Brand"
                        value={mgmtName}
                        onChange={e => { setMgmtName(e.target.value); setMgmtError('') }}
                        className="w-full rounded-xl px-3 py-2.5 text-sm f-body outline-none"
                        style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.12)', color: '#0A2E4D' }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.18em] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.5)' }}>Platform</label>
                      <select
                        value={mgmtPlatform}
                        onChange={e => setMgmtPlatform(e.target.value as 'google_ads' | 'meta')}
                        className="w-full rounded-xl px-3 py-2.5 text-sm f-body outline-none cursor-pointer"
                        style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.12)', color: '#0A2E4D' }}
                      >
                        <option value="google_ads">Google Ads</option>
                        <option value="meta">Meta</option>
                      </select>
                    </div>
                    {mgmtError && (
                      <p className="text-sm f-body px-3 py-2 rounded-xl" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.15)' }}>
                        {mgmtError}
                      </p>
                    )}
                    <button
                      onClick={handleAddCampaign}
                      disabled={mgmtSaving}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold f-body transition-all hover:brightness-110 disabled:opacity-60"
                      style={{ background: '#0A2E4D', color: '#fff' }}
                    >
                      {mgmtSaving
                        ? <><Loader2 size={14} className="animate-spin" /> Adding…</>
                        : <><Plus size={14} strokeWidth={2.5} /> Add Campaign</>
                      }
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
