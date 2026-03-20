'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type InquiryFormConfig } from '@/lib/inquiry-form-config'

// ─── updateInquiryFormConfig ──────────────────────────────────────────────────

/**
 * Saves the inquiry form field-visibility config for a given experience.
 * Auth: only the guide who owns the experience (or admin) can update it.
 */
export async function updateInquiryFormConfig(
  expId: string,
  config: InquiryFormConfig,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Resolve caller role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Guides: verify ownership
  if (!isAdmin) {
    const { data: guide } = await supabase
      .from('guides')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!guide) return { error: 'Guide profile not found.' }

    // Check experience belongs to this guide
    const { data: exp } = await supabase
      .from('experiences')
      .select('id')
      .eq('id', expId)
      .eq('guide_id', guide.id)
      .single()
    if (!exp) return { error: 'Experience not found or access denied.' }
  }

  const { error } = await supabase
    .from('experiences')
    .update({ inquiry_form_config: config })
    .eq('id', expId)

  if (error) {
    console.error('[updateInquiryFormConfig]', error)
    return { error: 'Failed to save settings. Please try again.' }
  }

  revalidatePath(`/dashboard/trips/${expId}/edit`)
  revalidatePath(`/trips/${expId}`)

  return {}
}
