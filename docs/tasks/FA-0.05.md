---
id: FA-0.05
title: Jedna ścieżka tworzenia zapytania — source + UTM; usunięcie landingu /plan-your-trip
stage: 0
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/inquiry-source-and-utm
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: false
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
- [ ] Regeneracja typów po migracji (`pnpm supabase:types`) i commit typów w tym samym PR.

## Gotowe, gdy
- [ ] Submit widgetu w dev tworzy wiersz z `source='web_form'`, wypełnionym `utm` i `gclid` — SELECT w raporcie.
- [ ] Ręczne dodanie zapytania w adminie tworzy wiersz z `source='manual'` — SELECT w raporcie.
- [ ] `INSERT ... source='foo'` odrzucony przez CHECK — **czerwony dowód**, komunikat błędu wklejony do raportu.
- [ ] `grep -rn "plan-your-trip\|trip-plan\|thank-you" src` → 0 wyników.
- [ ] `grep -rn "from('inquiries')" src | grep insert` → wyłącznie `src/lib/inquiries/create.ts`.
- [ ] `grep -rn "api.resend.com" src` → 0 wyników (jedyne dwa były w `trip-plan.ts`).
- [ ] `supabase db diff` po migracji pusty; wygenerowane typy zawierają `utm`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build` zielone.
      (`pnpm test` bez `--run` to tryb watch i nigdy nie wraca.)

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
grep -rn "api.resend.com" src || echo OK-no-raw-resend
grep -rn "from('inquiries')" src | grep insert
pnpm supabase:types && git diff --stat src/lib/supabase/database.types.ts
supabase db diff            # oczekiwane: No schema changes found
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
# SELECT id, source, gclid, utm, created_at FROM inquiries ORDER BY created_at DESC LIMIT 3;
# INSERT ... source='foo'  → oczekiwany błąd CHECK
```

## Notatki z realizacji
