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

### Odczyt produkcji (16 IX 2026, supabase-fa — przed zmianami)

```
z_dealem  z_dealem_bez_flagi  z_flaga
19        11                  13
```

`external_offer_sent`: `NOT NULL DEFAULT false` — `NOT external_offer_sent` i `external_offer_sent IS NOT TRUE` dają identyczne wyniki. Backfill używa `NOT external_offer_sent` (zgodnie z `route.ts:50`).

Różnica `z_dealem` między instrukcją (18) a odczytem (19): instrukcja liczyła tylko `internal_deal_total_eur IS NOT NULL`; zakres zadania liczy `OR internal_commission_eur IS NOT NULL` — wyższa liczba jest poprawna względem definicji.

### Zmiana kodu

`src/actions/inquiries.ts` — `saveInternalDeal`: payload budowany jako `Record<string, unknown>`; gdy `params.dealTotalEur != null || params.commissionEur != null`, do payloadu dokładane `external_offer_sent: true`. Gdy oba są null — pole nie wchodzi do UPDATE (raz wysłana oferta zostaje wysłana).

### Backfill (16 IX 2026)

Lista 11 id zaktualizowanych wierszy (SELECT przed UPDATE — jedyna forma odwracalności; po UPDATE warunek przestał je opisywać):

| id | angler_name | total | commission |
|---|---|---|---|
| c6a0a222-d74a-4fb4-89bd-b4950b511a62 | Marc moussa | 700 | 150 |
| b421e267-21d5-4651-ac1d-33241c4f14a4 | Jack Bruff | 0 | 0 |
| 2d7440d8-d872-4dc8-997b-7e99b0f88ce8 | Ross Lamb | 680 | 90 |
| 1dbfe86d-95a5-41f2-8cc6-924eda3a5331 | Alexander Van Alen | 1600 | 280 |
| 3a5ee20d-0ef5-47de-8ada-31e3e4927338 | Sean Engel | 1450 | 290 |
| a45b417d-9897-47a9-8377-9c4b1198f07f | Taylor Ingraham | 1450 | 290 |
| 1d68186d-2bdb-4d4b-93b9-5909390a6d8a | Scott Latimer | 12900 | 2100 |
| 7a59b947-40e3-4cad-95ae-879c929480cf | Kevin Lavers | 1200 | 225 |
| 29a1b8e0-2978-4e80-b574-5a90784eaf5d | Ben Forcier | 1600 | 260 |
| 304ea655-cacf-4335-a150-34bcc306c1b6 | Karl Terauds | 11169.96 | 1873.67 |
| d060360a-2208-419e-a470-b410f5f9df10 | Roz Tatton | NULL | 130 |

SELECT weryfikacyjny po UPDATE:
```
z_dealem  z_dealem_bez_flagi  z_flaga
19        0                   24
```
`z_flaga`: 13 → 24 (+11). `z_dealem_bez_flagi`: 11 → 0.

### Kryterium „curl przed/po" — niespełnione, zastąpione

Oryginalne kryterium: „curl zwraca mniejszą liczbę niż przed" — curl PRZED UPDATE nie został wykonany i jest nie do odtworzenia. Kryterium zastąpione dowodem z SELECT-ów: `z_dealem_bez_flagi` 11 → 0, `z_flaga` 13 → 24. To jest zamiana dowodu, nie spełnienie oryginalnego kryterium.

Cron wywołany przez tj PO backfillu: `{"overdue":17,"mailed":true}`. Uwaga: `GET /api/cron/offer-sla` wysyła mail przy `OWNER_EMAIL` ustawionym i niepustej liście — nie jest odczytem bez skutków ubocznych. Odnotowane w `docs/deferred-tasks.md`.

### Poza zakresem (odnotowane — korekta)

`pnpm test --run` pisze do **produkcyjnej** tabeli `inquiries` przez klucz serwisowy — `.env.local` zawiera `NEXT_PUBLIC_SUPABASE_URL=https://uwxrstbplaoxfghrchcy.supabase.co` (produkcja, nie projekt testowy). Weryfikacja po fakcie przez tj potwierdziła, że `afterAll` w testach usunął wstawione wiersze — bez trwałych szkód. Poprzedni raport podał projekt testowy `xsilxmaiyyjgpxsalvet` bez sprawdzenia — to było założenie, nie odczyt. Docelowa naprawa: FA-0.21.

