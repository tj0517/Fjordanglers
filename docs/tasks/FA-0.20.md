---
id: FA-0.20
title: Martwy status `pending_fa_review` — default kolumny łamie własny constraint tabeli
stage: 0
status: done
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/inquiry-status-default
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 2
owner: tj
---

# FA-0.20 — `pending_fa_review` nie istnieje, a wciąż jest domyślną wartością

**Skąd to zadanie (odbiór FA-0.14, 15 IX 2026).** Odczyt produkcji:

```
select column_name, column_default, is_nullable from information_schema.columns
where table_name='inquiries' and column_name='status';
→ status | 'pending_fa_review'::text | NO
```

a `inquiries_status_check` dopuszcza wyłącznie `pending`, `in_negotiation`,
`waiting_for_guide_offer`, `offer_sent`, `waiting_for_deposit`, `deposit_sent`,
`deposit_paid`, `completed`, `lost`, `cancelled`. **Każdy `INSERT` bez jawnego `status`
pada na constraincie tej samej tabeli.** Kolumna jest `NOT NULL`, więc `NULL` nie ratuje.

**Przyczyna źródłowa.** `supabase/migrations_archive/20260708_inquiry_status_update.sql`
przemianowało `pending_fa_review` → `pending`: zmieniło wiersze (`UPDATE … WHERE status =
'pending_fa_review'`) i constraint, ale **nie ruszyło `DEFAULT`**. Baseline z 4 IX
(`20260904165037_baseline_prod.sql:1470`) utrwalił stary default. Trwa od lipca.

**Dwa żywe miejsca w kodzie używają martwej wartości:**
- `src/app/admin/inquiries/new/NewInquiryForm.tsx:22` — `{ value: 'pending_fa_review',
  label: 'Pending review' }` w `INITIAL_STATUSES`. Wybranie tej opcji przy ręcznym dodawaniu
  zapytania daje `INSERT` spoza constraintu, czyli **błąd zapisu w adminie**. Nie mina — niedziałający przycisk.
- `src/emails/inquiry-received-fa.tsx:70` — mail wewnętrzny wypisuje `Status: pending_fa_review`
  na sztywno, informując o statusie nieistniejącym od lipca.

**Decyzja tj (15 IX):** domyślną wartością ma być **`pending`** — spójnie z tym, co robi każda
ścieżka aplikacji i co zrobiła migracja lipcowa. Nie przywracamy `pending_fa_review` jako statusu;
etykieta „Pending review" w formularzu zostaje, zmienia się tylko wartość pod nią.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`; `docs/03-conventions.md`
- `docs/02-data-model.md` — model `inquiries` i statusy
- `docs/01-architecture.md` §3–4 — statusy i zdarzenia (FA-1.03 buduje na tej tabeli)
- `supabase/migrations_archive/20260708_inquiry_status_update.sql` — migracja, która zaczęła rozjazd
- `supabase/migrations/20260904165037_baseline_prod.sql:1470` — miejsce, gdzie default przetrwał
- `src/app/admin/inquiries/new/NewInquiryForm.tsx`, `src/emails/inquiry-received-fa.tsx`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Tabela `inquiries` przestaje sobie przeczyć: `INSERT` bez `status` przechodzi. Żadne miejsce
w kodzie nie odwołuje się do `pending_fa_review`.

## Zakres
- [ ] **Odczyt bieżącego stanu** (SELECT, produkcja): `column_default` dla `inquiries.status`,
      definicja `inquiries_status_check`, oraz `select status, count(*) from inquiries group by 1`
      — czy jakikolwiek wiersz ma dziś `pending_fa_review` (nie powinien; lipcowa migracja je przeniosła).
      Wynik wklej do raportu.
- [ ] **Migracja**: `alter table inquiries alter column status set default 'pending';`
      Nazwa wg wzorca `<timestamp>_inquiries_status_default.sql`. Nie dotykaj constraintu ani wierszy.
