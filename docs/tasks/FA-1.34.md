---
id: FA-1.34
title: Agent pisze pierwszą odpowiedź na zapytanie z formularza — pusty wątek nie blokuje „Zaproponuj”
stage: 1
status: review
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/agent-draft-empty-thread
pr: 112
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 2
owner: tj
---

# FA-1.34 — Agent pisze pierwszą odpowiedź na zapytanie z formularza

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `src/lib/ai/draft-reply.ts` — linia ~72: `thread.length === 0` → `DraftReplyError`; zapytanie z formularza trzyma treść w `inquiries.message`, wątek `messages` jest pusty
- `src/lib/ai/extract-trip.ts` → `assembleConversation` — już dziś wkłada `inquiry.message`, daty i liczbę osób do rozmowy
- `src/lib/ai/draft-reply.test.ts` — test „throws … thread is empty” (do zmiany)
- `src/lib/ai/auto-send.ts` — ~96: auto-wysyłka też kończy na pustym wątku; **nie ruszamy**
- `docs/tasks/FA-1.17.md` — kryterium 1 zawężone 26 IX z powodu tej luki

## Cel
Większość leadów z reklam przychodzi formularzem: treść klienta leży w zapytaniu, a wątek wiadomości jest pusty. „Zaproponuj” odmawia wtedy z błędem „conversation thread is empty”, więc agent nie może napisać najważniejszej wiadomości — pierwszej odpowiedzi. Po zadaniu przy pustym wątku agent pisze szkic na podstawie danych z formularza (treść, daty, liczba osób, kraj, wyprawa), tak jakby to była pierwsza wiadomość klienta. Nic nie wychodzi bez „Wyślij”.

## Zakres
- [ ] Odczyt bieżącego stanu: odtworzyć błąd lokalnie na zapytaniu z treścią formularza i bez wiadomości (wklejony błąd).
- [ ] `draftReply`: pusty wątek przestaje być błędem, gdy zapytanie ma treść formularza (`inquiries.message`); rozmowa dla modelu zawiera formularz jako pierwszą wiadomość klienta (agent ma wiedzieć, że to formularz, nie mail).
- [ ] Błąd zostaje tylko wtedy, gdy nie ma ani wątku, ani treści formularza — z komunikatem zrozumiałym dla admina.
- [ ] Szkic do przewodnika przy pustym wątku działa tak samo (prośba o cenę z danych formularza).

## Gotowe, gdy
- [ ] Test: zapytanie z `message` i pustym wątkiem → szkic powstaje (`status='draft'`, `drafted_by='agent'`), a prompt wysłany do modelu zawiera treść formularza — pokazany jako czerwony na kodzie sprzed zmiany, potem zielony.
- [ ] Test: brak wątku i brak `message` → czytelny błąd (nie wyjątek z Anthropic).
- [ ] Lokalnie „Zaproponuj” na zapytaniu z formularza bez wiadomości daje szkic — zrzut Playwright.
- [ ] `src/lib/ai/auto-send.ts` bez zmian w diffie (`git diff stage-1...HEAD --stat -- src/lib/ai/auto-send.ts` puste); testy auto-wysyłki zielone.
- [ ] Brak nowych `as any` / `eslint-disable`, brak `.from(` poza warstwą danych; `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone.

## Poza zakresem
- Auto-wysyłka pierwszej odpowiedzi na formularz (FA-1.27 zostaje jak jest).
- Treść instrukcji i wpisów wiedzy (panel, robi tj).
- Automatyczne tworzenie wiadomości w wątku z formularza przy zapisie zapytania.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (touches_db: false; szkic zapisuje istniejąca ścieżka, lokalnie)

## Weryfikacja
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
git diff stage-1...HEAD --stat -- src/lib/ai/auto-send.ts   # puste

## Notatki z realizacji
- 2026-09-26 tj (wf-next): luka wykryta przy odbiorze FA-1.17 (błąd „conversation thread is empty” na zapytaniu z formularza). Decyzja tj: FA-1.17 zamknięte z zawężonym kryterium, luka jako osobne zadanie. Plik zadania, statusy FA-1.17/1.26 i dwa wiersze deferred zakłada agent w pierwszym commicie, bo stage-1 jest chronione.
- 2026-09-26 tj: konflikt zauważony podczas implementacji — bezwarunkowa zmiana `draftReply` naprawia „Zaproponuj”, ale też odblokowuje `auto-send.ts` (FA-1.27) dla świeżych leadów z formularza (wcześniej pusty wątek blokował auto-wysyłkę), co jest poza zakresem tego zadania. Decyzja tj: opcja A — `draftReply` dostaje flagę `allowFormOnly` (domyślnie `false`); ustawia ją tylko `proposeDraft` („Zaproponuj”); `auto-send.ts` wywołuje bez flagi i zachowuje się identycznie jak dziś.
