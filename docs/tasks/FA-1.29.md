---
id: FA-1.29
title: Link depozytu działa — kwota i waluta z FA-1.28, „czeka na płatność” dopiero po linku, jeden aktywny link, link widoczny na karcie
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/deposit-link
depends_on: [FA-1.28]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-1.29 — Link depozytu działa

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły 2, 3, 5, 6, 7
- `docs/03-conventions.md` — konwencje kodu i testów
- `docs/01-architecture.md` §3–4 + `docs/REBUILD_PLAN.md` załącznik C — zdarzenia i przejścia statusów
- `src/lib/inquiries/state.ts` — `awaiting_payment` osiągalne tylko z `offer_presented`, etykieta „Payment link sent”
- `src/actions/messages.ts` — `markClientAccepted` (~437, dziś przestawia na `awaiting_payment`), `createPaymentLink` (~616: tworzy cenę i link przy każdym wywołaniu, wstawia szkic wiadomości, emituje `payment.link_sent`, przestawia status)
- `src/app/admin/inquiries/[id]/ThreadActionsPanel.tsx` — sekcje 3 (Client Accepted) i 4 (Create Deposit Link)
- `src/app/api/webhooks/stripe-deposit/route.ts` — ścieżka payment linku (metadane z linku, D1 FA-1.16), atomowa idempotencja (D2 FA-1.16)
- `docs/tasks/FA-1.16.md` — jak zrobiono pętlę depozytu i test w trybie testowym (D3)
- `docs/tasks/FA-1.28.md` — kolumny kwoty, waluty, kursu i aktywnego linku
- `docs/deferred-tasks.md` — wiersz FA-1.18 „STAGE-1 RELEASE BLOCKER” (m.in. dwa linki po dwóch kliknięciach w FA-1.18)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś „Client Accepted” od razu przestawia zapytanie na „czeka na płatność”, choć żaden link nie istnieje, a każde kliknięcie „Create Deposit Link” tworzy w Stripe nowy link — w FA-1.18 dwa kliknięcia dały dwa linki. Po zadaniu link powstaje w kwocie i walucie ustawionej w FA-1.28, status „czeka na płatność” pojawia się dopiero razem z linkiem, na zapytanie jest najwyżej jeden aktywny link, a admin widzi go na karcie i może skopiować. Wpłata przez ten link wraca do aplikacji jako „paid” z właściwą kwotą i walutą.

## Zakres
- [ ] Odczyt bieżącego stanu (do raportu): na produkcji liczba zapytań w `awaiting_payment` bez zdarzenia `payment.link_sent` (utknęły przez obecny błąd) — samo `count(*)`; lokalnie zachowanie `markClientAccepted` i `createPaymentLink` na seedzie.
- [ ] Przycisk „Create Deposit Link" pokazuje się na podstawie pól kwoty z FA-1.28 (decyzja tj 2026-09-24).
- [ ] `markClientAccepted` nie zmienia statusu (zostaje `offer_presented`); jedyną drogą do `awaiting_payment` jest utworzenie linku.
- [ ] `createPaymentLink` bierze kwotę, walutę i kurs z danych zapytania (FA-1.28), nie od klienta; bez ustawionej kwoty — błąd bez obiektu w Stripe.
- [ ] Jeden aktywny link na zapytanie: ponowne wywołanie przy tej samej kwocie i walucie zwraca istniejący link (bez nowego obiektu w Stripe); przy zmienionej kwocie lub walucie poprzedni link zostaje wyłączony w Stripe, a powstaje nowy. Id i URL aktywnego linku zapisane w kolumnach z FA-1.28.
- [ ] Kwota w jednostkach Stripe poprawna dla każdej waluty w użyciu (EUR, USD, ISK, NZD) — sprawdź w dokumentacji Stripe przez context7, jak Stripe traktuje ISK, i pokryj to testem.
- [ ] Karta: przycisk ze stanem „trwa” i blokadą podwójnego kliknięcia; po utworzeniu i po przeładowaniu strony link widoczny z przyciskiem „kopiuj”.
- [ ] Webhook: wpłata przez link zapisuje `deposit_paid_at` i emituje `payment.received` z kwotą i walutą z FA-1.28 (bez zmiany mechanizmu idempotencji z FA-1.16).
- [ ] Szkic wiadomości wstawiany dziś przez `createPaymentLink` zostaje bez zmian treści (treść → FA-1.30).

## Gotowe, gdy
- [ ] „Client Accepted” bez linku: status zostaje `offer_presented` — test + lokalny `SELECT status` — **wklej**.
- [ ] Po utworzeniu linku: status `awaiting_payment`, zdarzenie `payment.link_sent`, id i URL w kolumnach — **wklej `SELECT`**; link widoczny na karcie po przeładowaniu — **zrzut Playwright**.
- [ ] Red proof — podwójne wywołanie: dwa wywołania z tą samą kwotą → jeden obiekt w Stripe (test sprawdza, że `paymentLinks.create` wywołano raz) i jeden aktywny link w bazie.
- [ ] Zmiana kwoty: poprzedni link ma w Stripe (tryb testowy) `active: false`, nowy jest aktywny — **wklej odczyt z API Stripe**.
- [ ] Pełna pętla lokalnie w trybie testowym (`stripe listen` → webhook lokalny): link w EUR opłacony kartą 4242 → `deposit_paid_at` ustawione, status `paid`, kwota i waluta w zdarzeniu `payment.received` zgodne z linkiem — **wklej `SELECT`**. Dla ISK: kwota na stronie płatności Stripe równa kwocie na karcie — **zrzut**.
- [ ] Odczyt z produkcji: liczba zapytań utkniętych w `awaiting_payment` bez linku — **wklej wynik** (bez naprawiania).
- [ ] `pnpm typecheck && pnpm lint && pnpm test run` zielone.

## Poza zakresem
- Nazwa i opis produktu w Stripe, treść wiadomości z linkiem → FA-1.30
- Stany ładowania pozostałych akcji i nawigacji → FA-1.31; wygląd karty → FA-1.32
- Naprawa zapytań utkniętych na produkcji (tylko liczba w raporcie; sposób naprawy to decyzja tj)
- Endpoint webhooka dla preview (D3 z FA-1.16: pętla testowana lokalnie)
- Nowa migracja — kolumny są z FA-1.28; jeśli czegoś brakuje, STOP
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Stripe w trybie live — zakaz tworzenia i wyłączania linków; wszystko w trybie testowym.
- Zmiana endpointów webhooków w Stripe (także testowych) — zakaz.
- Produkcja: wyłącznie SELECT. Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.
- Potrzeba nowej migracji — pokaż powód i czekaj.

## Weryfikacja
```
pnpm test run src/actions src/app/api/webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe-deposit
psql "$LOCAL_DB_URL" -c "select status, deposit_paid_at from inquiries where id = '<id>'"
pnpm typecheck && pnpm lint && pnpm test run
```

## Notatki z realizacji
- 2026-09-24 tj (wf-plan): zadanie z wiersza FA-1.18 w `docs/deferred-tasks.md`; wydanie przez `stage-1`.
