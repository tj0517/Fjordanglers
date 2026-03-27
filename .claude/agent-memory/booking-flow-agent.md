# booking-flow-agent — pamięć

## Status
Sesja 41 — Manual payout model (DONE). typecheck ✅ 0 errors.

---

## Finalna architektura płatności — MANUAL PAYOUT MODEL

**Angler płaci platformie → admin ręcznie wysyła pieniądze do guide'a.**

```
1. Angler wysyła booking     → DB row (status: pending)
2. Guide akceptuje           → acceptBooking()                 — Checkout (NO transfer_data)
                               → status: accepted
3. Angler płaci 30% deposit  → webhook checkout.session.completed → status: confirmed
   (pieniądze na koncie platformy)
4. [opcjonalnie] Angler płaci 70% balance → createBalanceCheckout() → status: completed
5. Admin widzi payout_status = 'pending' → adminSendPayout()   → Stripe transfer do guide'a
   OR admin zwraca pieniądze  → adminRefundBooking()            → Stripe refund do anglera
```

**Dlaczego manual**: Upraszcza Stripe Connect setup (brak destination charges / split), admin kontroluje kiedy i czy wyplata jest wysyłana, łatwy zwrot pieniędzy bez auto-reversal transferu.

---

## Stripe Connect — model (AKTUALNY)

- **Custom accounts** — `type: 'custom'`, capability `transfers` only
- **NO destination charges** — brak `application_fee_amount`, brak `transfer_data.destination` w Checkout
- Wszystkie płatności trafiają na konto platformy
- Wypłaty dla guide'a: admin wywołuje `adminSendPayout(bookingId)` → `stripe.transfers.create()`
- Zwroty: `adminRefundBooking(bookingId)` → `stripe.refunds.create()` dla deposit PI i/lub balance PI
- **`stripe_payouts_enabled`** — NADAL syncowany (do adminSendPayout), ale NIE blokuje tworzenia Checkout
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

## Sesja 37 — Multi-date display for guide respond flow (DONE). typecheck ✅ 0 errors.

### Problem
`bookings.booking_date` przechowywał tylko pierwszą datę (dates[0]). Reszta dat wybranych przez anglera była tracona. Guide widział tylko jedną datę na kalendarzu i w dashboardzie.

### Co zrobione

**`supabase/migrations/20260325100000_add_requested_dates.sql`**
- `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS requested_dates text[] DEFAULT NULL`

**`src/lib/supabase/database.types.ts`**
- `requested_dates: string[] | null` w Row/Insert/Update bookings

**`src/actions/bookings.ts`**
- `createBookingCheckout` → `requested_dates: dates` (pełna tablica)
- `booking_date` nadal `dates[0]` (backward compat)

**`RespondCalendar.tsx`**
- Nowy prop `anglerDates?: string[]`
- `anglerDatesSet = useMemo(() => new Set(anglerDates ?? [anglerWindowFrom]))`
- `isAngWin = anglerDatesSet.has(iso)` — niebieskie kółko na KAŻDEJ dacie anglera
- Legenda: "Angler's dates"

**`BookingRespondForm.tsx`**
- Nowy prop `anglerRequestedDates?: string[]`
- Action phase: "3 dates" zamiast jednej daty
- BookingSummaryCard: chips (niebieskie) dla każdej daty
- Review phase: "3 dates: 15 Apr, 17 Apr, 22 Apr"

**`dashboard/bookings/[id]/page.tsx`**
- Multi-dates → chips (niebieskie) zamiast jednej daty
- Przekazuje `anglerRequestedDates` do formy

**`dashboard/bookings/[id]/respond/page.tsx`**
- Przekazuje `requested_dates` do formy

**`dashboard/bookings/page.tsx`**
- Lista: "+2 more dates" pod główną datą (niebieski tekst)

> ⚠️ Wymaga migracji: `supabase db push`

---

## Sesja 36 — Booking flow UI improvements (DONE). typecheck ✅ 0 errors.

### Co zrobione

**`src/app/trips/[id]/page.tsx`**
- Warunek sekcji dostępności rozszerzony: `calendarDisabled || availabilityConfig != null || exp.booking_type === 'classic' || exp.booking_type === 'both'`
- Classic guides bez `availabilityConfig` też widzą `AvailabilityPreviewCalendar`

**`src/components/trips/availability-preview-calendar.tsx`**
- CTA routing: `'icelandic'` → inquire form, wszystko inne → `/book/${expId}`
- CTA label: `'icelandic'` → `'Choose your dates →'`, inne → `'Book now →'`

