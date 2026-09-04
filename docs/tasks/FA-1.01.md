---
id: FA-1.01
title: Baseline schematu — `db pull` produkcji, archiwizacja 61 starych migracji, pogodzenie historii na produkcji
stage: 1
status: in_progress
difficulty: L
model: opus
model_approved:
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
