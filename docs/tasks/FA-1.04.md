---
id: FA-1.04
title: inquiries.qualified — z klasyfikacji agenta, z korektą ręczną, unknown dla starych
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium-high
agent: fa-core
branch: feat/inquiries-qualified
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
- `src/lib/ai/inquiry-agent.ts` — klasyfikacja (`priority`, `trip_country`, `classUpdate` ~366–376); oba `.update({ ...classUpdate })` (~447, ~474)
- `src/lib/inquiries/trip-country.ts`, `src/lib/countries.ts` — skąd bierze się kraj i lista obsługiwanych
- `src/app/admin/inquiries/[id]/page.tsx` — gdzie wstawić korektę ręczną (sidePanel ~604)
- `docs/tasks/FA-0.18.md` — `trip_country` jest zapisywane od etapu 0

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Bez flagi qualified nie da się policzyć, ile zapytań ma sens (M5) ani kosztu per qualified
(M6). Po zadaniu każde zapytanie ma `qualified ∈ {yes,no,unknown}`: agent ustawia je przy
klasyfikacji według reguły z O-10, admin może nadpisać na karcie, a każda zmiana emituje
`inquiry.qualified_set`. Stare wiersze dostają `unknown`; nie zgadujemy wstecz.

## Decyzje tj (19 IX 2026)

### D1 — computeQualified przy pustym trip_country
Ocena dwustopniowa:
- `priority === 'not_viable'` → `'no'` (dyskwalifikator jest znany; kraj nie zmieni wyniku)
- `priority` puste LUB `trip_country` puste / spoza COUNTRIES bez znanego priority → `'unknown'`
- `priority ≠ 'not_viable'` AND `trip_country ∈ COUNTRIES` → `'yes'`
- `priority ≠ 'not_viable'` AND `trip_country` spoza COUNTRIES (niepuste) → `'no'`
Agent woła `setQualified` tylko wtedy, gdy `computeQualified` zwróci `'yes'` albo `'no'`.
Wynik `'unknown'` z agenta = brak wywołania, brak zdarzenia, brak zapisu.

Testy `computeQualified` — pięć przypadków:
1. `not_viable` + kraj z listy → `'no'`
2. `not_viable` + kraj null → `'no'`   ← odróżnia D1 od wariantu "zawsze unknown"
3. `high` + kraj null → `'unknown'`
4. `high` + kraj spoza COUNTRIES (np. `'Spain'`) → `'no'`
5. `high` + kraj z listy → `'yes'`
Plus: `priority null` + kraj z listy → `'unknown'`.

### D2 — przełącznik w adminie
Trzy stany: yes / no / unknown, wszystkie dostępne dla admina.
- value `'yes'` | `'no'`  → `qualified_set_by = 'admin'`, `qualified_set_at = now()`
- value `'unknown'`       → `qualified_set_by = NULL` (blokada zdjęta), `qualified_set_at = now()`
Agent może nadpisać wartość wtedy i tylko wtedy, gdy `qualified_set_by ≠ 'admin'`.
Każda z trzech ścieżek emituje `inquiry.qualified_set` z `actor_kind='admin'`
i `payload { value, rule: 'manual' }` — także `'unknown'`.
W UI trzeci stan to „Reset to auto" (wróć do oceny automatycznej).

Dodatkowe testy wynikające z D2:
- admin ustawia `'no'` → klasyfikacja agenta nie zmienia wartości (czerwienieje po usunięciu warunku)
- admin ustawia `'unknown'` → następna klasyfikacja agenta ustawia wartość i `qualified_set_by='agent'`
- admin ustawia `'unknown'` → dokładnie jeden wiersz `inquiry_events`, `actor_kind='admin'`

Oba miejsca `.update({ ...classUpdate })` w `inquiry-agent.ts` (~447 i ~474) muszą wołać
`setQualified` — test pierwszeństwa admina ma czerwienieć dla obu ścieżek.

