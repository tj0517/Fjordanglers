---
id: FA-1.05
title: Backfill zdarzeń historycznych do `inquiry_events` — tylko z kolumn, które mówią prawdę
stage: 1
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: medium-high
agent: fa-core
branch: feat/inquiry-events-backfill
depends_on: [FA-1.03, FA-1.12]
blocked_by_questions: []
touches_db: true
touches_prod: true   # migracja wchodzi na produkcję przy następnym `db push`; sam agent nie pisze do prod
estimate_h: 5
owner: tj
---

# FA-1.05 — Backfill zdarzeń historycznych

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguła 5 (każda mutacja emituje zdarzenie); `docs/03-conventions.md` — migracje, „red proof"
- `docs/01-architecture.md` §4 i §4.1 — statusy, mapowanie legacy; §6 — po co jest `inquiry_events`
- `docs/REBUILD_PLAN.md` załącznik C — katalog typów; **kolumna „Zasila"** mówi, które metryki
  dostaną historię dzięki temu zadaniu (M5, M7, M10, M11)
- `supabase/migrations/20260916201226_add_inquiry_events.sql` — kształt tabeli, `source IN
  ('app','webhook','cron','backfill')`, trigger append-only
- `supabase/migrations/20260917120000_migrate_messages_data.sql` — jak FA-1.12 przeniosło
  `lead_messages` / `inquiry_messages` do `messages` i skąd wzięło `occurred_at`; **ta migracja
  nie tworzy zdarzeń**
- `src/lib/events/types.ts` — typy i wymagane pola `payload` dla `message.*`, `offer.presented`,
  `payment.received`, `inquiry.lost`
- `src/actions/inquiries.ts` — kto dziś ustawia `offer_sent_at` (~457, ~1546), `external_offer_sent`
  (~796, ~1224), `assigned_at`, `guide_responded_at`; `src/app/api/webhooks/stripe-deposit` —
  `deposit_paid_at`
- `docs/tasks/FA-1.03.md` — „Notatki z realizacji": rozkład statusów przed/po mapowaniu
- `docs/tasks/FA-1.04.md` — `qualified` **nie** jest backfillowane (świadomie `unknown`); tu też nie

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Metryki czasu i lejka (M7, M10, M11) liczą się z `inquiry_events`, a tabela istnieje od 16 IX —
wszystko wcześniej to zero. Część historii da się odtworzyć z kolumn `inquiries` i z
przeniesionych `messages`, ale **nie każda kolumna była wypełniana konsekwentnie** (decyzja tj
19 IX: backfillujemy tylko z tych źródeł, które odczyt produkcji pokaże jako wiarygodne).
Po zadaniu każde historyczne zapytanie ma komplet zdarzeń, które da się udowodnić danymi,
z `source='backfill'`, i ani jednego zmyślonego.

## Decyzje tj (19 IX 2026)

### D1 — źródła wybiera odczyt, nie plan
Zadanie zaczyna się od audytu jakości kolumn (Zakres, punkt 1). Kandydaci i ich a priori
wiarygodność:

| Zdarzenie | Źródło | Wiarygodność a priori | Uwaga |
|---|---|---|---|
| `inquiry.created` | `inquiries.created_at` | wysoka (NOT NULL, default) | zawsze wchodzi |
| `message.sent` / `message.received` | `messages` (direction, occurred_at, channel, drafted_by) | wysoka — `occurred_at` ustalone w FA-1.12 z `unmatched_messages.created_at` | każdy wiersz `messages` bez zdarzenia z tym `message_id` |
| `payment.received` | `inquiries.deposit_paid_at` | wysoka — ustawia webhook Stripe | payload `{ amount: deposit_amount ?? offer_deposit_eur, currency: 'EUR' }` |
| `offer.presented` | `inquiries.offer_sent_at` | **niska** — ustawiane tylko przez `sendOfferEmail` (builder, nieużywany); oferty szły mailem ręcznie z `external_offer_sent=true` **bez daty** | wchodzi tylko dla wierszy z niepustym `offer_sent_at`; `external_offer_sent` bez daty → brak zdarzenia (nie zgadujemy z `updated_at`) |
| `inquiry.lost` | `status='lost'` + `lost_reason_code` | średnia — brak daty przegranej | tylko jeśli audyt wskaże wiarygodny timestamp (np. `updated_at` gdy status lost i brak późniejszych wiadomości); inaczej pomijamy |
| `guide.contacted` | pierwsza `messages` outbound do `counterpart='guide'` | pochodna `message.sent` — wchodzi razem z nią | |
| `status.changed` | — | **nie backfillujemy** — brak dat przejść; syntetyczna kolejność z `stage_reached` byłaby zmyślona | |

