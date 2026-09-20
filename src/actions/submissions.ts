'use server'

/**
 * Guide submission Server Actions.
 *
 * markSubmissionInProgress — FA marks a submission as in_progress when starting to build.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'

// ─── markSubmissionInProgress ─────────────────────────────────────────────────

/**
 * FA marks a submission as in_progress when they start building the experience.
 * Returns the guide_id so the caller can navigate to the admin trip creation page.
 */
export async function markSubmissionInProgress(
  submissionId: string,
): Promise<{ guideId: string } | { error: string }> {
  await requireAdmin()
  const svc = createServiceClient()

  const { data: sub } = await svc
    .from('guide_submissions')
    .select('id, guide_id, status')
    .eq('id', submissionId)
    .single()

  if (sub == null) return { error: 'Submission not found' }

  await svc
    .from('guide_submissions')
    .update({ status: 'in_progress' })
    .eq('id', submissionId)

  return { guideId: sub.guide_id }
}
