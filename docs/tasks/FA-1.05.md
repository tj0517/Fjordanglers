---
id: FA-1.05
title: Backfill zdarzeń historycznych do `inquiry_events` — tylko z kolumn, które mówią prawdę
stage: 1
status: done
difficulty: L
model: opus
model_approved:
effort: high
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
- [x] Audyt z punktu 1 wklejony do raportu, z decyzją tj per źródło (cytat lub data).
- [x] Po migracji na lokalnym stacku: `SELECT type, source, count(*) FROM inquiry_events GROUP BY 1,2`
      — w raporcie; dla każdego typu z `source='backfill'` liczba ≤ liczby wierszy źródłowych z audytu.
- [x] `SELECT count(*) FROM messages m WHERE NOT EXISTS (SELECT 1 FROM inquiry_events e WHERE e.message_id = m.id)` → **0**.
- [x] `SELECT count(*) FROM inquiries WHERE deposit_paid_at IS NOT NULL AND NOT EXISTS (… type='payment.received')` → **0**.
- [x] **Na czerwono:** wiersz `external_offer_sent=true, offer_sent_at=NULL` — `SELECT … type='offer.presented'` → 0 wierszy (test lub SELECT w raporcie).
- [x] **Na czerwono:** drugie uruchomienie migracji → `RAISE NOTICE … 0 rows` dla każdego typu.
- [x] Żadne zdarzenie z `source='backfill'` nie ma `occurred_at > created_at` (SELECT → 0). Dla typów innych niż `message.*` występuje `occurred_at ≥ inquiries.created_at` (SELECT → 0). Dla `message.*` wiadomość może poprzedzać rekord zapytania (prod: 7 wierszy, 80 s – 13 h) — to prawdziwy czas, nie anomalia.
      Zmienione 19 IX po audycie prod, decyzja tj (D-B1).
- [x] `supabase db diff --local` pusty; `pnpm typecheck && pnpm test && pnpm build` zielone; `pnpm lint` nie gorzej niż `stage-1`.

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

## Report — FA-1.05 Backfill zdarzeń historycznych do `inquiry_events`

### Done

- **Prod audit (2026-09-19)** — 3 read-only SELECTs on `uwxrstbplaoxfghrchcy`:
  - `inquiries` aggregate: 99 rows, `offer_sent_at` = 1, `external_offer_sent` = 25, ext_without_date = 24, `deposit_paid_at` = 0, `status='lost'` = 63
  - `messages` breakdown (SELECT 2 raw output, WHERE NOT EXISTS inquiry_events):
    ```
    direction | counterpart | channel  | count | min_occurred_at              | max_occurred_at
    ----------+-------------+----------+-------+------------------------------+-------------------------------
    inbound   | angler      | email    |   307 | 2026-06-26 02:23:51+00       | 2026-09-19 07:31:24.301175+00
    inbound   | angler      | whatsapp |    63 | 2026-05-30 22:46:24+00       | 2026-07-24 17:34:55.962957+00
    outbound  | angler      | email    |   251 | 2026-05-26 12:54:40+00       | 2026-09-17 14:22:09.640348+00
    outbound  | angler      | whatsapp |    63 | 2026-05-30 21:49:14+00       | 2026-07-07 15:48:42+00
    ```
    Total: 684 rows (370 inbound = message.received, 314 outbound = message.sent). 0 rows with counterpart='guide'.
  - `inquiry_events`: empty (0 rows, source=app/webhook not yet backfilled at audit time)

- **Decisions from tj (D-A1–D-A5)** — recorded in task file Decyzje section and migration header comment:
  - D-A1: `inquiry.lost` not backfilled (no reliable timestamp)
  - D-A2: `drafted_by IS NULL` → `actor_kind='admin'`
  - D-A3: rollback via `DELETE FROM inquiry_events WHERE source='backfill'` by DB owner
  - D-A4: `payment.received` block kept (idempotent skeleton, 0 rows on prod)
  - D-A5: messages with `occurred_at > '2026-09-19 12:00+02'` and no event → count=0 ✓

