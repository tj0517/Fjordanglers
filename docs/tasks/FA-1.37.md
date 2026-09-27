---
id: FA-1.37
title: „Zapisz wpłatę z przeszłości” na karcie — data, kwota w groszach, waluta, kurs z dnia wpłaty; status od razu `paid`/`completed`; zdarzenia `backfill` z prawdziwą datą
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/record-past-payment
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 8
owner: tj
---

# FA-1.37 — Zapis wpłaty z przeszłości

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły 5 (każda zmiana stanu emituje zdarzenie), 6 (grosze + waluta, kurs zamrożony), 7 (booking = `deposit_paid_at`)
- `docs/03-conventions.md` — konwencje kodu
- `docs/01-architecture.md` §3–4 + `docs/REBUILD_PLAN.md` załącznik C — maszyna stanów i katalog zdarzeń
- `docs/02-data-model.md` + `docs/audit/rebuild-audit-db-aug-2026.md` — `inquiries`, `inquiry_events` (append-only)
- `src/lib/inquiries/state.ts` — `transition()`: kolejność zapis → zdarzenie → wycofanie przy błędzie; `ALLOWED_TRANSITIONS`, `stageReachedFor`
- `src/lib/events/emit.ts` (+ `emit.test.ts` „passes occurred_at through for backfilled history”) — `occurredAt`, `source: 'backfill'`
- `src/app/api/webhooks/stripe-deposit/route.ts` — jak webhook ustawia `deposit_paid_at` (idempotencja `WHERE deposit_paid_at IS NULL`); wzorzec do naśladowania
- `src/actions/inquiries.ts` `setDepositAmount` (~672) — kolumny FA-1.28 (`deposit_amount_cents`, `deposit_currency`, `deposit_eur_rate`) i pobranie kursu; `src/lib/fx.ts`
- `src/lib/metrics/commission.ts` — `rowCommissionEur` czyta kolumny FA-1.28 jako pierwsze
- `src/app/admin/inquiries/[id]/` — zakładka „Offer & payment” (FA-1.32), `useLockedAction` (FA-1.31)
- `docs/deferred-tasks.md` wiersz FA-1.12 `markPaymentReceived` — ta sama potrzeba (wpłata poza webhookiem); to zadanie ją domyka
- `docs/04-open-questions.md` O-25

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś nie da się zapisać bookingu, który się wydarzył, z jego prawdziwą datą: przejście statusu stempluje „teraz”, nie ustawia `deposit_paid_at`, a z `new` do `paid` trzeba przeklikać 4–5 kroków, każdy z dzisiejszą datą. Po tym zadaniu admin na karcie zapytania wpisuje „wpłacono <data>, <kwota> <waluta>” i jedną akcją: kolumny wpłaty i kwoty dostają prawdziwe wartości (kurs z dnia wpłaty, zamrożony), status przechodzi od razu na `paid` albo `completed`, a w `inquiry_events` powstają `status.changed` i `payment.received` z `source='backfill'` i `occurred_at` = data wpłaty. Ta sama akcja obsłuży przyszłe wpłaty poza Stripe (przelew, gotówka).

## Decyzje tj
- **O-25 (2026-09-27):** przeskok statusu z datą z przeszłości dozwolony dla **każdego** zapytania, jako osobna ścieżka historyczna oznaczona `backfill`. Zwykłe `transition()` nie zmienia reguł.

## Zakres
- [ ] Odczyt bieżącego stanu: definicje `transition()`, `emitEvent`, webhooka depozytu; czy w bazie istnieje cokolwiek, co pilnuje przejść statusu poza kodem (trigger, CHECK) — `grep` w `supabase/migrations` + wynik w raporcie; lista kolumn FA-1.28 i ich ograniczeń; obsługiwane waluty.
- [ ] `src/lib/inquiries/history.ts` — `recordPastPayment(client, inquiryId, { paidOn, amountCents, currency, finalStatus: 'paid' | 'completed', note, actor })`:
  - odrzuca `paidOn` w przyszłości (strefa Europe/Warsaw) i datę niepoprawną;
  - odrzuca, gdy `deposit_paid_at` już jest ustawione (także przez webhook) — korekta istniejącej wpłaty jest poza zakresem;
  - kurs do EUR z dnia `paidOn` (historyczny, nie bieżący), zamrożony w `deposit_eur_rate`;
  - zapis compare-and-set (`WHERE deposit_paid_at IS NULL`) kolumn wpłaty, kwoty, `status`, `stage_reached`;
  - zdarzenia `status.changed` (from → to, payload `{ historical: true, note }`) i `payment.received`, oba `source='backfill'`, `occurred_at = paidOn`; błąd zapisu zdarzenia → wycofanie zmian w `inquiries` (jak w `transition()`).
