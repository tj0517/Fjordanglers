---
id: FA-1.43
title: Formularz zapytań — honeypot i minimalny czas wypełnienia; podejrzane zapytanie zapisane, ale bez AI i maili do klienta
stage: 1
status: review
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-web
branch: feat/inquiry-form-bot-trap
pr: 124
depends_on: [FA-1.42]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 3
owner: tj
---

# FA-1.43 — Ochrona formularza przed prostymi botami

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md` — reguły i konwencje
- `docs/04-open-questions.md` — O-27 (honeypot + czas, rozstrzygnięte)
- `src/components/inquiry/InquiryWidget.tsx` — formularz, wywołanie `fetch('/api/inquiries')` (~linia 313)
- `src/app/api/inquiries/route.ts` — schemat zod i obsługa
- `docs/tasks/FA-1.42.md` — mechanizm pominięcia AI i maili do klienta dla powtórek, z którego korzysta to zadanie
- `src/lib/events/emit.ts` — katalog zdarzeń

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Proste boty wypełniają każde pole i wysyłają formularz w ułamku sekundy. Po zadaniu formularz ma ukryte pole-pułapkę oraz znacznik czasu rozpoczęcia wypełniania. Zapytanie z wypełnioną pułapką albo wysłane szybciej niż 2 sekundy od załadowania formularza jest **zapisane** (nie tracimy prawdziwego klienta, któremu autouzupełnianie wypełniło ukryte pole), ale traktowane jak podejrzane: bez klasyfikacji AI, auto-odpowiedzi i maili do klienta ani FA; zostaje zdarzenie z powodem. Decyzja tj z 2 X 2026 (O-27 a).

## Zakres
- [ ] Odczyt bieżącego stanu: struktura formularza i schemat zod; sprawdź, jak przeglądarki autouzupełniają ukryte pola i wybierz nazwę pola, której autouzupełnianie nie rusza.
- [ ] Widżet: pole-pułapka niewidoczne dla ludzi i czytników (poza ekranem, `aria-hidden`, `tabindex=-1`, `autocomplete=off`), nie `display:none`; znacznik czasu ustawiany po załadowaniu formularza.
- [ ] Trasa: pola opcjonalne w schemacie; wypełniona pułapka albo czas < 2 s → ścieżka „podejrzane” zgodnie z FA-1.42 (zapis, bez AI i maili, zdarzenie z powodem). Odpowiedź dla klienta bez zmian, żeby bot nie dowiedział się, że został rozpoznany.
- [ ] Typ zdarzenia z istniejącego katalogu; jeśli potrzebny nowy — STOP i pytanie.

## Gotowe, gdy
- [ ] Test trasy: pułapka wypełniona → zapytanie zapisane, `classifyInquiry`, `autoSendReply`, mail do klienta i do FA niewywołane, zdarzenie z powodem. Czerwony na `main`, potem zielony. Sprawdzenie: `pnpm exec vitest run src/app/api/inquiries`.
- [ ] Test: czas < 2 s przy pustej pułapce → ta sama ścieżka; czerwony, potem zielony.
- [ ] Test: pułapka pusta i czas ≥ 2 s → przebieg jak dziś; istniejące testy zielone.
- [ ] Playwright lokalnie (`http://localhost:3000`): człowiek wypełnia i wysyła formularz normalnie → przechodzi pełną ścieżką; skrypt wypełniający wszystkie pola natychmiast → ścieżka podejrzana. Zrzuty i ścieżki plików w opisie PR (`.playwright-mcp/`, `ls`).
- [ ] Pułapka niewidoczna wizualnie i dla czytnika ekranu — zrzut formularza oraz asercja atrybutów w teście komponentu lub DOM.
- [ ] `pnpm typecheck && pnpm lint && pnpm exec vitest run && pnpm knip` zielone; brak nowych `as any`, `eslint-disable`.

## Poza zakresem
- Turnstile / CAPTCHA → deferred; wracamy, gdy w danych pojawi się faktyczny ruch botów (O-27).
- Limity żądań → FA-1.41; powtórki i sufit kosztów → FA-1.42.
- Panel z listą podejrzanych zapytań → osobne zadanie, jeśli tj zdecyduje.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Nowy typ zdarzenia poza katalogiem — pytanie przed dodaniem.
- Merge do `main` = deploy na prod; PR z `--base main`.

## Weryfikacja
```
pnpm exec vitest run src/app/api/inquiries
pnpm typecheck && pnpm lint && pnpm knip
```
UI: uruchom aplikację lokalnie (http://localhost:3000), przejdź formularz z Playwright MCP i zapisz zrzuty do `.playwright-mcp`.

## Notatki z realizacji
- 2026-10-02 tj: O-27 → a: honeypot + czas; Turnstile odroczony.
- Próg 2 s i podejście „zapisz, ale podejrzane” to propozycja planu — tj może zmienić przy review.
- 2026-10-03 tj: decyzja (Option 2) — przeglądarka mierzy czas wypełnienia własnym stoperem i wysyła **czas trwania w milisekundach** (`form_elapsed_ms`), a nie znacznik czasu zegara; odchyłka od treści zadania („znacznik czasu"), bo zegar klienta może się rozjeżdżać z serwerem i fałszywie oflagować prawdziwego klienta. Brak, ujemna, nienumeryczna albo absurdalnie duża wartość = „brak informacji" → żądanie traktowane normalnie; żadna zniekształcona wartość nie jest podejrzana.
- 2026-10-03 tj: pole-pułapka `trip_notes_extra` (z wyłączeniem autouzupełniania i menedżerów haseł; w PR zaznaczyć, że nie testowane w prawdziwych przeglądarkach); zegar startuje przy pierwszym pokazaniu kroku z danymi i nie resetuje się po powrocie; „podejrzane" wygrywa z „powtórką" (bez zapytania o powtórkę, jedno zdarzenie); odpowiedź bez zmian: 201 `{ id, status }`.