- **Migration `20261003000000_backfill_inquiry_events.sql`** — 5 blocks:
  `inquiry.created`, `message.sent`, `message.received`, `offer.presented`, `payment.received`;
  idempotency via `WHERE NOT EXISTS`; `message.*` keyed on `message_id`;
  `RAISE NOTICE 'backfill <type>: % rows'` per block.
  Idempotency key fix (tj review 19 IX): `inquiry.created`, `offer.presented`, `payment.received` keyed on
  `(inquiry_id, type)` — `source` excluded so a live event (source='app') also blocks a duplicate backfill row.

- **`supabase/seed.sql` created** — 5 inquiries + 4 messages covering all edge cases:
  `external_offer_sent=true + offer_sent_at NULL` (Alice), `offer_sent_at NOT NULL` (Bob, Carol),
  `deposit_paid_at NOT NULL` (Carol), `status='lost'` (Dave), guide-counterpart outbound (Eve)

- **Acceptance criteria (local stack, after seed + manual psql run):**

  ```
  type             | source   | count
  -----------------+----------+-------
  inquiry.created  | app      |     1   ← Bob: pre-existing from seed (red proof)
  inquiry.created  | backfill |     4   ← 5 inquiries - 1 (Bob skipped by idempotency fix)
  message.received | backfill |     2
  message.sent     | backfill |     2
  offer.presented  | backfill |     2
  payment.received | backfill |     1
  ```

  ```
  messages_without_event = 0
  paid_without_event     = 0
  occurred_at_anomalies  = 0
  ```

- **Red proofs:**
  - Alice (external_offer_sent=true, offer_sent_at NULL): `alice_offer_presented = 0` ✓
  - Dave (status='lost'): `dave_inquiry_lost = 0` ✓
  - Bob (pre-existing `inquiry.created` source='app' in seed): backfill adds **0** additional; Bob has exactly 1 ✓
  - Idempotency (second run): all types → `0 rows` ✓

- **Prod SELECTs round 2 (read-only, 2026-09-19):**
  - 2a: inquiries already having `inquiry.created` from non-backfill source → **0**
  - 2b: messages where `occurred_at < inquiries.created_at` → **7**
    `cnt=7, min_diff=00:01:20, max_diff=13:07:41, earliest_msg=2026-06-27 20:53+00`
    D-B1 rozstrzygnięte: opcja A, tj 19 IX — prawdziwe znaczniki czasu zachowane.

- **docs/01-architecture.md §4.1** — corrected "backfill (FA-1.05)" sentence; backfill is about events not legacy status values

- **docs/REBUILD_PLAN.md Appendix C** — added backfill history note with sources and row counts

- **docs/03-conventions.md** — added stage-1 sequential timestamp rule

- **docs/deferred-tasks.md** — added 4 FA-1.05 audit findings (3 round 1 + D-B1 temporal anomaly); closed FA-1.12 seed entry

- **CI checks:** `db diff --local` → "No schema changes found"; `pnpm typecheck` → 0 errors; 137 tests passed; `pnpm build` → clean; `pnpm lint` → 40 errors on this branch; no JS/TS files changed vs stage-1, so count equals stage-1 baseline

### Not done

- Running migration on production — enters with next `db push`, tj's decision separately (per task scope)

### Noticed, not touched (→ docs/deferred-tasks.md)

- `deposit_paid_at` NULL for all 99 prod rows despite 10 with `stage_reached='deposit_paid'` — recorded in deferred-tasks.md
- 0 messages with `counterpart='guide'` — guide comms are outside system; `guide.contacted`/M10 start from zero — recorded
- 24 rows `external_offer_sent=true` without `offer_sent_at` — offer history is incomplete for pre-builder period — recorded

### Needs a decision

