---
id: FA-1.47
title: Sędzia auto-wysyłki dostaje wiedzę, z której powstał szkic — instrukcje, wpis kraju i guide'a jako źródło prawdy o cenach i zasadach
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/judge-sees-knowledge
pr: 128
depends_on: [FA-1.40]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.47 — Sędzia widzi wiedzę agenta

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.27.md` — bramki auto-wysyłki, sędzia ≥ 0.9, stany „nigdy auto”
- `docs/tasks/FA-1.22.md` — wiedza agenta w bazie (`agent_knowledge`: instructions, tone, destination, guide)
- `src/lib/ai/judge-reply.ts` — `judgeReply(conversation, draftText)`: prompt sędziego i wywołanie modelu
- `src/lib/ai/auto-send.ts` — wywołanie sędziego po `draftReply`; osobne `loadKnowledge({ country })` dla bramki 4
- `src/lib/ai/draft-reply.ts` — `loadKnowledge({ country, guideId })`, zwraca `usedIds`
- `src/lib/ai/knowledge.ts` — `loadKnowledge`, `KnowledgeEntry`, `usedIds`
- `src/lib/ai/judge-reply.test.ts`, `src/lib/ai/auto-send.test.ts`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Sędzia ocenia szkic bez dostępu do wiedzy, z której szkic powstał: dostaje tylko rozmowę i tekst szkicu. Nie może więc potwierdzić ceny, zasad guide'a ani reguł z wpisu `instructions`, choć jego własny prompt każe mu sprawdzać „rules from the instructions” i flagować twierdzenia, których nie da się zweryfikować. Skutek na produkcji (zapytanie 2640acd6, Nowa Zelandia, 4 X 2026): trzy oceny tego samego szkicu 0,72 / 0,72 / 0,75 przy progu 0,9; powody: „cena 1 440 NZD + 60 NZD może wymagać weryfikacji”, „guide pracuje tylko pełne dni — nie do sprawdzenia”, „baza wiedzy nie mówi, czy…”. Cena była zgodna z wpisem wiedzy. Po zadaniu sędzia dostaje tę samą wiedzę, którą miał agent piszący szkic, traktuje ją jako źródło prawdy i flaguje twierdzenia sprzeczne z nią lub spoza niej.

Decyzja tj (5 X 2026): „musimy dodać mu tę wiedzę, bo ten cennik był bardzo dobry”.

## Zakres
- [ ] Odczyt bieżącego stanu: otworzyć `judge-reply.ts`, `auto-send.ts`, `draft-reply.ts`, `knowledge.ts` na `main`; wkleić fragment budujący `userContent` sędziego i listę argumentów `judgeReply`.
- [ ] Sędzia dostaje wpisy wiedzy użyte przez szkic (instructions, destination dla kraju, guide dla przypisanego guide'a, tone — dokładnie to, co widział `draftReply`). Źródło: te same `usedIds`/wpisy co w szkicu, a nie osobne zapytanie o inny zestaw; bramka 4 (wpis `destination`) zostaje bez zmian.
- [ ] `draftReply` dodatkowo zwraca wpisy wiedzy, których faktycznie użył (instructions + tone/destination/guide), obok `usedIds`. Pole addytywne, bez drugiego zapytania o wiedzę; `DraftReplyResult` i wywołujący zaktualizowani tylko w niezbędnym zakresie. (Decyzja tj D1, 2026-10-05.)
- [ ] `autoSendReply` przekazuje sędziemu wpisy zwrócone przez `draftReply`; bramka 4 (własne `loadKnowledge({ country })`) bez zmian.
- [ ] Prompt sędziego: dodać sekcję „KNOWLEDGE BASE (source of truth)” i regułę: twierdzenie zgodne z wiedzą nie jest „niezweryfikowane”; flagować twierdzenia sprzeczne z wiedzą, spoza niej, albo obietnice niezgodne z `instructions`. Pozostałe reguły „never auto” (skarga, konkurencja, kontakt do guide'a, problem z rezerwacją, niejasna wiadomość, wymaga admina) bez zmian; próg 0,9 bez zmian.
- [ ] Sygnatura `judgeReply` rozszerzona o wiedzę (parametr opcjonalny albo obiekt wejściowy); wszyscy wywołujący zaktualizowani.

## Gotowe, gdy
- [ ] Test `judgeReply`: `userContent` wysłany do modelu zawiera wpisy wiedzy przekazane w argumencie — **czerwony na kodzie z `main`** (tam wiedzy nie ma w treści), potem zielony; bez wiedzy w argumencie wejście identyczne jak przed zmianą.
- [ ] Test `autoSendReply`: sędzia dostaje wpisy, z których powstał szkic (te same id co w `usedIds`), nie inny zestaw — czerwony, potem zielony.
- [ ] Test `draftReply`: zwrócone wpisy mają te same id co `usedIds`. (Dodane przez D1.)
- [ ] Przypadek zachowania z prawdziwym wywołaniem modelu (klucz `ANTHROPIC_API_KEY` z `.env.local`, jak w `.fa-proofs/demo-auto-send-form.mts`; decyzja tj D3; skrypt w `.fa-proofs/fa-1.47/` wywołuje tylko `judgeReply` na fikcyjnych danych, wynik wklejony w raporcie): trzy szkice dla pierwszego zapytania NZ z wpisem ceny w wiedzy — (1) cena zgodna z wpisem, (2) cena sprzeczna z wpisem, (3) obietnica spoza wiedzy (np. dostępność konkretnego dnia). Oczekiwanie: (1) powyżej progu 0,9, (2) i (3) poniżej progu lub `send=false`. Jeśli (1) nadal poniżej progu — raport z powodami, bez poluzowania progu.
- [ ] `git diff main...HEAD -- src/lib/ai/judge-reply.ts` pokazuje zmianę wyłącznie w wejściu i dodanej sekcji promptu; `JUDGE_THRESHOLD` bez zmian.
- [ ] Istniejące testy zielone: `pnpm test -- judge-reply auto-send draft-reply`.
- [ ] Brak nowych `as any`, `eslint-disable`, `.from(` poza warstwą danych.
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone.

## Poza zakresem
- Zmiana progu 0,9 i poluzowanie reguł „never auto”.
- Bateria testów sędziego i rozkład ocen — to FA-1.44.
- Poprawa treści wpisów wiedzy, w tym rozjazdu cen NZ (1 440 + 60 kontra 1 600 i 1 500 podane ręcznie) — robi tj w panelu wiedzy.
- Zachowanie auto-wysyłki po przejęciu wątku przez człowieka — to FA-1.48.
- Włączanie/wyłączanie flagi `AI_AUTO_REPLY_ENABLED` — to FA-1.45.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
pnpm test -- judge-reply auto-send draft-reply
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
git diff main...HEAD -- src/lib/ai/judge-reply.ts
```

## Notatki z realizacji
- 2026-10-05 tj: dowód z prod — zapytanie 2640acd6-4fe6-47a1-a7a5-6d057208998d (NZ, formularz, 4 X 17:33 UTC): `agent.auto_send_decided` score 0,72 (17:33), 0,72 (18:02), 0,75 (18:21), `sent=false`, szkic 53c5d719-e398-4f3d-8cc6-31a766e8d1cf. Powody sędziego: cena i „pełne dni” jako niezweryfikowane, mimo że pochodzą z wpisu wiedzy. tj: cennik był bardzo dobry — dać sędziemu tę wiedzę.
- Interpretacja do potwierdzenia przy odbiorze: „ta wiedza” = ten sam zestaw wpisów, z którego powstał szkic (instructions, destination, guide, tone).
- 2026-10-05 tj, D1: `draftReply` zwraca także wpisy wiedzy, których użył (obok `usedIds`) — źródło dla sędziego bez drugiego zapytania; do zakresu dodany punkt i test `draftReply`.
- 2026-10-05 tj, D2: z zakresu usunięty punkt o edycji `depends_on` w FA-1.44 i wiersza INDEX — FA-1.47 jest tam już od PR #127.
- 2026-10-05 tj, D3: przypadek zachowania z prawdziwym modelem używa `ANTHROPIC_API_KEY` z `.env.local` (osobnego klucza dev nie ma), jak `.fa-proofs/demo-auto-send-form.mts`; skrypt woła tylko `judgeReply`, bez bazy i bez maila, ze strażnikiem flagi fake (§10).
- 2026-10-05 tj: accepted, PR #128. Proved: judge test and autoSendReply test red on main then green (4 red / 55 green, 59 green after), draftReply returns usedEntries with ids equal to usedIds, real-model run on synthetic NZ fixtures 0.95 / 0.30 / 0.20, diff of judge-reply.ts limited to input and the added knowledge section, JUDGE_THRESHOLD unchanged, typecheck/lint/test run/knip green. Rule-clash decision (a): older rules left verbatim, measured in FA-1.44. Not proven: behaviour on production knowledge entries (synthetic instructions in the proof).
