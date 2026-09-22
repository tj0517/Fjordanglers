---
id: FA-1.23
title: Agent czyta wiedzę i instrukcje z bazy zamiast z plików — docs/knowledge/ znika
stage: 1
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/agent-knowledge-db
depends_on: [FA-1.21, FA-1.22]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.23 — Agent czyta wiedzę z bazy

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.22.md` — tabela `agent_knowledge` i jej reguły
- `src/lib/ai/knowledge.ts` + test — dzisiejszy loader plików
- `src/lib/ai/draft-reply.ts`, `src/lib/ai/draft-reply-prompt.ts` (po FA-1.21)
- `next.config.ts` — `outputFileTracingIncludes` dla `docs/knowledge/**`
- `docs/deferred-tasks.md` — wiersz FA-1.14 o `knowledgeDir`/`KNOWLEDGE_DIR` (zamykany tym zadaniem)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Po FA-1.22 wiedza jest w tabeli, ale agent nadal czyta pliki. Tu przełączamy źródło:
„zaproponuj” bierze aktywne instrukcje, ton, wpis kraju zapytania i wpis przypisanego
przewodnika (po `guide_id`, nie po nazwisku) z bazy. Zmiana wpisu w panelu działa od
następnego kliknięcia, bez deployu. Pliki, loader plików i ich konfiguracja znikają w tym
samym PR.

## Zakres
- [ ] Odczyt stanu: loader, jego testy, wywołania, `outputFileTracingIncludes`.
- [ ] `loadKnowledge({ country, guideId })` czyta `agent_knowledge` (tylko `active`) warstwą danych; wynik z listą id użytych wpisów.
- [ ] `buildDraftPrompt`: tekst instrukcji z wpisu `instructions`; `STUB_PROMPT` usunięty z kodu.
- [ ] Brak aktywnego wpisu `instructions` → czytelny `DraftReplyError` (nie cichy fallback).
- [ ] `draftReply` zwraca id użytych wpisów zamiast ścieżek plików.
- [ ] Usunięte: `docs/knowledge/` (README, katalogi), parser frontmatteru, wpisy w `next.config.ts`, fixture'y plików.
- [ ] Wiersz `knowledgeDir` w `docs/deferred-tasks.md` oznaczony jako zamknięty (FA-1.23).

## Gotowe, gdy
- [ ] Test: zapytanie z krajem A i przewodnikiem X → ładuje instrukcje + ton + wpis kraju A + wpis X; pomija wpis kraju B, wpis przewodnika Y i każdy wpis `active=false`.
- [ ] Test: brak aktywnych instrukcji → `DraftReplyError` z czytelnym komunikatem — **pokazany na czerwono** (tymczasowy fallback na stały tekst → test pada).
- [ ] Lokalnie: „zaproponuj” na zapytaniu z seedu zapisuje draft; raport: SQL wiersza draftu + lista id użytych wpisów. Potem UPDATE treści wpisu tonu i drugie „zaproponuj” bez restartu serwera → nowy draft odzwierciedla zmianę.
- [ ] `grep -rn "docs/knowledge\|STUB_PROMPT\|readdirSync" src next.config.ts` → 0.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone (build przy zatrzymanym stacku); `pnpm knip` czysty.

## Poza zakresem
- Ekran edycji → FA-1.24.
- Zapisywanie przy drafcie, których wpisów użył (kolumna w `messages`) — jeśli potrzebne, osobne zadanie.
- Treść wpisów → FA-1.17 / FA-1.26.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis na produkcji: STOP (Vercel Preview = baza prod; „zaproponuj” na preview to zapis na prod).
- Nowa migracja lub edycja istniejącej: STOP.
- Włączenie `AI_AUTO_REPLY_ENABLED=true`: STOP.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- knowledge draft-reply
grep -rn "docs/knowledge\|STUB_PROMPT\|readdirSync" src next.config.ts
pnpm typecheck && pnpm lint && pnpm knip
# build przy zatrzymanym stacku
```

## Notatki z realizacji
