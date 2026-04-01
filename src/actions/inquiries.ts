'use server'

/**
 * inquiries.ts — compatibility wrappers.
 *
 * trip_inquiries merged into bookings (source='inquiry').
 * All implementations live in bookings.ts.
 *
 * NOTE: Must use explicit async function wrappers — NOT `export { x } from '...'`
 * syntax — because Next.js enforces that 'use server' files only export
 * async functions. Re-export syntax is rejected by Turbopack at build time.
 *
 * TODO: update all import sites to import from '@/actions/bookings' directly,
 *       then delete this file.
 */

import {
  createInquiryBooking,
  sendOffer,
  acceptBookingOffer,
  markBookingReviewing,
  declineBooking,
} from '@/actions/bookings'

export async function submitInquiry(
  ...args: Parameters<typeof createInquiryBooking>
): ReturnType<typeof createInquiryBooking> {
  return createInquiryBooking(...args)
}

export async function sendOfferByGuide(
  ...args: Parameters<typeof sendOffer>
): ReturnType<typeof sendOffer> {
  return sendOffer(...args)
}

export async function acceptOffer(
  ...args: Parameters<typeof acceptBookingOffer>
): ReturnType<typeof acceptBookingOffer> {
  return acceptBookingOffer(...args)
}

export async function updateInquiryStatus(
  ...args: Parameters<typeof markBookingReviewing>
): ReturnType<typeof markBookingReviewing> {
  return markBookingReviewing(...args)
}

export async function declineInquiry(
  ...args: Parameters<typeof declineBooking>
): ReturnType<typeof declineBooking> {
  return declineBooking(...args)
}
