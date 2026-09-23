---
id: FA-1.25
title: Stary agent bez rund — przy nowym zapytaniu tylko klasyfikacja; koniec fałszywego „czekam, runda N” i przełącznika w panelu
stage: 1
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: chore/agent-rounds-removal
depends_on: [FA-1.14]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.25 — Stary agent bez rund

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.14.md` — D2 (rundy odłączone i oznaczone `// FA-1.17`)
- `src/lib/ai/inquiry-agent.ts` + testy round1/round2
- `src/app/api/inquiries/route.ts` — wywołanie `runAgentRound1` przy tworzeniu zapytania (gorąca ścieżka)
- `src/app/api/webhooks/email-inbound/route.ts` — `runAgentRound2`, gdy `agent_status='waiting'`
- `src/actions/ai.ts` (`setAgentStatus`), `src/app/admin/inquiries/[id]/AgentToggle.tsx`, `page.tsx`
- `src/lib/inquiries/qualified.ts` — FA-1.04; klasyfikacja musi dalej emitować `inquiry.qualified_set`
- `docs/deferred-tasks.md` — wiersz FA-1.14 o `agent_status`/`email_thread_message_id` (zamykany tym zadaniem)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Decyzja tj 22 IX (O-18): logika rund znika, klasyfikacja zostaje. Dziś przy każdym nowym
zapytaniu i każdym mailu klienta stary agent zapisuje „czekam na odpowiedź, runda N” i id
maila, który nigdy nie wyszedł, a przełącznik w panelu steruje czymś, co niczego nie wysyła.
Po zadaniu nowe zapytanie dostaje tylko klasyfikację (kraj, typ, priorytet, `qualified`),
mail klienta niczego w agencie nie uruchamia, a kod rund, stałe wiadomości i przełącznik
są usunięte.

## Zakres
- [ ] Odczyt stanu: wszystkie odczyty i zapisy `agent_status`, `agent_round`, `email_thread_message_id` w `src/` (22 IX: czytane tylko w `email-inbound/route.ts` i `[id]/page.tsx`; `email_thread_message_id` poza agentem nieczytane — potwierdź).
- [ ] `runAgentRound1` → funkcja klasyfikacji (nazwa do ustalenia w kodzie): ten sam prompt klasyfikacyjny, zapis kraju, typu, priorytetu, `qualified`; bez zapisu `agent_status`, `agent_round`, `email_thread_message_id`.
- [ ] `email-inbound`: usunięte wywołanie `runAgentRound2` i odczyt `agent_status`.
- [ ] Usunięte: `runAgentRound2`, `CLOSING_MESSAGE`, `WRAPPING_UP_MESSAGE`, pole `question` i logika `round` w prompcie klasyfikacji, `AgentToggle`, `setAgentStatus` (+ jego test autoryzacji), znaczniki `// FA-1.17`.
- [ ] Testy round1/round2 przepisane na test klasyfikacji.
- [ ] Wiersz deferred FA-1.14 (runda 2) o `agent_status`/`email_thread_message_id` oznaczony jako zamknięty (FA-1.25).

## Gotowe, gdy
- [ ] Test: nowe zapytanie → klasyfikacja zapisuje kraj, typ, priorytet i emituje `inquiry.qualified_set`; update nie zawiera `agent_status`, `agent_round` ani `email_thread_message_id` — **pokazany na czerwono** (tymczasowo przywrócony zapis `agent_status` → test pada).
- [ ] Test: webhook `email-inbound` dla zapytania z `agent_status='waiting'` nie woła modelu (mock, 0 wywołań).
- [ ] `grep -rn "runAgentRound\|agent_round\|AgentToggle\|setAgentStatus\|CLOSING_MESSAGE\|FA-1.17" src --include=*.ts --include=*.tsx | grep -v database.types` → 0.
- [ ] Lokalnie: utworzenie zapytania przez `/api/inquiries` z flagami fake → SELECT pokazuje klasyfikację i `agent_status` bez zmiany względem wartości domyślnej (wynik w raporcie).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone; `pnpm knip` czysty.

## Poza zakresem
- Drop kolumn `agent_status`, `agent_round`, `email_thread_message_id` → etap 4 (sprzątanie schematu).
- `'Other'` w klasyfikacji kraju (deferred FA-0.18).
- Draft odpowiedzi i jego prompt → FA-1.21 / FA-1.23.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Jeśli odczyt stanu pokaże, że `email_thread_message_id` albo `agent_status` jest czytane gdziekolwiek poza wymienionymi miejscami (dopasowanie maili, filtry listy, raporty) — STOP i pytanie.
- Zapis na produkcji: STOP.
- Nowa migracja: STOP (zadanie jej nie potrzebuje).
- Demo tylko z flagami fake (`RESEND_DEV_FAKE=1` itd.).

## Weryfikacja
```
pnpm test -- inquiry-agent email-inbound authorization
grep -rn "runAgentRound\|agent_round\|AgentToggle\|setAgentStatus\|CLOSING_MESSAGE\|FA-1.17" src --include=*.ts --include=*.tsx | grep -v database.types
pnpm typecheck && pnpm lint && pnpm knip
```

## Notatki z realizacji

- 2026-09-23 — start (agent): D1 `AI_AUTO_REPLY_ENABLED` pozostaje bez zmian i nadal steruje klasyfikacją (myląca nazwa → deferred jako FA-1.25 D1). D2 `sendInquiryAgentEmail` i `src/emails/inquiry-agent-email.tsx` usunięte w tym zadaniu.
