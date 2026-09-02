---
id: FA-0.07
title: Naprawa uszkodzonej migracji 20260815_fix_nz_species_casing.sql (plik ma 1 bajt)
stage: 0
status: todo
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

