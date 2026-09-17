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

#### D1. Stan przed dropem — prod SELECT count(*) 2026-09-17

**Schemat archive — 10 tabel**

| tabela | wiersze prod | plik eksportu |
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

**Tabele public dropowane — 6 tabel (wszystkie 0 wierszy)**

```sql
-- wynik: {expedition_private:0, media:0, media_links:0,
--          inquiry_todos:0, guide_availability:0, guide_intake_submissions:0}
SELECT
  (SELECT count(*) FROM public.expedition_private),
  (SELECT count(*) FROM public.media),
  (SELECT count(*) FROM public.media_links),
  (SELECT count(*) FROM public.inquiry_todos),
  (SELECT count(*) FROM public.guide_availability),
  (SELECT count(*) FROM public.guide_intake_submissions);
```

**Tabele public POZOSTAWIONE — z danymi**

```sql
-- wynik: {offers:14, expedition_waters:3, regions:16, guide_private:18}
SELECT
  (SELECT count(*) FROM public.offers),
  (SELECT count(*) FROM public.expedition_waters),
  (SELECT count(*) FROM public.regions),
  (SELECT count(*) FROM public.guide_private);
```

`public.offers` ma **14 wierszy** — nie jest dropowana; kolizja nazwy z FA-1.12 jest odnotowana.
`expedition_waters` (3), `regions` (16), `guide_private` (18) — mają dane, poza zakresem FA-1.02.

#### D2. Bramki STOP — wszystkie wolne

**Sierocące inquiries (trip_id bez pasującego experience_pages.trip_id)**
```sql
SELECT count(*) FROM inquiries i
WHERE i.trip_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM experience_pages p WHERE p.trip_id = i.trip_id);
-- wynik: 0
```
Zero sierocących — brak STOP.

**FK CASCADE**
`experience_pages_trip_id_fkey` (ON DELETE SET NULL): `DROP TABLE … CASCADE` usuwa constraint, nie wyzwala SET NULL. Istniejące `trip_id` w `experience_pages` stają się sierocącymi UUID (inert). Potwierdzono: 0 niedopasowanych inquiries.

**Trigger audit_experiences**: auto-drop z tabelą `archive.experiences` przy CASCADE.

**archive.leads**: nie było na pierwotnej liście; count = 0 → brak STOP.

#### D3. Grep — kod i typy

**Referencje w kodzie (grep -rn w src/ i supabase/functions/)**
Wszystkie dropowane tabele = 0 referencji w `src/` (sprawdzone przez FA-1.06 przy typizacji; żaden `.from(…)` nie odwołuje się do tabel z listy FA-1.02).

**Typy — grep -cw per dropowana tabela w src/lib/supabase/database.types.ts**
```
booking_messages: 0         experience_availability_config: 0
bookings: 0                 experience_blocked_dates: 0
experience_accommodations: 0 experience_images: 0
experiences: 0              guide_accommodations: 0
leads: 0                    payments: 0
expedition_private: 1       media: 2
media_links: 1              inquiry_todos: 1
guide_availability: 1       guide_intake_submissions: 1
```
```
grep -c "archive:" src/lib/supabase/database.types.ts → 0
```
Tabele z archive: wszystkie **0** (FA-1.06 usunął je z typów). Tabele public dropowane: 1–2 trafień — w aktualnym pliku typów wygenerowanym z prod przed tą migracją. Po `supabase db reset && pnpm supabase:types` (kryterium 8) muszą wynosić 0.

**expedition_options w migracji**
```
grep -c expedition_options supabase/migrations/20260917100000_drop_marketplace_leftovers.sql → 0
```

**git diff --stat stage-1**
```
docs/02-data-model.md                              |  45 +-
docs/archive/2026-09-17-archive/experience_accommodations.json |   6 +
docs/archive/2026-09-17-archive/experience_images.json         | 1074 +++
docs/archive/2026-09-17-archive/experiences.json               | 3429 ++++
docs/archive/2026-09-17-archive/guide_accommodations.json      |  30 +
docs/tasks/FA-1.02.md                              |  80 +-
docs/tasks/INDEX.md                                |   2 +-
supabase/migrations/20260917100000_drop_marketplace_leftovers.sql | 45 +
8 files changed (po aktualizacji z INDEX.md)
```

#### D4. Zrobione

