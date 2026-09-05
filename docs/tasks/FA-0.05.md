---
id: FA-0.05
title: Jedna ścieżka tworzenia zapytania — source + UTM; usunięcie landingu /plan-your-trip
stage: 0
status: done
difficulty: M
model: sonnet
model_approved: fable by tj 2026-09-04 (first pass) — odstępstwo od tabeli §2 w docs/05-agent-operations.md (zadanie jest M, Fable przewidziany dla XL); rebase + verification 2026-09-05 on sonnet/high per tj
effort: medium-high
agent: fa-core
branch: feat/inquiry-source-and-utm
depends_on: [FA-1.06]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 4
owner: tj
---

# FA-0.05 — Jedna ścieżka tworzenia zapytania: `source` + UTM

**Przepisane 4 IX 2026.** Poprzednia wersja zakładała podpięcie landingu `/plan-your-trip`
do `inquiries`. Decyzja tj z 4 IX: żadna kampania Google Ads nie kieruje na tę trasę, a sam
landing idzie do usunięcia — więc zamiast go naprawiać, kasujemy go w tym samym PR, w którym
porządkujemy tworzenie zapytań. Wartość `source='ads_landing'` znika z zakresu.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły; szczególnie 1 (migracje) i 3 (warstwa danych)
- `docs/03-conventions.md`
- `docs/02-data-model.md` §1 — ghost columns na `inquiries` (`source` istnieje w bazie, nie w migracji)
- `src/app/api/inquiries/route.ts` linie 115–137 — insert z widgetu; ustawia `gclid`, **nie ustawia `source`**
- `src/actions/inquiries.ts:143` `createManualInquiry` — druga, niezależna ścieżka tworzenia (admin)
- `src/lib/gclid.ts` + `src/components/analytics/GclidCapture.tsx` — wzorzec localStorage z TTL 90 dni; UTM ma iść tą samą drogą
- `src/actions/trip-plan.ts` (134 linie) i `src/app/plan-your-trip/page.tsx` (600 linii) — do usunięcia
- `docs/REBUILD_PLAN.md` §7.2 (M5, M6) — po co UTM-y

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Zapytania powstają dziś w dwóch miejscach, każde swoim insertem, żadne nie zapisuje `source`,
a UTM-y nie są łapane w ogóle — więc kosztu per kampania nie da się policzyć nawet ręcznie.
Po zadaniu istnieje jedna funkcja tworząca zapytanie, każde zapytanie niesie `source` i `utm`
obok `gclid`, a martwy landing zbierający leady wyłącznie do skrzynki znika z kodu.

## Zakres
- [ ] **Odczyt bieżącego stanu bazy** (bez tego ani kroku dalej):
      `select column_name, data_type from information_schema.columns where table_name='inquiries' and column_name in ('source','gclid','utm','trip_length');`
      oraz `select distinct source, count(*) from inquiries group by 1;`
      Drugie zapytanie decyduje o treści CHECK-a — jeśli w danych są wartości spoza listy poniżej, **STOP i pytaj**, zamiast dopisywać je do CHECK-a po cichu.
- [ ] Migracja: `utm JSONB` na `inquiries` (jeśli brak) + `source` przez `ADD COLUMN IF NOT EXISTS`
      z `CHECK (source IS NULL OR source IN ('web_form','manual','email','whatsapp'))`.
      `IS NULL` jest w warunku celowo — historyczne wiersze mają `source` puste i nie backfillujemy ich w tym zadaniu.
      Bez `ads_landing` — ta ścieżka przestaje istnieć.
- [ ] `src/lib/utm.ts`: przechwycenie `utm_source/medium/campaign/content/term` do localStorage,
      TTL 90 dni, dokładnie ten sam wzorzec co `gclid.ts` (try/catch wokół każdego dostępu).
      `GclidCapture` **rozszerzony**, nie zduplikowany nowym komponentem.
- [ ] Jedna funkcja tworzenia zapytania — `src/lib/inquiries/create.ts` — z jawnymi polami
      `source`, `gclid`, `utm`, `trip_length`. Używają jej **obie** dzisiejsze ścieżki:
      `api/inquiries/route.ts` (`source='web_form'`) i `createManualInquiry` (`source='manual'`).
      Insert znika z obu miejsc; żadne nowe `.from('inquiries').insert` poza tą funkcją.
- [ ] **Usunięcie landingu**: `src/app/plan-your-trip/` (cały katalog), `src/actions/trip-plan.ts`,
      wpis `'/plan-your-trip/'` z `src/app/robots.ts`. Przed usunięciem — dowód, że nic tego nie importuje.
      Znika przy okazji `router.push('/thank-you')` na nieistniejącą trasę.
