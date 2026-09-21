---
id: FA-1.16
title: Domknięcie pętli depozytu — endpoint webhooka w Stripe, sesje `payment_link`, atomowa idempotencja
stage: 1
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: medium-high
agent: fa-core
branch: fix/fa-1.16-stripe-deposit-payment-link
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
  z metadanymi **na linku**; przy API 2026-02-25.clover Stripe **kopiuje** metadane linku
  na sesję, więc `session.metadata` jest wypełnione; filtr z linii 70 działa przez
  `session.metadata`, a nie przez `paymentLinks.retrieve`; gałąź D1 (retrieve) pozostaje
  jako zabezpieczenie na wypadek innej wersji API lub zmiany zachowania Stripe
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

**Korekta po D3 (21 IX 2026):** przyczyną zer nie były metadane (te działały przez `session.metadata`
przy API 2026-02-25.clover), lecz brak endpointu Stripe celującego w `/api/webhooks/stripe-deposit`.
Kod D1 (gałąź `paymentLinks.retrieve`) jest zabezpieczeniem, a nie naprawą obserwowanego błędu.

## Decyzje tj (21 IX 2026)
**D1 = (b):** obie ścieżki zostają. Webhook: gdy `session.metadata` nie ma `payment_type`/
`inquiry_id`, a `session.payment_link` jest ustawione → `stripe.paymentLinks.retrieve(id)` →
użyj metadanych linku. Sesja z Checkout Session (`sendDepositLink`) działa jak dotąd — bez
dodatkowego odczytu. `createPaymentLink` i panel bez zmian. `sendDepositLink` nie ruszamy.
`stripe.paymentLinks.retrieve` rzuca → `RetriableError` → 500 (Stripe ponowi; bezpieczne
dzięki D2). Decyzja odnośnie błędu retrieve: runda 2 tj (21 IX).

**D2 = tak:** atomowy zapis `UPDATE inquiries SET deposit_paid_at = now(),
deposit_stripe_session_id = $2 WHERE id = $1 AND deposit_paid_at IS NULL RETURNING id`
(w supabase-js: `.update().eq().is('deposit_paid_at', null).select('id, …')`); `payment.received`,
`transition()` i maile tylko gdy zwrócono wiersz. Bez migracji.

**D3 = tryb testowy na preview:** pełna pętla na deployu preview z kluczami `sk_test`
i endpointem trybu testowego w Stripe, zapłata kartą 4242. Zero zapisów na produkcji.
`stripe trigger checkout.session.completed` NIE jest dowodem pętli — możesz go użyć
tylko do sprawdzenia podpisu/200.

## Zakres
- [ ] Odczyt bieżącego stanu (do raportu): `SELECT type, occurred_at, source FROM inquiry_events ORDER BY occurred_at DESC LIMIT 20` na produkcji; `SELECT count(*) FROM inquiries WHERE deposit_paid_at IS NOT NULL`; lista endpointów Stripe i zmiennych `STRIPE_*` w Vercelu.
- [ ] Webhook rozpoznaje sesję z payment linku (D1): gdy `session.metadata?.payment_type` jest null/undefined i `session.payment_link` ustawione → `stripe.paymentLinks.retrieve(payment_link_id)` → użyj metadanych linku.
- [ ] Atomowa idempotencja (D2): `.update({deposit_paid_at, deposit_stripe_session_id}).eq('id', inquiryId).is('deposit_paid_at', null).select('id, …')` — dalej tylko gdy zwrócono wiersz.
- [ ] Test jednostkowy: sesja z payment linku z właściwymi metadanymi → deposit zapisany.
- [ ] Test jednostkowy: sesja z payment linku, metadane linku bez `payment_type='inquiry_deposit'` → zero zapisów.
- [ ] Test: dwie równoległe dostawy (Promise.all) ze wspólnym stanem bazy → dokładnie jeden `payment.received`, jeden `transition()`.
- [ ] Wiersze `docs/deferred-tasks.md` wg kryterium.
- [ ] Endpoint Stripe dla preview (STOP przed utworzeniem).
- [ ] Endpoint Stripe live na `/api/webhooks/stripe-deposit` (STOP — po akceptacji tj, osobno).

## Gotowe, gdy
- [ ] `grep -rnE "deposit_paid_at\s*:" src --include=*.ts --include=*.tsx | grep -v -e __tests__ -e '\.test\.' -e database.types -e 'string | null'` → dokładnie 1 linia, w `src/app/api/webhooks/stripe-deposit/route.ts`.
- [ ] Test jednostkowy: fixture sesji **z payment linku** (puste `session.metadata`) →
      `deposit_paid_at` ustawione, `payment.received` w `inquiry_events`, status przez
      `transition()`. **Na czerwono:** ten sam fixture na kodzie sprzed poprawki → cichy `return`,
      zero zapisów; zrzut obu przebiegów w raporcie.
      _(Uwaga po D3: gałąź D1 `paymentLinks.retrieve` jest zabezpieczeniem — w D3 Stripe przy
      API 2026-02-25.clover kopiował metadane na sesję, więc pętla przeszła przez `session.metadata`.
      Red proof D1 pozostaje ważny: testuje gałąź na inne wersje API / zmiany zachowania Stripe.)_
