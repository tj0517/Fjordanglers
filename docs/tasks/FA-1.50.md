---
id: FA-1.50
title: EXPAND — oferta zamiast przewodnika w schemacie: `experience_guides`, `experience_prices`, aliasy slugów, nowe kolumny treści, `inquiries.brief`; backfill; nic nie usuwa
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: db/experience-offer-centric-expand
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 8
owner: tj
---

# FA-1.50 — EXPAND: schemat pod stronę ofertową, obok starego

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/proposals/2026-10-05-experience-offer-centric.md` — §2 model docelowy, §3 backfill, §7 krok 1 (EXPAND); to zadanie realizuje dokładnie §7 krok 1
- `docs/02-data-model.md` §1 (stan) i §2 (target) — nowe tabele mają być zgodne z konwencjami target state (centy + waluta, `created_at`/`updated_at`, jawne `ON DELETE`, RLS + policy na każdej tabeli)
- `docs/audit/rebuild-audit-db-aug-2026.md` — audyt bazy
- `docs/adr/0004-money-in-cents-frozen-fx.md` — pieniądze w centach
- `docs/04-open-questions.md` — O-31 (cena całkowita), O-32 (nadpisanie ceny per przewodnik), O-33 (warianty = osobna strona, cennik bez `option_id`) — rozstrzygnięte, kształt schematu z nich wynika
- `supabase/migrations/20260904165037_baseline_prod.sql` — definicje `experience_pages`, `experience_page_options`, `guides`, `reviews`, `inquiries`
- `supabase/migrations/20261006000000_deposit_amount_cents.sql` — ostatnia migracja; wzór migracji z backfillem w centach
- `docs/05-agent-operations.md` §3 — bramki STOP i kolejność migracja → kod

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Strona oferty ma móc mieć więcej niż jednego przewodnika, cennik „dni × wędkarze”, tryb stałej lub personalizowanej oferty i treść pod nowy szablon (dla kogo, przebieg dnia, licencja, SLA) — a jednocześnie obecna strona, admin i ścieżka zapytanie → oferta → depozyt mają działać bez żadnej zmiany. To zadanie dokłada nowe tabele i kolumny obok starych, wypełnia je z istniejących danych i niczego nie usuwa ani nie przemianowuje. Rename `experience_pages → experiences` i dropy zostają w etapie 4.

## Zakres
- [ ] Odczyt bieżącego stanu: `ls supabase/migrations | tail -5`; definicje `experience_pages`, `experience_page_options`, `guides`, `reviews`, `inquiries` z baseline; na prod (odczyt, wklej wynik): `SELECT country, count(*), count(guide_id) FROM experience_pages GROUP BY 1;` oraz `SELECT experience_page_id, count(*) FROM experience_page_options GROUP BY 1;`
- [ ] Jedna migracja `2026xxxx_experience_offer_centric_expand.sql`, w pełni addytywna, z propozycji §2.1–2.8:
  - `experience_guides (experience_id, guide_id, role primary|backup, status active|paused, show_on_page, sort_order, guide_price_override_cents, created_at)`, PK `(experience_id, guide_id)`, unikalny `primary active` per strona; CHECK: `guide_price_override_cents` ≤ 115% ceny bazowej z `experience_prices` dla (days=1, anglers=max) — albo, jeśli CHECK z podzapytaniem nie jest możliwy, trigger `BEFORE INSERT OR UPDATE` (O-32: nadpisanie tylko do ~15%)
  - `experience_prices (experience_id, days, anglers, guide_price_cents, currency, valid_from, valid_to)`, UNIQUE `(experience_id, days, anglers, valid_from)`; bez `option_id` (O-33)
  - `experience_slug_aliases (slug PK, experience_id)`
  - `experience_pages`: `offer_mode fixed|custom`, `price_from_cents`, `price_to_cents`, `fee_pct` default 0.20, `max_anglers_per_guide` default 2, `min_days`, `max_days`, `page_version smallint 1|2 default 1`, `suited_for text[]`, `not_suited_for text[]`, `expectations_text`, `skill_level 1–5`, `walking_km_min/max`, `day_schedule jsonb`, `nearest_airport`, `suggested_lodging jsonb`, `license_info jsonb`, `tip_guidance_text`, `weather_policy_text`, `response_sla_hours default 24`, `offer_eta_text`
  - `experience_page_options`: `kind variant|archetype|addon`, `price_from_cents`, `price_to_cents`, `currency`, `duration_days_min/max`, `sample_itinerary jsonb`
  - `guides`: `association`, `response_time_hours`, `gear_text`
  - `reviews`: `experience_id` → `experience_pages`
  - `inquiries`: `brief jsonb` (klucze z propozycji §2 „Co z inquiries”; walidacja kształtu w kodzie, nie w DB) — decyzja tj 2026-10-05 (P2)
  - RLS włączone i polityki na każdej nowej tabeli: odczyt publiczny tylko wierszy stron `status='active'`, zapis tylko admin (wzór: polityki `experience_page_options`)
- [ ] Backfill w tej samej migracji, idempotentny (`ON CONFLICT DO NOTHING`, `WHERE … IS NULL`): §3 kroki 1–5 propozycji (`guide_id` → `experience_guides primary`; `price_from` → `price_from_cents`; `offer_mode='custom'` dla Iceland/Norway/Finland; `experience_prices (1, max_anglers_per_guide)` dla `fixed`; `kind` i centy w opcjach)
- [ ] Regeneracja `src/lib/supabase/database.types.ts`
- [ ] `docs/02-data-model.md` §1: dopisać nowe tabele/kolumny jako „live, przejściowe do etapu 4” z odsyłaczem do propozycji

## Gotowe, gdy
- [ ] Migracja przechodzi na czystym lokalnym stacku: `supabase db reset` zielone; `ls supabase/migrations | tail -1` pokazuje nowy plik — wynik w raporcie
- [ ] Po migracji na lokalnym seedzie: `SELECT count(*) FROM experience_guides` = `SELECT count(*) FROM experience_pages WHERE guide_id IS NOT NULL`; każda strona `fixed` z `price_from > 0` ma ≥ 1 wiersz w `experience_prices` — oba zapytania i wyniki w raporcie
- [ ] Red proof 1: `INSERT` drugiego `primary active` dla tej samej strony kończy się błędem unikalności — wklejony komunikat
- [ ] Red proof 2: `guide_price_override_cents` o 30% wyższy niż cena bazowa jest odrzucony — wklejony komunikat
- [ ] Red proof 3: anon (`set role anon`) nie widzi `experience_prices` strony ze `status='draft'` i nie może wstawić wiersza do `experience_guides` — wklejone wyniki
- [ ] `grep -n -E 'DROP|RENAME|ALTER COLUMN .* TYPE' supabase/migrations/<nowy plik>` → 0 trafień (migracja niczego nie usuwa ani nie zmienia znaczenia kolumn)
- [ ] `git diff main...HEAD -- src/lib/supabase/database.types.ts --stat` niepusty; `grep -n "experience_guides\|experience_prices\|brief" src/lib/supabase/database.types.ts` trafia
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone; CI job `db` zielony
- [ ] Istniejąca strona `/experiences/[slug]` i admin `/admin/experiences/[id]/edit` działają bez zmiany kodu — `git diff main...HEAD --stat -- src/app src/components src/actions` pusty poza typami

## Poza zakresem
- Triggery synchronizujące `guide_id` ↔ `experience_guides` → FA-1.51
- Jakikolwiek kod UI, router v1/v2, formularz → FA-1.52–1.55
- Zakładka admina do nowych pól → FA-1.56
- Scalanie bliźniaczych stron (ten sam produkt, dwóch przewodników) → ręcznie w adminie po FA-1.56; tu tylko `experience_slug_aliases` jako tabela
- Drop `experience_pages.guide_id`, `price_from`, `boat_*`, `rod_setup`, rename na `experiences` → etap 4 (CONTRACT, `docs/deferred-tasks.md`)
- `destinations`, `guide_destinations`, `customers` z planu etapu 4
- Przenoszenie `boat_*` / `rod_setup` do `guides` (§3 krok 7) → etap 4
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- przed `supabase db push` na prod (`uwxrstbplaoxfghrchcy`) — pokaż `supabase migration list` (lokalnie vs prod) i pełną treść migracji; czekaj na akceptację tj; push robi tj albo agent z `FA_ALLOW_PROD=1` po zgodzie
- przed jakimkolwiek `UPDATE`/`INSERT` na prod poza migracją — zatrzymaj się; backfill wchodzi wyłącznie w migracji
- przed merge do `main` — migracja zastosowana na prod (wklej `supabase migration list`), inaczej PR czeka
- stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów

## Weryfikacja
```
ls supabase/migrations | tail -3
supabase db reset
psql "$LOCAL_DB" -c "SELECT count(*) FROM experience_guides" -c "SELECT count(*) FROM experience_pages WHERE guide_id IS NOT NULL"
psql "$LOCAL_DB" -c "SELECT e.id FROM experience_pages e WHERE offer_mode='fixed' AND price_from_cents>0 AND NOT EXISTS (SELECT 1 FROM experience_prices p WHERE p.experience_id=e.id)"   # oczekiwane: 0 wierszy
grep -n -E 'DROP|RENAME|ALTER COLUMN .* TYPE' supabase/migrations/<nowy plik>   # 0
git diff main...HEAD --stat -- src/app src/components src/actions          # pusty
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji
- 2026-10-05 tj (/wf-plan): O-31 cena całkowita (schemat trzyma cenę przewodnika + `fee_pct`, total liczony); O-32 nadpisanie per przewodnik do ~15%; O-33 warianty = osobna strona, cennik bez `option_id`; P2 `inquiries.brief` wchodzi tutaj, nie w etapie 4.
