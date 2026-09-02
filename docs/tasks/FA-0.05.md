---
id: FA-0.05
title: Leady z /plan-your-trip trafiają do inquiries (source=ads_landing) + przechwytywanie UTM
stage: 0
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/ads-landing-to-inquiries
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-0.05 — Leady z landingu reklamowego do bazy + UTM

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły; szczególnie 1 (migracje) i 3 (warstwa danych)
- `docs/03-conventions.md`
- `docs/02-data-model.md` §1 — ghost columns na `inquiries` (`source` już istnieje w bazie, nie w migracji!)
- `src/actions/trip-plan.ts` — dzisiejsza ścieżka: dwa `fetch` do Resend, zero zapisu
- `src/app/api/inquiries/route.ts` — właściwa ścieżka intake (walidacja zod, insert, maile, agent)
- `src/lib/gclid.ts` + `src/components/analytics/GclidCapture.tsx` — jak dziś łapany jest gclid (UTM ma iść tą samą drogą)
- `docs/REBUILD_PLAN.md` §7.2 (M5, M6) — po co to jest

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Landing pod reklamy wysyła leady wyłącznie mailem — nie ma ich w `inquiries`, w pipeline, w finansach ani w statystyce kosztu per zapytanie. Po zadaniu każdy lead z landingu jest zapytaniem z `source='ads_landing'`, a każde zapytanie z dowolnego formularza niesie UTM-y obok `gclid`, żeby koszt per qualified request dało się policzyć per kampania.

## Zakres
- [ ] Odczyt bieżącego stanu: `select column_name, data_type from information_schema.columns where table_name='inquiries' and column_name in ('source','gclid','utm','trip_length')` — potwierdź, co istnieje.
- [ ] Migracja: `utm JSONB` na `inquiries` (jeśli brak) + jeśli `source` istnieje tylko w bazie — zapisz jego definicję w tej migracji (`ADD COLUMN IF NOT EXISTS`), z `CHECK (source IN ('web_form','ads_landing','manual','email','whatsapp'))`.
- [ ] `lib/utm.ts`: przechwycenie `utm_source/medium/campaign/content/term` do localStorage z TTL 90 dni, ten sam wzorzec co `gclid.ts`; `GclidCapture` rozszerzony, nie duplikowany.
- [ ] Wspólna funkcja tworzenia zapytania (dziś w `api/inquiries/route.ts`) wyciągnięta do `src/actions/inquiries.ts` (albo `lib/inquiries/create.ts`) i użyta przez: API route, `trip-plan.ts`, ręczne tworzenie w adminie. Pola `source`, `gclid`, `utm`, `trip_length` przekazywane jawnie.
- [ ] `trip-plan.ts`: najpierw insert, potem maile; mail do FA linkuje do `/admin/inquiries/<id>`.
- [ ] Mapowanie pól landingu (`species[]`, `duration`, `tripType`, `newsletter`) → `message`/`trip_length`/`brief`-like JSON w `message` (bez nowych kolumn poza `utm`).
- [ ] Regeneracja typów po migracji (`pnpm supabase:types`).

## Gotowe, gdy
- [ ] Submit landingu w dev tworzy wiersz w `inquiries` z `source='ads_landing'`, `utm` i `gclid` (SELECT w raporcie).
- [ ] Submit zwykłego widgetu tworzy wiersz z `source='web_form'` i tym samym `utm` (SELECT w raporcie).
- [ ] Wiersz z `source='foo'` jest odrzucany przez CHECK — **pokazane na czerwono** (komunikat błędu w raporcie).
- [ ] `grep -rn "api.resend.com" src/actions/trip-plan.ts` → 0 (wysyłka przez `lib/email.ts`).
- [ ] `supabase db diff` po migracji pusty; typy zawierają `utm`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Kwalifikacja (`qualified`) — FA-1.04.
- Uruchamianie agenta AI dla leadów z landingu (decyzja osobna; na razie `runAgentRound1` tylko jak dziś dla widgetu).
- Ekran `/admin/ads` z kosztem per kampania — etap 6.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Migracja: uruchamiana wyłącznie lokalnie / na gałęzi Supabase. `db push` na `uwxrstbplaoxfghrchcy` **wymaga STOP i zgody tj** — pokaż treść migracji i wynik `db diff` przed pytaniem.

## Weryfikacja
```
pnpm supabase:types && git diff --stat src/lib/supabase/database.types.ts
supabase db diff            # oczekiwane: No schema changes found
pnpm typecheck && pnpm lint && pnpm test && pnpm build
# SELECT id, source, gclid, utm, created_at FROM inquiries ORDER BY created_at DESC LIMIT 3;
# INSERT ... source='foo'  → oczekiwany błąd CHECK
```

## Notatki z realizacji

