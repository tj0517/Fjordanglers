---
id: FA-1.40
title: Auto-wysyłka odpowiada na pierwsze zapytanie z formularza — draft z treści formularza, sędzia widzi formularz, porażka zostawia ślad
stage: 1
status: done
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/auto-send-form-first-reply
pr: 120
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 3
owner: tj
---

# FA-1.40 — Auto-wysyłka dla pierwszego zapytania z formularza

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.34.md` — dlaczego `draftReply` ma `allowFormOnly` i czemu auto-wysyłki wtedy nie ruszono
- `docs/tasks/FA-1.27.md` — bramki auto-wysyłki, sędzia ≥ 0.9, stany „nigdy auto”
- `src/lib/ai/auto-send.ts` — wywołanie `draftReply` (~linia 93), budowa rozmowy dla sędziego (~linia 115)
- `src/lib/ai/draft-reply.ts` — `allowFormOnly`, błąd „thread is empty”
- `src/lib/supabase/queries.ts` — `getConversationForJudge` (czyta tylko `messages`)
- `src/lib/ai/judge-reply.ts` — `judgeReply(conversation, draftText)`
- `src/app/api/inquiries/route.ts` — wywołanie `autoSendReply` po zapytaniu z formularza

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Zapytanie z formularza trzyma treść klienta w `inquiries.message`, a wątek `messages` jest pusty.
FA-1.34 nauczyło „Zaproponuj” pisać z samego formularza, ale `autoSendReply` woła `draftReply`
bez tej zgody: kończy z `[autoSendReply] draftReply failed: … thread is empty`, zwraca `null`,
nie zostawia szkicu ani zdarzenia, i klient nie dostaje żadnej odpowiedzi. Po zadaniu pierwsze
zapytanie z formularza przechodzi pełną ścieżkę auto-wysyłki (szkic → bramki → sędzia → wysyłka
przy ≥ 0.9), a sędzia ocenia szkic na tle treści formularza. Decyzja tj (D1, 1 X 2026): auto-wysyłka,
nie sam szkic.

## Zakres
- [ ] Odczyt stanu bieżącego: odtworzyć błąd lokalnie (zapytanie z `message`, pusty wątek, flaga włączona, `RESEND_DEV_FAKE=1`) i wkleić log `[autoSendReply] draftReply failed`.
- [ ] `autoSendReply` woła `draftReply` z `allowFormOnly: true` (tylko dla `counterpart: 'angler'`).
- [ ] Rozmowa dla sędziego: gdy wątek jest pusty, a zapytanie ma `message`, treść formularza trafia do sędziego jako pierwsza wiadomość klienta (`[ANGLER]`). Niepusty wątek zostaje jak dziś.
- [ ] Brak wątku i brak `message`: zdarzenie `agent.auto_send_decided` z `sent=false`, `score=null`, `draft_message_id=null` i powodem, zamiast cichego `null` (aktualizacja komentarza o zwrotach funkcji). Inne `DraftReplyError` (np. brak aktywnego wpisu `instructions`) zostają jak w FA-1.27: log, `null`, bez zdarzenia (decyzja tj, 2 X 2026).
- [ ] Brak zmian w bramkach 1–4 i w progu sędziego.

## Gotowe, gdy
- [ ] Test `autoSendReply`: zapytanie `new` z `message`, pusty wątek, wpisy aktywne, sędzia 0.93 (mock) → szkic zapisany, jedna wysyłka przez fake Resend, `messages` z `drafted_by='agent'`, zdarzenie `agent.auto_send_decided` z `sent=true` — **pokazany na czerwono na kodzie z `main`** (ten sam test pada z „thread is empty”), potem zielony.
- [ ] Test: argument `judgeReply` zawiera treść formularza (asercja na `conversation`); przy niepustym wątku argument jest taki jak przed zmianą.
- [ ] Test: brak wątku i brak `message` → zdarzenie z powodem i brak wysyłki (nie wyjątek, nie ciche `null`) — czerwony, potem zielony.
- [ ] Istniejące testy bramek `auto-send` zielone bez zmian: `pnpm exec vitest run auto-send draft-reply inquiries email-inbound`.
- [ ] Brak aktywnego wpisu `instructions` → nadal `null` i brak zdarzenia (pokryte istniejącym testem).
- [ ] Lokalnie z `RESEND_DEV_FAKE=1`: nowe zapytanie z formularza → `SELECT` z `messages` i `inquiry_events` pokazuje wysyłkę lub szkic i decyzję z powodem (wynik w raporcie).
- [ ] `git diff main...HEAD --stat -- src/lib/ai/judge-reply.ts` puste; brak nowych `as any`, `eslint-disable` i `.from(` poza warstwą danych (`getConversationForJudge` zostaje w `queries.ts`).
- [ ] `pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm knip` zielone.

## Poza zakresem
- Zapis formularza jako wiadomości w wątku przy tworzeniu zapytania → osobne zadanie, jeśli tj zdecyduje (D2: odrzucone na teraz).
- Dołożenie treści formularza do rozmowy sędziego przy niepustym wątku → deferred.
- Zmiana nazwy `AI_AUTO_REPLY_ENABLED` → wiersz FA-1.25 w `docs/deferred-tasks.md`.
- Treść instrukcji i wpisów wiedzy → panel, robi tj.
- Auto-wysyłka po statusie `qualifying` dla przewodników, WhatsApp, Instagram → bez zmian (FA-1.27).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Ustawienie `AI_AUTO_REPLY_ENABLED` w Vercelu (każde środowisko) — STOP, robi tj.
- Jakikolwiek mail do prawdziwego adresu (także własnego) — STOP; demo i testy tylko z `RESEND_DEV_FAKE=1`. Pierwsza prawdziwa wysyłka ≥ 0.9 z prawdziwym sędzią idzie na adres tj, przed włączeniem na prod (notatka z odbioru FA-1.27).
- Jeśli zmiana sędziego wymaga edycji `judge-reply.ts` lub progu — STOP i pytanie.
- Merge do `main` = deploy na prod; PR otwarty z `--base main`.

## Weryfikacja
```
pnpm exec vitest run auto-send draft-reply inquiries email-inbound
pnpm typecheck && pnpm lint && pnpm knip
git diff main...HEAD --stat -- src/lib/ai/judge-reply.ts   # puste
```

## Notatki z realizacji
- 2026-10-01 tj: zadanie dopisane (/wf-plan fa „fixing this”). D1: auto-wysyłka pierwszej odpowiedzi na formularz (nie sam szkic). D2: treść formularza czytana z `inquiries.message`, bez zapisu do wątku.
- 2026-10-01: log z produkcji — `[autoSendReply] draftReply failed: Cannot draft a reply: the conversation thread is empty.` Przyczyna: FA-1.34 dało `allowFormOnly` tylko przyciskowi „Zaproponuj”.
- 2026-10-02 tj: zdarzenie zamiast cichego `null` **tylko** przy braku wątku i braku `message`. Inne `DraftReplyError` (m.in. brak aktywnego wpisu `instructions`) zostają jak w FA-1.27: log, `null`, bez zdarzenia. Rozróżnienie zrobione prostym warunkiem w `autoSendReply` (wątek pusty + pusty `message`), bez zmian w `draft-reply.ts` poza komentarzem.
- 2026-10-02: wątek dla sędziego jest teraz czytany przed szkicem (te same wiersze co po — szkice są wykluczone), żeby warunek „brak wątku i brak message" zapadł przed wywołaniem modelu. `getInquiryForAutoSend` dostał kolumnę `message` (zostaje w `queries.ts`).
- 2026-10-02 tj: accepted, PR #120. Proven in code review: allowFormOnly pass-through, judge conversation from form text, event on no thread + no message, FA-1.27 behavior kept for other DraftReplyErrors, judge-reply.ts untouched. Open item (deferred, not blocking): judge scored exactly 0.90 on the first real run — evaluate on real inquiries before AI_AUTO_REPLY_ENABLED goes on in prod.
