'use server'

/**
 * Server actions of the request page (FA-M.04). The token is the credential: the FA-M.03
 * database functions behind these calls check it (hash, expiry, withdrawal, guide removed) in the
 * same call that writes, and write the event in the same transaction. The token is never logged.
 */

import { createServiceClient } from '@/lib/supabase/server'
import {
  answerFromRequestPage,
  openFromRequestPage,
  type RequestPageAnswerOutcome,
} from '@/lib/guide-requests/page'

function reason(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}

/** The page has rendered in a browser (tj D1 a). Only the first call records anything. */
export async function markRequestOpened(token: unknown): Promise<void> {
  if (typeof token !== 'string') return
  try {
    await openFromRequestPage(createServiceClient(), token)
  } catch (e) {
    console.error('[request-page] open failed:', reason(e))
  }
}

export type SubmitOutcome = RequestPageAnswerOutcome | { kind: 'error' }

/** Accept / Decline / Other dates. `input` is untrusted and validated by `answerGuideRequest`. */
export async function submitRequestAnswer(token: unknown, input: unknown): Promise<SubmitOutcome> {
  if (typeof token !== 'string') return { kind: 'expired' }
  try {
    return await answerFromRequestPage(createServiceClient(), token, input)
  } catch (e) {
    console.error('[request-page] answer failed:', reason(e))
    return { kind: 'error' }
  }
}
