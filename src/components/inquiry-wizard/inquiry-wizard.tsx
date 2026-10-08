'use client'

/**
 * The v2 inquiry form (FA-1.55): one set of answers, two frames.
 *
 * S14 shows step 1 inline on the page (`InquiryInline`); every CTA — the sticky widget, the
 * mobile bottom bar, the top bar — opens the same form as a full-screen wizard
 * (`InquiryWizardOverlay`). Both read and write the one state this provider holds, so moving
 * between them never costs an answer, and going back from step 2 to step 1 shows what was
 * typed.
 *
 * It POSTs to `/api/inquiries` — the one inquiry-creation path (FA-0.05) — with the same trap
 * field and elapsed-time signal the v1 widget sends (FA-1.43), plus `brief`. The rate limiter,
 * the honeypot and the minimum fill time therefore apply to this form exactly as they do to
 * the old one; nothing here asks for an exception, and the server would not grant one.
 *
 * The v1 widget (`src/components/inquiry/InquiryWidget.tsx`) is untouched: the only things
 * shared with it are the trap field and the stored UTM/gclid readers.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { InquiryTrapField, TRAP_FIELD_NAME, elapsedSinceShown } from '@/components/inquiry/InquiryTrapField'
import { getStoredGclid } from '@/lib/gclid'
import { getStoredUtm } from '@/lib/utm'
import { safeHttpUrl } from '@/lib/experience-v2-content'
import {
  briefFromAnswers,
  clearAnswers,
  initialAnswers,
  loadAnswers,
  saveAnswers,
  validateStep,
  type WizardAnswers,
  type WizardErrors,
  type WizardPageRules,
  type WizardStep,
} from './wizard-state'
import { StepAngler, StepContact, StepTrip, asksBudget, type WizardPageInfo } from './wizard-steps'
import { MUTED, Progress, primaryButtonStyle } from './wizard-fields'

const TOTAL_STEPS = 3

export interface InquiryWizardPage extends WizardPageInfo {
  /** The canonical page the inquiry is filed against — an alias slug has already resolved. */
  experiencePageId: string
  experienceName:   string
  responseSlaHours: number
  /** `license_info.buy_url`, already checked `http(s)` by the data layer, or null. */
  licenseUrl:       string | null
}

type SubmitState = 'idle' | 'sending' | 'done' | 'error'

/** The step-1 answers the widget collects on its own. */
export type WidgetTrip = Partial<Pick<WizardAnswers, 'datesMode' | 'dateFrom' | 'flexMonth' | 'days' | 'anglers'>>

interface WizardValue {
  page:    InquiryWizardPage
  answers: WizardAnswers
  errors:  WizardErrors
  step:    WizardStep
  isOpen:  boolean
  submitState: SubmitState
  errorMessage: string | null
  set:     <K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => void
  /** Opens the full-screen wizard at `step`, keeping every answer given so far. */
  openAt:  (step: WizardStep) => void
  /**
   * What the sticky widget's CTA does: hand over the trip answers the visitor already gave
   * up there (FA-1.53 kept them in local state for exactly this), then open at step 2 — or
   * at step 1, when what they picked is not enough to leave it (an "exact dates" choice with
   * no date, say).
   */
  startFromWidget: (trip: WidgetTrip) => void
  close:   () => void
  /** Validates the current step; advances, or shows what is missing. */
  next:    () => void
  back:    () => void
  submit:  () => void
}

const WizardContext = createContext<WizardValue | null>(null)

function useInquiryWizard(): WizardValue {
  const value = useContext(WizardContext)
  if (value == null) throw new Error('useInquiryWizard must be used inside <InquiryWizardProvider>')
  return value
}

/**
 * For components that may or may not sit inside the provider — the widget's CTA is the same
 * component on a v2 page (where it opens the wizard) and in the preview (where it does too),
 * but it must not throw if it is ever rendered without one.
 */
export function useInquiryWizardOptional(): WizardValue | null {
  return useContext(WizardContext)
}

