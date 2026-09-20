---
id: FA-1.16
title: Domknięcie pętli depozytu — endpoint webhooka w Stripe, sesje `payment_link`, atomowa idempotencja
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium-high
agent: fa-core
branch: fix/deposit-webhook-loop
depends_on: [FA-1.12]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 5
owner: tj
---

# FA-1.16 — Wpłata depozytu wraca do aplikacji

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguła 5 (każda mutacja emituje zdarzenie), reguła 3 (warstwa danych)
- `docs/03-conventions.md` — konwencje kodu i testów
- `src/app/api/webhooks/stripe-deposit/route.ts` — jedyne miejsce w całej aplikacji, które
  zapisuje `inquiries.deposit_paid_at` (linia 102); filtr wejściowy w linii 70
  (`session.metadata?.payment_type !== 'inquiry_deposit'` → cichy `return`)
- `src/actions/inquiries.ts` (~317, ~656) — `sendDepositLink`: `checkout.sessions.create`
  z `metadata.payment_type='inquiry_deposit'` i `inquiry_id` **na sesji**
- `src/actions/messages.ts` (~595–675) — `createPaymentLink` z FA-1.12: `paymentLinks.create`
  z metadanymi **na linku**; sesja powstała z payment linku ma puste `session.metadata`,
  więc filtr z linii 70 ją odrzuca
- `src/lib/env.ts:41,47,51` — `STRIPE_WEBHOOK_SECRET` (wymagany), `STRIPE_CONNECT_WEBHOOK_SECRET`
  i `STRIPE_WEBHOOK_SECRET_DEPOSIT` (oba opcjonalne, z fallbackiem)
- `docs/deferred-tasks.md` — wiersze: FA-1.12 „obsługa sesji `payment_link`", FA-1.12 „wyścig
  przy równoległym podwójnym webhooku" (check-then-write), FA-1.05 audit „`deposit_paid_at`
  pusty dla wszystkich 99 zapytań", FA-1.10 „filtr wierszy w `/admin/finances`"
- `docs/REBUILD_PLAN.md` §9 dopisek 19 IX — `inquiry_events` = 785 wierszy, w tym **1 webhook
  live**; trzeba ustalić, z której trasy to przyszło
- `docs/01-architecture.md` §3–4 — katalog zdarzeń i `transition()`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Stan faktyczny na 20 IX 2026 (dashboard Stripe, tryb live, konto Fjordanglers)
Dwa event destinations i **żaden** nie celuje w `/api/webhooks/stripe-deposit`:

| Endpoint | URL | Stan | Zdarzenia |
|---|---|---|---|
| `brilliant-glow` | `https://fjordanglers.com/api/stripe/webhook` | Active | 15, z kont połączonych |
| `platform-webhook` | `https://fjordanglers.com/api/webhooks/stripe` (trasy nie ma w repo) | Disabled | 2, z konta |

Do tej pory depozyty szły linkiem tworzonym ręcznie poza aplikacją (tj, 20 IX), więc pętla
nigdy nie była uruchomiona — to nie jest regresja.

## Cel
Po zadaniu wpłata depozytu wraca do bazy sama: Stripe dostarcza `checkout.session.completed`
na `/api/webhooks/stripe-deposit`, trasa rozpoznaje sesję niezależnie od tego, czy powstała
z Checkout Session czy z payment linku, zapisuje `deposit_paid_at` atomowo i emituje
`payment.received`. Bez tego `/admin/weekly`, `/admin/finances` i strona potwierdzenia dla
klienta pokazują zera niezależnie od tego, ile wpłat faktycznie przyszło.

## Decyzje do podjęcia przez tj — przed startem
**D1 — jedna ścieżka linku czy dwie?**
- (a) kanoniczny zostaje `sendDepositLink` (Checkout Session); `createPaymentLink` znika
  z panelu — najmniej kodu, jedna ścieżka do utrzymania, ale traci się wygodę linku
  wielokrotnego użytku z wątku;
- (b) obie zostają, webhook uczy się sesji z payment linku (odczyt metadanych z
  `payment_link` albo z `payment_intent`, gdy `session.metadata` puste) — dwie ścieżki,
  jeden dodatkowy odczyt z API Stripe na zdarzenie;
- (c) `createPaymentLink` przepisany na Checkout Session z metadanymi na sesji — jedna
  ścieżka w webhooku, ale zmiana zachowania UI z FA-1.12.

**D2 — czy w tym samym zadaniu naprawiamy idempotencję** (wiersz FA-1.12: check-then-write →
atomowy `UPDATE … WHERE id = $1 AND deposit_paid_at IS NULL RETURNING id`)? Rekomendacja:
tak — bez tego podwójna dostawa daje dwa `payment.received` i dwa przejścia stanu, a pierwsza
realna wpłata jest najgorszym momentem na odkrycie tego.

