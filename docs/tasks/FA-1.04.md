---
id: FA-1.04
title: inquiries.qualified — z klasyfikacji agenta, z korektą ręczną, unknown dla starych
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium-high
agent: fa-core
branch: stage-1/inquiries-qualified
depends_on: [FA-1.03]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.04 — `inquiries.qualified`

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/04-open-questions.md` O-10 — definicja qualified: domyślnie `priority ≠ not_viable AND trip_country ∈ COUNTRIES`; nie rozszerzaj bez decyzji tj
- `docs/REBUILD_PLAN.md` §7 (M5, M6) i załącznik C (`inquiry.qualified_set`)
- `src/lib/events/emit.ts`, `src/lib/events/types.ts` — z FA-1.03
- `src/lib/ai/inquiry-agent.ts` — klasyfikacja (`priority`, `trip_country`, `classUpdate` ~445–591)
- `src/lib/inquiries/trip-country.ts`, `src/lib/countries.ts` — skąd bierze się kraj i lista obsługiwanych
- `src/app/admin/inquiries/[id]/page.tsx` — gdzie wstawić korektę ręczną
- `docs/tasks/FA-0.18.md` — `trip_country` jest zapisywane od etapu 0

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Bez flagi qualified nie da się policzyć, ile zapytań ma sens (M5) ani kosztu per qualified
(M6). Po zadaniu każde zapytanie ma `qualified ∈ {yes,no,unknown}`: agent ustawia je przy
klasyfikacji według reguły z O-10, admin może nadpisać na karcie, a każda zmiana emituje
`inquiry.qualified_set`. Stare wiersze dostają `unknown`; nie zgadujemy wstecz.

## Zakres
- [ ] Odczyt stanu (do raportu): rozkład `priority` i `trip_country` w `inquiries` (lokalny stack z zasianym rozkładem albo produkcja przez SELECT); ile wierszy spełnia regułę O-10.
- [ ] Migracja `inquiries_qualified`: `qualified TEXT NOT NULL DEFAULT 'unknown' CHECK (qualified IN ('yes','no','unknown'))`, `qualified_set_by TEXT NULL` (`agent`|`admin`), `qualified_set_at TIMESTAMPTZ NULL`; indeks częściowy na `qualified` gdzie `≠ 'unknown'`. Bez backfillu.
- [ ] `src/lib/inquiries/qualified.ts` — `computeQualified({ priority, tripCountry })` (czysta funkcja, reguła O-10) i `setQualified(client, inquiryId, value, { actor })`: update + `emitEvent('inquiry.qualified_set', { payload: { value, rule: 'O-10' | 'manual' } })`. Ręczne `admin` ma pierwszeństwo: agent nie nadpisuje wartości ustawionej przez admina.
- [ ] Agent: po każdej klasyfikacji z niepustym `priority` wołaj `setQualified` z `actor=agent`, o ile `qualified_set_by ≠ 'admin'`.
- [ ] Karta zapytania: trzy-stanowy przełącznik (yes / no / unknown) z aktorem admin.
- [ ] Testy: `computeQualified` dla czterech przypadków (not_viable, kraj spoza listy, oba OK, brak danych → unknown); agent nie nadpisuje wartości admina; każde `setQualified` = dokładnie jedno zdarzenie.

## Gotowe, gdy
- [ ] Po migracji: `SELECT qualified, count(*) FROM inquiries GROUP BY 1` → wyłącznie `unknown`. Wynik w raporcie.
- [ ] `UPDATE inquiries SET qualified='maybe'` → błąd constraintu — **na czerwono w raporcie**.
- [ ] Test: klasyfikacja agenta po ręcznym `no` nie zmienia wartości — na czerwono, gdy logika zostanie usunięta.
- [ ] Na lokalnym stacku: klasyfikacja testowego zapytania → `qualified='yes'`, jeden wiersz `inquiry_events` typu `inquiry.qualified_set` z `actor_kind='agent'`. SELECT w raporcie.
- [ ] `supabase db diff` pusty; typy zawierają `qualified`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Rozszerzenie reguły o liczbę osób / termin — O-10, decyzja tj później.
- Backfill historycznych wierszy — świadomie `unknown`.
- Przegląd tygodniowy liczący M5/M6 — FA-1.10.
- Zmiany w promptach agenta poza wywołaniem `setQualified` — FA-1.14.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis na produkcji: STOP. Lokalny stack.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- qualified
supabase db diff
pnpm typecheck && pnpm lint && pnpm build
# SELECT qualified, qualified_set_by, count(*) FROM inquiries GROUP BY 1,2;
```

## Notatki z realizacji