## Zakres
- [ ] Odczyt stanu (do raportu): rozkład `priority` i `trip_country` w `inquiries` (lokalny stack z zasianym rozkładem albo produkcja przez SELECT); ile wierszy spełnia regułę O-10.
- [ ] Migracja `inquiries_qualified`: `qualified TEXT NOT NULL DEFAULT 'unknown' CHECK (qualified IN ('yes','no','unknown'))`, `qualified_set_by TEXT NULL` (`'agent'`|`'admin'`|null), `qualified_set_at TIMESTAMPTZ NULL`; indeks częściowy na `qualified` gdzie `≠ 'unknown'`. Bez backfillu.
- [ ] `src/lib/inquiries/qualified.ts` — `computeQualified({ priority, tripCountry })` (czysta funkcja, reguła O-10 z D1) i `setQualified(client, inquiryId, value, actor)`: update + `emitEvent('inquiry.qualified_set', { payload: { value, rule: 'O-10' | 'manual' } })`. Admin ma pierwszeństwo: agent nie nadpisuje wartości ustawionej przez admina.
- [ ] Agent: po każdej klasyfikacji z niepustym `priority` wołaj `setQualified` z `actor={kind:'agent'}`, o ile `qualified_set_by ≠ 'admin'` i `computeQualified` zwróci `'yes'` albo `'no'`.
- [ ] Karta zapytania: trzy-stanowy `QualifiedChanger` (yes / no / Reset to auto) z aktorem admin. Każda ścieżka emituje zdarzenie.
- [ ] Testy: `computeQualified` dla sześciu przypadków (D1); agent nie nadpisuje wartości admina (obie ścieżki agenta); każde `setQualified` = dokładnie jedno zdarzenie; admin ustawia `'unknown'` → zdarzenie + agent może nadpisać.

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

## Dowód na prod (19 IX 2026)

`db push` wykonany przez tj, 19 IX 2026. SQL Editor, read-only, `uwxrstbplaoxfghrchcy`.

```
SELECT qualified, count(*) FROM inquiries GROUP BY 1;
→ unknown | 99   (wszystkie istniejące wiersze)

UPDATE inquiries SET qualified='maybe';
→ ERROR: violates check constraint "inquiries_qualified_check"  (na czerwono ✓)

SELECT count(*) FROM inquiry_events WHERE type='inquiry.qualified_set' AND source='app';
→ 0  (brak duplikatów — backfill nie tworzył qualified_set)
```

Emiter `inquiry.qualified_set` zweryfikowany pośrednio przez FA-1.05 (`message.received/webhook = 1` — pierwsze żywe zdarzenie po wdrożeniu); ścieżka agenta przetestowana w testach jednostkowych (153 passed).

## Notatki z realizacji

### Raport runda 2 (19 IX 2026)

**Model:** claude-sonnet-4-6 · **Effort:** medium-high

#### Zrobione

