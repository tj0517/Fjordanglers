---
id: FA-M.09
title: Kalendarz przewodnika, część 1 — synchronizacja zajętości z linku kalendarza (Apple) do zajętych dni, strona „Connect with your calendar” przez podpisany link
stage: M
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/fa-m.09-calendar-sync
depends_on: []
blocked_by_questions: [O-55]
touches_db: true
touches_prod: true
estimate_h: 8
owner: tj
---

# FA-M.09 — Kalendarz: synchronizacja i Apple

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`, `docs/02-data-model.md`
- `guide_unavailable_dates` (dzień po dniu), `src/actions/availability.ts`, `src/app/dashboard/calendar/page.tsx` — ręczne blokady dziś
- `src/app/admin/inquiries/[id]/GuideAttachmentTab.tsx` — admin widzi zajęte dni przewodników
- `guide_private` — prywatne dane przewodnika (tylko serwer)
- `docs/04-open-questions.md` O-54, O-55
- Dokument „Aplikacja dla przewodników — zakres MVP” — funkcja 1, decyzje 10.11

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Kalendarz zostaje u przewodnika, FA tylko odczytuje zajętość. To zadanie buduje wspólny fundament i przycisk Apple: zapis podłączenia kalendarza, synchronizację zajętości co kilka godzin do zajętych dni ze źródłem (z kalendarza / ręczna) oraz stronę „Connect with your calendar” otwieraną jednorazowym podpisanym linkiem (bez logowania; w koncie ta sama strona trafi w FA-M.13). Apple nie ma logowania OAuth do kalendarza, więc przycisk Apple prowadzi przez krótką instrukcję udostępnienia kalendarza i wklejenie linku (decyzja tj: link udostępniania). Przycisk Google dochodzi w FA-M.10.

## Zakres
- [ ] Odczyt stanu: `guide_unavailable_dates`, kto i gdzie je zapisuje/czyta, polityki; `guide_private`; crony (O-55).
- [ ] Migracja: podłączenie kalendarza per przewodnik (dostawca, link kalendarza — **prywatny, dostęp tylko serwer**, status, ostatnia synchronizacja, ostatni błąd); źródło blokady na zajętych dniach (`manual` / `calendar`) tak, by synchronizacja nie kasowała ręcznych blokad; RLS w tej samej migracji.
- [ ] Synchronizacja: pobranie i parsowanie ICS (wydarzenia całodniowe i godzinowe → zajęty dzień w strefie czasowej przewodnika; wydarzenia oznaczone jako „wolny” pomijane), horyzont 12 miesięcy, zastąpienie tylko blokad ze źródła `calendar`; błąd pobrania zapisuje status, nie usuwa starych blokad.
- [ ] Zadanie cykliczne co kilka godzin (mechanizm wg O-55), z sekretem crona.
- [ ] Podpisany link „connect calendar” (jednorazowy, z terminem) generowany w adminie do skopiowania / wysłania na WhatsApp; strona z dwoma przyciskami: **Apple** (instrukcja iPhone/Mac + pole na link, walidacja i próbne pobranie) i **Google** (wyłączony z dopiskiem „soon” do FA-M.10).
- [ ] Karta zapytania w adminie: zajęte dni z kalendarza odróżnione od ręcznych + data ostatniej synchronizacji.
- [ ] Testy na plikach ICS z repo (fixtures: całodniowe, godzinowe, wielodniowe, strefy, cykliczne, „free”).

## Gotowe, gdy
- [ ] Link kalendarza nie jest czytelny dla `anon`/`authenticated` ani na stronie publicznej przewodnika; pokazane na czerwono — **jak sprawdzić:** test sesją seeda + odczyt polityk na prod.
- [ ] Synchronizacja z fixture daje oczekiwane zajęte dni (w tym wydarzenie cykliczne i wielodniowe) — **jak sprawdzić:** test z listą dat.
- [ ] Ręczna blokada przetrwa synchronizację; usunięte w kalendarzu wydarzenie znika z zajętych dni — **jak sprawdzić:** testy.
- [ ] Błąd pobrania (404 / timeout) nie usuwa wcześniejszych blokad i zapisuje status błędu — **jak sprawdzić:** test.
- [ ] Podpisany link działa raz i wygasa; zły link nie pokazuje danych — **jak sprawdzić:** testy.
- [ ] Zrzuty strony „Connect” (telefon) i karty zapytania z rozróżnieniem źródeł — **jak sprawdzić:** ścieżki w PR.

## Poza zakresem
- Przycisk Google (OAuth) → FA-M.10.
- Strona „Connect” w koncie przewodnika → FA-M.13.
- CalDAV z hasłem aplikacji Apple, FishingBooker → poza MVP (FishingBooker: ręczne blokady, decyzja 10.11).
- Zapis do kalendarza przewodnika → poza MVP.
- Semi-auto rezerwacja na podstawie kalendarza → kolejny etap.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed migracją — schemat, polityki i miejsce przechowywania linku do akceptacji tj.
- Zmiana harmonogramu (`vercel.json` lub zewnętrzny) — wg O-55, pokazać tj.
- `db push` na prod wyłącznie przez `deploy-db.yml` (zatwierdza tj).
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- calendar-sync ics connect-calendar
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename IN ('<tabela podłączeń>', 'guide_unavailable_dates');
```

## Notatki z realizacji
- **2026-11-10, tj (wf-plan):** „Connect with your calendar” z dwoma przyciskami; Apple = link udostępniania; przyciski w koncie + jednorazowy podpisany link; w MVP tylko Google i Apple, FishingBooker ręcznie.
