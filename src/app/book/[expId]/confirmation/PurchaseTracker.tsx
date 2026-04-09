'use client'

import { useEffect } from 'react'

export function PurchaseTracker({
  bookingId,
  totalEur,
  bookingFeeEur,
}: {
  bookingId:    string
  totalEur:     number
  bookingFeeEur: number
}) {
  useEffect(() => {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event:          'purchase',
      transaction_id: bookingId,
      value:          bookingFeeEur,  // amount actually charged via Stripe
      currency:       'EUR',
      items: [{
        item_name: 'Fishing trip booking fee',
        price:     bookingFeeEur,
        quantity:  1,
      }],
    })
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Purchase', {
        value:    bookingFeeEur,
        currency: 'EUR',
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