- [ ] Test jednostkowy: fixture sesji z payment linku (puste `session.metadata`, `session.payment_link` ustawione, zamockowany odczyt linku z metadanymi) → `deposit_paid_at` ustawione, `payment.received` w `inquiry_events`, status przez `transition()`. Na czerwono: ten sam fixture na kodzie sprzed poprawki → cichy return, zero zapisów. Zrzut obu przebiegów.
- [ ] Test: sesja z payment linku, metadane nie mają `payment_type='inquiry_deposit'` → zero zapisów.
- [ ] Istniejące testy sesji Checkout (metadane na sesji) zielone bez zmian w asercjach.
- [ ] Na czerwono (idempotencja): dwie dostawy puszczone RÓWNOLEGLE (Promise.all), mock bazy z **wspólnym stanem** `deposit_paid_at` symulującym Postgres — `.update().eq().is('deposit_paid_at', null)` zwraca wiersz tylko temu, kto zastał null → dokładnie jeden `payment.received` i jedno `transition()`. Na kodzie sprzed poprawki ten sam test pokazuje dwa. Zrzut obu przebiegów.
- [ ] `stripe.paymentLinks.retrieve` rzuca → 500. Druga dostawa po poprawce (retrieve działa) → 200, 1× `payment.received`.
- [ ] FA-1.09 testy tytułu wyprawy (resolved name, fallback) zielone.
- [ ] Pełna pętla w trybie testowym (D3): link z panelu na preview → zapłata 4242 → endpoint testowy 200 → `deposit_paid_at` i wiersz `payment.received` w bazie preview. W raporcie: id sesji, id linku, SELECT z `inquiry_events`.
- [ ] Endpoint live na `/api/webhooks/stripe-deposit` — po akceptacji tj (STOP); „Send test event" → 200, widoczne w Events.
- [ ] `/admin/weekly` na preview pokazuje wpłatę z pętli testowej. `/admin/finances`: raport mówi, czy pokazuje; jeśli nie — którym filtrem pomija (FA-1.10). Filtru nie poprawiasz.
- [ ] Wiersze w `docs/deferred-tasks.md`: FA-1.12 „wyścig" zamknięty; FA-1.07 „brak endpointu na stripe-deposit" otwarty (zamknie go live endpoint); FA-1.05 audit uzupełniony o notatkę „1 webhook live"; FA-1.07 `platform-webhook` z opcjami tj.
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm build` zielone.

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
pnpm typecheck && pnpm lint && pnpm test run
grep -rnE "deposit_paid_at\s*:" src --include=*.ts --include=*.tsx | grep -v -e __tests__ -e '\.test\.' -e database.types -e 'string | null'
pnpm vitest run src/app/api/webhooks/__tests__/stripe-deposit.test.ts
```

## Notatki z realizacji

### Decyzje (21 IX 2026)
- D1 = (b): obie ścieżki zostają; gdy `session.metadata` nie ma `payment_type`, a `session.payment_link` ustawione → `stripe.paymentLinks.retrieve(id)` → metadane linku; retrieve błąd → `RetriableError` → 500
- D2 = tak: atomowy `UPDATE … WHERE deposit_paid_at IS NULL RETURNING id`; brak zwróconego wiersza = już przetworzone lub nie nasze
- D3 = lokalnie (nie preview): lokalny stack Supabase + `pnpm dev` + `stripe listen`; preview wskazuje na bazę prod (uwxrstbplaoxfghrchcy) — wiersz w deferred-tasks.md; `stripe trigger` tylko do testu podpisu
- D4 = runda 2 (tj): retrieve rzuca → 500 zamiast 200; Stripe ponawia; bezpieczne dzięki D2

### experience_page_id i tytuł wyprawy
Po rebase na origin/stage-1: `experience_page_id` przywrócony do SELECT w atomowym UPDATE; import `getInquiryExperience`/`tripTitleOf` przywrócony; testy FA-1.09 zielone.

### 1 webhook live (FA-1.05 audit dopisek)
Według REBUILD_PLAN.md §9 dopisek 19 IX: `inquiry_events` = 785 wierszy, w tym **1 z `source='webhook'`**. Odczyt produkcji niewykonany (MCP `execute_sql` → permission error). Do wykonania przez tj: `SELECT type, source, channel, occurred_at FROM inquiry_events WHERE source = 'webhook' ORDER BY occurred_at DESC LIMIT 5`.

### Pętla D3 (21 IX 2026, 12:47–12:50 CEST, lokalny stack)
- plink_1UI4knCkrtMjTevhGFMUtX9T → cs_test_a1X0eq0pCGLNVzoFEvX4d4snuAY56Xk3DYWOjSxF389fF5XIdB49oxtgDr → evt_1UI4m2CkrtMjTevhLhA3JI7q; stripe listen: `<-- [200] POST …/api/webhooks/stripe-deposit`.
- Lokalna baza: inquiries a2a2…202 → status=paid, deposit_paid_at=2026-09-21 10:48:41.678+00, deposit_stripe_session_id=cs_test_a1X0eq0p…
- inquiry_events: payment.link_sent (app, 10:47:20) → status.changed (app, 10:47:21) → payment.received (webhook/stripe, 10:48:41.733, 100 centów EUR) → status.changed (webhook/stripe, 10:48:41.808)
- Resend evt_1UI4m2… → nadal payment.received=1, status.changed(webhook)=1. [linii z listen/dev potwierdzające dotarcie resend — do dopisania przez tj]
- HTTP 401 Resend przy mailu (nieważny klucz lokalny) — przechwycony po zapisie; poza zakresem (wiersz w deferred-tasks.md).

### Obserwacja D1 po D3 (API 2026-02-25.clover)
Stripe kopiuje metadane payment linku na sesję (`session.metadata = {inquiry_id, payment_type: 'inquiry_deposit'}` przy `payment_link = plink_…` w evt_1UI4m2…). Pętla przeszła przez `session.metadata`; `paymentLinks.retrieve` nie został wywołany. Gałąź D1 (retrieve) pozostaje jako zabezpieczenie na inne wersje API / zmiany zachowania Stripe. Komentarz dopisany do route.ts.
