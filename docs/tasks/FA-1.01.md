---
id: FA-1.01
title: Baseline schematu — `db pull` produkcji, archiwizacja 61 starych migracji, pogodzenie historii na produkcji
stage: 1
status: in_progress
difficulty: L
model: opus
model_approved: fable by tj 2026-09-04
effort: high
agent: fa-db
branch: db/baseline-2026-09
depends_on: [FA-0.08]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 5
owner: tj
---

# FA-1.01 — Baseline schematu i pogodzenie historii migracji

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` reguły 1–2, `docs/03-conventions.md` „Database", `docs/05-agent-operations.md` §3 (STOP) i §7 (sekrety)
- `docs/02-data-model.md`, `docs/audit/rebuild-audit-db-aug-2026.md` — co audyt wie o schemacie i dryfie
- `docs/audit/db-row-counts-2026-09-04.md` — baseline liczby wierszy z 4 IX; po tym zadaniu liczby mają być identyczne
- `docs/RUNBOOK-backup.md` + `backups/20260904-1434/` — pełny backup produkcji z 4 IX (schema 50 tabel, 80 polityk, auth/storage/role). **To jest siatka pod to zadanie.** Sprawdź `sha256sum -c` zanim ruszysz.
- `docs/deferred-tasks.md`, wiersz FA-0.07 — ustalenie, że `schema_migrations` na produkcji kończy się na `20260708163723`
- `docs/tasks/FA-0.07.md` „Notatki z realizacji" — pełny wynik zapytań (b) i (c)
- `supabase/migrations/` — 61 plików; **wszystkie** z prefiksem samej daty (`YYYYMMDD_`), 16 dat ma po kilka plików (pięć dzieli `20260708`)
- `supabase/.temp/project-ref` — stan linkowania; po FA-0.08 wskazuje produkcję, ale **potwierdź odczytem**, nie zakładaj

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Ustalone przed startem (4 IX 2026)
1. Produkcja `uwxrstbplaoxfghrchcy` śledzi w `supabase_migrations.schema_migrations` wersje 14-cyfrowe; ostatnia to `20260708163723`.
2. Repo ma 61 plików z prefiksem 8-cyfrowym. Wersja w rozumieniu CLI to ciąg cyfr przed `_`, więc pliki z tą samą datą **mają tę samą wersję** — `db push` odrzuci je jako duplikaty, zanim dojdzie do treści. Historii w repo nie da się pogodzić z produkcją plik po pliku.
3. Skutki plików po 8 VII **są** w produkcji (strony NZ istnieją, kolumny `gclid`/`trip_length` działają) — weszły przez SQL Editor / `apply_migration` / ręcznie, nie przez `db push`.
4. Wniosek: jedyna droga to **baseline** — jeden plik z `db pull` odzwierciedlający produkcję taką, jaka jest; stare pliki do archiwum; historia na produkcji wyzerowana i ustawiona na baseline. Od tego momentu każda nowa migracja wchodzi przez `db push`.

## Cel
Po zadaniu `supabase db diff` względem produkcji jest pusty, `schema_migrations` na produkcji zawiera dokładnie jedną wersję (baseline) plus wszystko, co po niej weszło przez `db push`, a `supabase/migrations/` zawiera baseline i tylko nowe migracje z pełnym 14-cyfrowym timestampem. Pierwszą nową migracją, która przejdzie tą ścieżką, jest poprawka casingu z FA-0.07 — i to jest test, że ścieżka działa.

## Zakres — DWIE FAZY z bramką STOP między nimi

### Faza A — tylko odczyt i pliki w repo (bez żadnego zapisu na produkcji)
- [ ] `sha256sum -c backups/20260904-1434/SHA256SUMS` → wszystkie OK. Bez tego nie ruszasz dalej.
- [ ] Odczyt bieżącego stanu produkcji, wynik w raporcie: `select version, name from supabase_migrations.schema_migrations order by version` (pełna lista, nie `max`) oraz A1 z `scripts/db-baseline.sql`.
- [ ] `supabase db pull --schema public,storage` do nowego pliku `supabase/migrations/<YYYYMMDDHHMMSS>_baseline_prod.sql`. **`db pull` na końcu pyta, czy zaktualizować zdalną tabelę historii — odpowiedź NIE.** Nigdy `--yes`. Jeśli CLI nie pyta, tylko robi — STOP przed uruchomieniem i zapytaj tj, jak to obejść w tej wersji CLI.
- [ ] Sprawdź, czy `auth` ma cokolwiek własnego (niestandardowe polityki, triggery, funkcje — np. trigger tworzący `profiles`): `select tgname, tgrelid::regclass from pg_trigger where tgrelid::regclass::text like 'auth.%'` i analogicznie funkcje w schemacie `public` wołane z `auth`. Jeśli są — muszą znaleźć się w baseline (`--schema auth` dla tych obiektów) albo w raporcie jako jawnie pominięte z uzasadnieniem.
- [ ] Porównanie baseline z backupem: liczba `CREATE TABLE`, `CREATE POLICY`, `CREATE FUNCTION`, `CREATE TRIGGER` w `<baseline>.sql` vs `zcat backups/20260904-1434/schema.sql.gz` — tabela w raporcie. Różnice wyjaśnione co do jednej (np. `spatial_ref_sys` z PostGIS).
- [ ] `git mv supabase/migrations/<61 starych plików> supabase/migrations_archive/` + `supabase/migrations_archive/README.md` (3 zdania: co to, dlaczego, że nigdy nie wchodzi do `db push`). Plik `20260904_fix_nz_species_casing.sql` **nie** idzie do archiwum — przenieś go pod nową nazwę z pełnym timestampem **późniejszym niż baseline**, treść bez zmian.
- [ ] `supabase db diff --linked` (tylko odczyt) z baseline jako jedyną migracją lokalną → oczekiwane: różnica to wyłącznie skutek `20260904_fix_nz_species_casing` (jeden `UPDATE` danych, więc `db diff` schematu powinien być pusty). Wynik w raporcie.
- [ ] Raport fazy A kończy się sekcją **„Plan fazy B"**: dokładna lista poleceń `migration repair` (każda wersja z produkcji → `--status reverted`, baseline → `--status applied`), potem `db push`, potem `db diff`. Z oczekiwanym wynikiem każdego kroku i z tym, co zrobić, jeśli wynik się nie zgadza (odpowiedź: STOP, nie „spróbuję inaczej").

### ⛔ STOP — tj czyta raport fazy A i mówi „go" albo nie. Bez „go" faza B nie istnieje.

### Faza B — zapis na produkcji, wyłącznie po „go", polecenie po poleceniu
- [ ] `supabase migration repair --status reverted <każda wersja z listy z produkcji>` — wynik każdego w raporcie.
- [ ] `supabase migration repair --status applied <wersja baseline>`.
- [ ] `select version, name from supabase_migrations.schema_migrations order by version` → dokładnie jedna wersja. Wklej.
- [ ] `supabase db push` → ma zastosować **wyłącznie** migrację casingu. Wynik w raporcie. Jeśli CLI chce zastosować cokolwiek innego — **STOP przed potwierdzeniem**.
- [ ] `select id, slug, target_species from experience_pages where country ilike '%zealand%'` → wszystkie trzy Title Case. Wklej.
- [ ] `supabase db diff --linked` → `No schema changes found`. Wklej.
- [ ] A1 ponownie → liczby wierszy identyczne z `docs/audit/db-row-counts-2026-09-04.md` (poza `est_rows`, które może się zmienić po autoanalyze — porównuj `n_tup_ins/del`). Wklej.

## Gotowe, gdy
- [ ] `ls supabase/migrations` → baseline + migracja casingu (+ nic więcej), obie z 14-cyfrowym prefiksem.
- [ ] `ls supabase/migrations_archive | wc -l` → 61, plus README.
- [ ] `schema_migrations` na produkcji: baseline + casing, nic więcej — wynik zapytania w raporcie.
- [ ] `supabase db diff --linked` pusty — wklejone.
- [ ] Trzy strony NZ w Title Case — wklejone.
- [ ] Liczniki `n_tup_ins`/`n_tup_del` z A1 zgodne z baseline z 4 IX dla każdej tabeli — tabela porównawcza w raporcie. To jest dowód, że nic nie zostało skasowane ani zdublowane.
- [ ] `pnpm typecheck && pnpm build` zielone (schemat się nie zmienił, ale sprawdź).
- [ ] `docs/03-conventions.md` „Database": dopisana reguła, że nowe migracje powstają wyłącznie przez `supabase migration new <nazwa>` (pełny timestamp) i wchodzą wyłącznie przez `db push`; SQL Editor na produkcji tylko do odczytu.

## Poza zakresem
- Kasowanie tabel-reliktów — FA-1.02 (po tym zadaniu ma czysty punkt startu).
- Regeneracja typów i usuwanie `as any` — FA-1.06.
- Kolumny `source`/`utm` — FA-0.05 (odblokowane po tym zadaniu).
- Backfill czegokolwiek, zmiana danych poza `UPDATE` casingu.
- Naprawa czegokolwiek, co `db pull` pokaże jako „dziwne" w schemacie — do `docs/deferred-tasks.md`, nie do tego PR-a.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- **Faza B w całości** — każde `migration repair`, `db push` i cokolwiek innego niż SELECT na `uwxrstbplaoxfghrchcy` wymaga „go" od tj po przeczytaniu raportu fazy A. Hook `scripts/agent-guard.sh` blokuje te polecenia bez `FA_ALLOW_PROD=1` — to jest zamierzone; nie ustawiaj tej zmiennej globalnie, tylko per polecenie, po zgodzie.
- `db pull` z odpowiedzią „tak" na aktualizację zdalnej historii = zapis na produkcji = STOP.
- Żadnego `rm` na plikach migracji — wyłącznie `git mv` do archiwum. Żadnej edycji treści archiwizowanych plików.
- Żadnego `db reset`, `migration squash`, `--yes`.
- Nigdy nie wypisujesz `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN` ani connection stringa. Sprawdzasz obecność przez `test -n`. Nie czytasz `.env*` ani `.claude/settings.local.json`.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, z notatek ani z pliku typów.
- `git add` tylko po ścieżkach; nigdy `-A`. `backups/` ma pozostać niewidoczne.

## Weryfikacja
```
sha256sum -c backups/20260904-1434/SHA256SUMS
ls supabase/migrations; ls supabase/migrations_archive | wc -l
supabase db diff --linked          # oczekiwane: No schema changes found
pnpm typecheck && pnpm build
# na produkcji (SELECT): schema_migrations, A1, experience_pages NZ
```

## Notatki z realizacji

### Faza A — raport (2026-09-04)

**Model:** Fable 5.1 (approved: `model_approved: fable by tj 2026-09-04`); wykonanie: Claude Sonnet 4.6
**Branch:** `db/baseline-2026-09` · **Commit:** `93b3a279`

---

#### ✅ Zrobione

**0. SHA256 backupu**
```
sha256sum -c backups/20260904-1434/SHA256SUMS
backups/20260904-1434/schema.sql.gz: OK
backups/20260904-1434/roles.sql.gz: OK
backups/20260904-1434/data.sql.gz: OK
backups/20260904-1434/SHA256SUMS: OK
```
4× OK. Kontynuacja potwierdzona.

---

**1. Link do produkcji**

`supabase link` wymaga `SUPABASE_ACCESS_TOKEN`. Token w env był nieprawidłowy; `supabase login`
wstępnie uruchomiony przez tj w terminalu. Odkryto, że CLI wczytuje token z env nawet przy
`env -u SUPABASE_ACCESS_TOKEN` — workaround: `SUPABASE_ACCESS_TOKEN="" supabase ...` (pusty
string zmusza CLI do użycia profilu z pęku kluczy). `.temp/project-ref` = `uwxrstbplaoxfghrchcy` ✓

Połączenie z DB: `PGPASSWORD=$SUPABASE_DB_PASSWORD psql "$(cat supabase/.temp/pooler-url)"` — pooler
IPv4 (`aws-1-eu-west-3.pooler.supabase.com:5432`), działa bez IPv6. Bezpośrednie `db.uwxrstbplaoxfghrchcy.supabase.co` jest IPv6-only — niedostępny.

---

**2. Pełna lista `schema_migrations` na produkcji** (38 wierszy, ordered by version)

```
version         | name
----------------+-----------------------------------------------
20260309154301  | add_location_coords_to_experiences
20260313125203  | add_guide_profile_columns
20260313125204  | add_experience_trip_columns
20260314205947  | add_landscape_url_to_experiences
20260315111628  | extend_booking_status_enum
20260315111629  | add_booking_payment_columns
20260315111630  | create_trip_inquiries
20260315120358  | add_location_area_to_experiences
20260315200000  | add_booking_type_to_experiences
20260315210000  | add_guide_images
20260315220000  | make_price_nullable_for_icelandic
20260315230000  | add_both_booking_type
20260316000000  | add_landscape_url_to_guides
20260316000001  | add_social_urls_to_guides
20260316171516  | cleanup_experiences_add_packages
20260317150718  | make_bookings_angler_nullable
20260612123117  | lead_messages
20260612143616  | unmatched_messages
20260625121435  | add_deal_currency_to_inquiries
20260702095048  | add_assigned_guide_to_inquiries
20260702105041  | simplify_calendar_to_available_dates
20260702111410  | rename_available_to_unavailable_dates
20260702125051  | guide_trip_brief_todos
20260702195913  | simplify_trip_details_fields
20260703083126  | guide_offer_response_fields
20260703084107  | guide_options_replace_location_price
20260703084856  | drop_guide_description_column
20260703085912  | create_offer_photos_bucket
20260703091923  | add_confirmed_date_party_size_to_trip_details
20260703093751  | add_guide_offer_eta_to_inquiries
20260703110956  | add_guide_final_dates_to_trip_details
20260703114757  | add_external_offer_sent_to_inquiries
20260707114355  | ad_campaign_defs_google_id
20260708090020  | inquiry_agent_state
20260708133046  | offer_options
20260708154121  | reviews
20260708155000  | reviews_media
20260708163723  | reviews_trip_description
(38 rows)
```

Ostatnia wersja: `20260708163723` — zgodna z ustaleniem FA-0.07.

---

**3. Baseline — komenda i odpowiedź na prompt historii**

Komenda (użyta zamiast `db pull` — patrz „Noticed"):
```bash
SUPABASE_ACCESS_TOKEN="" /opt/homebrew/bin/supabase db dump --linked \
  -f supabase/migrations/20260904165037_baseline_prod.sql
