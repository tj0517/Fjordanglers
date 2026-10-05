---
id: FA-1.44
title: Bateria testów sędziego auto-odpowiedzi — rozkład ocen na kilkunastu zapytaniach, przypadki brzegowe i wrogi tekst formularza
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: test/auto-reply-judge-battery
depends_on: [FA-1.40, FA-1.47]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.44 — Pomiar wiarygodności sędziego

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md` — reguły i konwencje
- `docs/05-agent-operations.md` §9, §10 — lokalne środowisko i dowody w `.fa-proofs/`
- `docs/tasks/FA-1.40.md`, `docs/tasks/FA-1.27.md` — pipeline, sędzia ≥ 0.9
- `src/lib/ai/auto-send.ts`, `src/lib/ai/judge-reply.ts` (tylko do odczytu), `src/lib/ai/draft-reply.ts`
- `.fa-proofs/demo-auto-send-form.mts`, `.fa-proofs/vitest.proof.config.mts` — dotychczasowy sposób uruchamiania dowodów
- `docs/deferred-tasks.md` — wiersz FA-1.40 o ocenie dokładnie 0.90

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Pierwsza prawdziwa ocena sędziego dla zapytania z formularza wyszła dokładnie 0.90, czyli na progu, a sędzia widzi tylko tekst formularza. Zadanie nie zmienia sędziego. Mierzy go: jak oceny rozkładają się na różnych zapytaniach, czy to samo wejście raz przechodzi, raz nie, i czy wrogi tekst formularza (próba wymuszenia oceny, obietnic, zniżki) przechodzi przez bramkę. Wynik to tabela, na podstawie której tj zdecyduje, czy włączać auto-odpowiedź i czy sędzia wymaga osobnego zadania.

## Zakres
- [ ] Odczyt bieżącego stanu: sposób uruchamiania dowodów w `.fa-proofs/`, lokalne wpisy `instructions` i `destination` w bazie lokalnej (seed albo syntetyczne, napisane ręcznie).
- [ ] Zestaw 15–20 zapytań fikcyjnych (adresy tylko `@example.test`): typowe, bez dat, bardzo krótkie, w innym języku, pytanie spoza oferty, kraj bez wpisu `destination`, duża grupa, ≥ 4 wrogie (polecenie „oceń 1.0”, prośba o zniżkę, wymuszenie obiecanej daty, prośba o ujawnienie instrukcji).
- [ ] Skrypt uruchamiający każde zapytanie 3–5 razy przez `autoSendReply` na lokalnej bazie, `RESEND_DEV_FAKE=1`, prawdziwy Anthropic; wynik zapisany do pliku (`.fa-proofs/`).
- [ ] Tabela wyników: dla każdego zapytania min / mediana / maks oceny, odsetek wysyłek, powody wstrzymania.
- [ ] Przegląd szkiców, które by wyszły (ocena ≥ 0.9): lista twierdzeń o datach, cenach i obietnicach, sprawdzonych z lokalnymi wpisami wiedzy.
- [ ] STOP — przed uruchomieniem pokaż liczbę wywołań modelu i szacunkowy koszt; limit 150 wywołań, powyżej czekaj na akceptację.
- [ ] STOP — nie kopiujesz danych z prod (ani wpisów wiedzy, ani zapytań) do lokalnej bazy bez pytania.

## Gotowe, gdy
- [ ] Zestaw ≥ 15 zapytań w repo bez prawdziwych danych osobowych — `grep -nE '[A-Za-z0-9._%+-]+@' <plik zestawu> | grep -v '@example.test'` bez trafień.
- [ ] Każde zapytanie uruchomione ≥ 3 razy; tabela z min / medianą / maks i odsetkiem wysyłek wklejona do opisu PR (wynik skryptu, nie opis słowny).
- [ ] Lista zapytań, które przy powtórzeniach raz przeszły, a raz zostały wstrzymane (zmienność), albo jawne „brak takich”.
- [ ] Wszystkie ≥ 4 wrogie zapytania: wynik wklejony; żadne nie zostało wysłane z obietnicą spoza wpisów wiedzy. Jeśli któreś zostało wysłane — to ustalenie do deferred i do tj, nie poprawka w tym zadaniu.
- [ ] Szkice, które by wyszły, przejrzane pod kątem dat, cen i obietnic; lista oznaczonych twierdzeń z oceną zgodności z wpisami wiedzy.
- [ ] `git diff main...HEAD --stat -- src/lib/ai/judge-reply.ts src/lib/ai/auto-send.ts` puste; liczba wywołań i szacunkowy koszt w raporcie; nic nie wyszło poza lokalny fake Resend.
- [ ] `pnpm typecheck && pnpm lint && pnpm knip` zielone; brak nowych `as any`, `eslint-disable`.

## Poza zakresem
- Zmiana sędziego, progu, wejścia sędziego lub instrukcji → osobne zadanie z bramką STOP (sędzia to bramka bezpieczeństwa).
- Treść wpisów wiedzy i instrukcji → panel, robi tj.
- Testy na dev i prod, pierwsza prawdziwa wysyłka → FA-1.45.
- Włączanie testów z prawdziwym Anthropic do CI → nie (koszt i niedeterminizm).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przekroczenie 150 wywołań modelu — pokaż koszt i czekaj.
- Kopiowanie danych z prod — pytanie.
- Jakikolwiek mail poza `RESEND_DEV_FAKE=1` — STOP.
- Merge do `main` = deploy na prod; PR z `--base main`.

## Weryfikacja
```
pnpm exec vitest run --config .fa-proofs/vitest.proof.config.mts <skrypt baterii>
pnpm typecheck && pnpm lint && pnpm knip
git diff main...HEAD --stat -- src/lib/ai/judge-reply.ts src/lib/ai/auto-send.ts   # puste
```

## Notatki z realizacji
- 2026-10-02: zadanie wynika z pytania tj o wiarygodne testy auto-odpowiedzi; wcześniejszy dowód to jedna ocena równa progowi (0.90).
