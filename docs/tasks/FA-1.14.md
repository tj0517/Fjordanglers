---
id: FA-1.14
title: Agent w wątku — instalacja — propozycja odpowiedzi w kompozytorze, loader wiedzy, auto-wysyłka wyłączona (treść i logika agenta → FA-1.17)
stage: 1
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: feat/agent-in-thread
depends_on: [FA-1.12]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 8
owner: tj
---

# FA-1.14 — Agent w wątku: instalacja

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/01-architecture.md` §3a, §4 — wątek i zdarzenia
- `docs/02-data-model.md` — `messages` (`status='draft'`, `drafted_by`, `channel`)
- `src/lib/ai/inquiry-agent.ts` + testy round1/round2 — dzisiejszy agent; wysyła przez `sendInquiryAgentEmail` (`@/lib/email`)
- `src/lib/ai/extract-trip.ts` — `assembleConversation`
- `src/lib/messages/send.ts`, `src/lib/events/emit.ts`, `src/actions/messages.ts` — wysyłka i `message.sent`
- `src/app/admin/inquiries/[id]/ThreadActionsPanel.tsx` — kompozytor
- `src/lib/env.ts` — `AI_AUTO_REPLY_ENABLED`, `ANTHROPIC_API_KEY`
- `docs/tasks/FA-1.16.md` §Pętla D3 — lokalny stack

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś odpowiedź powstaje przez wklejenie wątku do zewnętrznego AI, a stary agent sam
wysyła klientom maile. Po zadaniu w kompozytorze jest przycisk „zaproponuj”: kod składa
wątek, dane zapytania i pasujące pliki z `docs/knowledge/`, woła model i zapisuje wynik
jako wersję roboczą. Admin edytuje i wysyła. Stary agent nie wysyła nic. **Zadanie
dostarcza instalację, nie treść:** prompt jest zaślepką w jednym pliku, baza wiedzy jest
pusta poza README — treść i logikę agenta (graf działania) robi tj w FA-1.17, bez zmian w kodzie.

## Decyzje tj (21 IX)
- D1 = zakres to sama instalacja; prompt i pliki wiedzy podmienia FA-1.17 bez ruszania kodu.
- D2 = stary agent: wysyłka odłączona, klasyfikacja (qualified, FA-1.04) zostaje, logika rund zostaje w kodzie nieużywana i oznaczona `// FA-1.17` — o jej losie decyduje FA-1.17. Kolumn `agent_status`/`agent_round` nie ruszamy.
- D3 = dowód działania: test na pliku-fikcji + jedno lokalne wywołanie „zaproponuj” z prawdziwym API (lokalny stack; Vercel Preview = baza prod).

## Zakres
- [ ] Odczyt stanu: co robi `inquiry-agent.ts` (kiedy wysyła, co zapisuje); wartość `AI_AUTO_REPLY_ENABLED` w Vercel (preview i production) — odczyt, nie zmiana.
- [ ] `docs/knowledge/README.md` + puste katalogi `{tone,guides,destinations,offers}/`: format frontmatteru (`kind`, `country`, `regions`, `guide_name` lub klucz ustalony z tj) i reguła wyboru plików (tone zawsze; destination po kraju; guide po przewodniku zapytania).
- [ ] `src/lib/ai/knowledge.ts`: `loadKnowledge({ country, guide })` → lista plików z treścią; katalog wiedzy konfigurowalny (testy wskazują fixture).
- [ ] `src/lib/ai/draft-reply-prompt.ts`: jedyne miejsce z tekstem promptu; zaślepka, którą FA-1.17 podmienia.
- [ ] `src/lib/ai/draft-reply.ts`: `draftReply({ inquiryId, counterpart, channel })` → tekst + uzasadnienie (lista użytych plików); zapis `messages` ze `status='draft'`, `drafted_by='agent'`; nie wysyła.
- [ ] Kompozytor: przycisk „zaproponuj”, edytowalny draft, licznik długości dla kanału whatsapp; wysyłka przez zwykły `sendMessage` (zdarzenie z `payload.drafted_by='agent'`).
- [ ] `inquiry-agent.ts`: bez wywołań providera wysyłki; klasyfikacja działa.
- [ ] Testy (niżej).

## Gotowe, gdy
- [ ] Test: `loadKnowledge` na fixture wybiera tone + destination po kraju + guide po przewodniku i pomija resztę; wybrane pliki są w złożonym prompcie.
- [ ] Lokalnie: „zaproponuj” na seedowanym zapytaniu z ≥ 4 wiadomościami zapisuje draft w `messages` (odczyt SQL w raporcie) i pokazuje go w kompozytorze; raport: seed, użyte pliki, odpowiedź.
- [ ] `grep -rn "@/lib/email\|sendInquiryAgentEmail\|sendMessage(\|resend" src/lib/ai/` → 0.
- [ ] Test: przebieg `inquiry-agent` nie woła `@/lib/email` ani `sendMessage` (mock, 0 wywołań) — **pokazany na czerwono** (tymczasowo przywrócone wywołanie → test pada; wynik w raporcie).
- [ ] Test: draft w `messages` nie tworzy wiersza w `inquiry_events`.
- [ ] Test: wysyłka draftu przez `sendMessage` emituje `message.sent` z `payload.drafted_by='agent'`.
- [ ] Test: `draftReply` bez wątku → czytelny błąd.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone; `knip` bez nowych znalezisk.

## Poza zakresem
- Treść promptu i plików wiedzy, graf działania agenta, los logiki rund starego agenta → FA-1.17.
- Automatyczne odpowiadanie bez admina.
- Baza wiedzy w tabeli, embeddingi, RAG.
- Drop kolumn `agent_status`, `agent_round`; zmiany schematu `messages`.
- WhatsApp w obie strony (FA-1.13), przebudowa UI (FA-1.15).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis na produkcji: STOP. Vercel Preview wskazuje na bazę prod — „zaproponuj” na preview to zapis na prod.
- Włączenie `AI_AUTO_REPLY_ENABLED=true` gdziekolwiek poza lokalnym env testów: STOP.
- Zmiana env/sekretów w Vercel: STOP.
- Nowa migracja lub edycja istniejącej: STOP.
- `knip` zgłasza odłączoną logikę rund: STOP i pytanie (nie usuwaj — D2).
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- knowledge draft-reply inquiry-agent
grep -rn "@/lib/email\|sendInquiryAgentEmail\|sendMessage(\|resend" src/lib/ai/
pnpm typecheck && pnpm lint && pnpm build && pnpm knip
```

## Notatki z realizacji
