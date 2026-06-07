'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdCampaignRow {
  id: string
  created_at: string
  date: string
  platform: string
  campaign_name: string
  spend: number
  impressions: number
  clicks: number
  avg_cpc: number
}

export interface AdCampaignInsert {
  date: string
  platform: string
  campaign_name: string
  spend: number
  impressions: number
  clicks: number
  avg_cpc: number
}

export interface CampaignDefRow {
  id: string
  created_at: string
  key: string
  name: string
  platform: 'google_ads' | 'meta'
  sort_order: number
  active: boolean
}

// ─── Ad Campaign Actions ──────────────────────────────────────────────────────

export async function addAdCampaign(
  data: AdCampaignInsert,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('ad_campaigns').insert(data)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/ads')
  return { success: true }
}

export async function upsertAdCampaignRows(
  rows: AdCampaignInsert[],
): Promise<{ success: boolean; error?: string }> {
  if (rows.length === 0) return { success: true }
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('ad_campaigns')
    .upsert(rows, { onConflict: 'date,campaign_name' })
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/ads')
  return { success: true }
}

export async function getAdCampaignRows(
  campaignName: string,
  dateFrom: string,
  dateTo: string,
): Promise<AdCampaignRow[]> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from as any)('ad_campaigns')
    .select('*')
    .eq('campaign_name', campaignName)
    .gte('date', dateFrom)
    .lte('date', dateTo)
  return (data ?? []) as AdCampaignRow[]
}

// ─── Campaign Definition Actions ──────────────────────────────────────────────

export async function getCampaignDefs(): Promise<CampaignDefRow[]> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from as any)('ad_campaign_defs')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  return (data ?? []) as CampaignDefRow[]
}

export async function addCampaignDef(data: {
  key: string
  name: string
  platform: 'google_ads' | 'meta'
}): Promise<{ success: boolean; error?: string; row?: CampaignDefRow }> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from as any)('ad_campaign_defs')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  const maxOrder = ((existing as { sort_order: number }[] | null)?.[0]?.sort_order ?? 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase.from as any)('ad_campaign_defs')
    .insert({ ...data, sort_order: maxOrder + 1 })
    .select()
    .single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/ads')
  return { success: true, row: row as CampaignDefRow }
}

export async function deleteAdCampaignRow(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('ad_campaigns').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/ads')
  return { success: true }
}

export async function deleteCampaignDef(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('ad_campaign_defs')
    .update({ active: false })
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/ads')
  return { success: true }
}