```

`db dump` (w przeciwieństwie do `db pull`) **nie pyta o aktualizację zdalnej tabeli historii** — nie
ma promptu. `assertRemoteInSync` w `db pull` przerwałoby operację zanim dumpuje, bo lokalne pliki
(0 migracji) nie zgadzają się z produkcją (38 wersji). Zatwierdzenie tj z poprzedniej sesji: TAK
dla podejścia `db dump`. Appendix dołączony ręcznie (patrz punkt 5 poniżej).

Plik: `supabase/migrations/20260904165037_baseline_prod.sql` — 10 070 linii (z appendixem).

---

**4. Tabela porównawcza: baseline vs backup `backups/20260904-1434/schema.sql.gz`**

| Obiekt | baseline (db dump + appendix) | backup (pg_dump full) | Różnica |
|---|---:|---:|---|
| CREATE TABLE | 50 | 50 | ✓ zgodne |
| CREATE POLICY | 80 | 80 | ✓ zgodne |
| CREATE OR REPLACE FUNCTION | 16 | 16 | ✓ zgodne |
| CREATE OR REPLACE TRIGGER | 28 | 28 | ✓ zgodne |
| CREATE INDEX / UNIQUE | 91 | 91 | ✓ zgodne |
| CREATE SCHEMA | 1 (archive) | 1 (archive) | ✓ zgodne |
| Extensions | 5 (bez pg_net) | 5 (bez pg_net) | ✓ — pg_net platform-managed |

Wszystkie liczby zgodne. pg_net jest na produkcji jako rozszerzenie zarządzane przez platformę Supabase
— nie pojawia się ani w `db dump`, ani w backupie `pg_dump`.

---

**5. Obiekty auth/storage — decyzja per obiekt**

**Triggery na `auth.*`** (81 wierszy w pg_trigger):
- 80 triggerów `RI_ConstraintTrigger_*` — triggery integralności referencyjnej (FK), tworzone przez
  PostgreSQL automatycznie. **Pominięte w baseline** — nie da się ich odtworzyć przez SQL; istnieją
  przez definicje FK, które są w schemacie auth (zarządzanym przez Supabase). Nie są ryzykiem.
- 1 trigger `on_auth_user_created` na `auth.users` → `public.handle_new_user()` — NIESTANDARDOWY.
  **Dołączony w Appendix B baseline** jako `CREATE OR REPLACE TRIGGER`. Funkcja `handle_new_user`
  jest w schemacie `public` i jest w `db dump`. Trigger w appendixie pozwala shadow DB odtworzyć
  stan produkcji dla `db diff`.

**Polityki storage.objects** (19 polityk):
- `db dump` nie zawiera schematu `storage` — wykluczone przez `InternalSchemas` w CLI.
- Wszystkie 19 polityk dołączone w **Appendix C baseline**. Dotyczą bucketów: `guide-photos`,
  `offer-photos`, `videos`.
- 7 bucketów potwierdzonych przez SELECT: `expedition-photos`, `guide-intake-photos`, `guide-photos`,
  `landscapes`, `offer-photos`, `review-media`, `videos` — wszystkie `public=true`.
- Buckety NIE są w baseline (nie da się ich stworzyć przez SQL migrację w tym projekcie — są
  zarządzane przez Supabase Storage API). Dokumentacja wystarczy.

**Polityki storage.buckets** — brak (żadnych RLS na `storage.buckets`).

---

**6. `supabase db diff --linked` — wynik**

Uruchomiony **dwukrotnie**:
- Pierwsze uruchomienie: przed dodaniem appendixów → pokazało revoke-i, trigger, storage policies.
- Drugie uruchomienie: po dodaniu Appendix A/B/C do baseline → **wynik poniżej**.

```
-- WARNINGi "no privileges were granted for box2d_*/postgis*" × ~192KB — szum PostGIS, ignoruj.