**`src/components/trips/booking-widget.tsx`**
- Icelandic baner: dodano `&& bookingType !== 'classic'`
- Classic baner: dodano `&& calendarDisabled`
- Calendar dropdown: usunięto `&& bookingType !== 'classic'` (teraz włączone dla classic)
- CTA: brak dat → `?mode=request`; z datami → `?prefill=...&guests=...`

**`src/app/book/[expId]/page.tsx`**
- searchParams: `prefill?`, `mode?`
- `prefillDates` — parse + validate ISO dates
- `initialMode`: `mode=request` → `'request'`; prefill present → `'direct'`

**`src/app/book/[expId]/BookingDateStep.tsx`** (kompletny rewrite)
- 2 taby: "Book directly" / "Send request"
- Book directly: package cards → multi-select DirectDateCalendar → date chips → anglers stepper → price × dates × package
- Send request: MultiPeriodPicker + duration chips + anglers stepper + PriceEstimate
- `directSubtotal = pkgTotal(selectedPkg, groupSize) * directDates.length`

---

## Sesja 34 — Full-screen respond page (DONE). typecheck ✅ 0 errors.

### Co zbudowane

**`src/app/dashboard/bookings/[id]/respond/page.tsx`** — Server Component
- Auth check + guide identity check
- Booking musi być `pending` i należeć do guide'a (inaczej redirect)
- Pobiera `guide_weekly_schedules` (blocked weekdays)
- Pobiera `experience_blocked_dates` (hard blocked ranges)
- Renderuje `BookingRespondForm` z pełnymi danymi

**`src/app/dashboard/bookings/[id]/respond/BookingRespondForm.tsx`** — Client Component
3-fazowy flow:
- **Phase `'action'`**: Dwie duże karty — Accept (zielona) / Decline (czerwona)
- **Phase `'form'`**: 2-col grid (kalendarz + sidebar z booking summary)
  - Accept: `RespondCalendar` (mode=`'single'`) + optional note textarea
  - Decline: reason textarea + toggle "Propose alternative dates" → `RespondCalendar` (mode=`'range'`) + live message preview
- **Phase `'review'`**: Podsumowanie wszystkiego przed submitem + confirm button

**`RespondCalendar`** — inline calendar component (adapted from `OfferDatePicker`):
- `mode='single'`: guide klika jedną datę (potwierdzona data tripu)
- `mode='range'`: guide klika start → end (propozycja alternatywnych dat)
- Highlights: angler's `windowFrom` (blue circle), guide blocked weekdays (strikethrough red), experience blocked dates (disabled grey)
- Hover preview dla range mode

**Zmiany w istniejących plikach**:
- `src/app/dashboard/bookings/[id]/page.tsx` — usunięto `BookingActions`; dodano banner "🔔 Awaiting your response" z linkiem `Respond →` do `/respond`
- `src/app/dashboard/bookings/page.tsx` — usunięto `BookingActions` z listy; pending bookings mają link `🔔 Respond →`

### Architektura respond form

```
/dashboard/bookings/[id]/page.tsx    ← główny entry point
  └── BookingRespondForm (mode='inline') — osadzony w tej samej stronie

/dashboard/bookings/[id]/respond/page.tsx  ← fallback (standalone)
  └── BookingRespondForm (mode='page')  — z paddingiem i back nav
```

**`BookingRespondForm` prop `mode`**:
- `mode='inline'` (default): action phase renderuje się inline; form+review → **full-screen overlay** (`fixed inset-0 z-50`)
- `mode='page'`: wszystkie fazy inline z outer paddingiem + back nav (dla standalone `/respond` route)

**Overlay zachowanie (Sesja 35)**:
- Backdrop click → `closeOverlay()` → wraca do action phase (zamyka overlay)
- Back button (←) → `goBack()` → review→form (overlay zostaje), form→action (overlay zamknięty)
- Modal card: `maxWidth: 900px`, backdrop blur `rgba(10,46,77,0.55)`, `overflowY: auto`
- `onClick={stopPropagation}` na modal card

**Layout w booking detail (pending)**:
- Booking info card (normalna)
- Poniżej: karta respond z banerem "🔔 Awaiting your response" + embedded `BookingRespondForm`
- Klik Accept/Decline → full-screen overlay na wierzchu wszystkiego
- Czat po prawej stronie (bez zmian)

Fazy po submit:
- `acceptBooking(bookingId, { confirmedDate?, guideNote? })` → redirect do `/dashboard/bookings/[id]?responded=true`
- `declineBooking(bookingId, reason?, alternatives?)` → redirect do `/dashboard/bookings/[id]?responded=true`

---

## Sesja 33 — Enhanced BookingActions (guide response)

### Problem
`BookingActions` był prosty accept/decline bez żadnego kontekstu — guide nie mógł ani wybrać potwierdzonej daty ani zostawić wiadomości.

### Co zmienione

