'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BillingCycle = 'monthly' | 'yearly' | 'one_time'
export type CostCategory = 'infrastructure' | 'tools' | 'marketing' | 'other'

export interface FixedCostRow {
  id: string
  created_at: string
  updated_at: string
  name: string
  amount_pln: number
  billing_cycle: BillingCycle
  category: CostCategory
  notes: string | null
  active: boolean
}

export interface FixedCostInput {
  name: string
  amount_pln: number
  billing_cycle: BillingCycle
  category: CostCategory
  notes?: string | null
}

export interface ManualCostEntryRow {
  id: string
  month: string           // YYYY-MM
  name: string
  amount_pln: number
  category: CostCategory
  notes: string | null
  created_at: string
}

export interface ManualCostEntryInput {
  month: string
  name: string
  amount_pln: number
  category: CostCategory
  notes?: string | null
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function addFixedCost(
  data: FixedCostInput,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('fixed_costs').insert({
    ...data,
    notes: data.notes ?? null,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/finances')
  return { success: true }
}

export async function updateFixedCost(
  id: string,
  data: Partial<FixedCostInput>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('fixed_costs')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/finances')
  return { success: true }
}

export async function deleteFixedCost(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('fixed_costs')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/finances')
  return { success: true }
}

export async function addManualCostEntry(
  data: ManualCostEntryInput,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('manual_cost_entries').insert({
    month: data.month,
    name: data.name,
    amount_pln: data.amount_pln,
    category: data.category,
    notes: data.notes ?? null,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/finances')
  return { success: true }
}

export async function deleteManualCostEntry(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('manual_cost_entries').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/finances')
  return { success: true }
}

export async function updateEurRate(
  rate: number,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('finance_settings')
    .upsert({ key: 'eur_pln_rate', value: String(rate), updated_at: new Date().toISOString() })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
