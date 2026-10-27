---
id: FA-1.77
title: Payment link — nazwa i opis produktu Stripe widoczne i edytowalne przed utworzeniem; zmiana na istniejącym linku bez zmiany adresu
stage: 1
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: feat/fa-1.77-payment-link-preview
depends_on: [FA-1.76]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.77 — Payment link: podgląd i edycja nazwy oraz opisu

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `src/actions/messages.ts` — `createPaymentLink` (produkt → cena → link; ponowne użycie linku przy tej samej kwocie; zdarzenie `payment.link_sent` z `amount_cents`, `currency`, `link_id`)
- `src/lib/ai/draft-deposit-link.ts` — `buildStripeProductName`, `buildStripeProductDescription`
- `src/app/admin/inquiries/[id]/NextStepCard.tsx` — etap `deposit`
- `src/lib/events/types.ts`
- dokumentacja Stripe przez context7: `products.update`, `paymentLinks.listLineItems`, limity długości `name` / `description`, czy strona płatności istniejącego linku pokazuje zaktualizowaną nazwę produktu

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
„Create deposit link” tworzy dziś link od razu, z nazwą składaną automatycznie („<tytuł> — <daty> · <N> people”) i stałym opisem, bez podglądu. Po zadaniu admin widzi nazwę i opis przed utworzeniem linku — wypełnione dzisiejszym wzorem — i może je zaakceptować albo poprawić. Przy istniejącym linku nazwę i opis da się zmienić później: link (adres) zostaje ten sam, zmienia się produkt w Stripe.

## Decyzje tj (2026-10-27)
- D3 (a) **Zmiana na istniejącym linku**: przy tej samej kwocie zmiana nazwy/opisu aktualizuje produkt w Stripe, adres linku bez zmian. Warunek: Stripe faktycznie pokazuje nową nazwę na stronie istniejącego linku — jeśli nie (dokumentacja albo próba na `sk_test`), STOP i powrót do tj z opcją (b) „nowy link, stary wyłączony”.
- Zmiana kwoty działa jak dziś (stary link wyłączony, nowy z nazwą i opisem z formularza).

## Zakres
- [ ] Odczyt stanu: `createPaymentLink`, oba buildery, etap `deposit` w karcie; ustalić w dokumentacji Stripe (context7) limity pól i zachowanie istniejącego linku po `products.update` — wkleić fragmenty / cytaty.
- [ ] Etap `deposit` przed utworzeniem linku: pola „Product name” i „Description” wypełnione wynikiem builderów; przycisk „Create deposit link — <kwota>” wysyła je do akcji.
- [ ] `createPaymentLink(inquiryId, { name, description })`: walidacja po stronie serwera (niepuste, limity Stripe); produkt tworzony z podanych wartości; `product_id`, `name`, `description` dopisane do payload `payment.link_sent`.
- [ ] Istniejący aktywny link: karta pokazuje bieżącą nazwę i opis z „Edit” → zapis aktualizuje produkt w Stripe (id produktu z payload, a dla linków sprzed zadania z `paymentLinks.listLineItems`); adres linku bez zmian; nowe zdarzenie (np. `payment.link_details_updated`) z wartościami przed i po.
- [ ] Szkic wiadomości AI przy tworzeniu linku działa jak dziś.
- [ ] Testy: akcja z podaną nazwą/opisem (mock Stripe — sprawdzenie argumentów `products.create`), walidacja, aktualizacja istniejącego linku (`products.update`, brak `paymentLinks.create`), karta (pola wypełnione domyślnie, edycja).

## Gotowe, gdy
- [ ] Przed utworzeniem linku karta pokazuje nazwę i opis z dzisiejszego wzoru, a link tworzy się z wartościami poprawionymi przez admina — test karty + test akcji (argumenty `products.create`).
- [ ] Pusta nazwa i nazwa ponad limit Stripe są odrzucone po stronie serwera bez wywołania Stripe — **red proof**: wklejone wyniki testów na celowo złych wejściach.
- [ ] Zmiana nazwy/opisu przy aktywnym linku i tej samej kwocie woła `products.update`, nie tworzy nowego linku, adres w bazie bez zmian, zdarzenie z wartościami przed i po — test.
- [ ] Dowód, że strona płatności istniejącego linku pokazuje nową nazwę: cytat z dokumentacji Stripe albo zrzut checkoutu z `sk_test` po zmianie.
- [ ] Zrzuty (desktop): pola przed utworzeniem linku, edycja przy aktywnym linku.
- [ ] CI zielone na head PR (`check`, `knip`, `db`, `secrets`) — lista wklejona.

## Poza zakresem
- Treść szkicu wiadomości z linkiem (prompt AI) i mail `deposit-link-angler`.
- Zmiana domyślnego wzoru nazwy/opisu.
- Edycja oferty i etapy — FA-1.74, FA-1.76.
- Zapamiętywanie nazwy/opisu na zapytaniu w nowej kolumnie (bez migracji — źródłem jest payload zdarzenia i Stripe).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Wywołania Stripe wyłącznie na mocku albo `sk_test`; żadnego `sk_live`, żadnej zmiany webhooków ani ustawień konta Stripe.
- Stripe nie pokazuje zaktualizowanej nazwy na istniejącym linku → STOP, decyzja tj (D3).

## Weryfikacja
```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Notatki z realizacji
- **2026-10-27, tj:** serwer MCP stripe nadal nie działa (`CONNECTION_CLOSED`, brak `STRIPE_RESTRICTED_KEY` w środowisku Claude Code) — dla FA-1.77 opcjonalny; praca na mocku Stripe, bez zrzutu checkoutu na `sk_test`; dowód zachowania istniejącego linku z dokumentacji Stripe (context7). Odnotowane w „Not done” raportu.
- **2026-10-27, tj — decyzja 1 (limit opisu):** Stripe nie dokumentuje limitu `description` produktu (udokumentowany tylko `name` = 250). Opcja A: opis **wymagany** (niepusty po trim) i **maks. 250 znaków** — ta sama reguła co nazwa. Walidacja po stronie serwera przed wywołaniem Stripe.
- **2026-10-27, tj — decyzja 2 (D3, istniejący link):** opcja A — dokumentacja Stripe uznana za wystarczającą („The Payment Link uses the price to compute the order total. It also retrieves the product associated with the price. The product's name and image are used to render the payment page.” — https://docs.stripe.com/products-prices/how-products-and-prices-work); budujemy D3(a) (`products.update`, adres linku bez zmian), bez skryptu dowodowego na `sk_test`. W raporcie kryterium oznaczone „docs-based, manual check by tj pending” — tj sprawdzi stronę płatności po deployu.
