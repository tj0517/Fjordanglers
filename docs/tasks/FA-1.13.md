---
id: FA-1.13
title: WhatsApp w obie strony (Meta Cloud API, szablony 24 h) + adapter Instagram bez kluczy
stage: 1
status: in_progress
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/whatsapp-instagram
depends_on: [FA-1.12]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 12
owner: tj
---

# FA-1.13 — WhatsApp i Instagram jako kanały wątku

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/01-architecture.md` §3a — adaptery, okno 24 h, „brak kluczy = stan konfiguracji"
- `docs/REBUILD_PLAN.md` załącznik C
- `src/lib/channels/*`, `src/lib/messages/send.ts` — z FA-1.12
- `src/app/api/webhooks/whatsapp/route.ts` — istniejący odbiór (Meta Cloud API, weryfikacja podpisu)
- `src/lib/env.ts` — `WHATSAPP_*`
- `src/app/admin/inquiries/unmatched/*` — dopasowanie nieznanych numerów
- Meta: WhatsApp Cloud API — Messages, Templates; Instagram Messaging API (do adaptera)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Komunikacja z klientem jest dwutorowa: mail i WhatsApp, kontynuujemy tam, gdzie klient odpisze. Numer zbiera formularz.
Rozmowy z przewodnikami (i częścią klientów) toczą się na WhatsAppie. Po zadaniu admin
wysyła WhatsApp z tego samego wątku co mail, odpowiedzi wpadają do wątku, a numer
przewodnika/klienta jest zapisany przy zapytaniu, żeby dopasowanie było automatyczne.
Instagram dostaje adapter o tym samym interfejsie, który bez kluczy zgłasza „kanał
nieaktywny", a nie błąd — włączy się po weryfikacji Meta (O-16) bez zmian w kodzie.

## Zakres
- [ ] Odczyt stanu: co dziś robi webhook WA (jakie pola, gdzie zapisuje); ile `unmatched_messages` ma `source='whatsapp'`; czy `guides` mają kolumnę telefonu; `inquiries.angler_phone` istnieje (formularz zbiera numer, opcjonalnie) — ile wierszy ma numer i w jakich formatach.
- [ ] Migracja: `guides.phone_e164` (jeśli brak); normalizacja `inquiries.angler_phone` do E.164 przy zapisie (formularz) i backfill istniejących; indeks; `messages.media` używane dla załączników WA.
- [ ] `src/lib/channels/whatsapp.ts`: `send` (text; template gdy `canSendFreeform=false`), `parseInbound`, `canSendFreeform(lastInboundAt)` = 24 h. Szablony: jeden do przewodnika („nowe zapytanie, odpisz"), jeden do klienta („mamy ofertę/odpowiedź") — nazwy z env, treść w `docs/ops/whatsapp-templates.md`; rejestrację u Meta robi tj.
- [ ] `src/lib/channels/instagram.ts`: ten sam interfejs; bez `INSTAGRAM_*` w env → `enabled=false`, kompozytor pokazuje kanał wyszarzony z powodem.
- [ ] Webhook WA: dopasowanie po `phone_e164` do otwartego zapytania (klient) lub przewodnika przypisanego/kontaktowanego w otwartym zapytaniu; wielu kandydatów → `unmatched` z listą kandydatów; statusy dostarczenia (`sent/delivered/read`) aktualizują `messages.status` po `external_id`.
- [ ] Kompozytor: wybór kanału; przy WA poza oknem 24 h wybór szablonu zamiast pola tekstu; rozmówca „przewodnik" wymaga wskazania przewodnika (lista + numer).
- [ ] Testy: `canSendFreeform` na granicy 24 h; inbound z nieznanego numeru → `unmatched`; adapter IG bez env → `enabled=false` i `send` odrzuca z czytelnym powodem; podpis webhooka zły → 401.

## Gotowe, gdy
- [ ] Na gałęzi podglądowej z testowym numerem Meta: WA do przewodnika z wątku → odpowiedź → w wątku jako `inbound/guide`, `message.received` z `channel='whatsapp'`, `source='webhook'`. SELECT w raporcie.
- [ ] Wysyłka poza oknem 24 h bez szablonu odrzucona — **na czerwono w teście**.
- [ ] Webhook z błędnym podpisem → 401 — **na czerwono w teście**.
- [ ] Bez `INSTAGRAM_*` w env aplikacja buduje się i działa; kompozytor pokazuje IG jako nieaktywny.
- [ ] `supabase db diff` pusty; `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Weryfikacja aplikacji u Meta i klucze IG — O-16, robi tj; nie blokuje.
- Auto-odpowiedzi agenta na WA — FA-1.14.
- Media wychodzące (zdjęcia do przewodnika) — później; przychodzące tylko jako link w `media`.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis na produkcji: STOP.
- Zmiana konfiguracji webhooka w Meta / sekretów: STOP, robi tj.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- whatsapp instagram channels
supabase db diff
pnpm typecheck && pnpm lint && pnpm build
# SELECT channel, direction, counterpart, status, external_id FROM messages WHERE inquiry_id='<id>' ORDER BY occurred_at;
```

## Notatki z realizacji
