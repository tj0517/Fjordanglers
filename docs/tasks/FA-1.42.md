---
id: FA-1.42
title: Kontrola kosztów auto-odpowiedzi — powtórki z tego samego e-maila nie uruchamiają AI ani maili do klienta; dzienny sufit auto-wysyłek
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/auto-reply-cost-guards
depends_on: [FA-1.40]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.42 — Kontrola kosztów i spamu przy auto-odpowiedzi

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md` — reguły i konwencje
- `docs/04-open-questions.md` — O-28 (powtórki) i O-30 (dzienny sufit = 5), oba rozstrzygnięte
- `docs/tasks/FA-1.40.md`, `docs/tasks/FA-1.27.md` — pipeline `autoSendReply`, bramki 1–4, sędzia ≥ 0.9
- `src/app/api/inquiries/route.ts` — kolejność: zapis, maile, `classifyInquiry`, `autoSendReply`
- `src/lib/ai/auto-send.ts` — `emitDecision`, wynik `AutoSendResult`
- `src/lib/supabase/queries.ts` — warstwa danych; zapytania o poprzednie zapytania i zdarzenia tylko tu
- `src/lib/events/emit.ts` — katalog typów zdarzeń
- `docs/02-data-model.md` — kolumny `inquiries` i `inquiry_events`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Adres e-mail wpisany w publicznym formularzu może należeć do kogoś innego, a każda wysyłka to koszt i ryzyko dla reputacji nadawcy. Po zadaniu: (1) zapytanie z tego samego e-maila w ciągu 24 godzin od poprzedniego jest **zawsze zapisane** (nie tracimy leadów), ale nie uruchamia klasyfikacji AI, auto-odpowiedzi ani maili skierowanych do klienta; powiadomienie dla FA zostaje; (2) dzienny sufit liczby auto-wysyłek: po jego osiągnięciu szkic zostaje zapisany do ręcznej oceny w panelu, zamiast wyjść. Każde pominięcie zostawia zdarzenie z powodem. Decyzje tj z 2 X 2026 (O-28 b).

## Zakres
- [ ] Odczyt bieżącego stanu: kolejność wywołań w trasie, `emitDecision`, katalog zdarzeń; sprawdź, czy istnieje już zapytanie po e-mailu i czy potrzeba indeksu (EXPLAIN na lokalnej bazie).
- [ ] Funkcja w warstwie danych: czy ten e-mail (po `trim` i `toLowerCase`) ma wcześniejsze zapytanie z ostatnich 24 h, z wyłączeniem bieżącego.
- [ ] W trasie: dla powtórki pomiń `classifyInquiry`, `autoSendReply` i mail potwierdzający do klienta; mail do FA zostaje; zapis zapytania bez zmian; zdarzenie z powodem „repeat submission from same e-mail within 24 h”.
- [ ] Dzienny sufit w `autoSendReply`: liczba zdarzeń `agent.auto_send_decided` z `sent=true` z ostatnich 24 h ≥ sufit → szkic zapisany, bez wysyłki, zdarzenie `sent=false` z powodem „daily auto-send cap reached”. Wartość z `AI_AUTO_SEND_DAILY_CAP` (env, deklaracja w `env.ts`), domyślnie 5 (O-30).
- [ ] Okno i sufit w jednym miejscu jako stałe/konfiguracja, nie rozsiane po kodzie.
- [ ] STOP — jeśli potrzebny jest indeks lub migracja, pokaż uzasadnienie (EXPLAIN) i czekaj na akceptację przed napisaniem migracji.
- [ ] STOP — nie ustawiasz zmiennych w Vercelu; dopisz tylko deklarację i `.env.example`.

## Gotowe, gdy
- [ ] Test trasy: drugie zapytanie z tego samego e-maila w oknie → `createInquiry` wywołane, `classifyInquiry`, `autoSendReply` i mail potwierdzający do klienta niewywołane, mail do FA wysłany, zdarzenie z powodem zapisane. **Czerwony na kodzie z `main`** (tam wszystkie wywołane), potem zielony. Sprawdzenie: `pnpm exec vitest run src/app/api/inquiries src/lib/ai/auto-send`.
- [ ] Test: inny e-mail albo zapytanie poza oknem → zachowanie bez zmian; istniejące testy trasy i bramek zielone.
- [ ] Test sufitu: przy osiągniętym suficie szkic zapisany, `sendMessage` niewywołane, zdarzenie z powodem; poniżej sufitu wysyłka jak dziś. Czerwony na `main`, potem zielony.
- [ ] Pominięcie powtórki i wstrzymanie przez sufit zostawiają zdarzenie (mutacja bez zdarzenia jest błędem) — asercja na `emittedEvents`.
- [ ] `git diff main...HEAD --stat -- src/lib/ai/judge-reply.ts` puste; bramki 1–4 i próg sędziego bez zmian.
- [ ] `pnpm typecheck && pnpm lint && pnpm exec vitest run && pnpm knip` zielone; brak nowych `as any`, `eslint-disable`, `.from(` poza warstwą danych.

## Poza zakresem
- Limit żądań per IP / per e-mail na trasie → FA-1.41.
- Honeypot i czas wypełnienia → FA-1.43 (używa mechanizmu pominięcia z tego zadania).
- Zmiana wejścia sędziego, progu lub `judge-reply.ts` → osobne zadanie z bramką STOP.
- Panel z listą wstrzymanych / powtórek, filtry w `/admin` → osobne zadanie, jeśli tj zdecyduje.
- Zmiana `AI_AUTO_REPLY_ENABLED` → robi tj (FA-1.45).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Migracja lub indeks na prod — pokaż uzasadnienie i czekaj.
- Ustawienia w Vercelu — robi tj.
- Merge do `main` = deploy na prod; PR z `--base main`.

## Weryfikacja
```
pnpm exec vitest run src/app/api/inquiries src/lib/ai/auto-send
pnpm typecheck && pnpm lint && pnpm knip
git diff main...HEAD --stat -- src/lib/ai/judge-reply.ts   # puste
```

## Notatki z realizacji
- 2026-10-02 tj: O-28 → b: zapytanie zapisane zawsze; powtórki pomijają AI i maile do klienta.
- 2026-10-02 tj: O-30 → dzienny sufit 5 auto-wysyłek „na razie”; zmieniany przez `AI_AUTO_SEND_DAILY_CAP` bez zmiany kodu. Szósta i kolejne odpowiedzi danego dnia czekają jako szkice na ręczną ocenę.
- Gorąca ścieżka: `inquiries`, wysyłka maili, `autoSendReply` — przy review ocenić skutki dla ścieżki zapytanie → oferta → depozyt.
