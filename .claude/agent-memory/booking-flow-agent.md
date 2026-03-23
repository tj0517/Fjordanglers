# booking-flow-agent — pamięć

## Status
Sesja 32 — Mock payment panel + calendar disable overlay + classic booking flow refactored (DONE). typecheck ✅ 0 errors.

---

## Finalna architektura płatności (uproszczona)

**Jeden flow dla wszystkich booking_type (`direct`, `icelandic`, `both`)**:

```
1. Angler wysyła booking     → DB row (status: pending)       — brak płatności
2. Guide akceptuje           → acceptBooking()                 — Checkout (destination charge)
                               → status: accepted
3. Angler widzi banner       → PayDepositBanner               — klik → Stripe Checkout
4. Angler płaci 30% deposit  → webhook checkout.session.completed
                               → status: confirmed
```

**Dlaczego**: Trzymanie pieniędzy na platformie przed akceptacją guide'a → EMD2/PSD2 w UE → money transmitter regulations. Prostsze i bezpieczniejsze prawnie: płatność dopiero gdy obie strony się zgodzą.

---

## Stripe Connect — model

- **Custom accounts** — `type: 'custom'`, capability `transfers` only
- **Destination charges** — `application_fee_amount` + `transfer_data.destination`
  - Stripe auto-splits: guide dostaje deposit minus platform fee
  - Na refundzie: `reverse_transfer: true` → Stripe auto-odwraca transfer
- **`stripe_payouts_enabled`** — jedyny miarodajny bool dla "account gotowy"
- **`stripe_charges_enabled`** — dla Custom zwykle `false`, nie blokuj na nim

---

## Pliki — aktualny stan

### `src/actions/bookings.ts`

**`createBookingCheckout()`**
- Tylko DB insert, zwraca `{ bookingId }` — brak Stripe session
- select: bez `booking_type`, bez `stripe_payouts_enabled`
- Wszystkie booking types → ten sam prosty flow

**`acceptBooking()`**
- Guide calls this after seeing pending booking
- Tworzy Stripe Checkout (destination charge):
  - `application_fee_amount` = `(total - guide_payout) * 0.3` (proporcjonalny do depositu)
  - `transfer_data.destination` = `guide.stripe_account_id`
- Idempotency key: `booking-accept-${bookingId}`
- `status → 'accepted'`

**`renewDepositCheckout()`**
- Wywołany gdy Checkout session wygasła (limit 24h Stripe)
- Tylko dla `status === 'accepted'` bookingów
- Zawsze destination charge (bez `isDirect` logiki)
- Nadpisuje `stripe_checkout_id` w DB

**`declineBooking()`**
- `pending` → cancel (brak płatności, brak Stripe)
- `accepted + checkout_id` → `stripe.checkout.sessions.expire()` (angler nie zdążył zapłacić)
- `confirmed + payment_intent` → `stripe.refunds.create({ reverse_transfer: true })` (destination charge auto-reversal)

### `src/app/api/stripe/webhook/route.ts`

**`handleCheckoutCompleted()`**
- Brak `bookingType === 'direct'` brancha (usunięty)
- Dla `bookingId`: idempotency check (`status === 'confirmed'` → skip), potem zawsze `status → confirmed`
- Dla `inquiryId`: confirma inquiry + `createBookingFromInquiry()`

### `src/app/book/[expId]/BookingCheckoutForm.tsx`
- Brak `bookingType` prop, brak `isDirect`
- Zawsze: button text `'Request to Book →'`, footer `'No payment now. Guide confirms within 24h...'`
- Po submit → redirect do `/book/${expId}/confirmation?bookingId=...`

### `src/app/book/[expId]/page.tsx`
- Brak `bookingType`, `isDirect`, `depositEur`, `balanceDue`
- "Due today" zawsze `€0` z opisem "after guide confirmation"
- Trust block zawsze request-flow items (🛡️⏰🔒)
- Nav title: `'Request to Book'`

