---
id: FA-1.36
title: Lista braków w danych — `/admin/data-gaps`: zapytania bez daty wpłaty, kwoty, daty oferty, kodu przegranej, z linkiem do karty
stage: 1
status: review
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-admin
branch: feat/admin-data-gaps
pr: 118
depends_on: [FA-1.35]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 3
owner: tj
---

# FA-1.36 — Lista braków w danych

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne (3: `.from(` tylko w `src/actions/*`; 7: booking = `deposit_paid_at`)
- `docs/03-conventions.md` — konwencje kodu
- `src/lib/metrics/facts.ts` (FA-1.35) — `isBooked`, `rowCommissionEur`; nie definiuj booking od nowa
- `src/lib/inquiries/state.ts` — `STATUSES`, `stageReachedFor`
- `docs/deferred-tasks.md` wiersze „FA-1.05 audit” — trzy znane klasy braków (daty wpłat, 24 oferty bez daty, 7 zapytań z `created_at` po pierwszej wiadomości)
- `src/actions/weekly.ts` — wzorzec: akcja czyta, `src/lib/metrics/*` liczy
- `src/components/admin/sidenav.tsx` — nawigacja

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
„Wszystko uzupełnione” musi być sprawdzalne, a nie oceniane na oko. Jedna strona pokazuje, ile zapytań ma każdą kategorię braku, i listę tych zapytań z linkiem do karty. Liczniki są miarą celu FA-1.39: kiedy kategorie A–D pokazują 0, historia jest kompletna. Strona tylko czyta.

## Zakres
- [ ] Odczyt bieżącego stanu: kolumny potrzebne do kategorii (`deposit_paid_at`, `status`, `stage_reached`, `external_offer_sent`, `offer_sent_at`, `lost_reason_code`, `qualified`, `created_at`, kolumny kwot z `CommissionRow`, min `messages.occurred_at` per zapytanie) — lista do raportu.
- [ ] `src/lib/metrics/gaps.ts` — czyste funkcje, jedna na kategorię:
  - **A. Booking bez daty wpłaty:** `status ∈ {paid, handed_over, completed}` albo `stage_reached ∈ {deposit_paid, completed}`, a `deposit_paid_at IS NULL`;
  - **B. Booking bez kwoty:** `isBooked` i `rowCommissionEur(row) === 0`;
  - **C. Oferta bez daty:** (`stage_reached ∈ {offer_sent, deposit_paid, completed}` albo `external_offer_sent = true`) i `offer_sent_at IS NULL`;
  - **D. Przegrana bez kodu:** `status = 'lost'` i `lost_reason_code IS NULL`;
  - **E. Data zapytania późniejsza niż pierwsza wiadomość** (informacyjnie);
  - **F. `qualified = unknown`** (informacyjnie — ustawia się istniejącą kontrolką na karcie).
- [ ] `src/actions/data-gaps.ts` — odczyt z `requireAdmin()`; strona `/admin/data-gaps` — liczniki A–F na górze, pod spodem tabela (imię, data, status, kategorie) z linkiem do `/admin/inquiries/<id>`. Link w sidenav.
- [ ] Testy Vitest dla każdej kategorii.

## Gotowe, gdy
- [ ] Test na każdą kategorię A–F: wiersz z brakiem jest wykryty, wiersz kompletny nie (`pnpm test -- gaps`).
- [ ] **Na czerwono:** test kategorii A pada, gdy warunek zostanie ograniczony do samego `status` (pominie wiersz z `stage_reached='deposit_paid'` i starym statusem) — wynik czerwony i zielony w raporcie.
- [ ] Na lokalnym stacku z seedem (dopisz do seeda po jednym wierszu na kategorię A–D): liczniki na stronie == wynik 4 SELECT-ów z tymi samymi warunkami (w raporcie) + zrzut Playwright.
- [ ] Strona bez braków pokazuje zera, nie błąd (test lub zrzut).
- [ ] Brak `.from(` w `src/app/**` i `src/lib/metrics/**` w diffie; `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Edycja danych z tej strony — tylko link do karty; wpisywanie to FA-1.37/FA-1.38.
- Automatyczne uzupełnianie braków z `messages` / Stripe — nie; źródłem jest człowiek (FA-1.39).
- Kategorie wydatków na reklamy — sprawdzane ręcznie w FA-1.39.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (tylko odczyt).

## Weryfikacja
```
pnpm test -- gaps
supabase db reset && pnpm dev   # /admin/data-gaps vs 4 SELECT-y
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Notatki z realizacji
- 2026-09-27 tj (wf-plan): pełny zakres (D3); liczniki A–D = 0 są miarą ukończenia FA-1.39.