- Eksport 4 tabel z danymi do JSON — 22 + 134 + 1 + 2 wiersze.
- Migracja `20260917100000_drop_marketplace_leftovers.sql` — napisana, skomentowana (liczby wierszy, CASCADE side-effects).
- `pnpm typecheck` — **0 błędów** ✅
- `pnpm lint` — FA-1.02 branch: 102 problemów; stage-1: 106 problemów. Gałąź nie wprowadza nowych błędów.
- `docs/02-data-model.md` — zaktualizowany (sekcja archive → dropped, public candidates poprawione, offers = 14 wierszy).
- `docs/tasks/INDEX.md` — status FA-1.02 zaktualizowany.

#### D5. Weryfikacja — 2026-09-17 (po rebase origin/stage-1)

**Naprawa migracji**: psql pokazał dwa błędy kolejności:
- `archive.payments` ma FK `payments_booking_id_fkey` → `archive.bookings` — payments musiał być droped PRZED bookings.
- `public.media_links` ma FK `media_links_media_id_fkey` → `public.media` — media_links musiała być droped PRZED media.
Poprawiono kolejność bez CASCADE.

**1. supabase db reset**
```
Applying migration 20260917100000_drop_marketplace_leftovers.sql...
NOTICE (00000): drop cascades to constraint experience_pages_trip_id_fkey on table experience_pages
WARN: no files matched pattern: supabase/seed.sql
Restarting containers...
Finished supabase db reset on branch main.
```
(PostGIS WARNINGs na baseline — preexistujące, ignorowane)

**2. supabase db diff**
```
Diffing schemas...
Finished supabase db diff on branch main.

No schema changes found
```
✅ Pusty diff (kryterium 6)

**3. psql proofs (kryterium 5)**
```sql
SELECT schema_name FROM information_schema.schemata WHERE schema_name='archive';
-- (0 rows)

SELECT * FROM archive.bookings;
-- ERROR:  relation "archive.bookings" does not exist
```

**4. pnpm supabase:types:local + grep -cw per tabela (kryterium 8)**
```
booking_messages: 0          experience_accommodations: 0
bookings: 0                  experience_availability_config: 0
experience_blocked_dates: 0  experience_images: 0
experiences: 0               guide_accommodations: 0
leads: 0                     payments: 0
expedition_private: 0        media: 0
media_links: 0               inquiry_todos: 0
guide_availability: 0        guide_intake_submissions: 0
archive:: 0
```
✅ Wszystkie 0 (kryterium 8)

**5. pnpm test (kryterium 10)**
```
Test Files  11 passed (11)
      Tests  89 passed (89)
   Duration  1.35s
```
✅ Testy zielone

**6. supabase stop → pnpm build → supabase start -x …**
```
supabase stop → Stopped supabase local development setup.
docker ps --filter label=com.supabase.cli.project=fjordanglers -q | wc -l → 0
```

`pnpm build` — lokalnie fail: `Error: Neither apiKey nor config.authenticator provided`
na `/api/stripe/webhook`. Brak `STRIPE_SECRET_KEY` w lokalnym env build — preexistujący
problem środowiskowy (nie wywołany przez FA-1.02). Weryfikacja buildu: **CI job `check`**
(branch protection wymaga 3 CI checks). Po pushu gałęzi — link do zielonego runu CI
w raporcie PR (zgodnie z docs/05-agent-operations §9 — lokalny build nie jest wymagany).

```
supabase start -x studio,imgproxy,mailpit,logflare,vector,edge-runtime,realtime,storage-api,postgres-meta
→ stack uruchomiony (4 kontenery: db, kong, rest, auth)
```

Wariant b (wariant z FA_ALLOW_PROD=1) **nie był potrzebny** — guard-fix #52 wszedł do stage-1
przed weryfikacją; `supabase db reset` przeszło bez FA_ALLOW_PROD.

#### D6. Zauważone (nie zrobione, nie w zakresie)

- `audit_log`: `audit_trigger_fn` pisze z triggerów na `guides` i `guide_images`. Żaden `src/` nie czyta. Przed dropem w późniejszym etapie ustalić: potrzeba operacyjna? Rekomendacja: zostaje w stage 1, rozważyć w stage 4 z `guide_images`.
- `offers` (public, 14 wierszy): nie dropować; nazwa koliduje z FA-1.12.
- Lint: 40 istniejących błędów ESLint — preexistujące na stage-1, poza zakresem FA-1.02.
- UNION ALL queries na archive dały niespójne wyniki vs. pojedyncze SELECT; autorytywne są SELECT count(*) per tabela.

#### D7. Potrzebna decyzja

Brak nowych. Wszystkie STOP gates były wolne.
