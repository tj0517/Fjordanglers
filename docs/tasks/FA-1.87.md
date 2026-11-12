---
id: FA-1.87
title: Atrybucja organiku — źródło pierwszego wejścia (referrer) i strona lądowania przy zapytaniu i zdarzeniach, kanał wyliczany; naprawa `web_events.referrer_host`
stage: 1
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: feat/fa-1.87-organic-attribution
pr:
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 6
owner: tj
---

# FA-1.87 — Atrybucja organiku

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` (gorąca ścieżka: `inquiries`), `docs/03-conventions.md`
- `docs/02-data-model.md` — `inquiries`, `web_events`
- `docs/REBUILD_PLAN.md` §7 — metryki
- `docs/audit/seo-audit-2026-11.md` — F17, §2.11
- `src/lib/utm.ts` (l. 4–30), `src/app/api/events/route.ts` (l. 66–70, 115), `POST /api/inquiries`
- `docs/tasks/FA-1.60.md` — `page_slug` przy zapytaniu

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
51 z 52 zapytań z 60 dni ma `source = web_form` bez kanału; 6 nie ma ani gclid, ani UTM, więc organik, direct i Instagram są nie do odróżnienia. `web_events.referrer_host` w 99,4% zapisuje własny host (Referer requestu beacona). Po zadaniu przy pierwszym wejściu zapisujemy `document.referrer` i ścieżkę lądowania (obok UTM), wysyłamy je z zapytaniem i zdarzeniami, a kanał (ads / organic / social / direct / referral) wylicza widok. Bez tego wzrostu z SEO nie zmierzymy we własnych danych.

## Zakres
- [ ] Odczyt stanu (SELECT, wklejony): rozkład `source`, gclid, `utm` za 60 dni; `referrer_host` w `web_events`.
- [ ] Pierwszy dotyk: referrer + ścieżka lądowania + znacznik czasu przy pierwszej wizycie, w tym samym magazynie co UTM (bez nadpisywania przy kolejnych wizytach).
- [ ] Gdzie zapisać przy zapytaniu (nowe kolumny vs klucze w istniejącym jsonb) — STOP z opcjami i SQL, decyzja tj.
- [ ] `web_events`: referrer z payloadu klienta zamiast nagłówka beacona.
- [ ] Widok kanału z regułami (gclid/utm cpc → ads; google/bing bez gclid → organic; instagram/facebook/utm social → social; brak → direct; reszta → referral) + test reguł.
- [ ] Żywa ścieżka zapytanie → oferta → depozyt bez zmian w zachowaniu.

## Gotowe, gdy
- [ ] Migracja na prod (jeśli potrzebna) i odczyt kolumn/widoku — wklejone.
- [ ] Test reguł kanału zielony; red proof: zapytanie z gclid nie wychodzi jako organic — wklejone.
- [ ] Test parytetu zielony: na tym samym zbiorze przypadków `ads` z widoku i `isPaidAttributed` się zgadzają; red proof: zmiana jednej strony → test czerwony → przywrócenie.
- [ ] Lokalnie: wejście z `Referer: https://www.google.com/` → zapytanie → kanał `organic`, ścieżka lądowania zapisana — wklejone (z flagami fake, bez wysyłki maili).
- [ ] Lokalnie: wiersz `web_events` zapisany ze strony otwartej z zewnętrznym referrerem ma ten host, nie własny — zapytanie i wynik wklejone. Po merge'u tj sprawdza na prod nowe wiersze z referrerem innym niż własny host (jak w FA-1.84 i FA-1.85); dokładny SELECT w opisie PR.
- [ ] CI zielone — lista wklejona.

## Poza zakresem
- Raport kanałów na dashboardzie admina → osobne zadanie.
- Uzupełnianie kanału dla historycznych zapytań.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Wybór miejsca zapisu i SQL migracji — STOP, decyzja tj.
- Migracja tylko przez `migrate-prod` (tj); kod nie może wymagać nowej kolumny przed jej wdrożeniem (§3).
- Wysłanie formularza zapytania w przeglądarce tylko z flagami fake; jeśli ścieżka maila nie czyta flagi — STOP (project.md, FA-1.55).
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- channel
```

## Notatki z realizacji
- **2026-11-03, tj:** zadanie z audytu SEO (F17); kolejność wg raportu (D6).
- **2026-11-12, tj — decyzje:** (1) kanał wylicza widok w bazie; test dowodzi, że reguła `ads` widoku zgadza się z `isPaidAttributed` na tych samych przypadkach. (2) Kryterium „po deployu” sprawdza tj po merge'u, jak w FA-1.84 i FA-1.85 — kryterium przeformułowane: lokalny dowód + SELECT dla tj w opisie PR.