- [x] Regeneracja typów po migracji i commit typów w tym samym PR — **z lokalnej bazy**
      (`supabase gen types typescript --local`), nie `pnpm supabase:types`, który czyta produkcję,
      gdzie kolumn nie ma do czasu STOP-owanego pushu (zmiana tj 5 IX).

## Gotowe, gdy
Kryteria doprecyzowane przez tj 5 IX 2026 (po rebase na FA-1.06); poprzedni dowód z 4 IX
nie liczy się jako aktualny.

- [x] Submit widgetu tworzy wiersz z `source='web_form'`, wypełnionym `utm` i `gclid` — SELECT
      w raporcie, na bazie lokalnej, po rebase.
- [x] Ręczne dodanie zapytania w adminie tworzy wiersz z `source='manual'` — SELECT w raporcie.
- [x] `INSERT ... source='foo'` odrzucony przez CHECK — **czerwony dowód**, komunikat błędu wklejony.
- [x] `grep -rn "plan-your-trip\|trip-plan\|thank-you" src` → 0 wyników.
- [x] `grep -rn -A3 "from('inquiries')" src | grep "\.insert("` → wyłącznie `src/lib/inquiries/create.ts`
      (grep jednoliniowy nigdy nie trafia — `.insert(` stoi w linii po `.from('inquiries')`).
- [x] `grep -rn "api.resend.com" src` → dokładnie 2 trafienia: `src/lib/email.ts` i
      `src/app/api/webhooks/email-inbound/route.ts` (poza zakresem, nietknięte; z `trip-plan.ts`
      znikają wszystkie).
- [x] `supabase db diff` (lokalnie, po migracji) → `No schema changes found`.
- [x] `database.types.ts` zregenerowany `supabase gen types typescript --local`; `inquiries.Row`
      zawiera `source` i `utm`.
- [x] Parytet typów z produkcją po `db push`: **sekcja `Database.public` identyczna** między
      regeneracją lokalną a `gen types --project-id uwxrstbplaoxfghrchcy`; różnice poza nią
      dopuszczalne i wymienione w raporcie. (Przeformułowane 5 IX z „pusty `git diff` po
      `pnpm supabase:types`": zdalny i lokalny generator dają inny szkielet pliku — nagłówek
      `__InternalSupabase`, nawiasy w helperach `Tables<>`/`Enums<>`, końcowy newline — przy
      identycznym schemacie, więc dosłownie pusty diff jest nieosiągalny bez wyboru jednego
      kanonicznego generatora, co należy do FA-1.11. Plik w repo pochodzi z generatora lokalnego,
      jak od FA-1.06.)
- [x] `pnpm typecheck` i `pnpm build` zielone; `pnpm test -- --run` zielone.
- [x] `pnpm lint`: zero NOWYCH błędów względem `main` (liczby z obu gałęzi w raporcie).
      „Lint zielony" jest nieosiągalny — 42 błędy na `main` sprzed tego zadania, wiersz w
      `docs/deferred-tasks.md`.
- [x] Status `blocked → review` tu i w `docs/tasks/INDEX.md`, w tym samym PR.

## Poza zakresem
- Kwalifikacja (`qualified`) — FA-1.04.
- Backfill `source` dla historycznych zapytań — osobna decyzja; tutaj zostają `NULL`.
- Ekran `/admin/ads` z kosztem per kampania — etap 6.
- Zmiana zachowania agenta AI dla nowych zapytań.
- Cokolwiek w `src/components/inquiry/InquiryWidget.tsx` poza przekazaniem `utm`.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- `db push` / `apply_migration` na produkcji `uwxrstbplaoxfghrchcy` — **STOP**, pokaż treść migracji
  i wynik `db diff`, poczekaj na zgodę tj. Migracja uruchamiana lokalnie albo na gałęzi Supabase.
- Wartości `source` w danych spoza listy z CHECK-a — **STOP**, nie rozszerzaj CHECK-a samodzielnie.
- **Usuwanie plików**: zgoda tj z 4 IX 2026 obejmuje wyłącznie `src/app/plan-your-trip/`
  i `src/actions/trip-plan.ts`, i tylko pod warunkiem, że grep pokaże brak importów.
  Jeśli cokolwiek je importuje — STOP, nie usuwaj, zapytaj.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, z notatek ani z pliku typów.

