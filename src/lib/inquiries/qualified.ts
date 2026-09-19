/**
 * inquiries.qualified — three-state classification flag (FA-1.04).
 *
 * Rule O-10: qualified = yes iff priority ≠ not_viable AND trip_country ∈ COUNTRIES.
 *
 * D1 edge cases (decided 19 IX 2026 by tj):
 *   priority === 'not_viable'                          → 'no'   (disqualifier is known)
 *   priority empty OR (trip_country empty/unknown)    → 'unknown' (cannot evaluate yet)
 *   priority ≠ 'not_viable' AND country ∈ COUNTRIES  → 'yes'
 *   priority ≠ 'not_viable' AND country ∉ COUNTRIES  → 'no'
 *
 * D2 (decided 19 IX 2026 by tj):
 *   Admin sets 'yes'|'no'  → qualified_set_by = 'admin' (agent cannot overwrite)
 *   Admin sets 'unknown'   → qualified_set_by = NULL    (lock released; agent can overwrite)
 *   Agent only calls setQualified when computeQualified returns 'yes' or 'no'.
 *   Every setQualified call emits exactly one inquiry.qualified_set event.
 */

import { COUNTRIES } from '@/lib/countries'
import { emitEvent, type EventActor, type EventClient } from '@/lib/events/emit'

export type QualifiedValue = 'yes' | 'no' | 'unknown'

// ─── computeQualified ─────────────────────────────────────────────────────────

export function computeQualified({
  priority,
  tripCountry,
}: {
  priority:    string | null | undefined
  tripCountry: string | null | undefined
}): QualifiedValue {
  // Disqualifier always wins — country cannot rescue a not_viable lead.
  if (priority === 'not_viable') return 'no'

  // Not enough information to evaluate yet.
  if (!priority || !tripCountry) return 'unknown'

  const served = COUNTRIES.some(
    c => c.toLowerCase() === tripCountry.toLowerCase().trim(),
  )
  return served ? 'yes' : 'no'
}

// ─── setQualified ─────────────────────────────────────────────────────────────

export class QualifiedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QualifiedError'
  }
}

/**
 * Writes qualified, qualified_set_by and qualified_set_at, then emits
 * inquiry.qualified_set. Throws QualifiedError if the DB write or event fails.
 *
 * For admin actors:
 *   value 'yes'|'no'  → qualified_set_by = 'admin'
 *   value 'unknown'   → qualified_set_by = NULL (releases the agent lock)
 * For agent actors:
 *   qualified_set_by = 'agent'
 */
export async function setQualified(
  client:     EventClient,
  inquiryId:  string,
  value:      QualifiedValue,
  actor:      EventActor,
): Promise<void> {
  const qualifiedSetBy =
    actor.kind === 'admin' && value === 'unknown'
      ? null
      : actor.kind

  const { error } = await client
    .from('inquiries')
    .update({
      qualified:        value,
      qualified_set_by: qualifiedSetBy,
      qualified_set_at: new Date().toISOString(),
    })
    .eq('id', inquiryId)

  if (error != null) {
    throw new QualifiedError(
      `setQualified: failed to update inquiry ${inquiryId}: ${error.message}`,
    )
  }

  await emitEvent(client, {
    inquiryId,
    type:    'inquiry.qualified_set',
    actor,
    source:  'app',
    payload: {
      value,
      rule: actor.kind === 'admin' ? 'manual' : 'O-10',
    },
  })
}
