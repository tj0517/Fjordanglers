import type { InquiryStatus } from '@/lib/inquiries/state'

export type TabId = 'overview' | 'conversation' | 'brief' | 'guide' | 'offer'

export const defaultTabForStatus: Record<InquiryStatus, TabId> = {
  new:              'conversation',
  qualifying:       'conversation',
  waiting_guide:    'guide',
  offer_presented:  'offer',
  awaiting_payment: 'offer',
  paid:             'overview',
  handed_over:      'overview',
  completed:        'overview',
  lost:             'overview',
  cancelled:        'overview',
}
