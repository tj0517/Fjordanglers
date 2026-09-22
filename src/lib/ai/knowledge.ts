/**
 * Knowledge loader for the draft-reply agent. FA-1.23.
 *
 * Reads active entries from the `agent_knowledge` table:
 *   instructions — the agent system prompt (at most one active; throws if absent)
 *   tone         — always loaded
 *   destination  — loaded when country matches the entry's country field
 *   guide        — loaded when guideId matches the entry's guide_id field
 *
 * Returns the matching entries plus the list of their ids.
 * No caching — every call reads the table so panel changes take effect immediately.
 */

import { createServiceClient } from '@/lib/supabase/server'

type KnowledgeKind = 'instructions' | 'tone' | 'destination' | 'guide'

export interface KnowledgeEntry {
  id:       string
  kind:     KnowledgeKind
  country:  string | null
  guide_id: string | null
  title:    string
  body:     string
}

export interface LoadKnowledgeParams {
  country?:  string | null
  guideId?:  string | null
}

export interface LoadKnowledgeResult {
  instructions: KnowledgeEntry | null
  entries:      KnowledgeEntry[]
  usedIds:      string[]
}

export async function loadKnowledge(params: LoadKnowledgeParams = {}): Promise<LoadKnowledgeResult> {
  const { country, guideId } = params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('agent_knowledge')
    .select('id, kind, country, guide_id, title, body')
    .eq('active', true)

  if (error != null) {
    throw new Error(`Failed to load agent knowledge: ${error.message}`)
  }

  const rows = (data ?? []) as KnowledgeEntry[]

  let instructions: KnowledgeEntry | null = null
  const entries: KnowledgeEntry[] = []

  for (const row of rows) {
    if (row.kind === 'instructions') {
      instructions = row
    } else if (row.kind === 'tone') {
      entries.push(row)
    } else if (
      row.kind === 'destination' &&
      country != null &&
      row.country != null &&
      row.country.toLowerCase() === country.toLowerCase()
    ) {
      entries.push(row)
    } else if (row.kind === 'guide' && guideId != null && row.guide_id === guideId) {
      entries.push(row)
    }
  }

  const usedIds: string[] = [
    ...(instructions != null ? [instructions.id] : []),
    ...entries.map(e => e.id),
  ]

  return { instructions, entries, usedIds }
}