**D3 — jak testujemy na żywo:** `stripe listen` / `stripe trigger` w trybie testowym, czy
realny przelew 1 EUR na produkcji? Przelew dowodzi całej pętli, ale zostawia wiersz w bazie
produkcyjnej i wymaga zwrotu.

## Zakres
- [ ] **Odczyt bieżącego stanu, do raportu:** `SELECT type, occurred_at, source FROM inquiry_events
      ORDER BY occurred_at DESC LIMIT 20` na produkcji — ustal, z której trasy przyszedł
      „1 webhook live" z dopisku 19 IX; `SELECT count(*) FROM inquiries WHERE deposit_paid_at
      IS NOT NULL`; lista endpointów w Stripe i zmiennych `STRIPE_*` w Vercelu (nazwy, nie wartości).
- [ ] Webhook rozpoznaje sesję z payment linku — wg D1.
- [ ] Idempotencja — wg D2.
- [ ] Endpoint w Stripe na `/api/webhooks/stripe-deposit` i `STRIPE_WEBHOOK_SECRET_DEPOSIT`
      w Vercelu (prod + preview). **STOP przed każdą z tych zmian.**
- [ ] `platform-webhook` (Disabled, celuje w nieistniejącą trasę) — usunąć albo zostawić
      z uzasadnieniem; decyzja tj, nie agenta.
- [ ] Wiersze w `docs/deferred-tasks.md` zamknięte (`~~…~~ — FA-1.16`) albo przepisane.

## Gotowe, gdy
- [ ] `grep -rn "deposit_paid_at" src --include=*.ts | grep -i "update"` → nadal dokładnie jedno
      miejsce zapisu.
- [ ] Test jednostkowy: fixture sesji **z payment linku** (puste `session.metadata`) →
      `deposit_paid_at` ustawione, `payment.received` w `inquiry_events`, status przez
      `transition()`. **Na czerwono:** ten sam fixture na kodzie sprzed poprawki → cichy `return`,
      zero zapisów; zrzut obu przebiegów w raporcie.
- [ ] **Na czerwono (idempotencja, jeśli D2 = tak):** dwie równoległe dostawy tego samego
      `event.id` → dokładnie jeden wiersz `payment.received` i jedno przejście stanu; na kodzie
      sprzed poprawki test pokazuje dwa. Zrzut obu przebiegów.
- [ ] Dostarczenie testowe z dashboardu Stripe na nowy endpoint → 200, widoczne w „Events".
- [ ] Wg D3: pełna pętla udowodniona — od linku wysłanego z panelu do `deposit_paid_at`
      i wiersza w `inquiry_events`, z id sesji w raporcie.
- [ ] `/admin/weekly` i `/admin/finances` pokazują tę wpłatę (albo raport tłumaczy, którym
      filtrem który ekran ją pomija — wiersz FA-1.10).
- [ ] `pnpm typecheck && pnpm test run && pnpm build` zielone.

## Poza zakresem
- Filtr wierszy w `/admin/finances` (`status IN (...)` → `deposit_paid_at IS NOT NULL`) — osobne
  zadanie S z wiersza FA-1.10.
- Backfill historycznych 99 zapytań i bazylina metryk sprzed stage-1 — wiersz FA-1.05 audit,
  historia nieodwracalnie utracona.
- `/api/stripe/webhook` (Stripe Connect) — FA-1.07 zostawia trasę pustą; likwidacja w etapie 7.
- Zwroty, wpłaty częściowe, druga rata, waluty inne niż obsługiwane dziś.
- Zmiany w `supabase/` i jakiekolwiek migracje.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Dodanie lub zmiana endpointu w Stripe, zmiana zmiennych środowiskowych w Vercelu, rotacja
  sekretów — **STOP, akceptacja tj przed każdą pojedynczą zmianą**, z wypisaniem, co dokładnie
  się zmienia.
- Jakikolwiek zapis na produkcji inny niż wywołany testowym przelewem zatwierdzonym w D3;
  zero SQL innego niż SELECT.
- Usunięcie endpointu `platform-webhook` — decyzja tj.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, z notatek ani z pliku typów.

## Weryfikacja
```
pnpm typecheck && pnpm test run && pnpm build
pnpm vitest run src/app/api/webhooks/__tests__/stripe-deposit.test.ts
stripe trigger checkout.session.completed   # tryb testowy, wg D3
grep -rn "deposit_paid_at" src --include=*.ts | grep -i update
```

## Notatki z realizacji