## Weryfikacja
```
grep -rn "plan-your-trip\|trip-plan\|thank-you" src || echo OK-landing-gone
grep -rn "api.resend.com" src            # oczekiwane: dokładnie email.ts + email-inbound
grep -rn -A3 "from('inquiries')" src | grep "\.insert("   # oczekiwane: tylko lib/inquiries/create.ts
supabase migration up --local && supabase db diff --local   # oczekiwane: No schema changes found
supabase gen types typescript --local > src/lib/supabase/database.types.ts
pnpm typecheck && pnpm test -- --run && pnpm build
pnpm lint                                # liczba błędów vs main
# SELECT id, source, gclid, utm, created_at FROM inquiries ORDER BY created_at DESC LIMIT 3;
# INSERT ... source='foo'  → oczekiwany błąd CHECK
```

## Notatki z realizacji (2026-09-04/05)

### Odczyt bieżącego stanu (przed zmianą)

Lokalny stack Supabase nie istniał w repo (brak `supabase/config.toml`) — dodany przez
`supabase init` (tylko `config.toml` + `supabase/.gitignore`, migracje nietknięte) i
uruchomiony przez `supabase start` na przesuniętych portach (54421–54429; domyślne porty
54321–54327 zajęte na tej maszynie przez niepowiązany projekt
`supabase_db_Seaclouds_management_system`). Baseline (`20260904165037_baseline_prod.sql`)
i casing-fix zaaplikowały się czysto.

```
select column_name, data_type from information_schema.columns
where table_name='inquiries' and column_name in ('source','gclid','utm','trip_length');

 column_name | data_type
-------------+-----------
 trip_length | text
 gclid       | text
(2 rows)

select distinct source, count(*) from inquiries group by 1;
ERROR:  column "source" does not exist
```

Zgodnie z przewidywaniem w zadaniu: `source`/`utm` nie istnieją na `inquiries` w baseline —
to nie jest STOP, tylko oczekiwany stan wyjściowy. Zapis w `docs/02-data-model.md` §1, że
`source` jest ghost column, był nieaktualny (poprawiony w tym PR).

### Migracja

`supabase/migrations/20260904210532_inquiries_source_utm.sql`:

```sql
ALTER TABLE "public"."inquiries"
  ADD COLUMN IF NOT EXISTS "source" "text",
  ADD COLUMN IF NOT EXISTS "utm" "jsonb";

ALTER TABLE "public"."inquiries"
  ADD CONSTRAINT "inquiries_source_check"
  CHECK ("source" IS NULL OR "source" = ANY (ARRAY['web_form'::"text", 'manual'::"text", 'email'::"text", 'whatsapp'::"text"]));

COMMENT ON COLUMN "public"."inquiries"."source" IS '...';
COMMENT ON COLUMN "public"."inquiries"."utm" IS '...';
```

Applied locally with `supabase migration up` (not `db reset` — that pattern is a hard
STOP-gate block in `scripts/agent-guard.sh` regardless of local/prod; `migration up`
achieves the same thing for local-only and isn't on the blocked-pattern list).

**`db diff` after migration (local) — clean:**
```
Applying migration 20260904165038_fix_nz_species_casing.sql...
Applying migration 20260904210532_inquiries_source_utm.sql...
Diffing schemas...
Finished supabase db diff on branch db/baseline-2026-09.

No schema changes found
```
(WARNING lines about PostGIS function grants are the same known noise documented in FA-1.01.)

**Red proof — CHECK constraint rejects invalid `source`:**
```sql
insert into inquiries (angler_name, angler_email, source) values ('Test Bad', 'bad@example.com', 'foo');
```
```
ERROR:  new row for relation "inquiries" violates check constraint "inquiries_source_check"
DETAIL:  Failing row contains (... foo).
```
Row count after the failed insert: `0` — the violation rolled back cleanly, nothing to clean up.

### Code

- `src/lib/inquiries/create.ts` (new) — the single insert path. Both callers go through it.
- `src/lib/utm.ts` (new) — twin of `gclid.ts`: localStorage, 90-day TTL, try/catch around
  every access, same shape.
- `src/components/analytics/GclidCapture.tsx` — extended (not duplicated) to also call
  `storeUtm()`.
- `src/components/inquiry/InquiryWidget.tsx` — reads `getStoredUtm()` alongside
  `getStoredGclid()` and sends `utm` in the POST body.
- `src/app/api/inquiries/route.ts` — insert replaced by `createInquiry(..., source: 'web_form')`;
  `utm` added to the Zod schema.
- `src/actions/inquiries.ts` — `createManualInquiry`'s old `source` param (channel: instagram/
  whatsapp/…) renamed to `channel` to stop overloading the name; it still writes
  `internal_notes = "Source: <channel>"` as before. The new `inquiries.source` column is
  hardcoded to `'manual'` for this path.
- `src/app/admin/inquiries/new/NewInquiryForm.tsx` — local state renamed `source` → `channel`
  to match.
- Removed: `src/app/plan-your-trip/` (page + layout), `src/actions/trip-plan.ts`, the
  `/plan-your-trip/` entry in `src/app/robots.ts`. Confirmed via grep before deletion that
  nothing else imported either.
