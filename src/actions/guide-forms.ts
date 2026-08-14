'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multi_select'
  | 'number'
  | 'url'
  | 'yes_no'

export interface FormQuestion {
  id: string
  type: QuestionType
  label: string
  placeholder?: string
  required: boolean
  options?: string[]
}

export interface GuideIntakeForm {
  id: string
  title: string
  description: string | null
  questions: FormQuestion[]
  token: string
  is_active: boolean
  created_at: string
  updated_at: string
  response_count?: number
}

export interface GuideIntakeResponse {
  id: string
  form_id: string
  respondent_name: string
  respondent_email: string
  answers: Record<string, string | string[]>
  submitted_at: string
}

// Cast helper: guide_intake_* tables not yet in generated types — remove after regenerating types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const any = (client: ReturnType<typeof createServiceClient>) => client as any

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<ReturnType<typeof createServiceClient>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Not authorized')
  return createServiceClient()
}

// ─── createIntakeForm ─────────────────────────────────────────────────────────

export async function createIntakeForm(
  title: string,
  description: string | null,
  questions: FormQuestion[],
): Promise<{ id: string } | { error: string }> {
  let svc: ReturnType<typeof createServiceClient>
  try { svc = await requireAdmin() } catch { return { error: 'Not authorized' } }

  const token = crypto.randomUUID().replace(/-/g, '')

  const { data, error } = await any(svc)
    .from('guide_intake_forms')
    .insert({
      title:       title.trim(),
      description: description?.trim() || null,
      questions,
      token,
    })
    .select('id')
    .single()

  if (error != null || data == null) {
    console.error('[createIntakeForm]', error)
    return { error: 'Failed to create form' }
  }

  revalidatePath('/admin/forms')
  return { id: data.id as string }
}

// ─── updateIntakeForm ─────────────────────────────────────────────────────────

export async function updateIntakeForm(
  id: string,
  updates: Partial<Pick<GuideIntakeForm, 'title' | 'description' | 'questions' | 'is_active'>>,
): Promise<void | { error: string }> {
  let svc: ReturnType<typeof createServiceClient>
  try { svc = await requireAdmin() } catch { return { error: 'Not authorized' } }

  const { error } = await any(svc)
    .from('guide_intake_forms')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error != null) {
    console.error('[updateIntakeForm]', error)
    return { error: 'Failed to update form' }
  }

  revalidatePath(`/admin/forms/${id}`)
  revalidatePath('/admin/forms')
}

// ─── deleteIntakeForm ─────────────────────────────────────────────────────────

export async function deleteIntakeForm(
  id: string,
): Promise<void | { error: string }> {
  let svc: ReturnType<typeof createServiceClient>
  try { svc = await requireAdmin() } catch { return { error: 'Not authorized' } }

  const { error } = await any(svc)
    .from('guide_intake_forms')
    .delete()
    .eq('id', id)

  if (error != null) {
    console.error('[deleteIntakeForm]', error)
    return { error: 'Failed to delete form' }
  }

  revalidatePath('/admin/forms')
}

// ─── getForms ─────────────────────────────────────────────────────────────────

export async function getForms(): Promise<GuideIntakeForm[]> {
  const svc = createServiceClient()

  const { data: forms } = await any(svc)
    .from('guide_intake_forms')
    .select('*')
    .order('created_at', { ascending: false }) as { data: GuideIntakeForm[] | null }

  if (forms == null || forms.length === 0) return []

  const ids = forms.map(f => f.id)
  const { data: countRows } = await any(svc)
    .from('guide_intake_responses')
    .select('form_id')
    .in('form_id', ids) as { data: { form_id: string }[] | null }

  const countMap: Record<string, number> = {}
  ;(countRows ?? []).forEach(r => {
    countMap[r.form_id] = (countMap[r.form_id] ?? 0) + 1
  })

  return forms.map(f => ({
    ...f,
    questions:      (f.questions ?? []) as FormQuestion[],
    response_count: countMap[f.id] ?? 0,
  }))
}

// ─── getFormById (admin — includes responses) ─────────────────────────────────

export async function getFormById(id: string): Promise<{
  form: GuideIntakeForm
  responses: GuideIntakeResponse[]
} | null> {
  const svc = createServiceClient()

  const [
    { data: form },
    { data: responses },
  ] = await Promise.all([
    any(svc).from('guide_intake_forms').select('*').eq('id', id).single() as
      Promise<{ data: GuideIntakeForm | null }>,
    any(svc)
      .from('guide_intake_responses')
      .select('*')
      .eq('form_id', id)
      .order('submitted_at', { ascending: false }) as
      Promise<{ data: GuideIntakeResponse[] | null }>,
  ])

  if (form == null) return null

  return {
    form:      { ...form, questions: (form.questions ?? []) as FormQuestion[] },
    responses: responses ?? [],
  }
}

// ─── getFormByToken (public — no auth, active forms only) ─────────────────────

export async function getFormByToken(token: string): Promise<GuideIntakeForm | null> {
  const svc = createServiceClient()

  const { data } = await any(svc)
    .from('guide_intake_forms')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .single() as { data: GuideIntakeForm | null }

  if (data == null) return null
  return { ...data, questions: (data.questions ?? []) as FormQuestion[] }
}

// ─── submitIntakeResponse (public — no auth required) ────────────────────────

export async function submitIntakeResponse(
  token: string,
  respondentName: string,
  respondentEmail: string,
  answers: Record<string, string | string[]>,
): Promise<{ success: true } | { error: string }> {
  const svc = createServiceClient()

  const { data: form } = await any(svc)
    .from('guide_intake_forms')
    .select('id, questions, is_active')
    .eq('token', token)
    .single() as { data: { id: string; questions: FormQuestion[]; is_active: boolean } | null }

  if (form == null || !form.is_active) {
    return { error: 'Form not found or no longer active' }
  }

  if (!respondentName.trim()) return { error: 'Your name is required' }
  if (!respondentEmail.trim() || !respondentEmail.includes('@')) {
    return { error: 'A valid email address is required' }
  }

  const questions = (form.questions ?? []) as FormQuestion[]
  for (const q of questions) {
    if (!q.required) continue
    const ans = answers[q.id]
    const isEmpty =
      ans == null ||
      (typeof ans === 'string' && !ans.trim()) ||
      (Array.isArray(ans) && ans.length === 0)
    if (isEmpty) return { error: `"${q.label}" is required` }
  }

  const { error } = await any(svc)
    .from('guide_intake_responses')
    .insert({
      form_id:          form.id,
      respondent_name:  respondentName.trim(),
      respondent_email: respondentEmail.trim().toLowerCase(),
      answers,
    })

  if (error != null) {
    console.error('[submitIntakeResponse]', error)
    return { error: 'Failed to submit — please try again' }
  }

  return { success: true }
}
