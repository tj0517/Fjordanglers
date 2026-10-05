---
id: FA-1.46
title: Auto-wysyłka odpowiada na zapytanie z formularza bez tekstu klienta — wejściem są dane formularza (wyprawa, daty, liczba osób), sędzia widzi ten sam blok
stage: 1
status: done
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/auto-send-form-without-message
pr: 126
depends_on: [FA-1.40]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 3
owner: tj
---

# FA-1.46 — Auto-wysyłka: formularz bez tekstu klienta

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.40.md` — co auto-wysyłka robi dziś z formularzem i czemu zdarzenie „no message thread and no form message to answer”
- `docs/tasks/FA-1.34.md` — flaga `allowFormOnly` w `draftReply`
- `docs/tasks/FA-1.27.md` — bramki auto-wysyłki, sędzia ≥ 0.9, stany „nigdy auto”
- `src/lib/ai/auto-send.ts` — warunek `msgs.length === 0 && formText === ''` i budowa `conversationText` dla sędziego
- `src/lib/ai/draft-reply.ts` — bramka `allowFormOnly` (sprawdza tylko `inquiry.message`)
- `src/lib/ai/extract-trip.ts` → `assembleConversation` — już składa blok „ORIGINAL INQUIRY” (wyprawa, daty, liczba osób, message jeśli jest)
- `src/lib/ai/judge-reply.ts` — reguły „never auto”, w tym „wiadomość niejasna”
- `src/app/api/inquiries/route.ts` — `message` jest w schemacie opcjonalne

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Formularz pozwala wysłać zapytanie bez pola „message”. Po FA-1.40 auto-wysyłka widzi wtedy „nic do odpowiedzenia”: zapytanie 5b5c0418 (Islandia, `web_form`, 4 X 2026 02:22 UTC) skończyło zdarzeniem `agent.auto_send_decided` z `sent=false`, `draft_message_id=null`, powód „no message thread and no form message to answer”. Klient dostał tylko automatyczne potwierdzenie. Po zadaniu zapytanie bez `message`, ale z wyprawą, datami i liczbą osób przechodzi pełną ścieżkę (szkic → bramki 1–4 → sędzia → wysyłka przy ≥ 0.9 albo szkic do admina), a sędzia ocenia szkic na tle danych formularza.

Decyzja tj (4 X 2026): opcja A — pisać z danych formularza. Wymuszenie pola „message” (B) poza zakresem.

## Zakres
- [ ] Odczyt bieżącego stanu: otworzyć `auto-send.ts` i `draft-reply.ts` na `main`, odtworzyć lokalnie zapytanie z pustym `message` (flaga włączona, `RESEND_DEV_FAKE=1`) i wkleić zdarzenie z powodem.
- [ ] `autoSendReply`: pusty wątek + pusty `message` przestaje kończyć się zdarzeniem „nothing to answer”, jeśli zapytanie ma wyprawę (`trip_id` lub `experience_page_id`). Zdarzenie zostaje tylko dla zapytania bez żadnej z tych danych.
- [ ] `draftReply` z `allowFormOnly`: bramka akceptuje dane formularza (wyprawa, daty, liczba osób), nie tylko `inquiry.message`; komunikat błędu aktualny.
- [ ] Rozmowa dla sędziego przy pustym wątku i pustym `message`: wejście zgodne z D1: blok z `assembleConversation` jako `[ANGLER]`.
- [ ] Bramki 1–4, próg sędziego i prompt sędziego bez zmian.

## Decyzje tj
- **D1 (4 X 2026): a.** Gdy klient nie napisał tekstu, sędzia dostaje blok z `assembleConversation` (wyprawa, daty, liczba osób) jako pierwszą wiadomość `[ANGLER]` — te same fakty, z których powstaje szkic. Konsekwencja przyjęta przez tj: reguła sędziego „wiadomość niejasna” może często obniżać wynik; część szkiców zostaje do ręcznego przejrzenia w adminie.

## Gotowe, gdy
- [ ] Test `autoSendReply`: zapytanie `new`, `message=null`, pusty wątek, `trip_id` ustawione, wpisy wiedzy aktywne, sędzia 0.93 (mock) → szkic zapisany, jedna wysyłka przez fake Resend, `messages.drafted_by='agent'`, `agent.auto_send_decided` z `sent=true` — **pokazany na czerwono na kodzie z `main`** (ten sam test pada z powodem „no message thread and no form message to answer”), potem zielony.
- [ ] Test: argument `judgeReply` przy pustym `message` zawiera blok wyprawa/daty/liczba osób (asercja na `conversation`); przy niepustym wątku i przy niepustym `message` argument identyczny jak przed zmianą.
- [ ] Test: zapytanie bez wątku, bez `message` i bez wyprawy → zdarzenie z powodem, brak wysyłki (czerwony, potem zielony).
- [ ] Istniejące testy auto-send i draft-reply zielone bez zmian: `pnpm test -- auto-send draft-reply inquiries email-inbound`.
- [ ] `git diff main...HEAD --stat -- src/lib/ai/judge-reply.ts` puste (prompt i próg bez zmian).
- [ ] Lokalnie z `RESEND_DEV_FAKE=1`: zapytanie z formularza bez `message` → wynik `SELECT` z `messages` i `inquiry_events` w raporcie.
- [ ] Brak nowych `as any`, `eslint-disable`, `.from(` poza warstwą danych.
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone.

## Poza zakresem
- Wymuszenie pola „message” w formularzu i w `POST /api/inquiries` (opcja B) → osobne zadanie, jeśli tj zdecyduje.
- Zapis formularza jako wiadomości w wątku przy tworzeniu zapytania (FA-1.40 D2, odrzucone).
- Zmiany promptu sędziego i progu — to FA-1.44.
- Włączanie/wyłączanie flagi `AI_AUTO_REPLY_ENABLED` na prod — to FA-1.45.
- Uzupełnianie wpisów wiedzy (np. brak wpisu `destination` dla kraju) — robi tj w panelu.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
pnpm test -- auto-send draft-reply inquiries email-inbound
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
git diff main...HEAD --stat -- src/lib/ai/judge-reply.ts   # puste
```

## Notatki z realizacji
- 2026-10-04 tj: dowód z prod — zapytanie 5b5c0418-dca7-4369-aa63-eb86be4a4d0e: `inquiry.created` 02:22:06, `agent.auto_send_decided` 02:22:08 (`sent=false`, `score=null`, powód „no message thread and no form message to answer”). Wybór A (pisać z danych formularza), D1 = a.
- 2026-10-05 tj: trzecie kryterium „Gotowe, gdy” (brak wątku, `message`, wyprawy) jest zielone już na `main`, więc czerwień pokazujemy na celowo zepsutej bramce: tymczasowo usunąć nowy warunek wyprawy, wkleić porażkę testu, przywrócić, wkleić zielony. Tymczasowa zmiana nigdy nie trafia do commita.
- 2026-10-05 tj: bramka `draftReply` z `allowFormOnly` używa warunku „zapytanie ma wyprawę” (`trip_id` lub `experience_page_id`) — tego samego co `autoSendReply`. „Dowolne z wyprawa/daty/liczba osób” odrzucone: liczba osób zawsze ma wartość, więc bramka nigdy by nie odrzuciła.
- 2026-10-05 tj: lokalny dowód end-to-end opcją D — bez czytania `.env.local`; serwer dev startuje z jawnymi lokalnymi zmiennymi w środowisku procesu (mają pierwszeństwo przed `.env.local`): URL i klucze Supabase z `supabase status` (127.0.0.1), `RESEND_DEV_FAKE=1`, `AI_AUTO_REPLY_ENABLED` włączone. Przed pierwszym żądaniem log startu z adresem bazy (inny niż 127.0.0.1/localhost = stop); lista zmiennych nadal pochodzących z `.env.local` na ścieżce żądania (same nazwy) — jeśli któraś sięga prawdziwej usługi poza modelem, stop. Wynik sędziego poniżej 0.9 bez wysyłki to poprawny wynik, bez strojenia. `.fa-proofs/` nie jest commitowany.
- 2026-10-05 tj: Upstash opcja A — na czas lokalnego dowodu `UPSTASH_REDIS_REST_URL` i `UPSTASH_REDIS_REST_TOKEN` ustawione na puste w wierszu poleceń serwera dev, więc `getRateLimiter()` zwraca `null` (brak limitera). Limit FA-1.41 nie jest w tym przebiegu sprawdzany; strażnicy FA-1.42/1.43 działają na lokalnej bazie. Lokalna baza nie ma wiersza w `experience_pages` (seed.sql go nie tworzy) — jednorazowy wiersz Islandii wstawiony zwykłym lokalnym `INSERT`, bez migracji i bez zmian w seed.sql.
- 2026-10-05 tj: przyjęte (PR #126). Udowodnione: czerwone testy na main (wysyłka, argument sędziego, bramka draftReply), czerwień „bez wyprawy” na celowo zepsutej bramce, judge-reply.ts bez zmian, brak nowych as any / eslint-disable / .from(; lokalny przebieg dał szkic 0.85 bez wysyłki (ścieżka wysyłki ≥ 0.9 tylko testem z mockiem). Poza zakresem zostają: Resend fake w src/lib/email.ts (deferred), ocena 0.85 (pomiar w FA-1.44).