- `docs/02-data-model.md` §1 — corrected the ghost-column note for `source`/`utm`.

### Verification — the parts in scope for FA-0.05

Per the standing rule against running `pnpm dev`/`pnpm start` (`.env.local` points at a
different test Supabase project), the two insert paths were exercised directly against the
**local** Supabase instance by running `createInquiry` itself (the real function, not a
re-implementation) via `pnpm dlx tsx`, with `NEXT_PUBLIC_SUPABASE_URL`/
`SUPABASE_SERVICE_ROLE_KEY` pointed at `http://127.0.0.1:54421` for that one invocation only:

```
select id, source, gclid, utm, internal_notes, status, created_at from inquiries order by created_at desc;

                  id                  |  source  |      gclid       |                                      utm                                      |  internal_notes   |     status     |          created_at
--------------------------------------+----------+------------------+-------------------------------------------------------------------------------+--------------------+----------------+-------------------------------
 3f87e321-ad02-4a3f-b621-e515ac13b06c | manual   |                  |                                                                               | Source: instagram | in_negotiation | 2026-09-04 22:23:31.641073+00
 6b74b141-aef7-4a73-91b5-01a86e7c189d | web_form | TEST_GCLID_12345 | {"utm_medium": "cpc", "utm_source": "google", "utm_campaign": "fa-0-05-test"} |                    | pending        | 2026-09-04 22:23:31.340529+00
(2 rows)
```
Both test rows deleted after the check; the one-off verification script was not committed.

```
$ grep -rn "plan-your-trip\|trip-plan\|thank-you" src || echo OK-landing-gone
OK-landing-gone

$ grep -rn "api.resend.com" src
src/app/api/webhooks/email-inbound/route.ts:91
src/lib/email.ts:103
(exactly the 2 allowed hits — email-inbound + email.ts, untouched)

$ grep -rn -A3 "from('inquiries')" src | grep "\.insert("
src/lib/inquiries/create.ts-44-    .insert({
(exactly one hit)
```

Types regenerated from the **local** db (not `pnpm supabase:types`, which targets prod —
prod doesn't have these columns until this migration is pushed there, which is a separate
STOP-gated step):
```
supabase gen types typescript --local > src/lib/supabase/database.types.ts
```
`inquiries.Row`/`Insert`/`Update` now carry `source: string | null` and `utm: Json | null`.
`git diff --stat`: 1 file changed, 2117 insertions(+), 975 deletions(-) — this is a full,
accurate regeneration against the real current schema, not a hand patch.

`pnpm test -- --run`: **green** — 3 files, 17 tests passed, none touch the affected dead tables.

### Blocked (4 IX) — `pnpm typecheck` / `pnpm build` were NOT green — *resolved by FA-1.06, see "Rebase" below*

Regenerating types accurately (as required above) surfaces that FA-1.01's baseline pull —
the authoritative read of production, done the same week — no longer has these tables in
`public`: `experiences`, `bookings`, `booking_messages`, `guide_accommodations`,
`experience_accommodations`, `experience_images`, `guide_images`, `leads`, `payments` (old).
`docs/02-data-model.md` already flagged all of these as dead in the Aug 31 audit — this
isn't a new discovery, it's that stale `database.types.ts` was masking the compile errors
that dead code should always have had. None of this is in FA-0.05's touched code — the only
overlap is `src/actions/inquiries.ts`, and there only in *other*, pre-existing functions
(`saveRichOffer`, `getOfferByToken`, `sendDepositLink`, …), never in `createManualInquiry`
(confirmed: first error in that file is at line 232, my edit ends at line ~180).

I flagged this to tj mid-task (regenerate-vs-scope tradeoff) — decision: **full regen,
accept red build, report as blocked.**

Files affected (confirmed via `pnpm typecheck` + `pnpm build`, first error each):
`src/actions/accommodations.ts`, `src/actions/admin.ts`, `src/actions/bookings.ts`,
`src/actions/experience-pages.ts`, `src/actions/experiences.ts`, `src/actions/guide-apply.ts`,
`src/actions/inquiries.ts` (pre-existing functions only), `src/actions/reviews.ts`,
`src/app/admin/experiences/new/page.tsx`, `src/app/admin/guides/[id]/page.tsx`,
`src/app/admin/guides/[id]/trips/[expId]/edit/page.tsx`, `src/app/admin/guides/new/page.tsx`,
`src/app/admin/guides/page.tsx`, `src/app/admin/inquiries/[id]/page.tsx`,
`src/app/admin/inquiries/page.tsx`, `src/app/admin/leads/page.tsx`, `src/app/admin/page.tsx`,
`src/app/api/stripe/webhook/route.ts`, `src/app/api/webhooks/stripe-deposit/route.ts`,
`src/app/dashboard/trips/page.tsx`, `src/app/experiences/[slug]/page.tsx`,
`src/lib/mock-data.ts`, `src/lib/supabase/queries.ts`, `src/types/index.ts` (23 files).

