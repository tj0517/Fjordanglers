---
id: FA-1.06
title: Typy mówią prawdę — regeneracja z baseline i usunięcie zapytań do tabel w archive
stage: 1
status: in_progress
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: chore/types-truth
depends_on: [FA-1.01]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 8
owner: tj
---

# FA-1.06 — Typy mówią prawdę

**Przeskalowane 5 IX 2026** z M/sonnet na L/opus. Pierwotny zapis („regeneracja typów +
usunięcie `as any`") powstał przed FA-1.01. Baseline produkcji pokazał, że dziesięć tabel
marketplace'u żyje w schemacie `archive`, a nie w `public` — więc uczciwa regeneracja
typów wywala kompilację w 23 plikach. FA-0.05 potwierdziło to praktycznie i utknęło.
Zakres tego zadania jest teraz zdefiniowany brzegiem, nie listą: **wszystko, co musi się
zmienić, żeby `pnpm typecheck` i `pnpm build` były zielone przy prawdziwych typach — i nic
poza tym.**

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły, szczególnie 3 (warstwa danych)
- `docs/03-conventions.md` — konwencje kodu i nazw
- `docs/02-data-model.md` — model danych; §1 opisuje ghost tables/columns
- `docs/audit/rebuild-audit-db-aug-2026.md` — audyt z 31 VIII, źródło listy martwych tabel
- `supabase/migrations/20260904165037_baseline_prod.sql` — baseline FA-1.01; linie z
  `CREATE TABLE IF NOT EXISTS "archive".` wyliczają dziesięć tabel, o które chodzi
- `docs/tasks/FA-1.01.md` — jak powstał baseline i czego dowiódł
- `docs/tasks/FA-0.05.md` §„Notatki z realizacji" — lista 23 plików z czerwonego builda
- `docs/04-open-questions.md` O-04 — rename `experience_pages` → `experiences` jest
  zaplanowany na etap 4 i **nie należy do tego zadania**
- `src/lib/supabase/queries.ts`, `src/actions/`, `src/app/admin/` — miejsca z zapytaniami
Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
`src/lib/supabase/database.types.ts` jest dziś zamrożonym obrazem schematu sprzed
archiwizacji i przez to kompilator akceptuje zapytania do tabel, których w `public` nie ma.
Po zadaniu typy są generowane z rzeczywistego schematu, każde zapytanie w `src` dotyczy
tabeli, która istnieje, a `typecheck` i `build` są zielone. To odblokowuje FA-0.05 i
zdejmuje z FA-1.07/1.08 pracę, której bez kompilującego się drzewa i tak nie da się zrobić.

## Zakres

### Faza A — inwentaryzacja i plan (kończy się STOP)
- [ ] Odczyt bieżącego stanu: `grep 'CREATE TABLE IF NOT EXISTS "archive"'` w baseline —
      pełna lista zarchiwizowanych tabel; `grep -rn "from('<tabela>')" src` dla każdej.
- [ ] Lokalny stack Supabase z baseline'em i regeneracja typów
      (`supabase gen types typescript --local`), potem `pnpm typecheck` — pełna lista
      błędów, plik po pliku.
- [ ] Klasyfikacja **każdego** użycia do jednej z trzech kategorii, w tabeli w raporcie:
      **(a) plik/trasa martwa w całości** — istnieje wyłącznie po to, żeby obsługiwać
      zarchiwizowaną tabelę → do usunięcia;
      **(b) plik żywy z martwym fragmentem** — np. `/admin` czy `src/actions/inquiries.ts`,
      gdzie jedno zapytanie obok dziesięciu żywych → wycinamy fragment i to, co go renderuje;
      **(c) użycie żywe mimo pozorów** — tabela w `archive`, ale kod nadal jest potrzebny
      → zgłoś, nie ruszaj, czekaj na decyzję.
      Przy każdej pozycji jedno zdanie dowodu: kto to importuje, co jest w nawigacji.
- [ ] **STOP — przedstaw tabelę i czekaj na akceptację tj.** Żadnego kasowania przed zgodą.

### Faza B — wykonanie zaakceptowanej listy
- [ ] Usunięcie / wycięcie dokładnie tego, co zaakceptowane w fazie A. Nic ponadto.
- [ ] Typy wygenerowane z lokalnej bazy, zacommitowane w tym samym PR.
- [ ] `as any` — usuń tylko te, które istniały **z powodu braku typów** i po regeneracji
      są zbędne. `as any` z innych powodów zostaje; wypisz je w raporcie jako zauważone.
- [ ] `supabase/config.toml` i `supabase/.gitignore` — jeśli ich nie ma na gałęzi,
      dodaj (`supabase init`) i zacommituj tutaj. Uwaga: FA-0.05 ma je w swoim diffie;
      zostają w tym PR, a FA-0.05 przy rebase je z siebie wyrzuci.

## Gotowe, gdy
- [ ] `supabase gen types typescript --local > src/lib/supabase/database.types.ts`, a potem
      `git diff --exit-code src/lib/supabase/database.types.ts` → brak zmian (typy w repo
      są dokładnie tym, co generator daje z baseline'u).
- [ ] `grep -rn "from('bookings')\|from('booking_messages')\|from('experiences')\|from('experience_accommodations')\|from('experience_availability_config')\|from('experience_blocked_dates')\|from('experience_images')\|from('guide_accommodations')\|from('leads')\|from('payments')" src`
      → 0 wyników, albo wyłącznie pozycje zaakceptowane w fazie A jako kategoria (c), wymienione z nazwy w raporcie.
- [ ] `pnpm typecheck` → 0 błędów.
- [ ] `pnpm build` → przechodzi.
- [ ] `pnpm test -- --run` → zielone, tyle samo testów co przed zadaniem albo więcej.
      (`pnpm test` bez `--run` to tryb watch i nigdy nie wraca.)
- [ ] `pnpm lint` — nie gorzej niż przed zadaniem; liczba błędów przed i po w raporcie.
      Zielony lint nie jest kryterium, jego czerwień ma inne, wcześniejsze przyczyny.
- [ ] **Czerwony dowód:** po zadaniu dopisz w dowolnym pliku `await supabase.from('experiences').select('id')`,
      pokaż, że `pnpm typecheck` to odrzuca, wklej komunikat, usuń linię. To dowód, że typy
      faktycznie pilnują, a nie że kod przypadkiem się kompiluje.
- [ ] Każda usunięta trasa ma w raporcie dowód, że nic do niej nie linkuje
      (`grep -rn "<ścieżka>" src`) — osobno dla nawigacji i dla `sitemap.ts`.
- [ ] `docs/02-data-model.md` opisuje stan po zadaniu; `docs/deferred-tasks.md` — wpis
      FA-0.05 o 23 plikach zdjęty albo zawężony do tego, co zostało.

## Poza zakresem
- Usuwanie tabel z `archive` w bazie — to FA-1.02. Tutaj tylko kod.
- Martwy kod, który **kompiluje się** poprawnie (nieużywane komponenty, `mock-data.ts`,
  nieużywane typy w `src/types/index.ts`, osierocone trasy bez zapytań do archive) — FA-1.07/1.08.
  Brzeg tego zadania to zielony `typecheck` i `build`, nie czystość repo.
- Rename `experience_pages` → `experiences` — O-04, etap 4.
- Legacy edytor `experiences` poza nawigacją — FA-1.09 (jeśli fazy A nie usunie go wcześniej
  jako kategorię (a); w takim wypadku zgłoś, że FA-1.09 traci przedmiot).
- Cokolwiek w `src/lib/inquiries/`, `src/lib/utm.ts` — to FA-0.05, na osobnej gałęzi.
- Naprawianie `pnpm lint` do zera.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- **Koniec fazy A** — tabela klasyfikacji przedstawiona, zero usunięć przed zgodą tj.
- Usunięcie pliku, trasy albo katalogu spoza listy zaakceptowanej w fazie A — STOP.
- Jakikolwiek zapis na produkcji `uwxrstbplaoxfghrchcy` (`db push`, `apply_migration`,
  SQL inny niż SELECT) — STOP. To zadanie nie dotyka bazy; jeśli wydaje się, że musi, to
  znak, że zakres się rozjechał.
- `migration repair`, edycja albo usunięcie istniejącego pliku migracji — STOP.
  Baseline `20260904165037` jest nietykalny.
- Zmiana sekretów, env w Vercel, ustawień Auth, webhooków Stripe — STOP.
- Ręczna edycja `database.types.ts` — zakazana. Plik wychodzi wyłącznie z generatora;
  jeśli generator daje coś, co nie kompiluje, problem jest w kodzie, nie w typach.

## Weryfikacja
```
supabase gen types typescript --local > src/lib/supabase/database.types.ts
git diff --exit-code src/lib/supabase/database.types.ts && echo OK-types-are-generated
grep -rn "from('bookings')\|from('experiences')\|from('leads')\|from('payments')" src || echo OK-no-archive-queries
pnpm typecheck
pnpm build
pnpm test -- --run
pnpm lint  # licz błędy, porównaj z liczbą sprzed zadania
# czerwony dowód: dopisz from('experiences'), pokaż błąd typecheck, usuń
```

## Notatki z realizacji
