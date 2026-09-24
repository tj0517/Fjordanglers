---
id: FA-1.27
title: Hybrydowa auto-wysyłka do klienta — sędzia ≥ 0.9 i stany „nigdy auto”; reszta zostaje draftem
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/agent-auto-send
depends_on: [FA-1.23, FA-1.25]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 8
owner: tj
---

# FA-1.27 — Hybrydowa auto-wysyłka do klienta

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/01-architecture.md` §3–4 — statusy, `transition()`, zdarzenia
- `src/lib/ai/draft-reply.ts`, `src/lib/ai/draft-reply-prompt.ts` (po FA-1.23: instrukcje z bazy)
- `src/actions/messages.ts` — `sendMessageFromThread` (dziś tylko z sesją admina)
- `src/app/api/inquiries/route.ts`, `src/app/api/webhooks/email-inbound/route.ts` — miejsca wyzwolenia (po FA-1.25 bez rund)
- `src/lib/env.ts` — `AI_AUTO_REPLY_ENABLED`
- `docs/tasks/FA-1.17.md` — treść instrukcji, na której auto działa

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Decyzja tj 22 IX: agent odpisuje klientowi sam tylko wtedy, gdy jest prawie pewne, że
draft jest dobry; w każdym innym przypadku zostaje draft do „Wyślij”. Po zadaniu nowe
zapytanie i mail klienta uruchamiają draft, osobne wywołanie modelu („sędzia”) ocenia go
i podaje powód, a kod wysyła mailem tylko przy ocenie ≥ 0.9 i gdy nie zachodzi żaden stan
„nigdy auto”. Każda decyzja (wysłane / nie i dlaczego) jest w historii zdarzeń.

## Decyzje tj (22 IX)
- D1 Ocena: osobne wywołanie „sędzia” (wątek + draft + reguły → `score`, `reasons`), nie autor draftu.
- D2 Status: auto-odpowiedź na nowe zapytanie **nie zmienia** statusu (`new` zostaje); gdy klient odpisze na zapytanie, które dostało auto-odpowiedź, status przechodzi `new → qualifying` przez `transition()` z aktorem `agent`. (SLA 48 h liczy brak oferty, nie status — cron `offer-sla` bez zmian.)
- D3 Kanał: tylko e-mail.
- D4 Włączenie: `AI_AUTO_REPLY_ENABLED=true` od razu po wdrożeniu (bez trybu na sucho) — przestawia tj w Vercelu.
- D5 Próg: 0.9.
- **Auto tylko gdy wszystko naraz:** adresat = klient; status `new` lub `qualifying`; kanał e-mail; jest aktywny wpis `destination` dla kraju zapytania; sędzia ≥ 0.9.
- **Nigdy auto (decyzja sędziego → `reasons`):** skarga, porównanie z konkurencją, prośba o kontakt do przewodnika, „coś poszło nie tak”; pytanie klienta, na które odpowiedź nie wynika wprost z wpisów wiedzy; wiadomość niejasna lub niepasująca do żadnego etapu; draft łamiący reguły z wpisu `instructions` (np. pytanie o liczbę osób).
- Brak wpisu kraju: nigdy auto i agent nigdy nie pisze klientowi, że „nie mamy tego kraju” (incydent z NZ).

## Zakres
- [ ] Odczyt stanu: `draftReply`, `sendMessageFromThread`, oba miejsca wyzwolenia po FA-1.25, `transition()`.
- [ ] Ścieżka wysyłki bez sesji admina (serwerowa, aktor `agent`), współdzieląca logikę z `sendMessageFromThread` — bez kopiowania wysyłki.
- [ ] Bramka: twarde warunki w kodzie (adresat, status, kanał, wpis kraju) przed wywołaniem sędziego; sędzia tylko gdy twarde przejdą.
- [ ] Sędzia: prompt z regułami „nigdy auto” + zwrot `{ score, send, reasons }`; próg 0.9 jako stała.
- [ ] Wyzwolenie: nowe zapytanie (`/api/inquiries`) i mail klienta (`email-inbound`), tylko przy `AI_AUTO_REPLY_ENABLED`.
- [ ] Zdarzenie decyzji: `agent.auto_send_decided` z `{ sent, score, reasons, draft_message_id }`; przy wysyłce także zwykłe `message.sent` z aktorem `agent`.
- [ ] D2: przejście `new → qualifying` przy mailu klienta po auto-odpowiedzi.
- [ ] Testy (niżej).

## Gotowe, gdy
- [ ] Test bramki: każdy stan „nigdy auto” osobno (adresat przewodnik, status `waiting_guide`, kanał WhatsApp, brak wpisu kraju, sędzia 0.89, sędzia `send=false` ze skargą) → 0 wysyłek, draft zapisany, zdarzenie `agent.auto_send_decided` z `sent=false` i powodem — **pokazany na czerwono** (tymczasowo usunięty warunek wpisu kraju → test pada).
- [ ] Test: nowe zapytanie NZ, wpisy aktywne, sędzia 0.93 (mock) → jedna wysyłka przez fake Resend, wiersz `messages` wysłany z `drafted_by='agent'`, zdarzenia `message.sent` (aktor `agent`) i `agent.auto_send_decided` (`sent=true`, score); status dalej `new`.
- [ ] Test D2: mail klienta do zapytania `new` z auto-odpowiedzią → `status.changed` `new → qualifying` z aktorem `agent`; zapytanie `new` bez auto-odpowiedzi → status bez zmian.
- [ ] Test: flaga wyłączona → 0 wywołań modelu w obu miejscach wyzwolenia.
- [ ] Lokalnie z `RESEND_DEV_FAKE=1`: nowe zapytanie z krajem z wpisem → SELECT `messages` + `inquiry_events` pokazuje wysyłkę i decyzję; zapytanie z krajem bez wpisu → tylko draft + powód (wyniki w raporcie).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone (build przy zatrzymanym stacku); `pnpm knip` czysty.

## Poza zakresem
- WhatsApp i Instagram → po FA-1.13.
- Auto do przewodników — nigdy (decyzja tj).
- Tryb na sucho / próg w panelu — odrzucone 22 IX; wrócić, jeśli ocena po wdrożeniu pokaże złe auto-wysyłki.
- Treść instrukcji i wpisów → FA-1.17.
- Temat maila (`buildDraftSubject`) → deferred.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Ustawienie `AI_AUTO_REPLY_ENABLED` w Vercelu (każde środowisko) — STOP, robi tj.
- Zapis na produkcji, nowa migracja — STOP (zadanie jej nie potrzebuje: `inquiry_events.type` to wolny tekst, aktor `agent` już dozwolony).
- Demo i testy tylko z flagami fake (`RESEND_DEV_FAKE=1`); żaden mail do prawdziwego adresu.
- Jeśli wydzielenie wysyłki z `sendMessageFromThread` wymaga zmiany jej zachowania dla admina — STOP i pytanie.

## Weryfikacja
```
pnpm test -- auto-send draft-reply email-inbound inquiries
pnpm typecheck && pnpm lint && pnpm knip
```

## Notatki z realizacji
- 2026-09-22 tj: zadanie dopisane (/wf-plan); decyzje D1–D5 wyżej.