`pnpm build` fails at the TypeScript step with the same root cause, first hit:
```
./src/actions/accommodations.ts:6:59
Type error: Property 'guide_accommodations' does not exist on type '{...}'
```

`pnpm lint`: also red, but for unrelated pre-existing reasons (email templates using raw
apostrophes, `image-crop.tsx` ref-during-render, a parsing error in `whatsapp-bridge/poll-emails.mjs`,
one pre-existing `Unexpected any` at `src/actions/inquiries.ts:393` inside `saveRichOffer`).
None of FA-0.05's own new/touched code has lint errors from the type-aware rules; the two
`InquiryWidget.tsx` hook warnings that show up are pre-existing, at lines 51/747, untouched
by this diff.

This task cannot honestly claim "done" while two of its own acceptance criteria
(`pnpm typecheck`, `pnpm build` green) are red, even though the root cause is entirely
outside its scope and already covered by planned work (FA-1.06 → FA-1.07 → FA-1.08, all
`todo`, depending on FA-1.01 which is now `done`). Status set to `blocked` rather than
`done`; the 23-file list above is handed to whoever writes FA-1.06/1.07/1.08 next.

### Local dev environment note

`supabase/config.toml` + `supabase/.gitignore` are new (didn't exist in the repo before —
nothing had run `supabase init` here). Ports shifted +100 from the CLI defaults
(54421/54422/54420/54429/54423/54424/54427) only because another, unrelated project's
Supabase stack already holds the default ports on this machine. If another dev's machine
doesn't have that collision, these non-default ports still work fine — just flagging the
non-default choice in case tj wants to pick different ones.

### Poza zakresem — potwierdzone, nietknięte
`qualified`, backfill `source` na historyczne wiersze, `/admin/ads`, zachowanie agenta AI,
`InquiryWidget.tsx` poza przekazaniem `utm`, `email.ts`/`email-inbound` resend calls, SELECT/UPDATE
na `inquiries` poza tym PR-em.

---

## Rebase na `main` po FA-1.06 (2026-09-05)

Warunek startu: `origin/main` = `4d7b8c18 Merge pull request #11 from tj0517/chore/types-truth`
(FA-1.06). WIP `d9209f7a` przepisany na `07b50430` przez `git rebase origin/main`.

**Uwaga:** PR #11 został zmergowany o 16:58:12, a ostatni commit FA-1.06 `5a0aabc7`
(uzupełnienie D4, `docs/tasks/FA-1.09.md`, reguła §8 w `05-agent-operations.md`, wiersz o
martwych tokenach w `deferred-tasks.md`) wszedł na `origin/chore/types-truth` o 16:59:51 —
99 sekund po merge. **Nie ma go na `main`.** Ten PR go nie zawiera (nie mój zakres); decyzja
w raporcie poniżej.

### Konflikty i rozwiązanie

| Plik | Konflikt | Rozwiązanie | Co przepadło |
|---|---|---|---|
| `src/lib/supabase/database.types.ts` | oba: pełna regeneracja | wersja z `main`, potem `supabase migration up --local` i `supabase gen types typescript --local` — diff do `main`: **+6 linii**, dokładnie `source`/`utm` w `Row`/`Insert`/`Update`; druga generacja bajt w bajt identyczna | nic — moja regeneracja z 4 IX była przeciw baseline bez FA-1.06 |
| `src/app/api/inquiries/route.ts` | FA-1.06 zdjęła `as any` z insertu; ja zastąpiłem insert `createInquiry(...)` | moja strona (insert znika w całości, więc i rzutowanie) | nic |
| `src/actions/inquiries.ts` | brak — auto-merge | `createManualInquiry` (`channel`, `source='manual'`) obok przepisanych przez FA-1.06 funkcji; potwierdzone grepem | nic |
| `docs/02-data-model.md` | FA-1.06 przepisała §1 | wersja z `main`; zdanie „`source`/`utm` **not** in the baseline — FA-0.05 adds them" rozwinięte o nazwę migracji, CHECK i ścieżkę insertu | moja stara notka o ghost columns (już nieaktualna po §1 z FA-1.06) |
| `docs/deferred-tasks.md` | FA-1.06 dodała wiersz „FA-0.05 … odblokowane" | wersja z `main`; wiersz FA-1.06 o FA-0.05 zamknięty (`closed`), do wiersza o lint dopisane liczby po rebase | mój wiersz o 23 plikach — usunięty, FA-1.06 go domknęła |
| `docs/tasks/INDEX.md` | FA-1.06 zmieniła własny wiersz | wersja z `main`; FA-0.05 `todo → review`, `depends` = FA-1.06 | mój `blocked` (nieaktualny) |
| `supabase/config.toml`, `supabase/.gitignore` | add/add | identyczne bajt w bajt (te same porty +100) — git scalił sam; wersja `main` | nic; porty się nie różnią |

