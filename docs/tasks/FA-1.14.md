---
id: FA-1.14
title: Agent w wątku — propozycja odpowiedzi z bazy wiedzy; auto-wysyłka wyłączona
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/agent-in-thread
depends_on: [FA-1.12]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 12
owner: tj
---

# FA-1.14 — Agent proponuje odpowiedź w wątku

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/01-architecture.md` §3a, §4
- `src/lib/ai/inquiry-agent.ts` — dzisiejszy agent (generyczny, auto-mail, `agent_status`); do zastąpienia
- `src/lib/messages/send.ts`, wątek z FA-1.12
- `src/actions/ai.ts`, `AI_AUTO_REPLY_ENABLED` (FA-0.04)
- Skill Cowork `fa-klient-korespondencja` i `docs/ops/` — dzisiejsze zasady pisania do klientów i przewodników (to jest wiedza, którą agent ma dostać)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś odpowiedź powstaje przez wklejenie screena do zewnętrznego AI. Po zadaniu w wątku
jest przycisk „zaproponuj odpowiedź": agent dostaje cały wątek (oba kanały, obie strony),
dane zapytania, profil przewodnika i wiedzę o lokacji/ofercie z bazy wiedzy, i wypełnia
kompozytor. Admin edytuje i wysyła. Auto-wysyłka domyślnie wyłączona; obecny agent
mailowy przestaje wysyłać cokolwiek sam.

## Zakres
- [ ] Odczyt stanu: co dziś robi `inquiry-agent.ts` (prompt, źródła kontekstu, kiedy wysyła); wartość `AI_AUTO_REPLY_ENABLED` w env podglądu.
- [ ] Baza wiedzy: `docs/knowledge/{guides,destinations,offers,tone}/*.md` w repo (format i pierwsze pliki z tj), ładowana do promptu wg zapytania (kraj, przewodnik); struktura opisana w `docs/knowledge/README.md`. Tabela `knowledge_docs` — **nie** w tym zadaniu (O: repo vs baza, decyzja po pierwszych tygodniach użycia).
- [ ] `src/lib/ai/draft-reply.ts`: `draftReply({ inquiryId, counterpart, channel })` → tekst + krótkie uzasadnienie (co wziął z wiedzy); zapis jako `messages` ze `status='draft'`, `drafted_by='agent'`; wysyłka przez zwykły `sendMessage` (zdarzenie ma `payload.drafted_by='agent'`).
- [ ] Kompozytor: przycisk „zaproponuj", wersja robocza edytowalna, licznik długości dla WA.
- [ ] Wyłączenie auto-wysyłki: `inquiry-agent.ts` nie woła providera maili; klasyfikacja (qualified, FA-1.04) zostaje.
- [ ] Testy: `draftReply` bez wątku → błąd czytelny; wersja robocza nie emituje `message.sent`; z `AI_AUTO_REPLY_ENABLED=false` żaden test nie wywołuje `send` z `drafted_by='agent'` bez akcji admina.

## Gotowe, gdy
- [ ] Na gałęzi podglądowej: dla zapytania z ≥ 4 wiadomościami w wątku „zaproponuj" zwraca tekst odwołujący się do konkretów z wątku i z pliku wiedzy (raport: wątek, plik, odpowiedź).
- [ ] `grep -rn "sendEmail\|resend\." src/lib/ai/` → 0 poza `draft-reply.ts` (który nie wysyła).
- [ ] Wersja robocza w `messages` nie tworzy `inquiry_events` — test.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Automatyczne odpowiadanie bez admina — decyzja później, osobne zadanie.
- Baza wiedzy w tabeli, embeddingi, RAG — po pierwszych tygodniach użycia.
- Treść samej wiedzy (pliki o przewodnikach i lokacjach) — pisze tj/zespół; zadanie dostarcza format i 2–3 przykłady.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis na produkcji: STOP.
- Włączenie `AI_AUTO_REPLY_ENABLED=true` gdziekolwiek: STOP.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- draft-reply
grep -rn "sendEmail\|resend\." src/lib/ai/
pnpm typecheck && pnpm lint && pnpm build
```

## Notatki z realizacji