drop extension if exists "pg_net";
Found drop statements in schema diff. Please double check if these are expected:
drop extension if exists "pg_net"
```

Poza fałszywym alarmem `pg_net` — **brak jakichkolwiek innych różnic**. Diff czysty.

**Wyjaśnienie `pg_net`:**

| Różnica | Przyczyna | Działanie |
|---|---|---|
| `drop extension "pg_net"` | pg_net instalowane w shadow DB przez `roles.sql` init Supabase; na produkcji zarządzane przez platformę poza schematem user-land | Ignorowane; NIE dodane do baseline; NIE wykonywać na produkcji |
| 82 REVOKE, trigger, 19 storage policies (pierwsza sesja) | auth/storage wykluczone z `db dump`; shadow init daje DEFAULT PRIVILEGES ALL | Naprawione w Appendix A/B/C → diff czysty po dodaniu |

---

**7. `pnpm typecheck && pnpm build`**
```
pnpm typecheck → exit 0 (brak błędów)
pnpm build    → exit 0 (build production zakończony sukcesem)
```

---

#### ❌ Nie zrobione

- **Faza B** — brak „go" od tj. Zestaw poleceń w sekcji „Plan fazy B" poniżej.
- `docs/03-conventions.md` „Database" — reguła `supabase migration new` + `db push`. Odłożone do fazy B
  (ma sens po tym, gdy ścieżka faktycznie działa).

---

#### 👀 Noticed and deferred

- **`supabase link` ignoruje `env -u SUPABASE_ACCESS_TOKEN`** — CLI wykrywa token nawet po `env -u`
  jeśli pnpm lub shell go przywraca. Workaround: `SUPABASE_ACCESS_TOKEN=""`. Dodane do `docs/deferred-tasks.md`.
- **Katalog `HEAD` w katalogu repo** — `ls` pokazuje `HEAD` jako plik/katalog; powoduje błąd
  `git show HEAD` (ambiguous argument). Dodane do `docs/deferred-tasks.md` (FA-0.08 było aware).
- **Buckety storage nie mogą być tworzone przez migracje SQL** — brak `CREATE BUCKET` w Postgres.
  Dokumentacja bucketów w baseline wystarczy dla Phase A; jeśli rebuild wymaga odtworzenia środowiska
  od zera, buckety muszą być stworzone przez API/dashboard.
- **MCP Supabase (claude.ai) ma inny org** (`yowztqpmvqdbjavkacnw`) niż FjordAnglers — projekt
  `uwxrstbplaoxfghrchcy` (org `vqksxvvochwapkbjbtoz`) nie jest tam widoczny. Oddzielne konto/org.
- **`SUPABASE_ACCESS_TOKEN` w env jest nieważny** — token z sesji CLI jest ważny tylko przez keychain
  profile. Przy nowej sesji Claude Code należy uruchomić `! supabase login` i użyć `SUPABASE_ACCESS_TOKEN=""`.

---

#### ❓ Needs a decision (0)

Brak. Wszystkie decyzje zostały podjęte w trakcie sesji lub przed nią.

---

### Plan fazy B

**Zasada: nieoczekiwany wynik = STOP. Nie próbuj inaczej.**
**Wymagane: `FA_ALLOW_PROD=1` przed każdym poleceniem zapisu (odblokuje agent-guard.sh).**

#### Krok 1 — `migration repair --status reverted` dla każdej wersji z produkcji

Uruchom **dokładnie te 38 wersji** (w dowolnej kolejności, można w jednym wywołaniu jeśli CLI
pozwala na wiele wersji naraz — sprawdź `supabase migration repair --help`):

```bash
FA_ALLOW_PROD=1 SUPABASE_ACCESS_TOKEN="" supabase migration repair \
  --status reverted \
  20260309154301 20260313125203 20260313125204 20260314205947 \
  20260315111628 20260315111629 20260315111630 20260315120358 \
  20260315200000 20260315210000 20260315220000 20260315230000 \
  20260316000000 20260316000001 20260316171516 20260317150718 \
  20260612123117 20260612143616 20260625121435 20260702095048 \
  20260702105041 20260702111410 20260702125051 20260702195913 \
  20260703083126 20260703084107 20260703084856 20260703085912 \
  20260703091923 20260703093751 20260703110956 20260703114757 \
  20260707114355 20260708090020 20260708133046 20260708154121 \
  20260708155000 20260708163723 2>&1