Żaden plik z mojego diffu nie został usunięty przez FA-1.06 (`comm` na listach — pusty), więc
bramka „FA-1.06 usunęła plik, który modyfikujesz" nie zadziałała.

### Report — FA-0.05 Jedna ścieżka tworzenia zapytania: `source` + UTM (po rebase)

#### Done
- Rebase na `main` (FA-1.06) — evidence: `git log --oneline -3` → `07b50430` na `4d7b8c18`; tabela wyżej.
- Odczyt stanu lokalnej bazy **przed** migracją (nie z notatek) — evidence:
  ```
  select column_name, data_type from information_schema.columns
  where table_schema='public' and table_name='inquiries'
    and column_name in ('source','gclid','utm','trip_length');
   gclid | text
   trip_length | text
  (2 rows)
  pg_constraint inquiries_source_check → (0 rows)
  schema_migrations → 20260904165037, 20260904165038
  select count(*) from inquiries → 0
  ```
  0 wierszy, więc `select distinct source` nie ma czego sprawdzać — bramka „wartości spoza CHECK-a" bezprzedmiotowa.
- Migracja zastosowana lokalnie — evidence: `supabase migration up --local` →
  `Applying migration 20260904210532_inquiries_source_utm.sql... Local database is up to date.`
- Stan **po** migracji — evidence:
  ```
   gclid       | text
   source      | text
   trip_length | text
   utm         | jsonb
  inquiries_source_check | CHECK (((source IS NULL) OR (source = ANY (ARRAY['web_form'::text, 'manual'::text, 'email'::text, 'whatsapp'::text]))))
  schema_migrations → 20260904165037, 20260904165038, 20260904210532
  ```
- `supabase db diff --local` — evidence: `Diffing schemas... No schema changes found`.
- Typy zregenerowane z lokalnej bazy — evidence: `git diff --stat` vs `main`: `database.types.ts | 6 ++++++`;
  `inquiries.Row`: `source: string | null`, `utm: Json | null`; `supabase gen types typescript --local | diff -q - src/lib/supabase/database.types.ts` → identyczne.
- Widget → `source='web_form'` + `utm` + `gclid`; admin → `source='manual'` — evidence: skrypt jednorazowy
  (`pnpm dlx tsx`, `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` z `supabase status -o env`,
  z blokadą na adres inny niż `127.0.0.1`) wywołał **prawdziwe** `createInquiry(...)` dla ścieżki widgetu
  i **prawdziwą** akcję `createManualInquiry(...)` dla admina (nie imitację jak 4 IX):
  ```
  select id, source, gclid, utm, internal_notes, status, angler_email, created_at from public.inquiries order by created_at;
   021a2868-… | web_form | PROOF_GCLID_0905 | {"utm_medium": "cpc", "utm_source": "google", "utm_campaign": "fa-0-05-rebase"} |                   | pending        | proof-web@example.com    | 2026-09-05 15:22:38
   90aa4cee-… | manual   |                  |                                                                                 | Source: instagram | in_negotiation | proof-manual@example.com | 2026-09-05 15:22:39
  (2 rows)
  DELETE 2 → rows_after_cleanup = 0
  ```
  (`Proof-Manual@Example.com` → `proof-manual@example.com`: lower-case z `createManualInquiry` działa.)
- Czerwony dowód CHECK — evidence:
  ```
  insert into public.inquiries (angler_name, angler_email, source) values ('Test Bad', 'bad@example.com', 'foo');
  ERROR:  new row for relation "inquiries" violates check constraint "inquiries_source_check"
  DETAIL:  Failing row contains (e6408ebe-…, …, foo, null).
  rows_after_failed_insert = 0
  ```
- Grepy — evidence:
  ```
  grep -rn "plan-your-trip\|trip-plan\|thank-you" src → OK-landing-gone (0 hits)
  grep -rn -A3 "from('inquiries')" src | grep "\.insert(" → src/lib/inquiries/create.ts-44-    .insert({
  grep -rn "api.resend.com" src → src/app/api/webhooks/email-inbound/route.ts:91, src/lib/email.ts:101
  ```
