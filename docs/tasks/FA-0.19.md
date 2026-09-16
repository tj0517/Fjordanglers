---
id: FA-0.19
title: Hub prowizji ustawia `external_offer_sent` — licznik SLA przestaje liczyć oferty wysłane poza systemem
stage: 0
status: review
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/internal-deal-marks-offer-sent
depends_on: [FA-0.16]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 2
owner: tj
---

# FA-0.19 — zapis dealu oznacza, że oferta wyszła

**Skąd to zadanie (przegląd 11 IX 2026).** Odczyt produkcji: Islandia ma **36 zapytań, 6 wygranych
i 1 zarejestrowaną ofertę**. Oferty idą do klientów poza systemem (WhatsApp, mail), a w aplikacji
zostaje po nich tylko wpis w hubie prowizji — `saveInternalDeal` zapisuje `internal_deal_total_eur`,
`internal_commission_eur`, `internal_notes`, `deal_currency` i **nic więcej**.

Tymczasem licznik SLA z FA-0.16 (`SlaBadge` + `GET /api/cron/offer-sla`) uznaje zapytanie za
zaległe, dopóki nie ma `offer_sent_at` ani `external_offer_sent`. Flaga `external_offer_sent`
istnieje i jest respektowana, ale ustawia ją **osobny przełącznik** w karcie zapytania
(`src/actions/inquiries.ts:1110`), którego nikt nie klika, bo cena i prowizja są już wpisane
gdzie indziej.

Skutek: poranny digest i czerwone znaczniki w adminie wymieniają sprawy, które ofertę dostały.
Alarm wdrożony 10 IX ma fałszywe pozytywy od pierwszego dnia — dziś 11 pozycji, z których część
jest domknięta albo w toku.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`; `docs/03-conventions.md`
- `src/actions/inquiries.ts` — `saveInternalDeal` (hub prowizji, `requireAdmin()`) oraz
  `setExternalOfferSent`/miejsce z `update({ external_offer_sent: value })` (~l. 1110)
- `src/app/admin/inquiries/[id]/page.tsx:565` — gdzie przełącznik jest renderowany
- `src/app/api/cron/offer-sla/route.ts:44–56` — filtr zaległych; `src/app/admin/inquiries/InquiriesClient.tsx`
  — `noOfferSinceHours()` i `SlaBadge`
- `docs/tasks/FA-0.16.md` — definicja SLA i co znaczy „bez oferty"
- `docs/tasks/FA-1.03.md` — `inquiry_events` przyjdzie później; **nie** buduj tu logu zdarzeń

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Wpisanie ceny wyprawy albo prowizji w hubie oznacza zapytanie jako takie, któremu ofertę
wysłano — bez dodatkowego kliknięcia i bez zmiany nawyków. Licznik „bez oferty od" pokazuje
wyłącznie sprawy, w których faktycznie nic do klienta nie poszło.

## Zakres
- [ ] **Odczyt bieżącego stanu** (`supabase-fa`, tylko SELECT, wklej do raportu):
      ```sql
      select
        count(*) filter (where internal_commission_eur is not null or internal_deal_total_eur is not null) as z_dealem,
        count(*) filter (where (internal_commission_eur is not null or internal_deal_total_eur is not null)
                          and not external_offer_sent and offer_sent_at is null)                            as z_dealem_bez_flagi,
        count(*) filter (where external_offer_sent)                                                          as z_flaga
      from inquiries;
      ```
      Drugi licznik to dokładnie tyle wierszy, ile naprawi backfill.
- [ ] `saveInternalDeal` — jeśli `dealTotalEur` albo `commissionEur` jest niezerowe, ustaw w tym
      samym `update` `external_offer_sent: true`. Nie nadpisuj na `false`, gdy admin wyczyści pola:
      raz wysłana oferta zostaje wysłana. `offer_sent_at` **nie** jest ustawiane — hub nie zbiera daty,
      a zmyślona data zepsułaby przyszłą metrykę czasu do oferty (patrz „Poza zakresem").
- [ ] Przełącznik `external_offer_sent` w karcie zapytania zostaje — jest potrzebny dla ofert
      wysłanych bez wpisanej jeszcze ceny.
- [ ] **Backfill jednorazowy**: `UPDATE inquiries SET external_offer_sent = true WHERE
      (internal_commission_eur IS NOT NULL OR internal_deal_total_eur IS NOT NULL)
      AND NOT external_offer_sent AND offer_sent_at IS NULL`. **STOP** przed wykonaniem.
- [ ] Jedno zdanie w `docs/tasks/FA-0.16.md` (Notatki): co znaczy „bez oferty" po tej zmianie.

## Gotowe, gdy
- [ ] **Czerwony dowód 1**: lokalnie zapytanie ze statusem `pending`, starsze niż 48 h, bez flagi
      → widoczne w `GET /api/cron/offer-sla` i ma `SlaBadge`. Po wywołaniu `saveInternalDeal`
      z prowizją → `SELECT external_offer_sent` = `true`, a zapytanie **znika** z wyniku crona.
      Oba SELECT-y i oba wyniki crona wklejone.
- [ ] **Czerwony dowód 2**: `saveInternalDeal` z `commissionEur = null` i `dealTotalEur = null`
      na zapytaniu bez flagi → `external_offer_sent` pozostaje `false` (pusty zapis nie oznacza oferty).
- [ ] **Czerwony dowód 3**: `saveInternalDeal` z prowizją na zapytaniu, które **ma już**
      `external_offer_sent = true` → wartość się nie zmienia i nic innego nie zostaje nadpisane.
- [ ] Po backfillu (po „go" tj): ten sam SELECT co w Zakresie — `z_dealem_bez_flagi` = 0;
      `curl -H "Authorization: Bearer $CRON_SECRET" https://www.fjordanglers.com/api/cron/offer-sla`
      zwraca mniejszą liczbę niż przed (wklej przed i po).
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` bez nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- `offer_sent_at` i metryka „czas do oferty" — wymaga daty wysyłki, której hub nie zbiera; FA-1.03.
- Rejestrowanie treści oferty w systemie, generowanie ofert, integracja z WhatsApp — etap 7.
- Zmiana definicji SLA (48 h) i progów kolorów — FA-0.16, zamknięte.
- `lost_reason_code` i cokolwiek w `StatusChanger` — FA-0.16.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- `UPDATE` backfillowy na produkcji — **STOP**: SELECT przed, dokładny SQL, zgoda tj, wykonanie
  po „go". Zapis przez `supabase-fa` to ta sama bramka co `db push`.
- Jeśli odczyt pokaże wiersze z `offer_sent_at` **i** brakiem `external_offer_sent` albo odwrotnie
  w liczbie, która nie pasuje do opisu wyżej — **STOP**, pokaż i zapytaj, zanim cokolwiek zmienisz.
- Nie dotykaj `saveOffer`/`saveRichOffer` (oferty w systemie) — inna ścieżka, inne pola.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci ani z `database.types.ts`.

## Weryfikacja
```
grep -n "external_offer_sent" src/actions/inquiries.ts
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/offer-sla
```

## Notatki z realizacji