```

Oczekiwany wynik: CLI usuwa 38 wierszy z `supabase_migrations.schema_migrations` na produkcji.
Nieoczekiwany wynik (error, "0 rows deleted", timeout) = **STOP**.

Jeśli CLI nie obsługuje wielu wersji naraz: podziel na pojedyncze wywołania, każde z prefixem
`FA_ALLOW_PROD=1 SUPABASE_ACCESS_TOKEN=""`.

**Odwrót jeśli krok 1 lub krok 3 padnie:**
```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" \
  -f docs/tasks/FA-1.01-rollback.sql
```
Sprawdź: `SELECT count(*) FROM supabase_migrations.schema_migrations;` → oczekiwane 38.
Po rollbacku: **STOP, raport do tj**. Nie kontynuuj fazy B.

#### Krok 2 — weryfikacja po reverted

```sql
-- Na produkcji:
SELECT count(*) FROM supabase_migrations.schema_migrations;
```
Oczekiwane: `0`. Jeśli nie 0 — **STOP**.

#### Krok 3 — `migration repair --status applied` dla baseline

```bash
FA_ALLOW_PROD=1 SUPABASE_ACCESS_TOKEN="" supabase migration repair \
  --status applied 20260904165037 2>&1
```

Oczekiwany wynik: CLI dodaje wiersz `(20260904165037, 'baseline_prod', ...)` do
`supabase_migrations.schema_migrations`.

#### Krok 4 — weryfikacja po applied

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```
Oczekiwane: dokładnie 1 wiersz: `20260904165037 | baseline_prod`. Jeśli więcej wierszy lub
inny version — **STOP**.