- `pnpm typecheck` → `tsc --noEmit`, exit 0, 0 błędów.
- `pnpm build` → exit 0, `Compiled successfully in 35.5s`, 46/46 stron (FA-1.06: 47; −1 = `/plan-your-trip`).
- `pnpm test -- --run` → 3 pliki, **17 passed**.
- `pnpm lint` — `main` (`4d7b8c18`, worktree z podlinkowanym `node_modules`): **42 błędy / 60 ostrzeżeń**;
  gałąź: **40 / 60**. Zero nowych; −2 to `eslint-disable no-explicit-any` zdjęte razem z insertami.
- Status `blocked → review` tu i w `INDEX.md`; `depends` = FA-1.06.

#### Not done
- ~~`db push` na produkcję — poza tym zadaniem, bramka STOP.~~ **Zrobione później tego samego
  dnia przez tj** (nie przez agenta) — sekcja „Push na produkcję" niżej. Kolejność „migracja przed
  merge'em" zachowana.
- Odczyt produkcji (`select distinct source`) — jak w FA-1.06: brak `SUPABASE_DB_PASSWORD` w sesji.
  Nie jest potrzebny: kolumny na produkcji nie istnieją (baseline z 4 IX to jej odczyt), więc nie ma
  wartości do sprawdzenia; migracja używa `ADD COLUMN IF NOT EXISTS`, a CHECK dopuszcza `NULL`.

#### Noticed, not touched (→ docs/deferred-tasks.md)
- `5a0aabc7` z FA-1.06 nie jest na `main` (merge 99 s przed pushem) — `origin/chore/types-truth`
  wciąż go ma; to docs-only. Nie w tym PR.
- Lint 42/60 na `main` — wiersz FA-1.06 uzupełniony o liczby po rebase (nie dublowany).
- Kontenery lokalnego stacka nazywają się `supabase_*_uwxrstbplaoxfghrchcy` mimo
  `project_id = "fjordanglers"` — CLI bierze id z `supabase/.temp/project-ref` po `supabase link`.
  Kosmetyka; wart jednej linii w runbooku sesji (`05-agent-operations.md` §4), nie tutaj.

#### Needs a decision
- **Kolejność push migracji vs deploy** — opcje: (a) `supabase db push` (STOP, zgoda tj) na
  `uwxrstbplaoxfghrchcy` **przed** merge tego PR-a, potem merge; (b) merge i push w jednym oknie,
  push pierwszy. Rekomendacja: (a) — migracja jest addytywna (`IF NOT EXISTS`, `NULL` dozwolony),
  stary kod z `main` jej nie zauważy, a nowy kod bez niej nie działa.
- `5a0aabc7` — osobny mini-PR `docs(FA-1.06)` z `origin/chore/types-truth` (jeden commit, tylko
  docs) albo cherry-pick do następnego PR-a docs. Rekomendacja: osobny PR, żeby `docs/tasks/FA-1.09.md`
  i reguła §8 istniały na `main` zanim ktoś weźmie FA-1.09.

#### Verification
```
$ git log --oneline -3
07b50430 wip(FA-0.05): source + utm single insert path, remove /plan-your-trip (blocked on FA-1.06)
4d7b8c18 Merge pull request #11 from tj0517/chore/types-truth
f8ba6421 docs(FA-1.06): report, data-model §1 after archive cleanup, deferred rows, status review

$ supabase migration up --local
Applying migration 20260904210532_inquiries_source_utm.sql...
Local database is up to date.

$ supabase db diff --local
Diffing schemas...
No schema changes found

$ supabase gen types typescript --local > src/lib/supabase/database.types.ts && git diff --stat
 src/lib/supabase/database.types.ts | 6 ++++++

$ pnpm typecheck   → exit 0
$ pnpm build       → exit 0, ✓ Compiled successfully in 35.5s, 46/46 pages
$ pnpm test -- --run → Test Files 3 passed (3) · Tests 17 passed (17)
$ pnpm lint        → main: ✖ 102 problems (42 errors, 60 warnings) · branch: ✖ 100 problems (40 errors, 60 warnings)

$ psql … -c "insert into public.inquiries (angler_name, angler_email, source) values ('Test Bad','bad@example.com','foo');"
ERROR:  new row for relation "inquiries" violates check constraint "inquiries_source_check"
```

---

## Push na produkcję (wykonany przez tj, 5 IX 2026)

