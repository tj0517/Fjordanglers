---
id: FA-1.13
title: WhatsApp w obie strony (Meta Cloud API, szablony 24 h) + adapter Instagram bez kluczy
stage: 1
status: blocked
blocked_by_questions: [O-16]
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/whatsapp-instagram
depends_on: [FA-1.12]
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

Szczegółowy raport w opisie PR. Poniżej podsumowanie.

### §5 — raport z realizacji (2026-09-18)

**Zrobione**

- `ChannelAdapter` contract v2: `canSendFreeform(lastInboundAt: Date | null): boolean`,
  `parseInbound` (wchłonął `parseThreadKey` — grep src/: 0 trafień przed zmianą).
- `src/lib/channels/whatsapp.ts` — pełny adapter (freeform w oknie 24h, szablon poza oknem,
  `parseInbound` normalizuje `from` do E.164).
- `src/lib/channels/instagram.ts` — stub; `enabled=false` gdy brak `INSTAGRAM_ACCESS_TOKEN`;
  `send()` rzuca czytelny błąd.
- Migracja `20260918135418_add_guides_phone_normalise_angler.sql`:
  `guides.phone_e164 TEXT`, indeks zwykły (nie UNIQUE — shared phones valid),
  backfill + indeks na `inquiries.angler_phone`.
  Wynik backfill local (empty dev DB): normalised=0, skipped=0, null=0.
  SELECT result (produkcja, live read 2026-09-18):
    null_phone=24, already_e164=28, to_normalise=47
    Breakdown of 47: Iceland 43, New Zealand 3, Other 1 — żaden NANP.
    Wynik na produkcji (faktyczny, wdrożenie 19 IX 2026, zapisany w commicie `12989cd8`): normalised=28, skipped=47, null=24.
    Wcześniejszy zapis „Oczekiwany wynik: normalised=0” był błędny: reguła 1 migracji (`LIKE '+%'` → usuń
    znaki formatowania → UPDATE) obejmuje 28 wierszy, które już były w E.164, więc normalised=28.
    RAISE NOTICE wylistuje wszystkie 47 ID dla tj (manual review).
- `inquiry-matcher.ts`: `matchInboundPhone` — dopasowanie angler phone + guide phone_e164
  (przypisany lub kontaktowany w otwartym zapytaniu); wielu kandydatów → unmatched.
- `messages/send.ts`: obsługa `whatsapp`/`instagram`; fetch `lastInboundAt` z DB dla WA;
  `templateName` w `SendMessageParams`.
- `inquiries/create.ts`: normalizacja `angler_phone` → E.164 przy zapisie.
- `actions/messages.ts`: `channel: 'email' | 'whatsapp' | 'instagram'`; WA ścieżka dla
  angler i guide (przez `phone_e164`); auto-wybór szablonu wg counterpart.
- Webhook `route.ts`: HMAC Option B; delivery statuses; `matchInboundPhone` z routingiem
  counterpart; `whatsappAdapter.parseInbound`.
- `MessageComposer.tsx`: channel picker; WA okno-zamknięte banner + "Send Template";
  IG disabled state.
- `env.ts`: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_GUIDE/ANGLER` (z defaultami),
  `INSTAGRAM_ACCESS_TOKEN`.
- `docs/ops/whatsapp-templates.md`, `docs/ops/whatsapp-e2e-checklist.md`.
- 116 testów zielonych; typecheck 0 błędów.

**Nie zrobione / poza zakresem**

- E2E z prawdziwym numerem Meta (punkt 1 acceptance criteria) — wymaga kluczy prod (robi tj).
- Instagram pełny adapter — O-16, robi tj.
- Media wychodzące — zdefiniowane jako poza zakresem.

**Zauważone, odroczone**

- `supabase db diff --local` nie działa z działającym primary DB na tym porcie
  (port conflict przy tworzeniu shadow DB). Migracja zweryfikowana przez psql bezpośrednio.
- Lint errorsy w 40 pre-existing plikach (FA-1.07/1.08 dead-code cleanup).

**⛔ STOP GATE**

**NIE MERGOWAĆ dopóki tj nie potwierdzi, że `WHATSAPP_APP_SECRET` jest ustawiony
w środowisku produkcyjnym Vercel.** Brak sekretu = webhook odrzuca wszystkie żądania
z 401 (HMAC Option B).

### Blokada zewnętrzna (18 IX 2026)

Integracja WhatsApp Cloud API jest zablokowana po stronie Meta, nie kodu. Konto tj ma
ograniczenie dostępu do reklam obejmujące tworzenie portfolio firmowych (komunikat:
„Nie możesz zamieszczać reklam, zarządzać zasobami reklamowymi ani tworzyć kont
reklamowych i portfolio firmowych"). Kreator aplikacji Meta na kroku „Business" zwraca
„No businesses available". Istniejące portfolio „fan page" (ID 1258409340996834,
utworzone 4 VIII 2019) ma pustą nazwę firmy, brak adresu i telefonu, status
„Nie zweryfikowano" — i tak nie jest oferowane w kreatorze.
Zmienne `WHATSAPP_*` w `.env.local` to zaślepki (`your_...`, `from...`), nie sekrety —
aplikacja Meta nigdy nie istniała. tj złożył odwołanie w Account Quality 18 IX 2026.

Grep na wołających `/api/webhooks/whatsapp` (poza `route.ts` i testami): **0 trafień** —
żaden kod klienta ani cron nie woła tego endpointu.
Blokada mergu (WHATSAPP_APP_SECRET w Vercel) jest tym samym **zdjęta**: sekret nie
istnieje i nie powstanie do czasu rozpatrzenia odwołania; webhook zwraca 401, ale nikt
do niego nie puka.

**Kryteria nieudowodnione do odblokowania konta:**
- Kryterium 1: E2E z prawdziwym numerem Meta (WA do przewodnika → odpowiedź → w wątku).
- Kryterium 5 (częściowo): build kompiluje się bez `INSTAGRAM_*`, ale pełna weryfikacja
  z testowym numerem Meta musi poczekać.

### Runda po przeglądzie (20 IX 2026) — numer przewodnika poza publicznym profilem

Przegląd znalazł, że `guides.phone_e164` (migracja `20260918135418`) leży w tabeli z polityką
`"Public reads all guides" FOR SELECT USING (true)` (`20260904165037_baseline_prod.sql`), czyli
numer wpisany zgodnie z `docs/ops/whatsapp-e2e-checklist.md` byłby czytelny kluczem publikowalnym.
Kolumna na produkcji była pusta, więc nic nie wyciekło. Decyzja tj: numer do osobnej tabeli.

- Migracja `20261004000000_guide_contacts.sql`: `guide_contacts` (RLS włączony, polityka wyłącznie
  `service_role`, `REVOKE ALL` dla `anon`/`authenticated`), przeniesienie danych, `DROP COLUMN guides.phone_e164`.
  `20260918135418` nie edytowana — jest zastosowana na produkcji. Od tej migracji zdania wyżej
  o `guides.phone_e164` opisują stan historyczny.
- Odczyty (`inquiry-matcher.ts`, `actions/messages.ts`, `admin/inquiries/[id]/page.tsx`) idą przez
  `src/lib/guide-contacts.ts`.
- Red proof: `src/lib/__tests__/guideContactsRls.test.ts` (anon vs `service_role` na lokalnym stacku).
- `db push` migracji `20261004000000` na produkcję: **otwarty STOP** — robi tj.
