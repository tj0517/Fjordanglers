---
id: FA-1.49
title: Maile wychodzące wysłane ze skrzynki Zoho trafiają do wątku zapytania — kopia BCC na adres inbound, rozpoznana jako wiadomość wychodząca człowieka
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/import-outbound-zoho-mail
pr: 129
depends_on: [FA-1.40]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.49 — Import maili wychodzących z Zoho do wątku

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/01-architecture.md` — model `messages` (direction, channel, counterpart, thread_key, external_id), adaptery kanałów, `unmatched_messages`
- `src/app/api/webhooks/email-inbound/route.ts` — webhook Resend Inbound: dziś każda wiadomość to „przychodząca od `from`”; `matchInquiryByEmail(fromEmail)`; zapis do `messages` albo `unmatched_messages`; D2 i `autoSendReply` po zapisie
- `src/lib/inquiry-matcher.ts` — `matchInquiryByEmail` (dopasowanie po nadawcy)
- `src/lib/messages/send.ts` — jak zapisuje się wiadomość wychodząca z panelu (`drafted_by`, `status`, zdarzenie `message.sent`)
- `src/lib/events/emit.ts` — typy zdarzeń i aktorów
- `src/lib/env.ts` — `FA_EMAIL`, `FA_INBOUND_EMAIL` (`leads@…`), `RESEND_INBOUND_SECRET`
- `src/app/api/webhooks/__tests__/email-inbound-matched.test.ts`, `email-inbound-unmatched.test.ts`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
tj często odpisuje klientom bezpośrednio ze skrzynki Zoho (`hello@fjordanglers.com`), nie z panelu aplikacji. Takie maile nie trafiają do `messages`, więc wątek w panelu jest niepełny, a agent nie wie, że człowiek już odpowiedział (FA-1.48 opiera się na wiadomościach wychodzących w wątku). Po zadaniu każdy mail wysłany ze skrzynki Zoho z ustawioną kopią (BCC lub reguła) na adres inbound w Resend jest rozpoznawany jako wiadomość **wychodząca** człowieka, dopasowywany do zapytania po adresacie i zapisywany w wątku.

Decyzja tj (5 X 2026): droga A — kopia wychodzących z Zoho na adres inbound w Resend; historia wstecz poza zakresem.

## Zakres
- [ ] Odczyt bieżącego stanu: webhook, `matchInquiryByEmail`, `sendMessage`, typy zdarzeń na `main`; odtworzyć lokalnie (`RESEND_DEV_FAKE=1`), co dziś robi webhook z mailem, którego `from` to adres FA, a `to` to klient — wkleić wynik (spodziewane: wpis w `unmatched_messages` albo błędne dopasowanie po nadawcy).
- [ ] Rozpoznanie wychodzącej: `from` należy do zbioru adresów FA (nowa zmienna env z listą, domyślnie adres skrzynki FA i `FA_EMAIL`; porównanie bez wielkości liter, po samym adresie). Webhook rozgałęzia się przed dopasowaniem po nadawcy.
- [ ] Dopasowanie po adresacie: `to` (i `cc`, jeśli payload je ma) → zapytanie klienta po `angler_email`; osobno rozpoznanie adresata-guide'a, jeśli istnieje analogiczne dopasowanie w kodzie (counterpart `guide`), w przeciwnym razie tylko `angler`.
- [ ] Zapis: wiersz `messages` — `direction='outbound'`, `channel='email'`, `status='sent'`, `drafted_by` taki jak przy ręcznej wiadomości człowieka z panelu (ustalić odczytem `sendMessage`/admin), `external_id` z identyfikatora wiadomości, `occurred_at` z nagłówka daty maila, jeśli payload go ma, w przeciwnym razie czas odbioru; zdarzenie `message.sent` z aktorem człowiek i źródłem `webhook`.
- [ ] Deduplikacja: powtórne dostarczenie tego samego maila (retry webhooka) nie tworzy drugiego wiersza.
- [ ] Wychodząca **nie** uruchamia `autoSendReply`, przejścia D2 ani aktualizacji `last_contact_at` jako kontaktu klienta (pole opisuje kontakt od klienta — potwierdzić odczytem użycia pola).
- [ ] Wychodząca bez dopasowanego zapytania: nie trafia do `unmatched_messages`; log `[email-inbound] outbound without matching inquiry` i koniec (maile do księgowej itp. nie są wątkami zapytań). Interpretacja do potwierdzenia przy odbiorze.
- [ ] Krótka instrukcja dla tj w `docs/` (jedna strona): jak ustawić w Zoho regułę kopiującą wychodzące na adres inbound i jak sprawdzić, że zadziałało. Kroków w Zoho agent nie wykonuje.

## Gotowe, gdy
- [ ] Test webhooka: payload z `from` = adres FA i `to` = `angler_email` istniejącego zapytania → wiersz `messages` outbound/sent, zdarzenie `message.sent`, brak wywołania `autoSendReply` i D2 — **czerwony na kodzie z `main`** (tam trafia do `unmatched_messages` lub dopasowuje po nadawcy), potem zielony.
- [ ] Test: ten sam payload dostarczony dwa razy → jeden wiersz `messages`.
- [ ] Test: `from` = adres FA, `to` = adres bez zapytania → brak wiersza w `messages` i `unmatched_messages`, log.
- [ ] Test: zwykły mail klienta (`from` = klient) działa jak dziś — istniejące testy `email-inbound-matched` i `email-inbound-unmatched` zielone bez zmian.
- [ ] Wiadomość z tego importu liczy się jako „ręczna wiadomość człowieka” dla `FA-1.48`: pokazane odczytem wartości `drafted_by` względem funkcji `hasHumanOutbound`/odpowiednika, jeśli już istnieje na `main`, w przeciwnym razie opisane w notatkach.
- [ ] Lokalnie z `RESEND_DEV_FAKE=1`: wysłać do webhooka payload outbound i pokazać `SELECT` z `messages` i `inquiry_events` (wynik w raporcie).
- [ ] Brak nowych `as any`, `eslint-disable`, `.from(` poza warstwą danych.
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone.

## Poza zakresem
- Import historii (folder „Wysłane”, `whatsapp-bridge/import-emails.mjs`, `poll-emails.mjs`) i droga B/C (IMAP, API Zoho).
- Konfiguracja reguły w Zoho i zmiana env na Vercelu — robi tj.
- Dopasowanie wątku po `In-Reply-To`/`References` zamiast po adresie (osobne zadanie, jeśli wątki się pomylą).
- Zmiana zachowania auto-wysyłki po przejęciu — to FA-1.48.
- Import wiadomości WhatsApp i Instagram.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zmiana env w Vercelu (nowa zmienna z listą adresów FA) — STOP, wykonuje tj; w kodzie wartość domyślna działa bez niej.
- Jakikolwiek zapis na produkcji — STOP.

## Weryfikacja
```
pnpm test -- email-inbound inquiry-matcher auto-send
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji
- 2026-10-05 tj: odpowiada klientom bezpośrednio z Zoho Mail; te maile nie są w `messages`, więc agent (FA-1.48) nie wie o przejęciu wątku. Wybrana droga A (kopia na adres inbound w Resend). Dowód stanu: audyt `docs/audit/rebuild-audit-app-aug-2026.md` §4.5 — druga ścieżka mailowa to poller Zoho IMAP z `whatsapp-bridge`, piszący do starych tabel; nie jest reużywany.
- Nie wiadomo (do ustalenia przez tj, nie przez agenta): czy plan Zoho pozwala na regułę kopii wychodzących i jak dziś maile klientów docierają do Resend inbound (przekierowanie czy MX).
- 2026-10-05 decyzja tj (D3 potwierdzona): wychodząca wiadomość bez dopasowanego zapytania → cichy drop. `unmatched_messages` nie jest zapisywany. Maile do zewnętrznych kontaktów (księgowa, dostawcy) nie są wątkami zapytań i nie powinny tworzyć wierszy.
- 2026-10-08 tj: przyjęte; PR #129 zmergowany (b55d9d23) przed zmianą statusu — domknięte na gałęzi FA-1.51 (rozjazd statusu).
