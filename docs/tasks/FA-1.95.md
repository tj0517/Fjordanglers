---
id: FA-1.95
title: Log zdarzeń tylko dla serwera — zamknięty odczyt `inquiry_events` sesją (`anon`, `authenticated`)
stage: 1
status: review
difficulty: S
model: opus
model_approved:
effort: high
agent: fa-db
branch: db/inquiry-events-admin-read
pr: 197
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 2
owner: tj
---

# FA-1.95 — Log zdarzeń tylko dla serwera

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`, `docs/05-agent-operations.md` §3 (bramki), §5 (raport)
- `supabase/migrations/20260916201226_add_inquiry_events.sql` — polityki i granty `inquiry_events`, strażnik append-only
- `src/actions/__tests__/guide-accounts.test.ts` — wzór testu z sesją konta seeda na lokalnym stacku

## Skąd to zadanie
Znalezione w FA-M.03 przy odczycie stanu (2026-11-16). Polityka „authenticated reads events” to
`SELECT … TO authenticated USING (true)`. Od FA-M.08 przewodnicy mają konta, więc każdy
zalogowany użytkownik (klient, przewodnik) czyta cały log zdarzeń wszystkich zapytań.
Odczyt prod 2026-11-16 (supabase-prod MCP, SELECT): **1809 zdarzeń / 161 zapytań** dostępnych
dla każdego zalogowanego; klucze payloadu obejmują kwoty (`amount_cents`, `eur_rate`), nazwy i
opisy produktów Stripe (`name`, `description`), notatki (`note` w `status.changed`,
`inquiry.lost`), uzasadnienia sędziego auto-wysyłki (`reasons`, `score`), identyfikatory sesji
Stripe (`stripe_session_id`).

## Cel
Log zdarzeń jest wewnętrzny. Po zadaniu `anon` i `authenticated` nie czytają `inquiry_events`
wcale; czyta i pisze wyłącznie kod serwera kluczem serwisowym (panel admina już tak robi —
odczyt FA-M.03: żaden kod nie czyta tej tabeli sesją).

## Zakres
- [ ] Odczyt (tylko SELECT): mechanizm admina w politykach RLS; każde miejsce w kodzie czytające `inquiry_events` i jakim klientem. STOP do tj. — **zrobione w FA-M.03 (2026-11-16)**, wynik w raporcie.
- [ ] Migracja `20261116000000`: `DROP POLICY "authenticated reads events"`; `REVOKE SELECT ON public.inquiry_events FROM anon, authenticated`. Polityki `service_role` i strażnik append-only bez zmian.
- [ ] Testy z red proofami (lokalny stack).

## Gotowe, gdy
- [ ] Sesja `angler@seed.test` i klient `anon`: przed migracją wynik odczytu wklejony, po migracji 0 wierszy / brak uprawnień — test + wynik czerwony i zielony.
- [ ] Oś czasu karty zapytania admina (klient serwisowy) czyta zdarzenia po migracji — test.
- [ ] CI zielone na head (`check`, `knip`, `db`, `secrets`).
- [ ] Po `deploy-db.yml` (uruchamia tj): `pg_policies` i `has_table_privilege` dla `anon`/`authenticated` na `inquiry_events` z prod wklejone.

## Poza zakresem
- Polityki innych tabel (także te z `USING (true)`) → deferred.
- `requireAdmin()` na stronie karty zapytania admina → deferred.

## Bramki STOP
- Migracja na prod wyłącznie przez `deploy-db.yml` (uruchamia tj); bez merge przed nim.
- Ten PR merge'uje się **przed** FA-M.03 (kolejność migracji `20261116…` < `20261117…`).

## Weryfikacja
```
ls supabase/migrations | tail -2
pnpm test run inquiry-events-access
SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename = 'inquiry_events';
SELECT r.rolname, has_table_privilege(r.rolname, 'public.inquiry_events', 'SELECT') FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role');
```

## Notatki z realizacji
- **2026-11-16, tj:** zadanie wydzielone z FA-M.03. Zakres zmieniony względem pierwszej propozycji — bez polityki admina: odczyt sesją zamknięty całkowicie (drop polityki + `REVOKE SELECT` od `anon`, `authenticated`). Migracja `20261116000000`, merge przed FA-M.03.
- **2026-11-16, tj:** przenumerowane z FA-1.94 na FA-1.95 — FA-1.94 zajęte przez stronę główną (gałąź lokalna, nigdy niewypchnięta).