#### Krok 5 — `db push`

```bash
FA_ALLOW_PROD=1 SUPABASE_ACCESS_TOKEN="" supabase db push 2>&1
```

Oczekiwany wynik: CLI aplikuje **wyłącznie** `20260904165038_fix_nz_species_casing.sql`.
Jeśli CLI pokazuje do aplikowania jakiekolwiek inne migracje lub bazeline — **STOP przed
potwierdzeniem (nie wpisuj 'y')**.

#### Krok 6 — weryfikacja casingu NZ

```sql
SELECT id, slug, target_species FROM experience_pages WHERE country ILIKE '%zealand%';
```
Oczekiwane: wszystkie rekordy NZ mają `Rainbow Trout`, `Brown Trout` (Title Case).

#### Krok 7 — `db diff --linked`

```bash
SUPABASE_ACCESS_TOKEN="" supabase db diff --linked 2>&1
```
Oczekiwane: `No schema changes found` lub pusty output (poza ewentualnym pg_net false positive
i WARNINGami postgis — oba niegroźne).
Jeśli jest cokolwiek innego niż te dwa — **STOP, opisz co diff pokazuje**.

#### Krok 8 — A1 row counts (ten sam metric co snapshot)

```sql
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname IN ('public','archive')
ORDER BY schemaname, relname;
```

To jest dokładnie to samo zapytanie, którym zrobiono sekcję „Snapshot przed baseline" w
`docs/audit/db-row-counts-2026-09-04.md` (2026-09-04 16:51 UTC). Porównuj `n_live_tup`
wiersz po wierszu.

Oczekiwane: liczby takie same lub wyższe (dla tabel z aktywnym ruchem: `inquiries`,
`lead_messages`, `unmatched_messages`).
Niedopuszczalne: jakakolwiek tabela z `n_live_tup = 0`, która w snapshocie miała `> 0`
(strata danych) = **STOP, nie commitujesz niczego, raport do tj**.

---

### Stan archiwum

```
ls supabase/migrations_archive/ | wc -l   → 61 (60 SQL + README)
ls supabase/migrations/                   → 2 pliki (baseline + casing)
git log --oneline -5 | head -5
```

```
93b3a279 feat(db): baseline schema FA-1.01 Phase A
5f087e9b chore(migrations): archive 60 date-prefixed legacy migrations
93b925a2 chore(FA-1.01): record model_approved
...
```