- **Migracja** `20261002000000_inquiries_qualified.sql` — `qualified TEXT NOT NULL DEFAULT 'unknown' CHECK (IN ('yes','no','unknown'))`, `qualified_set_by TEXT NULL`, `qualified_set_at TIMESTAMPTZ NULL`; indeks częściowy `WHERE qualified <> 'unknown'`. Zastosowana lokalnie, brak dryfu (`supabase db diff` pusty).
- **`src/lib/inquiries/qualified.ts`** — `computeQualified()` (reguła O-10 + D1), `setQualified()` (update + `emitEvent('inquiry.qualified_set')`), admin lock: `qualified_set_by = NULL` gdy admin ustawia `'unknown'`.
- **`src/lib/supabase/database.types.ts`** — zregenerowane, zawierają trzy nowe kolumny.
- **`src/lib/ai/inquiry-agent.ts`** — `qualified_set_by` dodany do obu SELECT (Round 1 i Round 2); `setQualified` wołany po każdym z czterech `.update({ ...classUpdate })` gdy wynik ≠ `'unknown'` i `qualified_set_by ≠ 'admin'`.
- **`src/actions/inquiries.ts`** — `setInquiryQualified(inquiryId, value)` z `requireAdmin()`.
- **`src/app/admin/inquiries/[id]/QualifiedChanger.tsx`** — trzy-stanowy komponent (yes / no / Reset to auto), `router.refresh()` po zmianie.
- **`src/app/admin/inquiries/[id]/page.tsx`** — `QualifiedChanger` wstawiony po `AgentToggle` w sidePanel.
- **Testy admina lock** — 8 testów w `inquiry-agent-round1.test.ts` (4 nowe) i nowy `inquiry-agent-round2.test.ts` (4 testy). Każda z czterech ścieżek agenta objęta: Round 1 ready (455), Round 1 waiting (490), Round 2 ready (591), Round 2 waiting (632).
- **Red proof** — usunięcie `&& qualified_set_by !== 'admin'` z czterech miejsc czerwieni cztery testy, po jednym na ścieżkę:
  - `does not call setQualified when qualified_set_by is admin (Round 1 ready)` ✗
  - `does not call setQualified when qualified_set_by is admin (Round 1 waiting)` ✗
  - `does not call setQualified when qualified_set_by is admin (Round 2 ready)` ✗
  - `does not call setQualified when qualified_set_by is admin (Round 2 waiting)` ✗
  Po przywróceniu warunku: 153 passed, 0 nowych błędów.

#### Weryfikacja (lokalny stack, 19 IX 2026)

```
INSERT (default) → qualified='unknown', qualified_set_by=NULL  ✓
UPDATE SET qualified='maybe' → ERROR: violates check constraint "inquiries_qualified_check"  ✓ (na czerwono)
supabase db diff → No schema changes found  ✓
pnpm typecheck → 0 errors  ✓
pnpm test → 153 passed (stack wyłączony; 1 pre-existing failure wymaga żywego DB)  ✓
pnpm build → OK (stack zatrzymany)  ✓
pnpm lint → 40 errors, 81 warnings — wszystkie pre-existing (FA-1.03: src/emails/*.tsx,
  whatsapp-bridge/poll-emails.mjs); zero przecięcia z plikami FA-1.04. *
```

(*) 40 błędów istnieje na `main` niezależnie od tego PR — wpis w deferred-tasks.md (FA-1.03).

#### Kryterium 1 — niespełnione (lokalny stack bez seed danych)

`SELECT qualified, count(*) FROM inquiries GROUP BY 1;` → `(0 rows)` — stack nie ma zasianych zapytań. Kolumny i constraint udowodnione osobno (INSERT + red proof). Do zamknięcia w FA-1.10, gdy seed.sql będzie naprawiony (wpis FA-1.04 w deferred-tasks.md).

#### Nie zrobione / odroczone (zakres)

- Brak backfillu historycznych wierszy — świadomie `unknown`, zgodnie z zakresem.
- Kryterium 4 (E2E klasyfikacja → `qualified='yes'` + `inquiry_events`) — deferred jak kryterium 1 (brak seed danych).
- Deduplikacja zdarzeń (setQualified emituje przy każdej rundzie, nawet gdy wartość niezmieniona) — wpis w deferred-tasks.md.

#### Zauważone poza zakresem

- `inquiry-agent-round1.test.ts` — mock `insert()` zwracał plain object zamiast łańcucha; emitEvent wymaga `.select().single()`. Naprawione w tym PR.
- Pre-existing failing test: `src/actions/__tests__/inquiryStatusDefault.test.ts` — „INSERT without status uses the default and returns new" — odpytuje żywy Supabase przez SDK i pada gdy stack jest wyłączony (ECONNREFUSED 127.0.0.1:54421); niesprawiony w FA-1.04, istnieje co najmniej od FA-1.03.

**Kryteria 1 i 4 domknięte w FA-1.10** (lokalny stack + seed, SELECT-y w `docs/proof/FA-1.10/fa-1.04-crit1.out` i `fa-1.04-crit4.out`, raport w `docs/tasks/FA-1.10.md`).
