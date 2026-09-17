---
id: FA-1.12
title: messages — jeden wątek na zapytanie; e-mail w obie strony z karty; oznaczanie oferta/akceptacja/wpłata; link Stripe z aplikacji
stage: 1
status: in_progress
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/messages-thread
depends_on: [FA-1.03]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 14
owner: tj
---

# FA-1.12 — Wątek wiadomości na karcie zapytania

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/01-architecture.md` §3a (messages), §3b (offers, wiele opcji), §4 (statusy, „wysyłka może zaproponować przejście")
- `docs/REBUILD_PLAN.md` załącznik C — które zdarzenia powstają z wątku i jak
- `docs/02-data-model.md` — `messages` docelowo, mapowanie `lead_messages → messages`
- `src/lib/events/*`, `src/lib/inquiries/state.ts` — z FA-1.03
- `src/actions/messages.ts`, `src/app/admin/inquiries/[id]/LeadCommsLogger.tsx`, `ConversationImporter.tsx` — dzisiejszy ręczny logger i importer (do zastąpienia)
- `src/app/api/webhooks/email-inbound/route.ts` — odbiór maili
- `src/actions/inquiries.ts` → `sendMessageToAngler`, `sendOfferEmail`, `sendDepositLink` — dzisiejsza wysyłka
- `supabase/migrations/20260904165037_baseline_prod.sql` — `lead_messages`, `inquiry_messages`, `unmatched_messages`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Karta zapytania ma jeden wątek: wszystkie wiadomości od i do klienta oraz od i do
przewodnika, w kolejności, z kanałem. Admin pisze i wysyła z tego wątku (w tym zadaniu:
e-mail), a oznaczając wiadomość jako „oferta od przewodnika", „przedstawia ofertę",
„klient akceptuje", „link do płatności" tworzy zdarzenia i proponuje przejście statusu.
Ręczny logger i importer znikają — nie ma kroku „dopisz potem".

## Zakres
- [ ] Odczyt stanu (do raportu): liczności `lead_messages`, `inquiry_messages`, `unmatched_messages`; rozkład `channel`/`direction`/`contact_type`; ile `inquiry_messages` ma `sent_at NULL`.
- [ ] Migracja `add_offers`: `offers` + `offer_options` wg §3b, RLS jak `inquiries`. Kolumny `offer_*` na `inquiries` zostają nietknięte (drop — etap 4).
- [ ] Migracja `add_messages`: tabela wg §3a, `external_id UNIQUE`, indeks `(inquiry_id, occurred_at)`, RLS jak `inquiries`; FK `inquiry_events.message_id → messages.id`.
- [ ] Migracja danych: `lead_messages` → `messages` (channel, direction, counterpart z `contact_type`), `inquiry_messages` → `messages` (email, outbound, angler, `sent_at` → `occurred_at`); potem `DROP` obu tabel. Idempotentna, z licznikami w `RAISE NOTICE`.
- [ ] `src/lib/channels/types.ts` — interfejs adaptera (`send`, `parseInbound`, `canSendFreeform`); `src/lib/channels/email.ts` — wysyłka przez istniejący provider, `Message-ID`/`In-Reply-To` jako `thread_key`.
- [ ] `src/lib/messages/send.ts` — `sendMessage(client, { inquiryId, channel, counterpart, body, draftedBy })`: insert `messages` (status `queued` → `sent`/`failed`), `emitEvent(message.sent)`, pierwsza wiadomość do przewodnika → `guide.contacted`.
- [ ] Webhook e-mail inbound: dopasowanie po `thread_key`/adresie → `messages` + `message.received`; brak dopasowania → `unmatched_messages`. Dopasowanie z `UnmatchedPageClient` przenosi do `messages` i emituje.
- [ ] UI wątku na `admin/inquiries/[id]`: lista, kompozytor (kanał, rozmówca, treść), przyciski oznaczeń: „oferta od przewodnika" (formularz: przewodnik + 1..n opcji z ceną/walutą/terminem → wiersz `offers` + `offer_options`, `guide.offer_received` z `payload.offer_id`), „przedstawia ofertę" (`offer.presented` + propozycja `offer_presented`), „klient akceptuje/odrzuca" (wybór opcji → `is_accepted`, `offer.accepted` z `payload.option_id` / `offer.declined` + propozycja statusu), „poinformowano przewodnika o wpłacie", „kontakty wymienione" (+ `handed_over`). Propozycja statusu = checkbox zaznaczony domyślnie, w tym samym submit.
- [ ] Stripe: „utwórz link do płatności" w wątku → Payment Link API z `metadata.inquiry_id`, `payment_type='inquiry_deposit'`; link wklejony do kompozytora; `payment.link_sent` + `awaiting_payment`. Webhook `stripe-deposit` obsługuje też `payment_link` sesje; `UnmatchedLinker` zostaje jako ścieżka awaryjna, emituje `payment.received` z `source='app'`.
- [ ] Usunięcie `LeadCommsLogger`, `ConversationImporter`, `sendOfferEmail`, buildera ofert z nawigacji (kod może zostać do FA-1.08).
- [ ] Harness dowodowy: przenieść `.fa-proofs/` (dziś w `.gitignore`, powstał w FA-1.03) do `scripts/proofs/` z `README.md` — stuby `next/headers` (ciasteczka + nagłówki z `globalThis`, bo skrypt i aplikacja dostają osobne instancje modułu) i `next/cache`, `tsconfig.proof.json` z mapowaniem `paths`, podpisywanie webhooka Stripe offline (`stripe.webhooks.generateTestHeaderString`). Dziś ten harness istnieje na jednym dysku; FA-1.12 i tak go potrzebuje na ścieżkę „mail → oferta → akceptacja → wpłata".
- [ ] Testy: oferta bez opcji odrzucona; akceptacja opcji z innej oferty odrzucona; `sendMessage` zapisuje wiersz i dokładnie jedno zdarzenie; inbound bez dopasowania trafia do `unmatched`; oznaczenie „przedstawia ofertę" bez wiadomości jest odrzucone; duplikat `external_id` odrzucony.

## Gotowe, gdy
- [ ] Na gałęzi podglądowej po migracji: `count(messages) = count_before(lead_messages) + count_before(inquiry_messages)`; tabele `lead_messages`, `inquiry_messages` nie istnieją. Liczby w raporcie.
- [ ] Ścieżka na gałęzi podglądowej, wyłącznie z UI: mail do klienta → mail do przewodnika → odpowiedź przewodnika (webhook, testowy payload) oznaczona jako oferta → mail do klienta „przedstawia ofertę" → odpowiedź klienta oznaczona „akceptuje" → link Stripe (tryb test) → webhook `payment.received` → „kontakty wymienione". `SELECT type, channel, source FROM inquiry_events … ORDER BY occurred_at` pokazuje ≥ 10 zdarzeń w tej kolejności; status końcowy `handed_over`. Wynik w raporcie.
- [ ] Insert do `messages` z istniejącym `external_id` → błąd unikalności — **na czerwono w raporcie**.
- [ ] `grep -rn "LeadCommsLogger\|ConversationImporter" src/app` → 0.
- [ ] Webhook Stripe z sesją bez `metadata.inquiry_id` loguje i nie zmienia statusu — test.
- [ ] Oferta z 0 opcji → błąd (constraint lub walidacja) — **na czerwono w raporcie**.
- [ ] `supabase db diff` pusty; typy zawierają `messages`, `offers`, `offer_options`, nie zawierają `lead_messages`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- WhatsApp i Instagram (adaptery, webhook WA) — FA-1.13. Interfejs adaptera musi jednak pozwolić je dopiąć bez zmiany `sendMessage`.
- Propozycje odpowiedzi od agenta — FA-1.14.
- Backfill zdarzeń z historycznych wiadomości — FA-1.05.
- `db push` na produkcję — paczka `stage-1`.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis na produkcji: STOP. Tylko gałąź podglądowa.
- `DROP TABLE lead_messages / inquiry_messages`: STOP przed napisaniem migracji — pokaż liczniki z migracji danych i zapytanie kontrolne.
- Zmiana webhooka Stripe i sekretu: STOP, pokaż diff; konfiguracja w Stripe dashboard (nowy endpoint dla podglądu) — robi tj.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- messages channels
supabase db diff
pnpm typecheck && pnpm lint && pnpm build
# SELECT count(*) FROM messages; SELECT to_regclass('lead_messages'), to_regclass('inquiry_messages');
# SELECT type, channel, source, actor_kind, occurred_at FROM inquiry_events WHERE inquiry_id='<id>' ORDER BY occurred_at;
```

## Notatki z realizacji
