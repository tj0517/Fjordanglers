'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { COUNTRIES } from '@/lib/countries'

// ─── Constraint name → human message ─────────────────────────────────────────

const CONSTRAINT_MESSAGES: Record<string, string> = {
  agent_knowledge_one_active_instructions:
    'There is already one active instructions entry. Deactivate it first.',
  agent_knowledge_destination_shape:
    'A destination entry needs a country and no guide.',
  agent_knowledge_guide_shape:
    'A guide entry needs a guide and no country.',
  agent_knowledge_global_shape:
    'Instructions and tone entries cannot have a country or guide.',
  agent_knowledge_title_not_blank:
    'Title cannot be blank.',
  agent_knowledge_body_not_blank:
    'Body cannot be blank.',
  agent_knowledge_country_check:
    'Unknown country.',
  agent_knowledge_kind_check:
    'Unknown kind.',
}

function mapDbError(message: string): string {
  for (const [constraint, human] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(constraint)) return human
  }
  return message
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const KIND_VALUES = ['instructions', 'tone', 'destination', 'guide'] as const
const COUNTRY_VALUES = COUNTRIES

const KnowledgePayloadSchema = z.object({
  kind:     z.enum(KIND_VALUES),
  country:  z.enum(COUNTRY_VALUES).nullable().optional(),
  guide_id: z.string().uuid().nullable().optional(),
  title:    z.string().min(1, 'Title cannot be blank'),
  body:     z.string().min(1, 'Body cannot be blank'),
  active:   z.boolean(),
})

export type KnowledgePayload = z.infer<typeof KnowledgePayloadSchema>

export type KnowledgeActionResult =
  | { success: true }
  | { success: false; error: string }

// ─── createKnowledgeEntry ─────────────────────────────────────────────────────

export async function createKnowledgeEntry(
  payload: KnowledgePayload,
): Promise<KnowledgeActionResult> {
  const { userId } = await requireAdmin()

  const parsed = KnowledgePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }
  }

  const { kind, country, guide_id, title, body, active } = parsed.data
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('agent_knowledge')
    .insert({ kind, country: country ?? null, guide_id: guide_id ?? null, title, body, active, updated_by: userId })

  if (error != null) return { success: false, error: mapDbError(error.message) }

  revalidatePath('/admin/knowledge')
  return { success: true }
}

// ─── updateKnowledgeEntry ─────────────────────────────────────────────────────

export async function updateKnowledgeEntry(
  id: string,
  payload: KnowledgePayload,
): Promise<KnowledgeActionResult> {
  const { userId } = await requireAdmin()

  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { success: false, error: 'Invalid entry id' }

  const parsed = KnowledgePayloadSchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }
  }

  const { kind, country, guide_id, title, body, active } = parsed.data
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('agent_knowledge')
    .update({ kind, country: country ?? null, guide_id: guide_id ?? null, title, body, active, updated_by: userId })
    .eq('id', id)
    .select('id')

  if (error != null) return { success: false, error: mapDbError(error.message) }
  if ((data ?? []).length === 0) return { success: false, error: 'Entry not found or update denied' }

  revalidatePath('/admin/knowledge')
  return { success: true }
}

// ─── setKnowledgeActive ───────────────────────────────────────────────────────

export async function setKnowledgeActive(
  id: string,
  active: boolean,
): Promise<KnowledgeActionResult> {
  const { userId } = await requireAdmin()

  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { success: false, error: 'Invalid entry id' }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('agent_knowledge')
    .update({ active, updated_by: userId })
    .eq('id', id)
    .select('id')

  if (error != null) return { success: false, error: mapDbError(error.message) }
  if ((data ?? []).length === 0) return { success: false, error: 'Entry not found or update denied' }

  revalidatePath('/admin/knowledge')
  return { success: true }
}