export function InquiryWizardProvider({ page, children }: { page: InquiryWizardPage; children: ReactNode }) {
  const rules: WizardPageRules = useMemo(() => ({
    offerMode:  page.offerMode,
    minDays:    page.minDays,
    maxDays:    page.maxDays,
    asksBudget: asksBudget(page),
  }), [page])

  const [answers, setAnswers] = useState<WizardAnswers>(() => initialAnswers(rules))
  const [step, setStep]       = useState<WizardStep>(1)
  const [isOpen, setIsOpen]   = useState(false)
  const [attempted, setAttempted] = useState<Record<WizardStep, boolean>>({ 1: false, 2: false, 3: false })
  const [submitState, setSubmitState]   = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // The elapsed-time signal (FA-1.43) is measured from the first paint of the form on the
  // page, not from opening the overlay: a visitor who read the page and then opened the
  // wizard has genuinely been here a while, and the server only cares about "too fast".
  const shownAt = useRef<number | null>(null)
  const trapRef = useRef<HTMLInputElement>(null)
  const sending = useRef(false)

  // sessionStorage only after mount — the server render must not depend on it.
  useEffect(() => {
    shownAt.current = performance.now()
    setAnswers(current => loadAnswers(page.experiencePageId, current))
  }, [page.experiencePageId])

  useEffect(() => {
    if (submitState === 'done') return
    saveAnswers(page.experiencePageId, answers)
  }, [answers, page.experiencePageId, submitState])

  const set = useCallback(<K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => {
    setAnswers(current => ({ ...current, [key]: value }))
  }, [])

  const errors = attempted[step] ? validateStep(step, answers, rules) : {}

  const openAt = useCallback((target: WizardStep) => {
    setStep(target)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  // Read in an event handler, never during render — so it is the answers as of the last
  // committed render, which is what a click on the widget's CTA should merge into.
  const answersRef = useRef(answers)
  useEffect(() => { answersRef.current = answers }, [answers])

  const startFromWidget = useCallback((trip: WidgetTrip) => {
    const merged = { ...answersRef.current, ...trip }
    setAnswers(merged)
    const stepOneDone = Object.keys(validateStep(1, merged, rules)).length === 0
    setAttempted(a => ({ ...a, 1: a[1] || !stepOneDone }))
    setStep(stepOneDone ? 2 : 1)
    setIsOpen(true)
  }, [rules])

  const submit = useCallback(async () => {
    if (sending.current) return
    setAttempted(a => ({ ...a, 3: true }))
    if (Object.keys(validateStep(3, answers, rules)).length > 0) return

    sending.current = true
    setSubmitState('sending')
    setErrorMessage(null)

    try {
      const response = await fetch('/api/inquiries', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experience_page_id: page.experiencePageId,
          angler_name:  `${answers.firstName.trim()} ${answers.lastName.trim()}`,
          angler_email: answers.email.trim(),
          angler_country: answers.country === '' ? null : answers.country,
          angler_phone:   answers.phone.trim() === '' ? null : answers.phone.trim(),
          // 'ZZ' is "somewhere else" — not a dialling region, so it is no help here.
          angler_phone_country: answers.country === '' || answers.country === 'ZZ' ? null : answers.country,
          // The server derives requested_dates, trip_length and the message summary from the
          // brief; party_size is sent because the schema requires it and is overridden there.
          party_size: answers.anglers,
          message:    answers.extra.trim() === '' ? null : answers.extra.trim(),
          brief:      briefFromAnswers(answers, rules),
          gclid:      getStoredGclid() ?? null,
          utm:        getStoredUtm() ?? null,
          [TRAP_FIELD_NAME]: trapRef.current?.value ?? '',
          form_elapsed_ms:   elapsedSinceShown(shownAt.current, performance.now()),
        }),
      })

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => ({}))
        const detail = typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error: unknown }).error)
          : `HTTP ${response.status}`
        throw new Error(detail)
      }

      setSubmitState('done')
      // Name, e-mail and phone must not outlive the submit in the browser.
      clearAnswers(page.experiencePageId)
    } catch (err) {
      // No personal data in the log — the message is the server's, never the form's content.
      console.error('[inquiry-wizard] submit failed:', err instanceof Error ? err.message : 'unknown error')
      setSubmitState('error')
      setErrorMessage('We could not send that. Please try again, or write to us directly.')
      sending.current = false
    }
  }, [answers, page.experiencePageId, rules])

  const next = useCallback(() => {
    setAttempted(a => ({ ...a, [step]: true }))
    if (Object.keys(validateStep(step, answers, rules)).length > 0) return
    if (step === 3) {
      void submit()
      return
    }
    const target = (step + 1) as WizardStep
    setStep(target)
    setIsOpen(true)
  }, [step, answers, rules, submit])

  const back = useCallback(() => {
    setStep(current => (current > 1 ? ((current - 1) as WizardStep) : current))
  }, [])

  const value: WizardValue = {
    page, answers, errors, step, isOpen, submitState, errorMessage,
    set, openAt, startFromWidget, close, next, back, submit: () => void submit(),
  }

  return (
    <WizardContext.Provider value={value}>
      {children}
      <InquiryTrapField inputRef={trapRef} />
      <InquiryWizardOverlay />
    </WizardContext.Provider>
  )
}

// ─── S14, inline on the page ──────────────────────────────────────────────────

