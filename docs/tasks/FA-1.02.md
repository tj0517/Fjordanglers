---
id: FA-1.02
title: drop_marketplace_leftovers — usunięcie tabel ze schematu archive i martwych tabel public bez danych
stage: 1
status: todo
difficulty: M
model: opus
model_approved:
effort: medium
agent: fa-core
branch: stage-1/drop-marketplace-leftovers
depends_on: [FA-1.01]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.02 — drop_marketplace_leftovers

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md` — migracje, „red proof"
- `docs/02-data-model.md` — sekcje „Archived in FA-1.01" (10 tabel w schemacie `archive`) i „Still in public, dead or near-dead" (kandydaci)
- `docs/REBUILD_PLAN.md` §5.4 — pełna lista do skasowania (część dopiero w etapie 4)
- `docs/tasks/FA-1.01.md`, `FA-1.01-rollback.sql` — jak powstało `archive`, jak się cofa
- `docs/tasks/FA-0.08.md` — procedura backupu (`pg_dump`)
- `supabase/migrations/20260904165037_baseline_prod.sql` — definicje tabel, FK, funkcje PostGIS
- `docs/REBUILD_PLAN.md` §8 Etap 1 — gałąź `stage-1`, jeden push

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Baseline zawiera tabele marketplace'u, którego nie ma: dziesięć już przeniesionych do
schematu `archive` (bez referencji w kodzie od FA-1.06) i kilkanaście w `public`, których
nic nie czyta. Po zadaniu schemat `archive` nie istnieje, a martwe tabele `public` bez
danych są usunięte, więc typy i `db diff` przestają nosić balast, a etap 4 ma mniej do
przenoszenia. Tabele z danymi, których los nie jest rozstrzygnięty, zostają — z listą w raporcie.

## Zakres
- [ ] Odczyt bieżącego stanu (do raportu): dla każdej tabeli w `archive` i każdej z listy kandydatów w `02-data-model.md`: `SELECT count(*)`, lista FK przychodzących (`pg_constraint`), `grep -rn "<tabela>" src supabase/functions` → 0 wyników. Tabela trafia do dropu tylko, gdy: brak referencji w kodzie **i** (schemat `archive` **lub** 0 wierszy).
- [ ] Eksport przed dropem: `pg_dump --schema=archive` do `docs/archive/<data>-archive.sql` (poza repo, jeśli > 5 MB — ścieżka w raporcie) oraz `guide_submissions` do JSON, jeśli trafia do dropu.
- [ ] Migracja `drop_marketplace_leftovers`: `DROP TABLE … CASCADE` wyłącznie dla tabel zakwalifikowanych z odczytu; `DROP SCHEMA archive`; enumy `booking_status`, `payment_status`, `trip_inquiry_status`, jeśli po dropie nic ich nie używa (sprawdź `pg_type`/`pg_attribute`). Każdy DROP z komentarzem: liczba wierszy z odczytu.
- [ ] Tabele z danymi i bez kodu (np. `guide_submissions`, `audit_log`, `guide_images`) — **nie** dropować; lista z licznościami i rekomendacją w raporcie i w `docs/02-data-model.md`.
- [ ] Funkcje PostGIS i rozszerzenie — poza zakresem (etap 4), ale sprawdź, czy któraś dropowana tabela nie jest jedynym użytkownikiem `geometry` i odnotuj.
- [ ] `gen types --local`; usuń z `src` typy/importy, które przestały istnieć (powinno być 0 — FA-1.06).

## Gotowe, gdy
- [ ] `SELECT schema_name FROM information_schema.schemata WHERE schema_name='archive'` → 0 wierszy (lokalny stack po migracji). Wynik w raporcie.
- [ ] Dla każdej dropowanej tabeli w raporcie: liczba wierszy przed dropem i wynik `grep` = 0.
- [ ] `SELECT * FROM archive.bookings` → błąd „relation does not exist" — **na czerwono w raporcie**.
- [ ] Żadna tabela z ≥ 1 wierszem w `public` nie została dropnięta — lista pozostawionych w raporcie.
- [ ] `supabase db diff` pusty; typy nie zawierają żadnej dropniętej tabeli (`grep` w `database.types.ts` → 0).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- `inquiry_messages`, `lead_messages`, `unmatched_messages` — FA-1.12.
- `experiences` legacy, `inquiry_trip_details`, kolumny `offer_*` na `inquiries` — etap 4.
- Funkcje PostGIS, rozszerzenie, `spatial_ref_sys` — etap 4.
- Jakakolwiek tabela z danymi bez rozstrzygnięcia w tym pliku.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis na produkcji: STOP. Lokalny stack.
- Przed napisaniem migracji: STOP — pokaż tabelę „tabela · schemat · wiersze · FK przychodzące · grep" i listę do dropu; czekaj na akceptację.
- Jeśli którakolwiek tabela z listy ma ≥ 1 wiersz albo FK z żywej tabeli: nie dropuj, zgłoś.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
supabase db reset && supabase db diff
grep -cE "archive|bookings|booking_messages" src/lib/supabase/database.types.ts
pnpm typecheck && pnpm lint && pnpm test && pnpm build
# SELECT schema_name FROM information_schema.schemata WHERE schema_name='archive';
```

## Notatki z realizacji
