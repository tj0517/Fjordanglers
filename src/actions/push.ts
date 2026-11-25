'use server'

/**
 * Guide actions for web push on /dashboard/account (FA-M.12).
 *
 *   savePushSubscriptionAction     this browser turned push on → store it for the signed-in login
 *   deletePushSubscriptionAction   this browser turned push off → delete the login's own row
 *   pushSubscriptionStatusAction   is this browser's subscription stored for the signed-in login?
 *
 * Every action runs requireGuide() first. The login is the session's — there is no user or guide
 * id parameter, so a caller cannot point an action at another account. Input is validated with zod
 * (https endpoint on a known push service only — src/lib/push/subscription.ts) before anything is
 * written. Writes use the service client through the DB functions, each with its audit_log row
 * (tj D1b A, D2 A); the status read uses the session client, so RLS limits it to own rows.
 * Endpoints and keys are never logged or returned in an error.
 */

import { requireGuide } from '@/lib/auth/guards'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { pushEndpointSchema, pushSubscriptionSchema } from '@/lib/push/subscription'
import {
  savePushSubscription, deletePushSubscription, isPushSubscriptionSaved,
} from '@/lib/push/subscriptions'

export type PushActionResult = { success: true } | { success: false; error: string }

const UNSUPPORTED = 'This browser’s push service is not supported.'
const FAILED      = 'Could not save. Please try again.'

export async function savePushSubscriptionAction(input: unknown, ...extra: unknown[]): Promise<PushActionResult> {
  const { userId } = await requireGuide()
  const parsed = pushSubscriptionSchema.safeParse(input)
  if (!parsed.success || extra.length > 0) return { success: false, error: UNSUPPORTED }

  try {
    await savePushSubscription(createServiceClient(), userId, parsed.data)
  } catch {
    console.error('[savePushSubscriptionAction] save failed')
    return { success: false, error: FAILED }
  }
  return { success: true }
}

export async function deletePushSubscriptionAction(endpoint: unknown, ...extra: unknown[]): Promise<PushActionResult> {
  const { userId } = await requireGuide()
  const parsed = pushEndpointSchema.safeParse(endpoint)
  if (!parsed.success || extra.length > 0) return { success: false, error: UNSUPPORTED }

  try {
    await deletePushSubscription(createServiceClient(), userId, parsed.data)
  } catch {
    console.error('[deletePushSubscriptionAction] delete failed')
    return { success: false, error: FAILED }
  }
  return { success: true }
}

export async function pushSubscriptionStatusAction(endpoint: unknown): Promise<{ saved: boolean }> {
  await requireGuide()
  const parsed = pushEndpointSchema.safeParse(endpoint)
  if (!parsed.success) return { saved: false }
  try {
    return { saved: await isPushSubscriptionSaved(await createClient(), parsed.data) }
  } catch {
    console.error('[pushSubscriptionStatusAction] read failed')
    return { saved: false }
  }
}