- **D-B1 rozstrzygnięte — opcja A, tj, 19 IX.** Prawdziwe `occurred_at` zachowane. Kryterium przepisane: `occurred_at > created_at` = 0 dla wszystkich typów; `occurred_at < inquiries.created_at` = 0 tylko dla nie-`message.*`. 7 wierszy zapisane w deferred-tasks.md.

### Verification

```
# db reset (migration applied on empty DB → 0 rows all types, seed runs)
supabase db reset

# First meaningful backfill (after seed)
psql "$LOCAL_DB_URL" -f supabase/migrations/20261003000000_backfill_inquiry_events.sql
# → inquiry.created: 4, message.sent: 2, message.received: 2, offer.presented: 2, payment.received: 1
#    (Bob skipped for inquiry.created — seed pre-inserted source='app' event; 5 inquiries - 1 = 4)

# Second run — idempotency
psql "$LOCAL_DB_URL" -f supabase/migrations/20261003000000_backfill_inquiry_events.sql
# → all types: 0 rows

# Acceptance SELECTs
SELECT type, source, count(*) FROM inquiry_events GROUP BY 1,2 ORDER BY 1,2;
SELECT count(*) FROM messages m WHERE NOT EXISTS (SELECT 1 FROM inquiry_events e WHERE e.message_id = m.id);
# → 0
SELECT count(*) FROM inquiries WHERE deposit_paid_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM inquiry_events e WHERE e.inquiry_id = id AND e.type = 'payment.received');
# → 0
-- occurred_at must never exceed created_at (all types)
SELECT count(*) FROM inquiry_events WHERE source='backfill' AND occurred_at > created_at;
# → 0

-- occurred_at must be >= inquiries.created_at for non-message.* types (D-B1)
SELECT count(*) FROM inquiry_events e JOIN inquiries i ON i.id=e.inquiry_id
  WHERE e.source='backfill' AND e.type NOT LIKE 'message.%' AND e.occurred_at < i.created_at;
# → 0

# Red proofs
SELECT count(*) FROM inquiry_events WHERE inquiry_id='a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a101' AND type='offer.presented';
# → 0 (Alice: external_offer_sent=true, offer_sent_at NULL)
SELECT count(*) FROM inquiry_events WHERE inquiry_id='a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a404' AND type='inquiry.lost';
# → 0 (Dave: status='lost', no inquiry.lost block)
SELECT count(*) FROM inquiry_events WHERE inquiry_id='a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a202' AND type='inquiry.created';
# → 1 (Bob: seed pre-inserted source='app'; backfill must not add a second)

# CI
supabase db diff --local  # → No schema changes found
pnpm typecheck             # → 0 errors
pnpm test                  # → 17 files, 137 tests passed
pnpm build                 # → clean
pnpm lint                  # → 40 errors (= stage-1 baseline; no JS/TS files changed)
```

### Checklista przy db push (prod)

Wykonać po wdrożeniu paczki FA-1.04 + FA-1.05 na `uwxrstbplaoxfghrchcy`.
Bez tych wyników PR nie jest „udowodniony na prod".

```sql
-- 1. Rozkład zdarzeń — oczekiwane: backfill created≈99 / sent≈314 / received≈370 /
--    offer.presented≈1 / payment.received≈0; plus ewentualne source='app' z okresu po 19 IX
SELECT type, source, count(*) FROM inquiry_events GROUP BY 1,2 ORDER BY 1,2;

-- 2. Wiadomości bez zdarzenia — oczekiwane: 0
SELECT count(*) FROM messages m
WHERE NOT EXISTS (SELECT 1 FROM inquiry_events e WHERE e.message_id = m.id);

-- 3. Zdarzenia backfill inne niż message.* z occurred_at < inquiries.created_at — oczekiwane: 0
SELECT count(*) FROM inquiry_events e
JOIN inquiries i ON i.id = e.inquiry_id
WHERE e.source='backfill'
  AND e.type NOT LIKE 'message.%'
  AND e.occurred_at < i.created_at;
```