**Kto i dlaczego.** `supabase migration list --linked`, `supabase db push` i oba SELECT-y na
produkcji wykonał **tj ręcznie w swoim terminalu**, nie agent. Poświadczenia produkcyjne
(`SUPABASE_DB_PASSWORD`) są świadomie poza zasięgiem sesji agenta do czasu zamknięcia
FA-0.09 (sekrety poza `settings.local.json`); agent nie łączył się z produkcją ani zapisem, ani
odczytem. Zgoda tj z 5 IX obejmowała wyłącznie tę jedną migrację i wyłącznie po kroku 1.
Kolejność (migracja **przed** merge'em PR-a) była częścią zgody: kod z tej gałęzi wstawia
`source` i `utm`, więc bez kolumn na produkcji każde nowe zapytanie padłoby na insercie.
Migracja `20260904210532` jest na produkcji od 5 IX 2026, więc zadanie liczy się jako
dotykające produkcji (`touches_prod: true`) dla wszystkich przyszłych ocen ryzyka.

### Krok 1 — pending przed pushem (`supabase migration list --linked`, tj)

```
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260904165037 | 20260904165037 | 2026-09-04 16:50:37
   20260904165038 | 20260904165038 | 2026-09-04 16:50:38
   20260904210532 |                | 2026-09-04 21:05:32
```

Pending: wyłącznie `20260904210532`. Historia pogodzona w FA-1.01 trzyma się — potwierdzone
odczytem, nie założeniem.

### Krok 2 — `supabase db push` (tj) i stan produkcji po pushu (psql, session pooler, tj)

```
select column_name, data_type, is_nullable from information_schema.columns
where table_name='inquiries' and column_name in ('source','utm','gclid','trip_length');

 column_name | data_type | is_nullable
-------------+-----------+-------------
 utm         | jsonb     | YES
 trip_length | text      | YES
 gclid       | text      | YES
 source      | text      | YES
(4 rows)

select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid='public.inquiries'::regclass and conname='inquiries_source_check';

        conname         |                              pg_get_constraintdef
------------------------+-------------------------------------------------------------------------------
 inquiries_source_check | CHECK (((source IS NULL) OR (source = ANY (ARRAY['web_form'::text, 'manual'::text, 'email'::text, 'whatsapp'::text]))))
(1 row)
```

CHECK: dokładnie cztery wartości, `NULL` dopuszczony. Żadnego INSERT-a na produkcji, także
testowego — czerwony dowód pochodzi z bazy lokalnej (wyżej) i wystarcza.

### Krok 3 — parytet typów (agent)

Przebieg, bez upiększania:
- `pnpm supabase:types` padło na `flag needs an argument: --project-id` (`$SUPABASE_PROJECT_ID`
  nie ma w env sesji), a przekierowanie `>` w skrypcie **wyzerowało** `database.types.ts` przed
  uruchomieniem komendy. Plik przywrócony z gita; od tego momentu generacja szła do pliku w
  scratchpadzie. Wiersz w `docs/deferred-tasks.md` → FA-1.11.
- `supabase gen types typescript --project-id uwxrstbplaoxfghrchcy` → `Unauthorized`: martwy
  `SUPABASE_ACCESS_TOKEN` z `settings.local.json`. Prefiks `SUPABASE_ACCESS_TOKEN=""` (obejście
  z FA-1.01, logowanie CLI z keychaina) zadziałał. To token API zarządzania, nie hasło do bazy.
  Wiersz w `deferred-tasks.md` → FA-0.09.

Wynik (`supabase gen types typescript --project-id uwxrstbplaoxfghrchcy --schema public,graphql_public`
vs plik w repo z `--local`, obie strony CLI 2.75.0):

```
raw diff: 13 hunków; po wyrównaniu listy schematów (zdalny generator domyślnie pomija graphql_public): 12
wszystkie 12 poza Database['public']:
  10,14d9                       nagłówek __InternalSupabase { PostgrestVersion: "14.5" } — tylko zdalny generator
  3701c3696 3706c3701 3730c3725 3734c3729 3755c3750 3759c3754
  3780c3775 3784c3779 3797c3792 3801c3796
                                nawiasy wokół typów warunkowych w helperach
                                Tables<> / TablesInsert<> / TablesUpdate<> / Enums<> / CompositeTypes<>
  3864a3860                     końcowy pusty wiersz

sekcja Database.public wycięta z obu plików (od "  public: {" do "type DatabaseWithoutInternals"):
  prod lines: 3653   local lines: 3653   identical: True
  inquiries.source: string | null  → obecne po stronie produkcji
  inquiries.utm: Json | null       → obecne po stronie produkcji
```

Decyzja tj 5 IX: parytet **spełniony** — schemat identyczny co do bajtu, różnice to szkielet
generatora, nie schemat. Plik w repo zostaje z generatora lokalnego (źródło od FA-1.06); wersja
z produkcji **nie** została podmieniona. Wybór jednego kanonicznego generatora dla CI → FA-1.11.

### Stan po kroku 4
Status `review` (plik + `INDEX.md`). Merge — tj.