/** Step 1 in the page's own flow, with the CTA that opens step 2 full-screen. */
export function InquiryInline() {
  const { page, answers, errors, set, next, submitState } = useInquiryWizard()

  if (submitState === 'done') {
    return (
      <div className="rounded-xl border-2 p-6" style={{ borderColor: 'var(--fa-navy)' }}>
        <ThankYou testId="inquiry-inline-done" />
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border-2 p-5 sm:p-8"
      style={{ borderColor: 'var(--fa-navy)', background: '#fff' }}
      data-testid="inquiry-inline"
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[3fr_2fr] sm:gap-8">
        <div>
          <h3 className="f-display mb-2 text-2xl font-bold leading-tight">
            Check availability — two minutes, non-binding
          </h3>
          <p className="mb-5 text-[15px]" style={MUTED}>
            We answer within {page.responseSlaHours} h; the guide&apos;s offer follows.
          </p>
          <StepTrip answers={answers} errors={errors} page={page} set={set} />
        </div>

        <div className="flex flex-col gap-3 sm:pt-11">
          <button
            type="button"
            onClick={next}
            className="w-full rounded-lg px-4 text-[17px] font-semibold"
            style={primaryButtonStyle}
          >
            Next → step 2 of 3
          </button>
          <p className="text-center text-[13px]" style={MUTED}>
            Step 2: your fishing, what matters, budget · Step 3: contact
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── The full-screen wizard ───────────────────────────────────────────────────

const STEP_TITLES: Record<WizardStep, string> = {
  1: 'The trip',
  2: 'You as an angler',
  3: 'Where we send the offer',
}

function InquiryWizardOverlay() {
  const { answers, errors, page, set, step, isOpen, close, next, back, submitState, errorMessage } = useInquiryWizard()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    // The page behind must not scroll under a full-screen form.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    headingRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [isOpen, close])

  if (!isOpen) return null

  const done = submitState === 'done'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={done ? 'Inquiry sent' : `Inquiry — step ${step} of ${TOTAL_STEPS}`}
      data-testid="inquiry-wizard"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(10,46,77,0.45)' }}
    >
      {/* Mobile: a sheet that fills the screen. Desktop: a centred card. */}
      <div
        className="flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:max-w-[560px] sm:rounded-xl"
        style={{ color: 'var(--fa-navy)' }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-4 sm:px-7">
          <div className="min-w-0 flex-1">
            {!done && <Progress step={step} total={TOTAL_STEPS} />}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-2 -mt-1 flex items-center justify-center text-[22px]"
            style={{ width: 44, height: 44 }}
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {done ? (
            <ThankYou testId="inquiry-thank-you" headingRef={headingRef} />
          ) : (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="f-display mb-4 text-xl font-bold outline-none">
                {STEP_TITLES[step]}
              </h2>
              {step === 1 && <StepTrip answers={answers} errors={errors} page={page} set={set} />}
              {step === 2 && <StepAngler answers={answers} errors={errors} page={page} set={set} />}
              {step === 3 && <StepContact answers={answers} errors={errors} page={page} set={set} />}
            </>
          )}
        </div>

        {!done && (
          <div className="border-t px-5 py-4 sm:px-7" style={{ borderColor: 'rgba(10,46,77,0.14)' }}>
            {errorMessage != null && (
              <p role="alert" className="mb-2.5 text-[14px] font-medium" style={{ color: '#B23A1C' }}>
                {errorMessage}
              </p>
            )}
            <div className="flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={back}
                  className="rounded-lg border px-4 text-[16px] font-semibold"
                  style={{ minHeight: 52, borderColor: 'rgba(10,46,77,0.28)' }}
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={next}
                disabled={submitState === 'sending'}
                className="flex-1 rounded-lg px-4 text-[17px] font-semibold disabled:opacity-60"
                style={primaryButtonStyle}
                data-testid="wizard-next"
              >
                {step < TOTAL_STEPS ? 'Next →' : submitState === 'sending' ? 'Sending…' : 'Send the inquiry'}
              </button>
            </div>
            <p className="mt-2.5 text-center text-[12px]" style={MUTED}>
              Free and non-binding · answer within {page.responseSlaHours} h
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Thank you ────────────────────────────────────────────────────────────────

function ThankYou({
  testId,
  headingRef,
}: {
  /** The inline copy and the overlay copy are two places on one page — distinct markers. */
  testId:      string
  headingRef?: React.Ref<HTMLHeadingElement>
}) {
  const { page } = useInquiryWizard()
  const licenceUrl = safeHttpUrl(page.licenseUrl)

  return (
    <div data-testid={testId}>
      <h2 ref={headingRef} tabIndex={-1} className="f-display mb-2 text-2xl font-bold outline-none">
        Your inquiry is in.
      </h2>
      <p className="mb-4 text-[16px]">
        We answer within <b>{page.responseSlaHours} hours</b> — check your inbox (and the spam
        folder, once).
      </p>
      <ul className="mb-4 list-disc space-y-1.5 pl-5 text-[15px]">
        <li>We read it, then ask the guide for dates and a price.</li>
        <li>You get one offer in the guide&apos;s name, with everything itemised.</li>
        <li>Nothing is due until you accept it.</li>
      </ul>
      {licenceUrl != null && (
        <p className="text-[15px]">
          In the meantime, you can read up on the fishing licence:{' '}
          <a href={licenceUrl} target="_blank" rel="noopener noreferrer" className="underline">
            where to buy it
          </a>.
        </p>
      )}
    </div>
  )
}
