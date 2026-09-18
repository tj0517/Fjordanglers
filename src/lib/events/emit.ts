/**
 * emitEvent — the only way a row reaches `inquiry_events`.
 *
 * It takes the client instead of creating one, so the event is written by the same
 * client (and, once the repositories move to RPC in stage 2/4, the same transaction)
 * as the mutation that caused it. A mutation without an event is a bug of the same
 * class as a write without auth (CLAUDE.md rule 5).
 *
 * The table is append-only: `emitEvent` can insert, and nothing anywhere can update or
 * delete (policies + REVOKE + trigger, see 20260916201226_add_inquiry_events.sql).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import {
  ACTOR_KINDS,
  EVENT_CHANNELS,
  EVENT_SOURCES,
  isEventType,
  type ActorKind,
  type EventChannel,
  type EventSource,
  type EventType,
} from './types'

export type EventClient = SupabaseClient<Database>

export interface EventActor {
  kind: ActorKind
  /** Admin uid or guide id. Null for system and agent. */
  id?: string | null
}

export interface EmitEventParams {
  inquiryId:   string
  type:        EventType
  actor:       EventActor
  source:      EventSource
  channel?:    EventChannel | null
  /** Only for `status.changed`. */
  fromStatus?: string | null
  toStatus?:   string | null
  /** Only for `message.*`. The FK to messages(id) arrives with FA-1.12. */
  messageId?:  string | null
  payload?:    Record<string, unknown>
  /** Real time of the fact, when it differs from now (backfills, imported history). */
  occurredAt?: string | Date | null
}

export class EventError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EventError'
  }
}

function assertKnown<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): asserts value is T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new EventError(
      `emitEvent: ${field} must be one of ${allowed.join(', ')} — got ${JSON.stringify(value)}`,
    )
  }
}

/**
 * Writes one event. Throws `EventError` on an unknown type, actor kind, channel or a
 * missing source — the caller is a mutation that must not report success when the
 * event did not land.
 *
 * Returns the new event id.
 */
export async function emitEvent(
  client: EventClient,
  params: EmitEventParams,
): Promise<string> {
  if (typeof params.inquiryId !== 'string' || params.inquiryId === '') {
    throw new EventError('emitEvent: inquiryId is required')
  }
  if (!isEventType(params.type)) {
    throw new EventError(
      `emitEvent: unknown event type ${JSON.stringify(params.type)} — ` +
      'add it to src/lib/events/types.ts and REBUILD_PLAN.md Appendix C in the same PR',
    )
  }
  assertKnown(params.actor?.kind, ACTOR_KINDS, 'actor.kind')
  assertKnown(params.source, EVENT_SOURCES, 'source')
  if (params.channel != null) {
    assertKnown(params.channel, EVENT_CHANNELS, 'channel')
  }

  const occurredAt =
    params.occurredAt == null
      ? undefined
      : (params.occurredAt instanceof Date
          ? params.occurredAt.toISOString()
          : params.occurredAt)

  const { data, error } = await client
    .from('inquiry_events')
    .insert({
      inquiry_id:  params.inquiryId,
      type:        params.type,
      actor_kind:  params.actor.kind,
      actor_id:    params.actor.id ?? null,
      source:      params.source,
      channel:     params.channel ?? null,
      from_status: params.fromStatus ?? null,
      to_status:   params.toStatus ?? null,
      message_id:  params.messageId ?? null,
      payload:     (params.payload ?? {}) as Database['public']['Tables']['inquiry_events']['Insert']['payload'],
      ...(occurredAt != null ? { occurred_at: occurredAt } : {}),
    })
    .select('id')
    .single()

  if (error != null || data == null) {
    throw new EventError(
      `emitEvent: failed to write ${params.type} for inquiry ${params.inquiryId}: ` +
      (error?.message ?? 'no row returned'),
    )
  }

  return data.id
}