**`src/actions/bookings.ts` — `acceptBooking()`**
- Nowa sygnatura: `acceptBooking(bookingId, options?: { confirmedDate?: string; guideNote?: string })`
- `confirmedDate` → update `booking_date` w DB (guide ustala rzeczywistą datę tripu w oknie anglera)
- `guideNote` → insert do `booking_messages` (wysyła jako wiadomość chatową do anglera)
- Dodano `revalidatePath('/account/bookings/${bookingId}')` po akceptacji

**`src/components/dashboard/booking-actions.tsx` — pełny rewrite**
- 3 stany panelu: `idle` | `accepting` | `declining`
- **Idle**: dwa przyciski "Accept →" i "Decline"
- **Accepting panel**: date picker (min=windowFrom) + optional "Message to angler" textarea → "Confirm & Accept →"
- **Declining panel**: optional reason textarea + warning banner → "Decline Booking"
- Back button (←) wraca do idle bez side effects
- Done states z odpowiednim kolorem i opisem
- Props: `bookingId`, `windowFrom` (booking_date = window start), `durationOption`

**`src/app/dashboard/bookings/[id]/page.tsx`**
- Przekazuje `windowFrom={booking.booking_date}` i `durationOption={booking.duration_option}` do BookingActions

**`src/app/dashboard/bookings/page.tsx`**
- Lista bookingów: ten sam update — oba pola już dostępne w BookingRow

**`src/app/account/bookings/[id]/page.tsx`**
- Dodano sekcję `declined` — pokazuje guide'ów powód odmowy:
  - `booking.declined_reason` (jeśli jest) lub "No reason provided. Feel free to reach out via chat."

### Sesja 33b — propose alternative dates on decline

**`declineBooking(bookingId, reason?, alternatives?: { from, to })`**
- Nowy param `alternatives` — jeśli podany, auto-inserts booking_message z skomponowanym tekstem
- Format: "Unfortunately... — {reason}. 📅 I'm available on {from} – {to}. Feel free to rebook..."
- `revalidatePath('/account/bookings/${bookingId}')` po decline (angler widzi od razu)

**`BookingActions` — decline panel**
- Toggle "Propose alternative dates" (pill switch, niebieskie akcenty)
- Dwa date inputy: From / To (walidacja: altFrom <= altTo)
- Live message preview (dashed box) — guide widzi dokładnie co zostanie wysłane
- CTA button: "Decline Booking" → "Decline & Send Alternative Dates →" gdy daty wybrane
- Button disabled jeśli `proposeAlternatives && (!altFrom || !altTo)`

**`/account/bookings/[id]/page.tsx` — declined state**
- `guideDeclineMessage` — latest message od guide'a (filter by `sender_id === guide.user_id`)
- Czerwony banner: declined reason
- Niebieski banner (gdy `guideDeclineMessage != null`):
  - Tekst auto-wiadomości z datami
  - Link "Book new dates for this experience →" → `/book/${exp.id}`

### Nie potrzebowaliśmy migracji
- `declined_reason` — już istnieje w DB
- `booking_date` — już istnieje, tylko aktualizujemy do potwierdzonej daty
- `booking_messages` — już istnieje; guide note (accept) i alternatives message (decline) jako wiadomości

---

## Historia decyzji

**Sesja 29**: Direct booking pay immediately → destination charge → pieniądze do guide'a od razu
**Sesja 30**: Hold funds on platform → separate charges + transfers → guide nie przyjął → trudny refund (prawny risk EMD2/PSD2)
**Sesja 31 (finalna)**: Płatność zawsze po akceptacji obu stron → najprostsza architektura, brak regulatory exposure
**Sesja 32**: Classic booking flow = ikelandic flow (trip page simple CTA → /book/[expId] date picker step 1 → contact form step 2)
**Sesja 33**: BookingActions enhanced — guide picks confirmed date + writes note on accept; decline with reason
**Sesja 33b**: Decline panel — "Propose alternative dates" toggle + auto-message in chat; angler sees guide's message prominently with "Book new dates →" CTA
**Sesja 34**: Full-screen respond page z kalendarzem; split na RespondCalendar.tsx + BookingRespondForm.tsx (fix SWC OOM)
**Sesja 35**: Full-screen overlay — klik Accept/Decline otwiera modal overlay (`fixed inset-0 z-50`); action cards zostają inline; multi-day **toggle** calendar (`calMode='multi'`, `confirmedDays: string[]`, live price recalc, DB pricing update w `acceptBooking()`)
**Sesja 39**: Desktop UX — respond form jako full-page popup widget:
- Usunięto embeddowany `BookingRespondForm mode="inline"` z `dashboard/bookings/[id]/page.tsx`
- Nowy `RespondBookingWidget.tsx` — compact trigger card (orange banner + summary row) + `fixed inset-0 z-50` overlay (1040px modal, blur backdrop, ✕ button)
- Inside overlay: `BookingRespondForm mode="page"` — wszystkie 3 fazy renderują się inline w overlaycie (bez double overlay)
- `BookingRespondForm` — nowy prop `onClose?: () => void`: action phase nie pokazuje "Back to booking" gdy `onClose` defined; review phase "Changed your mind?" → `goBack()` zamiast Link
- Efekt: czat (prawa kolumna) jest w pełni widoczny bo lewa kolumna nie ma już gigantycznego formularza; form ma pełną szerokość 1040px
- typecheck ✅ 0 errors

**Sesja 41**: Manual payout model — wypłaty guide'ów przez admina:
- `createBalanceCheckout()` — usunięto `transfer_data` + `stripe_payouts_enabled` guard; pieniądze zostają na platformie
- `src/actions/admin.ts` — `adminSendPayout(bookingId)`: stripe.transfers.create() → guide, update payout_status='sent', payout_sent_at, stripe_transfer_id; idempotency key `payout-${bookingId}`
- `src/actions/admin.ts` — `adminRefundBooking(bookingId)`: refund deposit PI + balance PI (jeśli zapłacony), update payout_status='returned', status='refunded'; tylko gdy payout_status='pending'
- `src/app/admin/guides/[id]/payouts/page.tsx` — tabela wszystkich bookingów guide'a z summary (pending €, sent count, returned count); dwie kolumny statusów (payout_status + booking status); per-booking `AdminPayoutsActions`
- `src/app/admin/guides/[id]/payouts/AdminPayoutsActions.tsx` — "Send payout" (zielony) + "Refund" (czerwony) przyciski; optimistic UI — po akcji wyświetla finalne pill; confirm dialog przed refundem
- `src/app/admin/guides/[id]/page.tsx` — dodano "Payouts" link button w sekcji akcji guide'a
- DB columns: `payout_status: 'pending'|'sent'|'returned'`, `payout_sent_at`, `stripe_transfer_id` (z migracji 20260327110000)
- typecheck ✅ 0 errors

**Sesja 40**: Icelandic trip type — calendar widget parity + period picker:
- `AvailabilityPreviewCalendar` — dla `bookingType === 'icelandic'` renderuje interaktywny `MultiPeriodPicker` zamiast read-only siatki; CTA "Request trip →" z `?periods=...` w URL; heading "Pick your travel period"
- `BookingWidget` — dla `effectiveType === 'icelandic'` (bez `calendarDisabled`): dropdown period picker na górze (identyczny layout jak classic calendar dropdown ale z `MultiPeriodPicker`); period chips pod triggerem; CTA "Request trip — 1 Apr – 5 Apr →" z `?periods=...` w URL
- Sync: `INQUIRY_PERIOD_EVENT` ('fa:inquiry-periods') — custom event synchronizuje oba pickers (source: 'preview' | 'widget')
- `multi-period-picker.tsx` — nowe eksporty: `INQUIRY_PERIOD_EVENT`, `InquiryPeriodEventDetail`, `encodePeriodsParam`, `decodePeriodsParam`
- `trips/[id]/page.tsx` — dodano `exp.booking_type === 'icelandic'` do warunku sekcji kalendarza (zawsze pokazuje dla icelandic)
- `trips/[id]/inquire/page.tsx` — parsuje `?periods=` param via `decodePeriodsParam`, przekazuje do `InquireForm`
- `InquireForm` — nowy prop `prefilledPeriods?: Period[]` (priorytet nad `prefilledDates` dla initialState)
- typecheck ✅ 0 errors

**Sesja 38**: Request booking UX guide-side — `RespondCalendar` + `BookingRespondForm` rozpoznają "request" vs "direct" booking:
- `RespondCalendar` — nowe props `anglerWindowTo?` + `anglerNumDays?`; gdy window: ciągły niebieski zakres (gradient tails) zamiast 2 kropek; baner "Available: Jun 10–20 · wants 3 days" nad miesiącem; `isInAnglerAvailability()` + `getAnglerWindowOuterBg()` helpers; legenda: "Availability window" vs "Angler's dates"
- `BookingRespondForm` — `deriveWindowTo()` (z `requested_dates[1]`) + `deriveNumDays()` (regex `\d+ days?` z `duration_option`); `isRequestBooking` flag; action phase: chip z oknem dostępności; form phase: label "Select exact days from window"; booking summary card: niebieski blok z oknem zamiast chip dates; review phase: "Window Jun 10 – Jun 20 · 3 days"; wszystkie 3 instancje RespondCalendar dostają nowe propsy