Po audycie: tabela „kolumna → ile wierszy niepustych → ile spójnych ze `stage_reached`/`status`
→ wchodzi / nie wchodzi" w raporcie, **STOP i decyzja tj** przed napisaniem migracji.

### D2 — mechanizm
Migracja SQL w `supabase/migrations`, idempotentna: `INSERT … WHERE NOT EXISTS (SELECT 1 FROM
inquiry_events e WHERE e.inquiry_id = i.id AND e.type = '<typ>' AND e.source = 'backfill')`,
dla `message.*` klucz idempotencji to `message_id`. `source='backfill'`, `actor_kind` wg
załącznika C (`system` dla `inquiry.created` i `payment.received`, `admin` dla `message.sent`
z `drafted_by='admin'`, `agent` gdy `drafted_by='agent'`, `angler`/`guide` dla `received`),
`occurred_at` = timestamp źródła, `created_at` = now(). `payload.backfilled_from` = nazwa
kolumny źródłowej — żeby dało się je odróżnić i w razie czego wycofać jednym `DELETE … WHERE
source='backfill'` (append-only trigger blokuje UPDATE, nie DELETE dla ownera — sprawdź).

### D3 — nie ruszamy
- `qualified` (FA-1.04 — świadomie `unknown`).
- Legacy wartości statusów w CHECK zostają (drop — etap 4, jak w FA-1.03).
- `status.changed` — patrz D1.

## Zakres
- [ ] **Audyt jakości źródeł (SELECT na produkcji, hasło na jedno polecenie, wynik w raporcie):**
      ```sql
      select count(*) total,
             count(offer_sent_at)                              offer_sent_at,
             count(*) filter (where external_offer_sent)       external_offer_sent,
             count(*) filter (where external_offer_sent and offer_sent_at is null) ext_without_date,
             count(*) filter (where stage_reached in ('offer_sent','deposit_paid','completed') and offer_sent_at is null) stage_offer_no_date,
             count(deposit_paid_at)                            deposit_paid_at,
             count(*) filter (where stage_reached in ('deposit_paid','completed') and deposit_paid_at is null) stage_paid_no_date,
             count(*) filter (where status='lost')             lost,
             count(*) filter (where status='lost' and lost_reason_code is not null) lost_with_code,
             count(assigned_at) assigned_at, count(guide_responded_at) guide_responded_at
      from inquiries;
      select direction, counterpart, channel, count(*), min(occurred_at), max(occurred_at)
      from messages m where not exists (select 1 from inquiry_events e where e.message_id = m.id)
      group by 1,2,3 order by 1,2,3;
      select type, source, count(*) from inquiry_events group by 1,2 order by 1,2;
      ```
      Tabela „źródło → wchodzi / nie wchodzi + dlaczego" w raporcie. **STOP: decyzja tj.**
- [ ] Migracja `backfill_inquiry_events` wg D2 — jeden blok `DO $$ … $$` na typ, każdy z
      `RAISE NOTICE 'backfill <typ>: % rows'`; kolejność: `inquiry.created`, `message.*`,
      `guide.contacted`, `offer.presented`, `payment.received`, (`inquiry.lost` jeśli D1 wpuści).
- [ ] Test migracji na lokalnym stacku zasianym rozkładem z audytu (seed z FA-1.12 po naprawie
      UUID — wpis FA-1.12 w `deferred-tasks.md`; jeśli seed nie odzwierciedla przypadków
      brzegowych, dopisz je do `seed.sql` w tym PR): wiersz z `external_offer_sent=true` i
      `offer_sent_at NULL` **nie** dostaje `offer.presented`; wiersz z `deposit_paid_at` dostaje
      dokładnie jedno `payment.received`; wiadomość z FA-1.12 dostaje dokładnie jedno `message.*`
      z `message_id` i `occurred_at = messages.occurred_at`.
