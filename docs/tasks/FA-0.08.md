---
id: FA-0.08
title: pg_dump produkcji + runbook backupu (warunek wstępny etapu 1)
stage: 0
status: done
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-db
branch: docs/backup-runbook
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 2
owner: tj
---

# FA-0.08 — Backup produkcji i runbook

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` reguła 1, `docs/05-agent-operations.md` §7 (sekrety)
- `docs/REBUILD_PLAN.md` §8 etap 0 pkt 9 i etap 1 — dlaczego bez dumpu nie ruszamy
- Supabase CLI: `supabase db dump --linked --data-only` / `--schema-only`, wymaga `SUPABASE_DB_PASSWORD` w env (agent **nie wypisuje** jego wartości; sprawdza `test -n`)
- Supabase → Database → Backups — czy plan projektu ma dzienne backupy i PITR

## Cel
Etap 1 kasuje ~12 tabel, etap 4 przepisuje `inquiries`. Przed tym musi istnieć pełny, zweryfikowany zrzut produkcji poza Supabase i jednostronicowa procedura „jak go zrobić i jak przywrócić", żeby drugi founder mógł to wykonać sam.

## Zakres
- [ ] Odczyt bieżącego stanu: status backupów w Supabase (dzienne? PITR?), rozmiar bazy (`pg_database_size`), lista tabel z liczbą wierszy (zapytanie A1 z `docs/REBUILD_PLAN.md` załącznik A) — w raporcie.
- [ ] `scripts/db-backup.sh`: `supabase db dump` schema + data do `backups/<YYYYMMDD-HHMM>/`, `gzip`, sha256; katalog `backups/` w `.gitignore`.
- [ ] `docs/RUNBOOK-backup.md`: jak zrobić dump, gdzie go składować (poza repo i poza laptopem — decyzja tj: który storage), jak przywrócić na nowy projekt Supabase, jak zweryfikować (liczba wierszy per tabela przed/po).
- [ ] Jednorazowe wykonanie dumpu przez tj (nie agenta — hasło do bazy) według runbooka; agent weryfikuje plik: rozmiar > 0, `pg_restore --list` / `head` zawiera `CREATE TABLE inquiries`.
- [ ] Wynik A1 zapisany jako `docs/audit/db-row-counts-<data>.md` — to jest baseline do porównania po etapie 1.

## Gotowe, gdy
- [ ] Plik dumpu istnieje poza repo, ma sumę kontrolną w raporcie i zawiera wszystkie tabele z A1 (porównanie listy).
- [ ] `docs/RUNBOOK-backup.md` przeszedł próbę: drugi founder wykonał procedurę z runbooka bez pytań (potwierdzenie tj).
- [ ] `backups/` w `.gitignore`; `git status` nie pokazuje dumpu.
- [ ] Row counts zapisane w `docs/audit/`.

## Poza zakresem
- Automatyzacja backupów cronem — osobne zadanie po etapie 1, jeśli plan Supabase nie ma PITR.
- Przywracanie na środowisko testowe (to jest część etapu 4).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Odczyt produkcji tylko SELECT i `db dump`. Żadnych zapisów.
- Agent nigdy nie wypisuje `SUPABASE_DB_PASSWORD` ani connection stringa z hasłem.

## Weryfikacja
```
test -n "$SUPABASE_DB_PASSWORD" && echo set || echo MISSING
ls -la backups/ 2>/dev/null; git check-ignore backups/ && echo ignored
```

## Notatki z realizacji

### Raport — Sonnet 5, effort low (2026-09-04)

Wykonane wg "Uzupełnienia od tj" (mają pierwszeństwo — punkty i kryteria niżej odbiegają
od treści zadania powyżej, patrz różnice zakresu w pkt 1, 4, 5 i skorygowane kryteria).

#### Ustalenie project-ref (punkt 1) — na samej górze

```
$ cat supabase/.temp/project-ref
igvmqroqerangldyheoy
$ ls -la supabase/.temp/project-ref
-rw-r--r--@ 1 tymonjezionek staff 20 Mar 19 13:22 supabase/.temp/project-ref
```
Data pliku: **19 marca 2026**. Produkcja FjordAnglers to `uwxrstbplaoxfghrchcy`
(`docs/05-agent-operations.md:46`, `CLAUDE.md`). Refy się różnią — potwierdzone.
`supabase/config.toml` **nie istnieje** w repo — tylko `migrations/` i `.temp/`.

**STOP zastosowany:** nie wykonałem żadnego `supabase link`, `db dump`, `db pull` ani
`gen types` dotykającego zdalnego projektu bez odpowiedzi tj. Jedyne polecenie CLI, jakie
uruchomiłem, to `pnpm supabase db dump --help` i `pnpm supabase link --help` — lokalne,
bez sieci, tylko żeby nie zgadywać składni flag w skrypcie.

Sprawdziłem też, czy mam bezpośredni dostęp odczytu do produkcji tą sesją (konektor MCP
Supabase) — miałem załadowane narzędzia `mcp__supabase__list_projects` /
`execute_sql`, ale wywołanie zwróciło:
```
Unauthorized. Please provide a valid access token to the MCP server via
the --access-token flag or SUPABASE_ACCESS_TOKEN.
```
Brak dostępu potwierdzony — nie obchodziłem tego (żadnego czytania `.env*` ani
`.claude/settings.local.json` w poszukiwaniu tokenu). Zgodnie z zadaniem: **czekam na
wynik A1 od tj**, plik `docs/audit/db-row-counts-2026-09-04.md` **nie powstał**.

CLI bez `config.toml`: `supabase db dump --help` i `link --help` zadziałały mimo braku
`config.toml` w repo — CLI nie wymaga go do samych tych poleceń (prawdopodobnie inicjuje
stan w locie / używa flag). Nie testowałem `db dump` na żywo, więc to obserwacja
ograniczona do `--help`, nie potwierdzenie że cały workflow zadziała bez `supabase init`.

#### Done

1. **Higiena `.temp/`:**
```
$ git ls-files supabase/.temp   → 8 plików (cli-latest, gotrue-version, pooler-url,
  postgres-version, project-ref, rest-version, storage-migration, storage-version)
$ git rm -r --cached supabase/.temp   → wypięte z indeksu, pliki nadal na dysku (`ls supabase/.temp/` po komendzie pokazuje wszystkie 8)
```
   Dopisane do `.gitignore`: `supabase/.temp/` i `backups/`.

2. **`scripts/db-backup.sh`** (wzorowany na `scripts/agent-guard.sh` / `scripts/vercel-ignore-build.sh`):
   - wymaga jawnego refa (`$1` lub `PROJECT_REF`) — odmawia bez niego z uzasadnieniem w komunikacie
   - **nie zgaduje** connection stringa/pooler URL — sprawdziłem realne flagi przez
     `supabase db dump --help` i `supabase link --help`; skrypt robi jawny
     `supabase link --project-ref "$REF" -p "$SUPABASE_DB_PASSWORD"`, potem
     `db dump --linked --schema-only` / `--data-only` (nigdy suchego `--linked` bez
     wcześniejszego jawnego linkowania do podanego refa)
   - `test -n "$SUPABASE_DB_PASSWORD"` → `set`/`MISSING`, bez wypisania wartości
   - gzip obu plików + `sha256sum` → `SHA256SUMS`

3. **Czerwony dowód** (brak refa):
```
$ bash scripts/db-backup.sh
ERROR: project ref is required — pass it as $1 or set PROJECT_REF.
This is deliberate: supabase/.temp/project-ref is local link state, not
confirmed prod. Look up the correct ref before running this script.
exit=1
```

4. **`test -x`:**
```
db-backup.sh: executable
agent-guard.sh: executable
vercel-ignore-build.sh: executable
```

5. **`scripts/db-baseline.sql`** — zapytanie A1 dosłownie z `docs/REBUILD_PLAN.md`
   Załącznik A (linie 524–530), jeden plik gotowy do wklejenia w SQL Editor.

6. **`docs/RUNBOOK-backup.md`** — sekcje: 0 (przed startem — ostrzeżenie o stale refie),
   1 (wykonanie), 2 (składowanie — `TODO(tj): storage`), 3 (weryfikacja — sha256sum,
   `CREATE TABLE` count, `CREATE TABLE public.inquiries`), 4 (przywrócenie na nowy
   projekt), 5 (awaria w połowie dumpu).

7. **`git status` — brak plików z `backups/`:**
```
$ git status --short
 M .gitignore
