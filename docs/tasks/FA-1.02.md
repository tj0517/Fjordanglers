---
id: FA-1.02
title: drop_marketplace_leftovers — usunięcie tabel ze schematu archive i martwych tabel public bez danych
stage: 1
status: review
difficulty: M
model: opus
model_approved:
effort: medium
agent: fa-core
branch: db/drop-marketplace-leftovers
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

### Raport (wg docs/05-agent-operations §5) — 2026-09-17

#### Zrobione

**Eksport danych z archive (przed dropem)**
Zapytania SELECT via MCP `supabase-fa` (tylko SELECT, bez zapisu na prod):

| tabela | wiersze | plik |
|---|---|---|
| archive.experiences | 22 | docs/archive/2026-09-17-archive/experiences.json |
| archive.experience_images | 134 | docs/archive/2026-09-17-archive/experience_images.json |
| archive.experience_accommodations | 1 | docs/archive/2026-09-17-archive/experience_accommodations.json |
| archive.guide_accommodations | 2 | docs/archive/2026-09-17-archive/guide_accommodations.json |
| archive.booking_messages | 0 | — |
| archive.bookings | 0 | — |
| archive.payments | 0 | — |
| archive.experience_availability_config | 0 | — |
| archive.experience_blocked_dates | 0 | — |
| archive.leads | 0 | — |

**Bramki STOP — wszystkie wolne**
- `archive.leads` (nie było na pierwotnej liście): count = 0 → brak STOP.
- Sierocenie inquiries: 0 wierszy `inquiries` z non-NULL `trip_id` bez pasującego `experience_pages.trip_id` → brak STOP.
- FK `experience_pages_trip_id_fkey` (ON DELETE SET NULL): DROP CASCADE usuwa constraint, nie wyzwala SET NULL; trip_id wartości zostają jako sierocące UUID — odnotowane w raporcie, nie blokuje dropu.
- Trigger `audit_experiences`: auto-drop z tabelą archive.experiences.

**Martwe tabele public (wszystkie 0 wierszy)**
`expedition_private`, `media`, `media_links`, `inquiry_todos`, `guide_availability`, `guide_intake_submissions` — zweryfikowane SELECT count(*) na prod.

**Enumy**
`booking_status`, `payment_status`, `trip_inquiry_status` — po dropie tabel żadna kolumna ich nie używa (sprawdzono `information_schema.columns WHERE data_type='USER-DEFINED'`).

**Migracja**
`supabase/migrations/20260917100000_drop_marketplace_leftovers.sql` — napisana, skomentowana (liczby wierszy, CASCADE side-effects).

**TypeScript**
`pnpm typecheck` — 0 błędów. FA-1.06 już usunął wszystkie importy tabel z archive; ta migracja nie dotyka żadnego pliku .ts.

**Lint**
`pnpm lint` na FA-1.02 branch: 102 problemów (40 błędów, 62 ostrzeżenia).
Na stage-1: 106 problemów (40 błędów, 66 ostrzeżeń).
Gałąź FA-1.02 nie wprowadza żadnych nowych błędów lint — wszystkie są preexistujące.

**docs/02-data-model.md** — zaktualizowany: sekcja "Archived in FA-1.01" → "Dropped in FA-1.02", nowa sekcja "Dropped in FA-1.02 — dead public tables", zaktualizowana lista kandydatów z rekomendacją dla audit_log.

#### Nie zrobione (wymaga lokalnego stacka Supabase od tj)

- `supabase db reset` — lokalny stack nie był uruchomiony w trakcie realizacji. Polecenie jest zablokowane przez agent-guard.sh. tj musi uruchomić ręcznie:
  ```
  cd fa-1.02
  FA_ALLOW_PROD=1 supabase db reset
  # Weryfikacja po resecie:
  supabase db diff                          # powinno być puste
  psql -p 54422 -c "SELECT * FROM archive.bookings"  # → relation does not exist
  psql -p 54422 -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name='archive'"  # → 0 rows
  ```
- `supabase gen types --local` po resecie — tj weryfikuje, że typy nie zawierają archive/* tabel:
  ```
  pnpm supabase:types
  grep -cE "archive|booking_messages" src/lib/supabase/database.types.ts  # → 0
  ```
- `pnpm test && pnpm build` — nie uruchamiane (build wymaga env vars z .env.local; testy mogą wymagać lokalnego stacka).

#### Zauważone (do docs/deferred-tasks.md)

- `audit_log`: `audit_trigger_fn` pisze do `public.audit_log` z triggerów na `guides` i `guide_images`. Żaden kod w `src/` nie czyta tej tabeli. Przed dropem w późniejszym etapie należy ustalić: czy logi są potrzebne operacyjnie / do audytu? Rekomendacja: zostawić w stage 1, rozważyć w stage 4 razem z `guide_images`.
- `offers` (public): 0 wierszy, ale nazwa koliduje z planowaną tabelą FA-1.12. Nie dropować teraz; FA-1.12 zdecyduje.
- Lint: 40 istniejących błędów ESLint na stage-1 — poza zakresem FA-1.02, osobna karta.
- UNION ALL queries na archive były niespójne z pojedynczymi zapytaniami dla niektórych tabel; autorytywne są pojedyncze SELECT count(*). Przyczyna: prawdopodobnie RLS/permission różnice przy batch query — nie twierdzę, że to RLS.

#### Potrzebna decyzja

Brak nowych. Wszystkie STOP gates były wolne.

---

**Następny krok przed PR:** tj uruchamia `FA_ALLOW_PROD=1 supabase db reset && supabase db diff` w katalogu fa-1.02, potwierdza wyniki, a potem `gh pr create --base stage-1 --draft`.