- [ ] Idempotencja: migracja uruchomiona dwa razy (`supabase db reset` + ręczne `psql -f`) daje
      identyczne `SELECT type, source, count(*)`.
- [ ] `docs/01-architecture.md` §4.1 — zdanie o „backfill (FA-1.05)" poprawione: backfill nie
      dotyczy statusów; legacy wartości spadają w etapie 4 niezależnie.
- [ ] `docs/REBUILD_PLAN.md` załącznik C — dopisek, które typy mają historię sprzed 16 IX i z
      jakiego źródła (jedna linia pod tabelą).

## Gotowe, gdy
- [ ] Audyt z punktu 1 wklejony do raportu, z decyzją tj per źródło (cytat lub data).
- [ ] Po migracji na lokalnym stacku: `SELECT type, source, count(*) FROM inquiry_events GROUP BY 1,2`
      — w raporcie; dla każdego typu z `source='backfill'` liczba ≤ liczby wierszy źródłowych z audytu.
- [ ] `SELECT count(*) FROM messages m WHERE NOT EXISTS (SELECT 1 FROM inquiry_events e WHERE e.message_id = m.id)` → **0**.
- [ ] `SELECT count(*) FROM inquiries WHERE deposit_paid_at IS NOT NULL AND NOT EXISTS (… type='payment.received')` → **0**.
- [ ] **Na czerwono:** wiersz `external_offer_sent=true, offer_sent_at=NULL` — `SELECT … type='offer.presented'` → 0 wierszy (test lub SELECT w raporcie).
- [ ] **Na czerwono:** drugie uruchomienie migracji → `RAISE NOTICE … 0 rows` dla każdego typu.
- [ ] Żadne zdarzenie z `source='backfill'` nie ma `occurred_at > created_at` ani `occurred_at < inquiries.created_at` (SELECT → 0).
- [ ] `supabase db diff --local` pusty; `pnpm typecheck && pnpm test && pnpm build` zielone; `pnpm lint` nie gorzej niż `main`.

## Poza zakresem
- Backfill `qualified` — FA-1.04, świadomie nie.
- Syntetyczne `status.changed` / `stage_reached` — nie robimy (D1).
- Drop legacy wartości statusów — etap 4.
- Zdarzenia `offer.accepted/declined`, `guide.offer_received`, `payment.link_sent` — brak
  historycznego źródła; jeśli audyt pokaże inaczej, zgłoś.
- Uruchomienie migracji na produkcji — wchodzi z następną paczką `db push`, decyzja tj osobno.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Jakikolwiek zapis do `uwxrstbplaoxfghrchcy` — STOP. Zakres to wyłącznie SELECT z punktu 1.
- Po audycie, przed migracją — STOP: tabela źródeł i decyzja tj.
- Jeśli audyt pokaże typ zdarzenia, którego nie ma w D1 (np. sensowne źródło dla
  `guide.offer_received`) — STOP, pokaż, nie dopisuj sam.
- `SUPABASE_DB_PASSWORD` per polecenie, nigdy wypisywane, nie w plikach repo.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
supabase db reset && supabase db diff --local
psql "$LOCAL_DB_URL" -f supabase/migrations/<ts>_backfill_inquiry_events.sql   # drugi raz → 0 rows
pnpm typecheck && pnpm lint && pnpm test && pnpm build
# SELECT type, source, count(*) FROM inquiry_events GROUP BY 1,2 ORDER BY 1,2;
# SELECT count(*) FROM messages m WHERE NOT EXISTS (SELECT 1 FROM inquiry_events e WHERE e.message_id = m.id);
# SELECT count(*) FROM inquiry_events e JOIN inquiries i ON i.id=e.inquiry_id WHERE e.source='backfill' AND (e.occurred_at > e.created_at OR e.occurred_at < i.created_at);
```

## Notatki z realizacji
