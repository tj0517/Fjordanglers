'use client'

/**
 * CalendarsPanel — left sidebar for managing named calendar groups.
 *
 * Allows the guide to:
 *   • Create / rename / delete named calendars
 *   • Assign any subset of their experiences to each calendar
 *   • Switch between calendars (navigates via URL ?calendarId=)
 */

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCalendar,
  updateCalendar,
  deleteCalendar,
  setCalendarExperiences,
  type GuideCalendar,
} from '@/actions/calendars'

// ─── Types ────────────────────────────────────────────────────────────────────

type Experience = { id: string; title: string; published: boolean }

type Props = {
  calendars:            GuideCalendar[]
  allExperiences:       Experience[]
  calendarExperienceMap: Record<string, string[]>   // calendarId → expId[]
  activeCalendarId:     string | null
  currentYear:          number
  currentMonth:         number
}

type PanelMode =
  | { type: 'idle' }
  | { type: 'creating' }
  | { type: 'editing'; calendarId: string }
  | { type: 'confirming-delete'; calendarId: string; calendarName: string }

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarsPanel({
  calendars,
  allExperiences,
  calendarExperienceMap,
  activeCalendarId,
  currentYear,
  currentMonth,
}: Props) {
  const router      = useRouter()
  const createRef   = useRef<HTMLInputElement>(null)
  const editRef     = useRef<HTMLInputElement>(null)

  const [mode,        setMode]        = useState<PanelMode>({ type: 'idle' })
  const [createName,  setCreateName]  = useState('')
  const [editName,    setEditName]    = useState('')
  const [editExpIds,  setEditExpIds]  = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // Focus input when form opens
  useEffect(() => { if (mode.type === 'creating') createRef.current?.focus() }, [mode.type])
  useEffect(() => { if (mode.type === 'editing')  editRef.current?.focus()   }, [mode.type])

  // ── Navigation ──────────────────────────────────────────────────────────────
  function navigate(calendarId: string | null) {
    const params = new URLSearchParams({
      year:  String(currentYear),
      month: String(currentMonth),
    })
    if (calendarId != null) params.set('calendarId', calendarId)
    router.push(`/dashboard/calendar?${params}`)
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  function startCreate() {
    setCreateName('')
    setError(null)
    setMode({ type: 'creating' })
  }

  async function handleCreate() {
    if (!createName.trim() || isSubmitting) return
    setIsSubmitting(true); setError(null)
    const result = await createCalendar(createName)
    setIsSubmitting(false)
    if ('error' in result) { setError(result.error); return }
    setMode({ type: 'idle' })
    router.refresh()
    // Navigate to newly created calendar
    if (result.id) navigate(result.id)
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  function startEdit(cal: GuideCalendar) {
    setEditName(cal.name)
    setEditExpIds(new Set(calendarExperienceMap[cal.id] ?? []))
    setError(null)
    setMode({ type: 'editing', calendarId: cal.id })
  }

  async function handleSaveEdit(calendarId: string) {
    if (!editName.trim() || isSubmitting) return
    setIsSubmitting(true); setError(null)
    const [nameResult, expResult] = await Promise.all([
      updateCalendar(calendarId, editName),
      setCalendarExperiences(calendarId, Array.from(editExpIds)),
    ])
    setIsSubmitting(false)
    if ('error' in nameResult) { setError(nameResult.error); return }
    if ('error' in expResult)  { setError(expResult.error);  return }
    setMode({ type: 'idle' })
    router.refresh()
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(calendarId: string) {
    setIsSubmitting(true); setError(null)
    const result = await deleteCalendar(calendarId)
    setIsSubmitting(false)
    if ('error' in result) { setError(result.error); return }
    setMode({ type: 'idle' })
    // If deleted the active calendar, go back to "All"
    if (activeCalendarId === calendarId) navigate(null)
    else router.refresh()
  }

  function toggleEditExp(expId: string) {
    setEditExpIds(prev => {
      const next = new Set(prev)
      if (next.has(expId)) next.delete(expId)
      else next.add(expId)
      return next
    })
  }

  const cancel = () => { setMode({ type: 'idle' }); setError(null) }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
      >
        <span
          className="text-[10px] uppercase tracking-[0.18em] font-semibold f-body"
          style={{ color: 'rgba(10,46,77,0.38)' }}
        >
          Calendars
        </span>
        <button
          onClick={startCreate}
          className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-[#0A2E4D]/[0.07]"
          style={{ color: 'rgba(10,46,77,0.45)', cursor: 'pointer' }}
          title="New calendar"
          aria-label="Create new calendar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="6" y1="1" x2="6" y2="11" />
            <line x1="1" y1="6" x2="11" y2="6" />
          </svg>
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error != null && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-xl text-xs f-body"
             style={{ background: 'rgba(220,38,38,0.07)', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {/* ── "All trips" item ───────────────────────────────────────────────── */}
      <div className="px-2 pt-2">
        <button
          onClick={() => navigate(null)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold f-body text-left transition-colors"
          style={{
            background: activeCalendarId == null ? 'rgba(10,46,77,0.07)' : 'transparent',
            color:      activeCalendarId == null ? '#0A2E4D'              : 'rgba(10,46,77,0.55)',
            cursor: 'pointer',
          }}
          onMouseEnter={e => {
            if (activeCalendarId != null) e.currentTarget.style.background = 'rgba(10,46,77,0.04)'
          }}
          onMouseLeave={e => {
            if (activeCalendarId != null) e.currentTarget.style.background = 'transparent'
          }}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'rgba(10,46,77,0.3)' }} />
          All trips
          <span
            className="ml-auto text-[10px] font-bold f-body px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.4)' }}
          >
            {allExperiences.length}
          </span>
        </button>
      </div>

      {/* ── Calendar items ─────────────────────────────────────────────────── */}
      <div className="px-2 pb-2 flex flex-col gap-0.5">
        {calendars.map((cal, i) => {
          const isActive  = activeCalendarId === cal.id
          const isEditing = mode.type === 'editing' && mode.calendarId === cal.id
          const isDelConf = mode.type === 'confirming-delete' && mode.calendarId === cal.id
          const expCount  = (calendarExperienceMap[cal.id] ?? []).length
          const dotColor  = ['#1B4F72','#0891B2','#059669','#7C3AED','#BE185D'][i % 5]!

          return (
            <div key={cal.id}>
              {/* ── Normal row ─────────────────────────────────────────────── */}
              {!isEditing && !isDelConf && (
                <div
                  className="flex items-center gap-1 px-3 py-2 rounded-xl transition-colors group"
                  style={{
                    background: isActive ? 'rgba(10,46,77,0.07)' : 'transparent',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(10,46,77,0.04)'
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* Calendar name (clickable area) */}
                  <button
                    onClick={() => navigate(cal.id)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-sm font-semibold f-body text-left"
                    style={{ color: isActive ? '#0A2E4D' : 'rgba(10,46,77,0.6)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                    <span className="truncate">{cal.name}</span>
                  </button>

                  {/* Experience count badge */}
                  <span
                    className="text-[10px] font-bold f-body px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.38)' }}
                  >
                    {expCount}
                  </span>

                  {/* Action buttons — pencil always visible, delete on hover */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => startEdit(cal)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{
                        color:      expCount === 0 ? '#E67E50' : 'rgba(10,46,77,0.5)',
                        background: expCount === 0 ? 'rgba(230,126,80,0.12)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = expCount === 0 ? 'rgba(230,126,80,0.2)' : 'rgba(10,46,77,0.08)'
                        e.currentTarget.style.color = expCount === 0 ? '#E67E50' : '#0A2E4D'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = expCount === 0 ? 'rgba(230,126,80,0.12)' : 'transparent'
                        e.currentTarget.style.color = expCount === 0 ? '#E67E50' : 'rgba(10,46,77,0.5)'
                      }}
                      title="Assign listings to this calendar"
                      aria-label={`Edit ${cal.name}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => setMode({ type: 'confirming-delete', calendarId: cal.id, calendarName: cal.name })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 hover:bg-red-50"
                      style={{ color: 'rgba(10,46,77,0.3)', cursor: 'pointer' }}
                      title="Delete calendar"
                      aria-label={`Delete ${cal.name}`}
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <polyline points="1,3 10,3"/>
                        <path d="M3,3V9.5a.5.5 0 00.5.5h4a.5.5 0 00.5-.5V3"/>
                        <line x1="4" y1="5" x2="4" y2="8"/>
                        <line x1="7" y1="5" x2="7" y2="8"/>
                        <path d="M4,3V2a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Delete confirmation ────────────────────────────────────── */}
              {isDelConf && (
                <div
                  className="px-3 py-3 rounded-xl flex flex-col gap-2"
                  style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.12)' }}
                >
                  <p className="text-xs f-body" style={{ color: '#B91C1C' }}>
                    Delete &ldquo;{mode.calendarName}&rdquo;?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(cal.id)}
                      disabled={isSubmitting}
                      className="text-xs font-bold f-body px-3 py-1.5 rounded-lg transition-colors"
                      style={{ background: '#DC2626', color: 'white', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1 }}
                    >
                      {isSubmitting ? 'Deleting…' : 'Delete'}
                    </button>
                    <button
                      onClick={cancel}
                      className="text-xs font-semibold f-body px-3 py-1.5 rounded-lg transition-colors hover:bg-[#0A2E4D]/[0.06]"
                      style={{ color: 'rgba(10,46,77,0.5)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── Edit form ──────────────────────────────────────────────── */}
              {isEditing && (
                <div
                  className="px-3 py-3 rounded-xl flex flex-col gap-3"
                  style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}
                >
                  {/* Name input */}
                  <input
                    ref={editRef}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(cal.id); if (e.key === 'Escape') cancel() }}
                    placeholder="Calendar name"
                    maxLength={80}
                    className="w-full text-sm f-body px-3 py-2 rounded-lg outline-none"
                    style={{
                      background:  'white',
                      border:      '1px solid rgba(10,46,77,0.18)',
                      color:       '#0A2E4D',
                    }}
                  />

                  {/* Experience assignment */}
                  {allExperiences.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <p
                        className="text-[10px] uppercase tracking-[0.14em] font-semibold f-body mb-1"
                        style={{ color: 'rgba(10,46,77,0.38)' }}
                      >
                        Listings
                      </p>
                      {allExperiences.map(exp => (
                        <label
                          key={exp.id}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,46,77,0.04)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <input
                            type="checkbox"
                            checked={editExpIds.has(exp.id)}
                            onChange={() => toggleEditExp(exp.id)}
                            className="w-3.5 h-3.5 rounded flex-shrink-0"
                            style={{ accentColor: '#0A2E4D', cursor: 'pointer' }}
                          />
                          <span
                            className="text-xs f-body truncate flex-1"
                            style={{ color: editExpIds.has(exp.id) ? '#0A2E4D' : 'rgba(10,46,77,0.45)' }}
                          >
                            {exp.title}
                            {!exp.published && (
                              <span style={{ color: 'rgba(10,46,77,0.3)' }}> (draft)</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Save / Cancel */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveEdit(cal.id)}
                      disabled={isSubmitting || !editName.trim()}
                      className="flex-1 text-xs font-bold f-body py-1.5 rounded-lg transition-colors"
                      style={{
                        background: '#0A2E4D',
                        color:      'white',
                        border:     'none',
                        cursor:     (isSubmitting || !editName.trim()) ? 'not-allowed' : 'pointer',
                        opacity:    (isSubmitting || !editName.trim()) ? 0.5 : 1,
                      }}
                    >
                      {isSubmitting ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={cancel}
                      className="text-xs font-semibold f-body px-3 py-1.5 rounded-lg transition-colors hover:bg-[#0A2E4D]/[0.06]"
                      style={{ color: 'rgba(10,46,77,0.5)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* ── Create form ────────────────────────────────────────────────── */}
        {mode.type === 'creating' && (
          <div
            className="mt-1 px-3 py-3 rounded-xl flex flex-col gap-2"
            style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}
          >
            <input
              ref={createRef}
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') cancel() }}
              placeholder="Calendar name…"
              maxLength={80}
              className="w-full text-sm f-body px-3 py-2 rounded-lg outline-none"
              style={{
                background: 'white',
                border:     '1px solid rgba(10,46,77,0.18)',
                color:      '#0A2E4D',
              }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreate}
                disabled={isSubmitting || !createName.trim()}
                className="flex-1 text-xs font-bold f-body py-1.5 rounded-lg transition-colors"
                style={{
                  background: '#0A2E4D',
                  color:      'white',
                  border:     'none',
                  cursor:     (isSubmitting || !createName.trim()) ? 'not-allowed' : 'pointer',
                  opacity:    (isSubmitting || !createName.trim()) ? 0.5 : 1,
                }}
              >
                {isSubmitting ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={cancel}
                className="text-xs font-semibold f-body px-3 py-1.5 rounded-lg transition-colors hover:bg-[#0A2E4D]/[0.06]"
                style={{ color: 'rgba(10,46,77,0.5)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {calendars.length === 0 && mode.type === 'idle' && (
          <button
            onClick={startCreate}
            className="mt-1 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs f-body transition-colors"
            style={{ color: 'rgba(10,46,77,0.38)', cursor: 'pointer', border: '1px dashed rgba(10,46,77,0.15)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,46,77,0.03)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="5.5" y1="1" x2="5.5" y2="10" />
              <line x1="1" y1="5.5" x2="10" y2="5.5" />
            </svg>
            Create your first calendar
          </button>
        )}
      </div>
    </div>
  )
}