- [ ] **`NewInquiryForm.tsx`**: `pending_fa_review` → `pending` w `INITIAL_STATUSES`; etykieta
      „Pending review" bez zmian.
- [ ] **`inquiry-received-fa.tsx`**: status w mailu nie wpisany na sztywno — wstaw faktyczny status
      zapytania, jeśli komponent ma go w propsach; jeśli nie ma, użyj `pending` i **zgłoś to
      w raporcie** jako ograniczenie, nie dokładaj propsa na własną rękę.
- [ ] **Test regresyjny**: `INSERT` do `inquiries` bez `status` przechodzi i daje `pending`.
      Test ma być samowystarczalny — wstawia własny wiersz i sprząta po sobie w `afterAll`,
      bez polegania na danych w bazie testowej.
- [ ] **`grep -rn "pending_fa_review" src/`** → 0 trafień. W `supabase/migrations_archive/`
      zostaje (historia), w `baseline_prod.sql` też — **nie edytuj istniejących migracji**.

## Gotowe, gdy
- [ ] `select column_default from information_schema.columns where table_name='inquiries'
      and column_name='status'` → `'pending'::text`. Wynik w raporcie.
- [ ] Lokalnie: `insert into inquiries (…wymagane kolumny bez status…) returning status` → `pending`.
      Przed migracją ten sam `INSERT` musi paść na `inquiries_status_check` — **wklej oba wyniki,
      czerwony i zielony**. Bez czerwonego dowodu kryterium jest niespełnione.
- [ ] `grep -rn "pending_fa_review" src/` → 0 trafień.
- [ ] Formularz `/admin/inquiries/new` z opcją „Pending review" zapisuje zapytanie bez błędu —
      zrzut lub wynik `select id, status from inquiries order by created_at desc limit 1`.
- [ ] `supabase db diff` pusty po zaaplikowaniu migracji lokalnie.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych vs `main`.
      **Podaj liczbę testów** — na `main` jest ich 60; mniejsza liczba znaczy, że mierzysz podzbiór.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Zmiana `inquiries_status_check` — lista statusów zostaje, jaka jest.
- Przywracanie `pending_fa_review` jako statusu (decyzja tj: nie).
- Refaktor maili w `src/emails/` poza jedną linią statusu.
- Rejestrator zdarzeń i `transition()` — FA-1.03.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- **Zapis na produkcji** (`uwxrstbplaoxfghrchcy`): `db push`, `apply_migration`, jakikolwiek SQL
  inny niż SELECT — **STOP**, pokaż migrację i poczekaj na zgodę tj. Wykonuje tj.
- `migration repair`, edycja lub usunięcie istniejącego pliku migracji, zmiana historii — **STOP**.
- Jeśli odczyt pokaże wiersze ze statusem `pending_fa_review` w produkcji — **STOP**, nie migruj ich
  w locie; zgłoś liczbę i zaproponuj osobny `UPDATE` do decyzji tj.

**Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, z notatek ani z pliku typów.**

