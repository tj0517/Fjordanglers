---
id: FA-0.16
title: SLA 48 h — obietnica terminu w auto-mailu, licznik i alarm w adminie, `lost_reason` jako lista
stage: 0
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/offer-sla-48h
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 6
owner: tj
---

# FA-0.16 — SLA 48 h i `lost_reason` jako lista

**Skąd to zadanie (audyt lejka 5 IX 2026).** 84 zapytania → 28 z ofertą (33%) → 14 wygranych.
49 z 56 przegranych przepadło **zanim wyszła jakakolwiek oferta** (19 „klient zamilkł",
11 brak/wolny przewodnik, 10 zmiana planów, 6 cena). Mediana od zapytania do przypisania
przewodnika: **9 dni** (n=30). Po wysłaniu oferty wygrywamy 2 z 3 rozstrzygniętych. Cena jako
powód przegranej po ofercie: 1 raz. Przeciek jest po formularzu, nie przed nim.

Dodatkowo `lost_reason` to wolny tekst („why? -> info on Tymon's whatsup"), więc kategorie
powyżej to ręczna klasyfikacja 56 wpisów — nie da się jej powtórzyć w SQL.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguła 1 (migracje), 3 (warstwa danych); `docs/03-conventions.md`; `docs/02-data-model.md`
- `src/app/api/inquiries/route.ts` — po insercie wysyła `InquiryRequestAnglerEmail` (`src/emails/inquiry-request-angler.tsx`)
- `src/app/admin/inquiries/InquiriesClient.tsx:120–150` — istniejące helpery „Xd ago", `last_contact_at ?? created_at`, flaga <24 h
- `src/app/admin/inquiries/[id]/StatusChanger.tsx` i `page.tsx:496` — gdzie `lost_reason` jest ustawiany i wyświetlany
- `src/lib/supabase/database.types.ts` — `inquiries.assigned_at`, `guide_offer_eta`, `offer_sent_at`, `external_offer_sent`, `next_action`, `last_contact_at`
- `src/app/api/cron/sync-google-ads/route.ts` + `vercel.json` — wzorzec crona (uwaga: FA-0.03 — GET)
- `docs/tasks/FA-1.03.md` — `inquiry_events` przyjdzie później; **nie** buduj tu własnego logu zdarzeń

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Klient po wysłaniu formularza dostaje w auto-mailu **datę**, do której dostanie konkretną
odpowiedź (48 h, dni robocze). Admin widzi na liście, ile godzin minęło od zapytania bez
oferty, czerwono powyżej 48 h. Raz dziennie przychodzi mail z listą zapytań po terminie.
Powód przegranej wybiera się z listy, więc lejek da się policzyć jednym SELECT-em.

## Zakres
- [ ] **Odczyt bieżącego stanu** (dane, produkcja, SELECT — wykonuje tj):
      ```sql
      select lost_reason, count(*) from inquiries where status='lost' group by 1 order by 2 desc;
      select percentile_cont(0.5) within group (order by extract(epoch from (assigned_at - created_at))/86400) as median_days_to_assign
      from inquiries where assigned_at is not null;
      ```
      Pierwsze zapytanie decyduje, czy lista wartości niżej pokrywa dane; drugie to liczba bazowa do raportu.
- [ ] Migracja: `inquiries.lost_reason_code text check (lost_reason_code in ('client_silent','no_guide','guide_slow','price','changed_plans','went_elsewhere','other'))`
      obok istniejącego `lost_reason` (wolny tekst zostaje jako komentarz). **Bez backfillu** w tym zadaniu —
      klasyfikacja historyczna to osobna decyzja (plik `fa_inquiries_sklasyfikowane.csv` z 5 IX jako punkt wyjścia).
- [ ] `StatusChanger`: przy `lost` wymagany `lost_reason_code` z listy + opcjonalny komentarz; zapis obu.
- [ ] Auto-mail do klienta: jedno zdanie z datą „We will come back to you with availability and a price by **{date}**"
      — `created_at + 2 dni robocze` (pon–pt, bez świąt; strefa Europe/Warsaw). Tekst — patrz STOP.
- [ ] Lista w adminie: kolumna „bez oferty od" = godziny od `created_at` dla wierszy bez `offer_sent_at`
      i `external_offer_sent=false` i statusu spoza {`lost`,`cancelled`,`deposit_paid`,`completed`};
      czerwono > 48 h, pomarańczowo > 24 h. Sortowanie po tej kolumnie. Bez nowych tabel.
- [ ] `GET /api/cron/offer-sla` (`CRON_SECRET`, wzorzec z FA-0.03): raz dziennie 07:00 Europe/Warsaw mail do `OWNER_EMAIL`
      z listą zapytań > 48 h bez oferty (nazwisko, kraj, godziny, link do admina). Pusta lista → brak maila.
- [ ] `vercel.json`: wpis crona. Regeneracja typów.

## Gotowe, gdy
- [ ] **Czerwony dowód**: `UPDATE inquiries SET lost_reason_code='vibes'` → błąd CHECK, wklejony.
- [ ] `StatusChanger` nie pozwala zapisać `lost` bez kodu — zrzut walidacji w raporcie; zapis z kodem → SELECT pokazuje `lost_reason_code`.
- [ ] Test jednostkowy funkcji „+2 dni robocze": piątek 15:00 → wtorek; sobota → środa; środa → piątek.
- [ ] Lokalnie: submit widgetu → auto-mail (podgląd z Resend test / render komponentu) zawiera datę zgodną z testem wyżej — zrzut w raporcie.
- [ ] Lista w adminie: wiersz starszy niż 48 h bez oferty ma czerwony znacznik; wiersz z `offer_sent_at` nie ma kolumny — zrzut ekranu.
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/offer-sla` → `200` i JSON `{overdue: N}`; bez nagłówka → `401` (czerwony dowód).
- [ ] `supabase db diff --local` → `No schema changes found`; typy zregenerowane.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Automatyczne przypisywanie przewodnika, przypomnienia do przewodników, WhatsApp — nie tutaj.
- Backfill `lost_reason_code` dla 56 historycznych — osobna decyzja tj.
- `inquiry_events` / oś czasu — FA-1.03.
- Zmiana treści auto-maila poza jednym zdaniem z datą.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- `db push` na produkcję — **STOP**, treść migracji + `db diff`, zgoda tj, wykonuje tj.
- Jeśli odczyt `lost_reason` pokaże kategorię, której nie ma na liście CHECK-a i nie mieści się w `other` — **STOP**, nie rozszerzaj listy sam.
- Zdanie w auto-mailu to obietnica wobec klienta — **treść zatwierdza tj** przed merge'em; agent proponuje, nie decyduje.
- `OWNER_EMAIL` — jeśli nie ma w `env.ts`, dodaj do schematu zod i **zatrzymaj się** przed ustawianiem wartości na Vercelu.

## Weryfikacja
```
supabase migration up --local && supabase db diff --local
psql … -c "update inquiries set lost_reason_code='vibes' where id=(select id from inquiries limit 1);"   # ERROR check
pnpm test -- --run src/lib/business-days.test.ts
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/cron/offer-sla                                 # 401
curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/offer-sla                          # {"overdue":N}
supabase gen types typescript --local > src/lib/supabase/database.types.ts
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji
