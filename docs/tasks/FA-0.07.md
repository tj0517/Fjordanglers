---
id: FA-0.07
title: Naprawa uszkodzonej migracji 20260815_fix_nz_species_casing.sql (plik ma 1 bajt)
stage: 0
status: review
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-db
branch: db/fix-corrupt-migration-20260815
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 2
owner: tj
---

# FA-0.07 — Uszkodzona migracja z 15 VIII

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` reguły 1–2, `docs/03-conventions.md` „Database", `docs/05-agent-operations.md` §3 (STOP)
- `supabase/migrations/20260815_fix_nz_species_casing.sql` — zawartość: pojedynczy znak `4`
- `supabase/migrations/20260815_seed_dustin_habener_new_zealand.sql`, `20260818_seed_*_nz.sql` — seedy NZ, których dotyczy „casing"
- `git log -p --follow supabase/migrations/20260815_fix_nz_species_casing.sql` — czy w historii jest prawdziwa treść
- Tabela `supabase_migrations.schema_migrations` na produkcji — czy wersja `20260815...` figuruje jako zastosowana

## Cel
Migracja składająca się z jednego bajtu albo nigdy nie została zastosowana (i wtedy `db push` na świeżą bazę wywali się na niej), albo została „zastosowana" jako pusta i intencja (poprawa wielkości liter gatunków w seedach NZ) nigdy nie weszła. Po zadaniu historia migracji jest spójna z produkcją, a plik ma treść odpowiadającą temu, co faktycznie jest w bazie.

## Zakres
- [ ] Odczyt bieżącego stanu: (a) `git log -p` pliku — czy była kiedyś pełna treść; (b) na produkcji: `select version, name from supabase_migrations.schema_migrations where version like '20260815%'`; (c) `select distinct target_species from experience_pages where country ilike '%zealand%'` — jak dziś wygląda casing.
- [ ] Wariant A (w historii jest treść i nie została zastosowana): przywróć treść, zastosuj lokalnie, sprawdź `db diff`.
- [ ] Wariant B (zastosowana jako pusta): zastąp treść komentarzem `-- applied empty on prod on 2026-08-15; intended fix moved to <nowa migracja>` i napisz nową migrację z właściwą poprawką casingu (na podstawie (c)).
- [ ] Wariant C (nie figuruje na produkcji, treści brak w historii): zamień na no-op z komentarzem i nową migrację jak w B.
- [ ] W każdym wariancie: raport mówi, który wariant zaszedł i dlaczego, z wynikami (a)–(c).

## Gotowe, gdy
- [ ] `wc -c supabase/migrations/20260815_fix_nz_species_casing.sql` > 1 i plik jest poprawnym SQL (`supabase db lint` albo zastosowanie na lokalnej bazie bez błędu).
- [ ] `supabase db diff` względem gałęzi/lokalnej bazy pusty po zastosowaniu.
- [ ] Wynik zapytania (b) i (c) w raporcie, przed i po.
- [ ] Nie użyto `migration repair` bez STOP i zgody.

## Poza zakresem
- Jakiekolwiek inne poprawki w seedach NZ.
- Baseline `db pull` — FA-1.01.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Odczyt produkcji: tylko SELECT. **Każda** zmiana na produkcji (`db push`, `migration repair --status applied/reverted`) — STOP, pokaż dokładną komendę i wynik `db diff`, czekaj na zgodę tj.

## Weryfikacja
```
git log --oneline --follow supabase/migrations/20260815_fix_nz_species_casing.sql
wc -c supabase/migrations/20260815_fix_nz_species_casing.sql
supabase db diff
```

## Notatki z realizacji

### Raport — Sonnet 5, effort medium (2026-09-04)

#### Wariant: **C** — nigdy nie zastosowana na produkcji

Wynik (a) — `git log --oneline --follow`:
```
64b60f06 feat: add New Zealand guides, destinations, and AI agent support
```
Jeden commit, plik już wtedy miał 1 bajt (`4`, bez `\n` na końcu). W historii **nigdy**
nie było prawdziwej treści — wariant A wykluczony, zgodnie z ustaleniem sprzed startu.

Wynik (b) — na prośbę tj (rozszerzone zapytanie, uruchomione przez tj w SQL Editor, bo
agent nie ma dostępu: `SUPABASE_DB_PASSWORD` brak, MCP Supabase zwraca `Unauthorized`
mimo ustawionego `SUPABASE_ACCESS_TOKEN`):
```sql
select version, name from supabase_migrations.schema_migrations
where version like '20260815%' or version like '20260818%'
   or version like '20260820%' or version like '20260827%';
```
→ **"Success. No rows returned."** Żadna migracja z zakresu 15–27 VIII nie figuruje jako
zastosowana przez `db push`. Kontrolne zapytanie potwierdzające, że tabela w ogóle coś
śledzi:
```sql
select max(version) from supabase_migrations.schema_migrations;
```
→ `20260708163723` (8 VII 2026). To jest **większe ustalenie niż zakres tego zadania**:
nie tylko `20260815_fix_nz_species_casing.sql` jest niezastosowana wg `schema_migrations`
— **żadna** migracja po 8 VII (w tym oba seedy NZ, `20260820_fix_is_hidden_default.sql`,
`20260827_inquiries_trip_length_gclid.sql`, seedy Patagonii z IX) nie jest tam
zarejestrowana, mimo że dane z tych seedów **są** widoczne w produkcji (patrz wynik (c)
niżej — trzy strony NZ istnieją). Wniosek: od 8 VII wszystkie zmiany schematu/danych
wchodzą na produkcję inną drogą niż `supabase db push` z tego repo (SQL Editor ręcznie,
`apply_migration` przez MCP, albo inny link/projekt) — `schema_migrations` na
production **nie jest** wiarygodnym źródłem prawdy o tym, co jest zastosowane. To
bezpośrednio dotyczy FA-1.01 (baseline `db pull`) — zgłaszam do „Needs a decision"
niżej, nie ruszam poza zakres tego zadania.

To odróżnia wariant B od C: B wymagałby wpisu w `schema_migrations` dla akurat tej
wersji (z inną treścią niż to, co jest w repo) — nie ma go. Plik nigdy nie przeszedł
przez `db push`; to zwykły, nigdy niezaaplikowany plik z uszkodzoną treścią, tak jak
wszystkie sąsiednie migracje z tego okresu.

Wynik (c) — przed zmianą (uruchomione przez tj):
```sql
select id, slug, target_species from experience_pages where country ilike '%zealand%';
```
| id | slug | target_species |
|---|---|---|
| c8e7a317-6728-4cca-9f90-4c33debd26b5 | guided-fly-fishing-central-north-island-new-zealand | `["Rainbow trout","Brown trout"]` |
| 9eb65954-af16-41b8-bbce-be8e051cb5b8 | fly-fishing-southland-new-zealand | `["Brown Trout","Rainbow Trout"]` |
| ff60aa14-5aac-4835-8968-0372c60a75ef | fly-fishing-taupo-tongariro-central-north-island | `["Rainbow Trout","Brown Trout"]` |

Dokładnie jeden wiersz (`c8e7a317`, Central North Island / Dustin Habener) ma casing
niezgodny z pozostałymi dwoma — lowercase zamiast Title Case. To jest „casing", który
zepsuta migracja miała naprawić: potwierdzone grepem po plikach seedów — 12 wystąpień
`target_species` w trzech plikach NZ, wszystkie Title Case
(`ARRAY['Rainbow Trout', 'Brown Trout']` / `ARRAY['Brown Trout', 'Rainbow Trout']`),
poza jednym w `20260815_seed_dustin_habener_new_zealand.sql:47`:
`ARRAY['Rainbow trout', 'Brown trout', 'Kingfish']` (lowercase, **trzy** gatunki).

Uwaga uboczna: produkcja ma dziś tylko dwa gatunki dla tego wiersza
(`["Rainbow trout","Brown trout"]`), bez „Kingfish", mimo że seed wstawiał trzy. Nie
wiem, kiedy i jak "Kingfish" zniknął (możliwe ręczne poźniejsze usunięcie) — nie
odtwarzam go, bo poprawka casingu ma zostawić zestaw gatunków bez zmian, tylko poprawić
wielkość liter istniejących wpisów. Zgłaszam to jako osobną obserwację, nie naprawiam.

#### Zmiany plików

1. **`supabase/migrations/20260815_fix_nz_species_casing.sql`** — zamieniony `4` na
   komentarz-no-op wyjaśniający historię (wariant C), bez żadnego SQL zmieniającego dane.
2. **`supabase/migrations/20260904_fix_nz_species_casing.sql`** (nowa) — treść:
```sql
update experience_pages
set target_species = array_replace(
      array_replace(target_species, 'Rainbow trout', 'Rainbow Trout'),
      'Brown trout', 'Brown Trout'
    )
where country ilike '%zealand%';
```
   Celowo wąska: `array_replace` na dokładnych, znanych złych wartościach, ograniczona
   do `country ilike '%zealand%'` — nie dotyka innych krajów ani innych gatunków.
   **Red proof / idempotencja** — zweryfikowane na jednorazowym kontenerze `postgres:17`
   (Docker, bez `supabase init`/`config.toml`, których repo nie ma — patrz FA-0.08):
   ```
   przed:  {"Rainbow trout","Brown trout"}
   1. przebieg: UPDATE 1 → {"Rainbow Trout","Brown Trout"}
   2. przebieg: UPDATE 1 → {"Rainbow Trout","Brown Trout"}   (bez zmian — idempotentna)
   ```
   `UPDATE 1` na drugim przebiegu bo `array_replace` na już-poprawnych wartościach jest
   no-opem semantycznym (ta sama wartość, ten sam wiersz dopasowany przez `WHERE`), nie
   podwaja ani nie psuje danych — potwierdzone identycznym wynikiem `select` po obu
   przebiegach.

#### Weryfikacja

```
$ wc -c supabase/migrations/20260815_fix_nz_species_casing.sql supabase/migrations/20260904_fix_nz_species_casing.sql
592 supabase/migrations/20260815_fix_nz_species_casing.sql
1065 supabase/migrations/20260904_fix_nz_species_casing.sql
```
Oba > 1 bajt.

`supabase db lint --local` / `supabase start` niedostępne — repo nie ma
`supabase/config.toml` (ustalone też w FA-0.08), więc lokalny stack Supabase nie jest
zainicjalizowany; inicjalizacja go wykracza poza zakres tego zadania (S, jedna poprawka
migracji). Zamiast tego oba pliki zaaplikowane bez błędu (`ON_ERROR_STOP=1`, `exit=0`
dla obu) na jednorazowym, tymczasowym kontenerze `postgres:17` z minimalnym schematem
`experience_pages(id, country, target_species text[])` — kontener zatrzymany i usunięty
po teście, nic nie zostało.

`supabase db diff` — **nie uruchomiony**: brak lokalnej bazy/gałęzi Supabase (jak wyżej,
brak `config.toml`, link do produkcji niedostępny bez `SUPABASE_DB_PASSWORD`). Piszę to
wprost zamiast pomijać kryterium.

```
$ pnpm typecheck
tsc --noEmit   → 0 błędów
$ pnpm build
exit code 0
```
Migracja nie dotyka kodu ani typów — `pnpm supabase:types` nie był potrzebny (kolumna
`target_species` bez zmian typu, tylko dane).

`migration repair` — **nie użyty**, zero poleceń zmieniających stan produkcji zostało
wykonanych w tej sesji. Jedyny kontakt z produkcją to SELECT-y wklejone przez tj.

#### Needs a decision

1. **Zastosowanie na produkcji** — ja nie mogę i nie próbowałem. Dokładna komenda,
   gdybyś zdecydował się zastosować teraz (poza `db push`, bo repo nie jest zlinkowane
   ani nie ma `config.toml` — patrz FA-0.08 punkt project-ref):
   ```sql
   update experience_pages
   set target_species = array_replace(
         array_replace(target_species, 'Rainbow trout', 'Rainbow Trout'),
         'Brown trout', 'Brown Trout'
       )
   where country ilike '%zealand%';
   ```
   Skutek: dokładnie wiersz `c8e7a317-...` zmienia `target_species` z
   `["Rainbow trout","Brown trout"]` na `["Rainbow Trout","Brown Trout"]`; pozostałe dwa
   wiersze NZ bez zmian (już poprawne, `array_replace` na nich jest no-opem). Zero
   wpływu na `experience_page_options` (osobna tabela, nie dotknięta — sprawdzone
   grepem, już Title Case wszędzie).
2. **`schema_migrations` na produkcji nie odzwierciedla realnego stanu od 8 VII 2026**
   (ustalenie z wyniku (b) wyżej) — to blokuje sens `supabase db push`/`db diff` dla
   *każdej* przyszłej migracji, dopóki FA-1.01 (baseline `db pull`) nie zsynchronizuje
   stanu. Zgłaszam jako input do FA-1.01, nie rozwiązuję tutaj (poza zakresem).
3. **„Kingfish" zniknięty z produkcji** względem tego, co seed wstawiał — nie wiem,
   czy to celowe (ktoś edytował ręcznie ofertę) czy utrata danych. Nie naprawiam (poza
   zakresem: „żadnych innych poprawek w seedach NZ" i ta poprawka nie dotyczy castingu).
   Zgłaszam do `docs/deferred-tasks.md` jeśli chcesz to zbadać osobno.

#### Poza zakresem — potwierdzone nietknięte
Inne poprawki w seedach NZ (poza samą wielkością liter dwóch nazw gatunków), baseline
`db pull` (FA-1.01), przywrócenie „Kingfish", jakakolwiek zmiana na produkcji.