### `src/components/booking/pay-deposit-banner.tsx`
- Brak `bookingStatus` prop
- Nagłówek zawsze: `'Your guide accepted — pay deposit to confirm'`
- Shows 30% deposit amount + balance amount
- Happy path: server-side URL → plain `<a>` link
- Expired path: button → `renewDepositCheckout()` → redirect

### `src/app/account/bookings/[id]/page.tsx`
- `awaitingPayment = booking.status === 'accepted' && booking.stripe_checkout_id != null`
- Server-side fetches Checkout URL przed renderem (passes to banner as static prop)
- `justPaid` (`?status=paid`) → green "payment received" banner

---

## Edge cases

| Scenariusz | Handling |
|---|---|
| Guide bez Stripe | `acceptBooking()` tworzy DB update bez Checkout ID — banner nie pokazuje się (brak `stripe_checkout_id`) |
| Checkout wygasł (24h) | `renewDepositCheckout()` tworzy nową session, nadpisuje `stripe_checkout_id` |
| Duplikat webhook | Idempotency: check `status === 'confirmed'` przed update |
| Guide odrzuca po akceptacji | `declineBooking()` → expire Checkout → angler nie może zapłacić |
| Guide odrzuca po płatności | `declineBooking()` → refund + `reverse_transfer: true` → Stripe auto-reversal |

---

## Testy do uruchomienia

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
stripe trigger charge.refunded
```

---

## Sesja 32 — zmiany

### Mock payment panel (testMode)
- `src/actions/bookings.ts` — dodano `mockConfirmDeposit()` i `mockCompleteBalance()` (brak Stripe, tylko DB update)
- `src/components/booking/pay-deposit-banner.tsx` — `testMode` prop: YES/NO panel zamiast Stripe link
- `src/components/booking/pay-balance-banner.tsx` — `testMode` prop: YES/NO panel zamiast Stripe Checkout
- `src/app/account/bookings/[id]/page.tsx`:
  - `awaitingPayment = booking.status === 'accepted'` (usunięto warunek `stripe_checkout_id != null`)
  - `testMode={!guide?.stripe_payouts_enabled}` — auto-detection bez env var
  - Guide query: dodano `stripe_payouts_enabled`

### Calendar disabled overlay
- `src/app/dashboard/calendar/page.tsx`:
  - `showCalendarToggle = true` — dla WSZYSTKICH guide'ów (usunięto warunek `!hasClassicListing`)
  - Overlay `absolute inset-0 z-10` z `backdropFilter: blur(3px)` gdy `calendarDisabled`
  - Stats cards: `opacity: 0.45` gdy disabled

### Classic booking flow (two-step)
- `src/app/book/[expId]/BookingDateStep.tsx` — NEW: date range picker (klik start → klik end) + group size stepper + live price
  - `DayState` union type dla 9 stanów dnia
  - `expandRange(from, to)` → individual ISO dates array
  - On "Continue": `router.push(/book/${expId}?dates=...&guests=...)`
- `src/app/book/[expId]/page.tsx` — rewritten:
  - Step 1 (no dates): `BookingDateStep` w `max-w-2xl` centered layout
  - Step 2 (dates in URL): existing contact form + "Step 2 of 2" label + "← Change dates" link
- `src/components/trips/booking-widget.tsx`:
  - Date picker dropdown: teraz `bookingType !== 'classic'` — nie pokazuje się dla pure classic
  - CTA dla `classic`: `<Link href="/book/${expId}?guests=${groupSize}">Book this trip →</Link>`
  - Hint text: `'Pick your dates on the next page — no payment until your guide confirms.'`
  - Mobile bar: label zmieniony na `'Book this trip →'`

## Historia decyzji

**Sesja 29**: Direct booking pay immediately → destination charge → pieniądze do guide'a od razu
**Sesja 30**: Hold funds on platform → separate charges + transfers → guide nie przyjął → trudny refund (prawny risk EMD2/PSD2)
**Sesja 31 (finalna)**: Płatność zawsze po akceptacji obu stron → najprostsza architektura, brak regulatory exposure
**Sesja 32**: Classic booking flow = ikelandic flow (trip page simple CTA → /book/[expId] date picker step 1 → contact form step 2)
