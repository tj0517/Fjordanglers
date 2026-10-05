---
id: FA-1.48
title: Auto-wysyłka prowadzi wątek tylko do przejęcia przez człowieka — po ręcznej odpowiedzi kolejne wiadomości klienta nie uruchamiają agenta
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/auto-send-stops-after-human
depends_on: [FA-1.40, FA-1.49]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.48 — Agent oddaje wątek człowiekowi

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.27.md` — hybryda auto-wysyłki, bramki, stany „nigdy auto” (D1–D5)
- `docs/tasks/FA-1.42.md` — kontrola kosztów auto-odpowiedzi, dzienny sufit
- `src/lib/ai/auto-send.ts` — bramka 3 (status `new`/`qualifying`), kolejność bramek
- `src/app/api/webhooks/email-inbound/route.ts` — każda przychodząca wiadomość woła `autoSendReply`; przejście D2 `new → qualifying` tylko po wysłanej auto-odpowiedzi
- `docs/tasks/FA-1.49.md` — maile wysłane ze skrzynki Zoho trafiają do wątku jako wiadomości wychodzące człowieka (bez tego przejęcie przez Zoho jest niewidoczne)
- `src/lib/messages/send.ts` — ręczne wysłanie: jakie `drafted_by`, `status`, czy zmienia status zapytania
- `src/lib/supabase/queries.ts` — `hasAgentSentReplyToAngler`, `getInquiryForAutoSend`, `getConversationForJudge`
- panel admina: `AgentToggle` i `inquiries.agent_status` (O-18) — co faktycznie robi dziś przełącznik

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Agent ma wysłać pierwszą odpowiedź (także w nocy) i prowadzić wątek tylko do momentu, gdy przejmie go człowiek. Dziś każda kolejna wiadomość klienta uruchamia `autoSendReply`, także gdy tj już odpowiedział ręcznie: bramka 3 przepuszcza status `new`, a status nie zmienia się po ręcznej wiadomości. Na produkcji (zapytanie 2640acd6, 4 X 2026) po ręcznej odpowiedzi tj agent trzy razy napisał i ocenił szkic po wiadomościach klienta (17:33, 18:02, 18:21 UTC) — koszt AI i ryzyko, że kiedyś szkic z oceną ≥ 0,9 wyjdzie do klienta, którym zajmuje się człowiek.

Decyzja tj (5 X 2026): agent nie odpowiada na kolejne wiadomości klienta, gdy wątek kontroluje tj; agent prowadzi wątek do przejęcia.

## Zakres
- [ ] Odczyt bieżącego stanu: kod `autoSendReply`, `email-inbound`, `sendMessage` i `AgentToggle` na `main`; dla `sendMessage` wpisać, jakie wartości `drafted_by`/`status` ma ręczna wiadomość tj, a jakie wiadomość agenta (wynik odczytu kodu i testu, nie z pamięci).
- [ ] Definicja przejęcia: w wątku jest wysłana wiadomość wychodząca napisana przez człowieka (nie `drafted_by='agent'`), na dowolnym kanale — także wiadomość zaimportowana z Zoho przez FA-1.49 (ta sama wartość `drafted_by` co ręczna z panelu). Wiadomość agenta nie jest przejęciem.
- [ ] Nowa bramka w `autoSendReply` przed `draftReply`: przejęcie → zdarzenie `agent.auto_send_decided` z `sent=false`, `score=null`, `draft_message_id=null` i powodem „human has taken over the thread”; bez wywołania modelu, bez szkicu, bez sędziego.
- [ ] Bramki 1–4, sędzia, próg i dzienny sufit bez zmian dla wątków bez przejęcia.
- [ ] Odczyt `AgentToggle`: opisać w raporcie, co dziś robi przełącznik (O-18 usunęło rundy agenta) i czy wyłącza `autoSendReply`; bez zmian kodu przełącznika w tym zadaniu.

## Gotowe, gdy
- [ ] Test `autoSendReply`: zapytanie `new`, wątek z wysłaną ręczną wiadomością wychodzącą i wiadomością przychodzącą klienta → zdarzenie z powodem przejęcia, `draftReply` i `judgeReply` niewołane (asercja na mockach), brak wysyłki — **czerwony na kodzie z `main`** (tam model jest wołany), potem zielony.
- [ ] Test: wątek z wiadomością wychodzącą zapisaną tak, jak robi to import z FA-1.49 (ta sama kolumna `drafted_by`, `status='sent'`) → przejęcie rozpoznane.
- [ ] Test: wątek z samą wiadomością agenta (`drafted_by='agent'`) i wiadomością klienta → ścieżka jak dziś (agent prowadzi wątek).
- [ ] Test: pierwsze zapytanie z formularzem, pusty wątek → ścieżka jak dziś (pierwsza odpowiedź).
- [ ] Test integracyjny `email-inbound`: wiadomość klienta po ręcznej odpowiedzi zapisuje wiadomość i zdarzenie `message.received`, wywołuje `autoSendReply`, który zwraca decyzję „human has taken over”; D2 (`new → qualifying`) nietknięte.
- [ ] Istniejące testy zielone: `pnpm test -- auto-send draft-reply inquiries email-inbound`.
- [ ] Brak nowych `as any`, `eslint-disable`, `.from(` poza warstwą danych.
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone.

## Poza zakresem
- Zmiana statusu zapytania po ręcznej wiadomości (osobna decyzja o maszynie stanów).
- Zmiany w `AgentToggle` i usuwanie martwego mechanizmu (O-18, osobne zadanie, jeśli tj zdecyduje).
- Dzienny sufit, limity i honeypot (FA-1.41–1.43), prompt i próg sędziego (FA-1.44, FA-1.47).
- Auto-wysyłka na WhatsApp i Instagram (poza e-mailem).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
pnpm test -- auto-send inquiries email-inbound
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji
- 2026-10-05 tj: zadanie idzie po FA-1.49 — odpowiedzi wysyłane ze skrzynki Zoho muszą być w `messages`, inaczej agent ich nie widzi. Weryfikacja FA-1.48 testami nie obejmuje maili spoza aplikacji; pokrywa je dopiero FA-1.49.
- 2026-10-05 tj: dowód z prod — zapytanie 2640acd6-4fe6-47a1-a7a5-6d057208998d (NZ, 4 X): `message.received` 18:02 i 18:20 UTC, po każdym `agent.auto_send_decided` (sent=false, score 0,72 i 0,75); status zapytania nadal `new`. Sędzia w powodach cytuje wcześniejszą ręczną wiadomość tj z innymi cenami (1 600 / 1 500 NZD).
- Interpretacja do potwierdzenia przy odbiorze: „przejęcie” = pierwsza wysłana wiadomość człowieka w wątku. Alternatywy (np. zmiana statusu albo wyłączenie agenta przełącznikiem w panelu) wymagają osobnej decyzji tj.