A  docs/RUNBOOK-backup.md
A  scripts/db-backup.sh
A  scripts/db-baseline.sql
D  supabase/.temp/* (×8)
```
   `backups/` nie istnieje na dysku — żaden dump nie został uruchomiony w tej sesji.

8. **`git check-ignore`:**
```
$ git check-ignore supabase/.temp backups/
supabase/.temp
backups/
exit=0
```
   Oba ignorowane.

#### Needs a decision

**Gdzie składować dumpy** (`TODO(tj): storage` w runbooku) — trzy opcje:
1. **S3/R2 bucket dedykowany do backupów** (rekomendacja) — tani, wersjonowany, łatwy do
   zautomatyzowania cronem później (poza zakresem tego zadania), niezależny od laptopa
   żadnego z founderów.
2. **1Password/Vaultwarden jako plik załącznika** — spójne z tym, gdzie już trzymacie
   `SUPABASE_DB_PASSWORD`, ale menedżery haseł nie są zaprojektowane pod duże pliki
   binarne (dump może szybko przekroczyć rozsądny rozmiar załącznika).
3. **Zaszyfrowany katalog na dysku zewnętrznym, offline** — najtańsze i najbardziej
   odporne na kompromitację konta w chmurze, ale ręczne, bez wersjonowania, i zależne od
   dyscypliny robienia kopii z laptopa na dysk.

Rekomendacja: opcja 1, z hasłem/kluczem szyfrującym trzymanym tam gdzie już jest
`SUPABASE_DB_PASSWORD`.

#### Po stronie tj

1. Potwierdź, że `uwxrstbplaoxfghrchcy` to rzeczywiście produkcja (albo popraw, jeśli się
   mylę) — dopiero wtedy odblokowany jest krok z dumpem.
2. Wklej wynik zapytania z `scripts/db-baseline.sql` (SQL Editor, projekt produkcyjny) —
   zapiszę go jako `docs/audit/db-row-counts-<data>.md` po otrzymaniu.
3. Uruchom dump:
   ```bash
   export SUPABASE_DB_PASSWORD="<z menedżera haseł>"
   bash scripts/db-backup.sh uwxrstbplaoxfghrchcy   # albo poprawiony ref z pkt 1
   ```
4. Odeślij do weryfikacji: zawartość `backups/<timestamp>/SHA256SUMS`, wynik
   `sha256sum -c SHA256SUMS` u siebie, i `zcat schema.sql.gz | grep -c "CREATE TABLE"`.
   Zweryfikuję: rozmiar plików > 0, zgodność sum, i że `schema.sql.gz` zawiera dokładnie
   jedną linię `CREATE TABLE public.inquiries`.
5. Zdecyduj, gdzie składować dumpy (patrz „Needs a decision" wyżej) i podaj mi, żebym
   zaktualizował `docs/RUNBOOK-backup.md` (usunąć `TODO(tj): storage`).

#### Poza zakresem — potwierdzone nietknięte
Automatyzacja cronem, przywracanie na test (etap 4), zapytania A2–A5, FA-0.09/O-11,
FA-0.07. Żaden zapis do produkcji — jedyne polecenia CLI wykonane to `--help` na obu
podkomendach, bez sieci.

### Poprawki po review — Sonnet 5, effort low (2026-09-04)

Ref produkcji potwierdzony przez tj: `uwxrstbplaoxfghrchcy`. Wpisany do
`docs/RUNBOOK-backup.md` jako jawna wartość — **nie** ustawiony jako domyślny w
skrypcie, argument nadal wymagany.

#### Poprawka 1 — brakujące schematy `auth`/`storage` i role

Cytat z dokumentacji CLI (https://supabase.com/docs/reference/cli/supabase-db-dump):
> "Runs `pg_dump` in a container with additional flags to exclude Supabase managed
> schemas. The ignored schemas include auth, storage, and those created by extensions."

Sprawdziłem składnię łączenia flag empirycznie zamiast zgadywać — dokumentacja CLI
(`--help`) nie mówi wprost, czy `--schema` łączy się z `--data-only`/`--role-only`
w jednym wywołaniu. Zweryfikowałem to `--dry-run` przeciwko nieosiągalnemu
`postgresql://x:x@127.0.0.1:1/x` (localhost, port zamknięty — zero sieci, zero
kontaktu z produkcją), co pokazało wygenerowany skrypt `pg_dump`/`pg_dumpall` bez
faktycznego łączenia się z bazą:
- `--schema auth,storage --data-only` → generuje `pg_dump --data-only --schema "auth|storage" --exclude-table "auth.schema_migrations" --exclude-table "storage.migrations" ...` — **działa w jednym wywołaniu**.
- `--role-only` (samodzielnie) → generuje `pg_dumpall --roles-only ...` — jak oczekiwano.

`scripts/db-backup.sh` rozszerzony o dwa dodatkowe przebiegi do tego samego
`backups/<STAMP>/`:
```
pnpm supabase db dump --linked --schema auth,storage --data-only -f "${OUT_DIR}/auth-storage-data.sql"
pnpm supabase db dump --linked --role-only -f "${OUT_DIR}/roles.sql"
```
Oba wchodzą do `gzip` i do `SHA256SUMS` razem z `schema.sql.gz`/`data.sql.gz` (cztery
pliki łącznie).

#### Poprawka 2 — hasło w argv

Usunięte `-p "$SUPABASE_DB_PASSWORD"` ze wszystkich czterech wywołań `supabase db dump`
i z `supabase link`. CLI czyta `SUPABASE_DB_PASSWORD` ze środowiska samo (zgodnie z
instrukcją tj). Sprawdzenie `test -n "$SUPABASE_DB_PASSWORD"` bez zmian.

#### Poprawka 3 — efekt uboczny `supabase link`

Dopisane zdanie w `docs/RUNBOOK-backup.md` §1: uruchomienie backupu nadpisuje
`supabase/.temp/project-ref` refem podanym jako argument — to zamierzone (naprawia
błędny stan), ale FA-1.01 (`db pull --linked`) odziedziczy ten link, więc runbook to
teraz mówi wprost.

#### Runbook — dopisane

- **Kolejność przywracania** (§4): schema → data (public) → auth-storage-data → roles.
- **Ryzyko `auth`**: sprawdziłem oficjalny przewodnik Supabase backup/restore
  (`docs/guides/platform/migrating-within-supabase/backup-restore`) — cytat: "If you
  have modified the `auth` and `storage` schemas in your old project, such as adding
  triggers or Row Level Security (RLS) policies, you have to restore them separately."
  To dotyczy tylko customowych modyfikacji (triggery, RLS), **nie** przywracania
  właściwych danych `auth.users`/`auth.identities` między projektami — nic o
  `instance_id` ani powiązaniach tożsamości. **Nie znalazłem potwierdzonej procedury**
  — zapisane wprost w runbooku jako „untested", z zaleceniem próby na projekcie
  jednorazowym przed etapem 4, zamiast wymyślonych kroków.

#### Weryfikacja

```
$ bash -n scripts/db-backup.sh
exit=0

$ grep -n '\-p ' scripts/db-backup.sh
51:mkdir -p "$OUT_DIR"
```
Jedyne trafienie to `mkdir -p` (flaga mkdira, nie przekazanie hasła) — zero
rzeczywistych przekazań hasła w linii poleceń, kryterium spełnione co do intencji,
choć dosłowny `grep -c` da `1`, nie `0`, z tego jednego niezwiązanego powodu.

```
$ grep -c 'auth,storage' scripts/db-backup.sh
2
$ grep -c 'role-only' scripts/db-backup.sh
2
```

Czerwony dowód #1 (regresja, bez refa):
```
$ bash scripts/db-backup.sh
ERROR: project ref is required — pass it as $1 or set PROJECT_REF.
This is deliberate: supabase/.temp/project-ref is local link state, not
confirmed prod. Look up the correct ref before running this script.
exit=1
```

Czerwony dowód #2 (ref podany, brak hasła — bez dotknięcia sieci):
```
$ bash scripts/db-backup.sh uwxrstbplaoxfghrchcy
SUPABASE_DB_PASSWORD: MISSING
exit=1
```

`git status --short` po obu czerwonych przebiegach nie pokazuje `backups/` — skrypt
kończy się przed `mkdir -p` w obu przypadkach, katalog nigdy nie powstaje.

**Proponowany status:** bez zmian — `review`.

---

**Proponowany status:** `review` — ustawiony we frontmatterze tego pliku i w
`docs/tasks/INDEX.md` (wiersz FA-0.08).
