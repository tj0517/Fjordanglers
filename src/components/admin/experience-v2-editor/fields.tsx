'use client'

/**
 * Shared pieces of the "Offer v2" editor (FA-1.56): section frame, field label, a native
 * select in the look of the design-system input, the save bar and the hook behind it.
 */

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { ExperienceV2SaveResult } from '@/actions/experience-pages'

// ─── Saving ──────────────────────────────────────────────────────────────────

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saved'; warnings: string[] }
  | { kind: 'error'; message: string }

/**
 * One save button's state. On success the route is refreshed, so every section sees what
 * the database now holds (the base price row, the guides, the readiness list) while the
 * drafts in the other sections stay as typed.
 */
export function useSave() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<SaveState>({ kind: 'idle' })

  function run(action: () => Promise<ExperienceV2SaveResult>) {
    startTransition(async () => {
      try {
        const result = await action()
        if (result.success) {
          setState({ kind: 'saved', warnings: result.warnings })
          router.refresh()
        } else {
          setState({ kind: 'error', message: result.error })
        }
      } catch {
        setState({ kind: 'error', message: 'Unexpected error — please try again.' })
      }
    })
  }

  /** A problem found in the form itself, before anything is sent. */
  function fail(message: string) {
    setState({ kind: 'error', message })
  }

  return { pending, state, run, fail }
}

export function SaveBar({
  label,
  pending,
  state,
  onSave,
}: {
  label:   string
  pending: boolean
  state:   SaveState
  onSave:  () => void
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex items-center gap-3">
        <Button type="button" onClick={onSave} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {label}
        </Button>
        {state.kind === 'saved' && !pending && (
          <span role="status" className="text-sm font-medium text-emerald-700">Saved</span>
        )}
      </div>
      {state.kind === 'error' && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      {state.kind === 'saved' && state.warnings.map(warning => (
        <Notice key={warning} tone="warning">{warning}</Notice>
      ))}
    </div>
  )
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export function Section({
  id,
  title,
  description,
  children,
}: {
  id:           string
  title:        string
  description?: string
  children:     ReactNode
}) {
  return (
    <Card id={id} aria-labelledby={`${id}-title`} role="region">
      <CardHeader>
        <h2 id={`${id}-title`} className="f-display text-lg font-bold text-foreground">{title}</h2>
        {description != null && <p className="f-body text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label:      string
  hint?:      ReactNode
  className?: string
  children:   ReactNode
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="f-body text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint != null && <span className="f-body text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function Notice({ tone, children }: { tone: 'info' | 'warning'; children: ReactNode }) {
  return (
    <p
      className={cn(
        'f-body rounded-lg px-3 py-2 text-sm',
        tone === 'warning' ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' : 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </p>
  )
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/**
 * An amount typed in major units ("1250.50"). The text is kept as typed; the caller turns
 * it into integer cents with parseMoneyToCents when saving.
 */
export function MoneyInput({
  value,
  onChange,
  currency,
  invalid = false,
  className,
  ...props
}: {
  value:     string
  onChange:  (value: string) => void
  currency?: string
  invalid?:  boolean
} & Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'>) {
  return (
    <span className="flex items-center gap-1.5">
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-invalid={invalid || undefined}
        className={cn('tabular-nums', className)}
        {...props}
      />
      {currency != null && <span className="f-body text-xs text-muted-foreground">{currency}</span>}
    </span>
  )
}

/** "one per line" textareas: what the admin typed → the list that is stored. */
export function toLines(text: string): string[] {
  return text.split('\n').map(line => line.trim()).filter(line => line !== '')
}
