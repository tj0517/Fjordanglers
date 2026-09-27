---
id: FA-1.38
title: Pozostałe daty z przeszłości — kiedy przyszło zapytanie, kiedy wysłano ofertę, kiedy przegrane; także pole daty w ręcznie tworzonym zapytaniu
stage: 1
status: review
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: feat/record-past-dates
depends_on: [FA-1.37]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.38 — Daty oferty, zapytania i przegranej z przeszłości

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły 5 (zdarzenie przy każdej zmianie stanu), 10 (zakres)
- `docs/03-conventions.md` — konwencje kodu
- `docs/01-architecture.md` §3–4 + `docs/REBUILD_PLAN.md` załącznik C — katalog zdarzeń (nowy typ = wpis w obu miejscach w tym samym PR)
- `src/lib/inquiries/history.ts` (FA-1.37) — ścieżka historyczna: walidacja daty, compare-and-set, zdarzenia `backfill`, wycofanie; **rozszerzasz ją, nie piszesz drugiej**
- `src/lib/inquiries/state.ts` — `transition()` do `lost` wymaga `lost_reason_code` (lista z FA-0.16)
- `src/actions/inquiries.ts` `createManualInquiry` (~135), `src/lib/inquiries/create.ts`, `src/app/admin/inquiries/new/NewInquiryForm.tsx`
- `docs/deferred-tasks.md` wiersze „FA-1.05 audit” — 24 oferty bez `offer_sent_at`, 7 zapytań z `created_at` po pierwszej wiadomości
- `src/lib/metrics/weekly.ts` `lostReasons` — liczy okno 90 dni po `updated_at` (proxy, TEMPORARY — nie zmieniaj)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Po FA-1.37 bookingi mają prawdziwe daty, ale metryki czasu i lejka dalej kłamią: 24 oferty nie mają daty wysłania, część zapytań ma datę utworzenia rekordu zamiast daty maila, a przegraną z przeszłości da się dziś oznaczyć tylko z dzisiejszą datą. Po tym zadaniu admin na karcie wpisuje te trzy daty, każda zostawia zdarzenie `backfill` z prawdziwą datą, a ręcznie tworzone zapytanie ma pole „przyszło dnia”.

## Zakres
- [ ] Odczyt bieżącego stanu: kto dziś ustawia `offer_sent_at` i `created_at`; czy `created_at` ma trigger/default blokujący zmianę; jakie zdarzenie ma zapytanie przy utworzeniu (`inquiry.created`) — wyniki w raporcie.
- [ ] `history.ts` rozszerzone o:
  - `recordPastOffer(inquiryId, { sentOn })` — tylko gdy `offer_sent_at IS NULL`; ustawia `offer_sent_at`, `stage_reached` co najmniej `offer_sent` (trigger pozwala tylko do przodu); zdarzenie `offer.presented` (`backfill`, `occurred_at = sentOn`);
  - `recordPastLoss(inquiryId, { lostOn, lostReasonCode, note })` — przeskok do `lost` z każdego statusu bez `deposit_paid_at`; kod wymagany; zdarzenia `status.changed` + `inquiry.lost` (`backfill`, `occurred_at = lostOn`);
  - `correctReceivedDate(inquiryId, { receivedOn })` — tylko **wcześniej** niż obecne `created_at`; nowe zdarzenie `inquiry.history_corrected` (payload `{ field: 'created_at', from, to }`), dopisane do katalogu w `src/lib/events/types.ts` i załączniku C.
  - Wszystkie: data nie w przyszłości, compare-and-set, wycofanie przy błędzie zdarzenia.
- [ ] UI na karcie: trzy małe akcje (w „Offer & payment” — data oferty; w nagłówku/Overview — data wpływu i „przegrane w przeszłości”), widoczne tylko, gdy dany brak występuje; FA-1.31 (stan „trwa”, blokada).
- [ ] `createManualInquiry` + formularz: opcjonalne „przyszło dnia” (domyślnie dziś) → `created_at` i `occurred_at` zdarzenia `inquiry.created`.
- [ ] Testy Vitest.

## Gotowe, gdy
- [ ] Lokalnie: każda z trzech akcji na zapytaniu z seeda → SELECT kolumny + wiersz `inquiry_events` z `source='backfill'` i właściwym `occurred_at` (3 pary w raporcie).
- [ ] Zapytanie utworzone ręcznie z datą sprzed 2 miesięcy: `created_at` i `inquiry.created.occurred_at` = ta data (SELECT); `/admin/pipeline` (widok miesięczny, tamten miesiąc) pokazuje +1 zapytanie; `/admin/weekly` „Conversion (YTD)” pokazuje +1 w mianowniku — wartości przed/po i zrzuty ekranu. *(Zmienione z „liczy się w tamtym tygodniu na /admin/weekly/pipeline” przez tj 2026-09-27: `/admin/weekly` pokazuje tylko ostatnie 5 tygodni, więc zapytanie sprzed 2 miesięcy dowodzi się przez miesiąc na pipeline i konwersję YTD.)*
- [ ] **Na czerwono:** data w przyszłości odrzucona dla każdej z 3 akcji (test).
- [ ] **Na czerwono:** `recordPastOffer` na zapytaniu z ustawionym `offer_sent_at` i `correctReceivedDate` z datą późniejszą niż obecna → błąd, zero zmian (testy).
- [ ] **Na czerwono:** `recordPastLoss` bez kodu i na zapytaniu z `deposit_paid_at` → błąd (testy).
- [ ] Nowy typ zdarzenia jest w `types.ts` i w załączniku C w tym samym diffie; `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Zmiana proxy `updated_at` w `lostReasons` na datę ze zdarzenia — `/admin/weekly` jest TEMPORARY; etap 5 (wpis do `deferred-tasks.md`). Znany skutek: przegrana wpisana dziś „z datą z maja” pojawi się w oknie 90 dni na `/admin/weekly`.
- Czas do oferty/do bookingu (M7, M10–M12) — etap 5.
- Korekta już ustawionych dat oferty/wpłaty — osobne zadanie.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.
- Jeśli zmiana `created_at` wymaga migracji (trigger, default, uprawnienia) — STOP: pokaż diff względem baseline przed napisaniem.
- Zapis na produkcji — STOP, nie w tym zadaniu. Testy tylko lokalnie.

## Weryfikacja
```
pnpm test -- history events
supabase db reset && pnpm dev
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Notatki z realizacji
- 2026-09-27 tj (wf-plan): pełny zakres (D3); O-25 obejmuje też przegraną z datą.
- 2026-09-27 tj (wf-task): serwer MCP `supabase-prod` odrzuca OAuth (`{“message”:”Unrecognized client_id”}`) — naprawa po stronie tj, nie agenta. Decyzja: fakty o bazie dla tego zadania ustalane na stosie lokalnym (psql, port z `supabase/config.toml`) i z `supabase/migrations/`; żadne twierdzenie o produkcji bez weryfikacji — oznaczone „not verified on prod”. Konfiguracji MCP nie dotykać.
- 2026-09-27 tj (wf-task): kryterium 2 zmienione — patrz wersja poniżej w sekcji „Gotowe, gdy” (`/admin/weekly` pokazuje tylko ostatnie 5 tygodni, więc dowód przez miesiąc na pipeline + YTD conversion, nie przez tydzień na weekly).