- [ ] Akcja `recordPastPaymentAction` w `src/actions/inquiries.ts` z `requireAdmin()`, `revalidatePath` kart i ekranów metryk.
- [ ] UI w zakładce „Offer & payment”: formularz „Zapisz wpłatę z przeszłości” (data, kwota, waluta, „zakończona wyprawa” → `completed`, notatka) widoczny tylko przy `deposit_paid_at IS NULL`; stan „trwa” + blokada podwójnego kliknięcia (FA-1.31).
- [ ] Testy Vitest dla `history.ts` (klient-atrapa jak w `state.test.ts`).
- [ ] `docs/REBUILD_PLAN.md` załącznik C — przy `payment.received` dopisek: „także `source='backfill'` z FA-1.37”; wiersz FA-1.12 `markPaymentReceived` w `deferred-tasks.md` zamknięty odnośnikiem do FA-1.37.

## Gotowe, gdy
- [ ] Na lokalnym stacku: zapis wpłaty z datą sprzed 3 miesięcy na zapytaniu z seeda → SELECT w raporcie pokazuje `deposit_paid_at` = ta data, `deposit_amount_cents`, `deposit_currency`, `deposit_eur_rate` (kurs z tamtego dnia), `status='paid'`; oraz dwa wiersze `inquiry_events` z `source='backfill'` i `occurred_at` = ta data.
- [ ] Ten booking pojawia się na `/admin/weekly`, `/admin/finances` i `/admin/pipeline` w miesiącu/tygodniu **wpłaty**, nie w bieżącym — liczby przed/po + zrzut Playwright.
- [ ] **Na czerwono:** data w przyszłości → błąd, zero zmian w `inquiries` i `inquiry_events` (test).
- [ ] **Na czerwono:** zapytanie z ustawionym `deposit_paid_at` (np. przez webhook) → błąd, wartości nie nadpisane (test).
- [ ] **Na czerwono:** nieudany zapis zdarzenia → `status`, `deposit_paid_at` i kwoty wycofane (test z klientem, który rzuca przy `inquiry_events`).
- [ ] Zwykłe `transition()` nadal odrzuca `new → paid` (istniejący test zielony, bez zmian w `ALLOWED_TRANSITIONS`); `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Daty oferty, zapytania i przegranej z przeszłości — FA-1.38.
- Korekta/cofnięcie już zapisanej wpłaty (zwrot, pomyłka) — osobne zadanie; wpis do `deferred-tasks.md`.
- Wielowalutowy Stripe, `payments`/`deals` — etap 4.
- Zmiana `InternalDealTracker` / `internal_commission_eur` — nie; nowe wpisy idą do kolumn FA-1.28 (reguła 6).
- Masowy import z CSV — nie.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.
- Jeśli potrzebna jest migracja (nowa kolumna, zmiana CHECK, triggera albo funkcji wołanej z RLS) — STOP przed napisaniem: pokaż diff względem baseline i powód.
- Zapis na produkcji (`db push`, SQL inny niż SELECT) — STOP, nie w tym zadaniu.
- Testy wyłącznie na lokalnym stacku (bezpiecznik FA-0.21); pobranie kursu w testach zaślepione.

## Weryfikacja
```
pnpm test -- history state emit
supabase db reset && pnpm dev   # zapis wpłaty z przeszłości na karcie, potem 3 ekrany metryk
psql "$LOCAL_DB_URL" -c "select type, source, occurred_at from inquiry_events where inquiry_id = '<id>' order by occurred_at"
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Notatki z realizacji
- 2026-09-27 tj (wf-plan): O-25 rozstrzygnięte — przeskok z datą dla każdego zapytania, `source='backfill'`.