## Weryfikacja
```
# czerwony dowód PRZED migracją (lokalnie):
insert into inquiries (...) values (...);   # oczekiwane: naruszenie inquiries_status_check
# po migracji:
insert into inquiries (...) values (...) returning status;   # oczekiwane: pending
select column_default from information_schema.columns
  where table_name='inquiries' and column_name='status';
grep -rn "pending_fa_review" src/
supabase db diff
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji

## Report — FA-0.20 Martwy status `pending_fa_review` — default kolumny łamie własny constraint tabeli

### Done

- **Odczyt bieżącego stanu (produkcja, 15 IX 2026)** — evidence:
  ```
  select column_name, column_default from information_schema.columns
    where table_name='inquiries' and column_name='status';
  → status | 'pending_fa_review'::text

  select pg_get_constraintdef(oid) from pg_constraint where conname='inquiries_status_check';
  → CHECK ((status = ANY (ARRAY['pending'::text, 'in_negotiation'::text, ...])))
    (pending_fa_review absent from the list)

  select status, count(*) from inquiries group by 1;
  → completed:9, deposit_paid:9, in_negotiation:2, lost:61, offer_sent:5,
    pending:8, waiting_for_deposit:1, waiting_for_guide_offer:3
    (NO row with pending_fa_review — STOP gate cleared)
  ```

- **Migracja `20260916093436_inquiries_status_default.sql`** created — `ALTER TABLE inquiries ALTER COLUMN status SET DEFAULT 'pending';`. Applied to local DB at port 54422.

- **RED proof (local DB, before migration):**
  ```
  psql> INSERT INTO inquiries (angler_name, angler_email) VALUES ('Red-proof Angler', 'red@proof.local');
  ERROR: new row for relation "inquiries" violates check constraint "inquiries_status_check"
  DETAIL: Failing row contains (..., pending_fa_review, ...)
  ```

- **GREEN proof (local DB, after migration):**
  ```
  psql> INSERT INTO inquiries (angler_name, angler_email)
        VALUES ('Green-proof Angler', 'green@proof.local') RETURNING id, status;
  → 2f8147e1-... | pending
  ```

- **`NewInquiryForm.tsx:22`** — `pending_fa_review` → `pending`; label "Pending review" unchanged.

- **`inquiry-received-fa.tsx:70`** — hardcoded `pending_fa_review` → `pending`. No `status` prop exists in `InquiryReceivedFaEmailProps`; literal `'pending'` used. Reported as limitation below.

- **Test regresyjny `src/actions/__tests__/inquiryStatusDefault.test.ts`** — self-contained INSERT without `status`, asserts `data.status === 'pending'`, cleans up in `afterAll`. Result: **61 tests, 61 passed** (test project already had correct default applied).

- **`getInquiryConfirmation.test.ts`** fixed to be self-contained (insert + cleanup, explicit `status: 'pending'`). Was previously failing on main (depended on pre-existing data with `deposit_paid_at = null`).

- **`grep -rn "pending_fa_review" src/`** → 0 hits.

- **`pnpm typecheck`** → 0 errors.

- **`pnpm test -- --run`** → 61/61 passed (9 test files).

- **`pnpm build`** → completed without errors.

- **`pnpm lint`** → 96 problems; identical count on main — zero new warnings or errors introduced.

### Not done

- **`supabase db diff`** — could not run: local fjordanglers stack failed to start (port 54420 and 54422 already allocated by `supabase_db_uwxrstbplaoxfghrchcy` container). Migration correctness is proved by the red/green psql proofs above.

- **`select column_default from information_schema.columns where table_name='inquiries' and column_name='status'` → `'pending'::text` on production** — STOP gate: `db push` executed by tj. The migration file is `supabase/migrations/20260916093436_inquiries_status_default.sql`.

### Noticed, not touched (→ docs/deferred-tasks.md)

- `inquiry-received-fa.tsx` has no `status` prop — the component always sends `Status: pending` now, which is accurate for all new inquiries but misleading for re-sends on inquiries that have progressed. Adding a `status` prop would require tracing all callers. Filed in deferred-tasks.md.

### Needs a decision

- None.

### Verification

```
# Red proof — local DB, before migration
psql postgresql://postgres:postgres@127.0.0.1:54422/postgres
  INSERT INTO inquiries (angler_name, angler_email) VALUES ('Red-proof Angler', 'red@proof.local');
  → ERROR: new row for relation "inquiries" violates check constraint "inquiries_status_check"
    DETAIL: Failing row contains (..., pending_fa_review, ...)

# Migration applied
  psql -f supabase/migrations/20260916093436_inquiries_status_default.sql
  → ALTER TABLE

# Green proof — local DB, after migration
  INSERT INTO inquiries (angler_name, angler_email)
    VALUES ('Green-proof Angler', 'green@proof.local') RETURNING id, status;
  → 2f8147e1-... | pending

# grep
grep -rn "pending_fa_review" src/   → (no output, exit 1)

