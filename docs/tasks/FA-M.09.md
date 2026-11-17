---
id: FA-M.09
title: Kalendarz przewodnika, część 1 — synchronizacja zajętości z linku kalendarza (Apple) do zajętych dni, strona „Connect with your calendar” przez podpisany link
stage: M
status: in_progress
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/fa-m.09-calendar-sync
depends_on: []
blocked_by_questions: []
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
- `docs/design/fa-m-guide-app/README.md` — makieta (tj 17.11): `Connect.dc.html` (kroki Apple, ręczne blokady jako fallback), `Calendar.dc.html` (status synchronizacji, źródło zajętego dnia), `OtherDates.dc.html` (zajęte dni wyłączone)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Kalendarz zostaje u przewodnika, FA tylko odczytuje zajętość. To zadanie buduje wspólny fundament i przycisk Apple: zapis podłączenia kalendarza, synchronizację zajętości co kilka godzin do zajętych dni ze źródłem (z kalendarza / ręczna) oraz stronę „Connect with your calendar” otwieraną jednorazowym podpisanym linkiem (bez logowania; w koncie ta sama strona trafi w FA-M.13). Apple nie ma logowania OAuth do kalendarza, więc przycisk Apple prowadzi przez krótką instrukcję udostępnienia kalendarza i wklejenie linku (decyzja tj: link udostępniania). Przycisk Google dochodzi w FA-M.10.

## Zakres
- [ ] Odczyt stanu: `guide_unavailable_dates`, kto i gdzie je zapisuje/czyta, polityki; `guide_private`; crony (O-55).
- [ ] Migracja: podłączenie kalendarza per przewodnik (dostawca, link kalendarza — **prywatny, dostęp tylko serwer**, status, ostatnia synchronizacja, ostatni błąd); źródło blokady na zajętych dniach (`manual` / `calendar`) tak, by synchronizacja nie kasowała ręcznych blokad; RLS w tej samej migracji.
- [ ] Synchronizacja: pobranie i parsowanie ICS (wydarzenia całodniowe i godzinowe → zajęty dzień w strefie czasowej przewodnika; wydarzenie całodniowe zawsze = zajęty dzień, także oznaczone jako „wolny”; wydarzenia godzinowe oznaczone jako „wolny” pomijane — tj 2026-11-17, opcja b), horyzont 12 miesięcy, zastąpienie tylko blokad ze źródła `calendar`; błąd pobrania zapisuje status, nie usuwa starych blokad.
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
- **2026-11-17, tj:** makieta zatwierdzona — `docs/design/fa-m-guide-app/` (kanwa claude.ai, prywatna tj). Układ i copy wg makiety, fonty i komponenty z aplikacji; przy sprzeczności z zakresem zadania wygrywa zadanie — zgłoś różnicę.
- **2026-11-17, tj:** O-55 → (a) crony Vercela (sub-daily wymaga planu Pro — tj potwierdza plan przed zmianą `vercel.json`); `blocked_by_questions` wyczyszczone.
- **2026-11-17, tj (STOP 1, schemat):**
  - D1 (b) — link kalendarza szyfrowany w aplikacji kluczem z env; STOP przed użyciem: agent podaje nazwę zmiennej i sposób wygenerowania, tj ustawia wartość w Vercel i lokalnie (agent nigdy jej nie widzi ani nie zapisuje). Testy i CI — stały, jawnie testowy klucz. Podpowiedź w adminie = sam host, zero znaków z tajnej części linku.
  - D2 (a) — źródło w kluczu (`guide_id, date, source`), istniejące wiersze = `manual`. Przyjęte skutki: „open season” czyści tylko ręczne przyszłe blokady; odblokowanie dnia zajętego w kalendarzu zostawia go zajętym. Przed migracją: co dziś widzi przewodnik na kalendarzu w dashboardzie dla dnia z kalendarza + najmniejsza poprawka jako opcje (bez budowania bez zgody).
  - D3 (a) — strefa z kraju przewodnika, potem strefa kalendarza, potem UTC.
  - D4 (a) — wiersze `audit_log` w tej samej transakcji, payload bez linku; deferred: tabela zdarzeń na poziomie przewodnika.
  - D5 — pakiet: link ważny 7 dni, zużyty dopiero przy udanym połączeniu, nowy link unieważnia stary niewykorzystany. **Jeden kalendarz na przewodnika — świadomy wybór MVP; oznacza, że Google z FA-M.10 zastąpi Apple.** Deferred: kilka kalendarzy na przewodnika.
  - D6 (b) — przewodnik tylko czyta swoje zajęte dni, zapis wyłącznie przez serwer; red proof: zalogowany przewodnik wstawia i kasuje wiersz bezpośrednio.
  - Różnice z makietą: wygrywa zadanie — Google wyłączony „soon”, dodane kroki dla Maca.
- **2026-11-17, tj (STOP 1b):**
  - Migracja: OK na lokalnie. Przed dalszą pracą na piśmie: (a) okno wdrożenia — co pęka na prod przy migracji przed kodem i odwrotnie (kolejność tj ustala na STOP przed merge); (b) `CALENDAR_LINK_KEY` nie jest wymagany przy starcie aplikacji — brak klucza wyłącza połączenie i synchronizację z czytelnym błędem, strona działa; test; (c) wiersze `audit_log` z nazewnictwem operacji jak w FA-M.08 + czy coś czyta `audit_log` zakładając tylko INSERT / UPDATE / DELETE. Ciała funkcji tj ocenia w diffie PR z red proofs.
  - D2 follow-up → (b): serwer odmawia odblokowania dnia zajętego w kalendarzu, strona wyjaśnia. Koszt ponownego odczytu dat po „Set open season” — tylko wycena, bez budowania.
  - `CALENDAR_LINK_KEY`: lokalnie ustawiony przez tj (wartość jednorazowa, inna niż prod). Wartość prod tj ustawia w Vercel przed merge — przypomnieć na STOP przed merge; prod nie jest gotowy bez potwierdzenia tj.
  - Klucz testowy w kodzie testów. Check `secrets` w CI musi przejść bez allowlisty i zmian CI; jeśli go oflaguje — STOP i pokazać.
- **2026-11-17, tj (parser, okno wdrożenia):**
  - Wydarzenia całodniowe → (b): zawsze zajęty dzień, także oznaczone jako „wolny”; godzinowe oznaczone jako „wolny” pomijane. Zakres zaktualizowany; fixtures dla obu przypadków; deferred: sprawdzić flagę na pierwszym prawdziwym kalendarzu iCloud i policzyć, jak często (b) blokuje dzień, w którym przewodnik był wolny.
  - „Set open season”: budujemy ponowny odczyt — akcja zwraca aktualne zajęte dni przewodnika, kalendarz zastępuje lokalną kopię; jeden test.
  - Kolejność wdrożenia: migracja przed kodem to bezpieczna kolejność; tj potwierdza na STOP przed merge.
  - Testy strony „Connect” i crona bez klucza („odmawia, nic nie zapisuje”) są dowodem w PR. Brak lokalnego `CALENDAR_LINK_KEY` przy przejściu w przeglądarce → zgłosić, nie obchodzić.
- **2026-11-17, tj:** oba lokalne stacki (fjordanglers i Seaclouds) zostają włączone obok siebie na czas przejścia w przeglądarce — jak w FA-M.07; nadpisuje linię §9 „tylko stack fjordanglers” dla FA-M.09. Jedna ciężka rzecz naraz (bez buildu i pełnego suite w trakcie przejścia).