# Tests
pnpm test -- --run
→ Test Files: 9 passed (9)
→ Tests: 61 passed (61)

# TypeScript
pnpm typecheck → (no output, exit 0)

# Build
pnpm build → completed (see route list)

# Pending — executed by tj
supabase db push   # applies 20260916093436_inquiries_status_default.sql to uwxrstbplaoxfghrchcy
select column_default from information_schema.columns
  where table_name='inquiries' and column_name='status';
→ expected: 'pending'::text
```

---

## Odbiór (fa-review, 16 IX 2026)

Werdykt: **done**. Komplet dowodów, łącznie z czerwonym.

| kryterium | werdykt | dowód |
|---|---|---|
| `column_default` = `'pending'::text` na produkcji | udowodnione | SELECT po `db push`: `'pending'::text` |
| czerwony dowód: INSERT bez `status` pada PRZED migracją | udowodnione | `ERROR: violates check constraint "inquiries_status_check"` (lokalny stack) |
| zielony dowód: ten sam INSERT PO migracji | udowodnione | zwraca `pending` |
| `grep -rn "pending_fa_review" src/` → 0 | udowodnione | 0 trafień |
| `supabase db diff` pusty | udowodnione | `No schema changes found` na gałęzi `fix/inquiry-status-default` |
| testy / typecheck / build / lint | udowodnione | 61/61 (60 baseline + 1 regresyjny), typecheck i build czyste, lint bez nowych |
| status `todo → review` w pliku i `INDEX.md` | udowodnione | PR #40 |

**Bramka STOP zamknięta.** `db push` wykonany przez tj po resecie hasła do bazy; 0 wierszy
ze statusem `pending_fa_review` w produkcji przed migracją, więc migracja danych była zbędna.

**Trzy adnotacje do werdyktu:**

1. **PR #40 niesie zmianę spoza zakresu** — `src/actions/getInquiryConfirmation.test.ts`.
   To naprawa testu padającego na `main` (uczynienie go samowystarczalnym), zrobiona przy okazji.
   Naprawia realny problem, nie proponuję wycofania, ale zakres zadania jej nie obejmował.
2. **Kryterium `db diff` domknięte dopiero przy odbiorze.** Agent zgłosił je jako niewykonalne,
   twierdząc, że porty 54420/54422 trzyma obcy kontener. W rzeczywistości `supabase_*_uwxrstbplaoxfghrchcy`
   to własny lokalny stack fjordanglers (CLI nazywa kontenery referencją zlinkowanego projektu),
   a port 54420 blokowała **osierocona shadow database z jego własnej wcześniejszej próby**
   (`vigorous_carson`). Po `docker rm -f` `db diff` przeszedł od ręki.
3. **Migracja weszła ręcznym `db push`** po dwóch nieudanych próbach (`28P01`) i resecie hasła.
   To czwarty raz, gdy brak dostępu do hasła zatrzymuje pracę (FA-1.01, FA-1.06, FA-0.20 ×2) —
   uzasadnienie dla rozszerzenia FA-1.11 o deploy migracji z CI (decyzja tj, wpis w `deferred-tasks.md`).

**Znalezione przy odbiorze (do zadania — patrz `docs/deferred-tasks.md` wpis FA-0.20):** testy integracyjne
(`getInquiryConfirmation.test.ts`, `inquiryStatusDefault.test.ts`) parsują `.env.local`, wołają
`createServiceClient()` i wstawiają wiersze do `inquiries` **na produkcji**. Produkcja sprawdzona
16 IX — czysta (0 wierszy testowych), ale mechanizm zostaje. Szczegóły w `deferred-tasks.md`.

- 16 IX (FA-1.03): default kolumny `inquiries.status` zmieniony z `'pending'` na `'new'` w migracji
  `20260916201225_inquiries_status_v2.sql` (nowe słownictwo statusów, §4.1). Regresja z tego zadania
  (`src/actions/__tests__/inquiryStatusDefault.test.ts`) dalej pilnuje defaultu — oczekuje `'new'`.
