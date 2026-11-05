---
id: FA-1.93
title: Rolę nadaje tylko serwer — użytkownik nie zmieni swojej roli, rejestracja i logowanie nie przyjmą `admin` z danych konta
stage: 1
status: review
difficulty: M
model: opus
model_approved:
effort: high
agent: fa-core
branch: fix/fa-1.93-role-server-only
pr: 175
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 4
owner: tj
---

# FA-1.93 — Rola tylko z serwera

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/02-data-model.md` — `profiles`; `docs/audit/rebuild-audit-db-aug-2026.md`
- `supabase/migrations/20260904165037_baseline_prod.sql` — `handle_new_user` (l. 264–280), polityki `profiles` (l. 3357–3373), granty (l. 9585–9587)
- `src/app/auth/callback/route.ts` (l. 39–57, 83–85) — zapis roli z `user_metadata` kluczem serwisowym
- `src/actions/auth.ts` (`signUp`, l. 50–90), `src/actions/admin.ts` (l. 340–344, `linkGuideAccount`) — ścieżki, które nadają rolę poprawnie i zostają
- `src/lib/auth/guards.ts` (`requireAdmin`), `src/lib/supabase/queries.ts` (`isAdminUser`), `src/actions/__tests__/experience-pages-v2.test.ts` — wzór testu z logowaniem kontami seeda
- `docs/05-agent-operations.md` §3 (bramki), §5 (raport)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś każdy zalogowany użytkownik może zostać adminem na trzy sposoby: (1) zmienić własny wiersz `profiles` (polityka „User updates own profile” bez ograniczenia kolumn i bez `WITH CHECK`, `GRANT ALL` dla `authenticated`); (2) zarejestrować się z `role: admin` w danych konta (`handle_new_user` bierze rolę z `raw_user_meta_data`); (3) ustawić `role: admin` we własnych danych konta i zalogować się przez link — `auth/callback` zapisuje tę rolę kluczem serwisowym. Rola admina otwiera `requireAdmin()` i polityki RLS z `role = 'admin'`. Po zadaniu rolę nadaje wyłącznie kod serwera (`signUp`, `linkGuideAccount`, zaproszenie przewodnika), a baza odrzuca każdą inną zmianę.

## Zakres
- [ ] Odczyt prod (supabase-prod MCP, tylko SELECT): polityki i granty `profiles`, definicja `handle_new_user`, lista adminów (maile zamaskowane, `created_at`, `updated_at`), liczba kont z `raw_user_meta_data->>'role' = 'admin'`. Wynik wklejony; STOP do potwierdzenia przez tj.
- [ ] Migracja: `anon`/`authenticated` nie zmieniają `profiles.role` ani nie wstawiają profilu z rolą inną niż `angler`; mechanizm wybiera agent i uzasadnia jednym zdaniem.
- [ ] Ta sama migracja: `handle_new_user` zawsze tworzy profil `angler`, `SET search_path`, `REVOKE EXECUTE` od `anon`, `authenticated`, `public`.
- [ ] `auth/callback`: usunięty zapis roli z `user_metadata` (D1 (b)); callback tylko dba, by profil istniał; przekierowanie po roli z `profiles` przez helper warstwy danych. Autolink po `invite_email` zostaje.
- [ ] Testy z red proofami (lokalny stack, konta seeda).
- [ ] Typy, jeśli migracja je zmienia.

## Gotowe, gdy
- [ ] `angler@seed.test` robi `update profiles set role='admin'` na własnym wierszu → odmowa albo 0 zmienionych wierszy, odczyt po teście pokazuje `angler`; test sprawdza stan wiersza, nie kod odpowiedzi (FA-1.22: odmowa RLS przy UPDATE = 204); pokazany na czerwono przed migracją.
- [ ] Użytkownik seeda **bez wiersza w `profiles`** wstawia własny profil z `role='admin'` (INSERT jego własną sesją) → odmowa, a odczyt po teście pokazuje brak wiersza albo wiersz `angler`; pokazane na czerwono przed migracją (trasa INSERT — wiadomość tj z 2026-11-04 po odczycie prod, pkt 1; nie była wymieniona w „Celu”, a polityka „User inserts own profile” sprawdza tylko `id`).
- [ ] Po `supabase db reset` z nową migracją: użytkownik utworzony kluczem serwisowym (`admin.createUser`, także z `user_metadata.role = 'admin'`) dostaje wiersz `profiles` z rolą `angler` — dowód, że trigger nadal odpala po odebraniu `EXECUTE` i ignoruje rolę z metadanych; czerwony przed migracją dla wariantu z `role: admin`. Oraz `admin@seed.test` jest adminem po resecie (poprawka seeda) (wiadomość tj z 2026-11-04 po zatwierdzeniu mechanizmu, dodatek 1).
- [ ] `grep -rn "from('profiles')" src` wklejony; każdy pozostały zapis idzie kluczem serwisowym w kodzie serwera.
- [ ] Nowy użytkownik z `user_metadata.role = 'admin'` dostaje profil `angler` — test z red proofem.
- [ ] Callback z `user_metadata.role = 'admin'` nie zmienia `profiles.role` (nowe konto ani istniejący admin) — test jednostkowy z red proofem na obecnym kodzie; `grep -n "metaRole\|user_metadata" src/app/auth/callback/route.ts` wklejony.
- [ ] `signUp` z `guide` → `guide`, `linkGuideAccount` → `guide`, `admin@seed.test` przechodzi `requireAdmin()` — nazwy testów + wynik.
- [ ] CI zielone na head (`check`, `knip`, `db`, `secrets`); po `migrate-prod` odczyt polityk, grantów i `handle_new_user` na prod wklejony.

## Poza zakresem
- Przebudowa modułu kont angler/guide (decyzja tj 2026-11-04) → deferred.
- Wybór roli `guide` w formularzu rejestracji → przy przebudowie kont.
- Odebranie zbędnych grantów `anon` na innych tabelach → deferred.
- Alarm o nowym adminie / zmianie roli → deferred.
- Zmiana ról istniejących kont na prod.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Po odczycie prod — zamaskowana lista adminów do tj; konto spoza założycieli = incydent, decyduje tj.
- Przed migracją — diff polityk/grantów `profiles` i `handle_new_user` względem baseline.
- `db push` na prod wyłącznie przez `deploy-db.yml` (`migrate-prod`, zatwierdza tj); agent go nie uruchamia. Raport mówi wprost, czy kod działa przed i po migracji; kolejność merge/migracja decyduje tj.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
    grep -rn "from('profiles')" src
    grep -n "metaRole\|user_metadata" src/app/auth/callback/route.ts
    pnpm test -- profiles-role auth-callback signUp
    SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='profiles';
    SELECT c.relacl::text AS table_acl,
           (SELECT string_agg(a.attname || ':' || a.attacl::text, ' | ') FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attacl IS NOT NULL) AS column_acls,
           r.rolname,
           has_table_privilege(r.rolname, c.oid, 'INSERT') AS can_insert,
           has_table_privilege(r.rolname, c.oid, 'UPDATE') AS can_update_table,
           has_column_privilege(r.rolname, c.oid, 'role', 'UPDATE') AS can_update_role,
           has_column_privilege(r.rolname, c.oid, 'role', 'INSERT') AS can_insert_role
    FROM pg_class c CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
    WHERE c.oid = 'public.profiles'::regclass;
    SELECT pg_get_functiondef('public.handle_new_user'::regproc);

## Notatki z realizacji
- **2026-11-04, tj:** pilne, przed zadaniami SEO (opcja A); odczyt prod robi agent w zadaniu.
- **2026-11-04, tj:** D1 — najprościej: callback przestaje zapisywać rolę (b); moduł kont poza adminem do wyrzucenia i przebudowy, bez dopracowywania ścieżek angler/guide.
- **2026-11-04, tj:** D2 — Opus, high.
- **2026-11-04, tj:** plik zadania, INDEX i deferred zapisuje agent w pierwszym commicie gałęzi (bez osobnego PR z zadaniem).
- **2026-11-04, tj (po odczycie prod):** konto admina `t***@g***.com` (utworzone 2026-03-06, ostatnie logowanie 2026-10-09) to konto założyciela — brak incydentu; kontynuacja. Odczyt prod: `anon` i `authenticated` mają pełne granty tabeli `profiles` (`arwdDxtm`), brak ACL kolumn, RLS włączony; `handle_new_user` jest `SECURITY DEFINER` bez `search_path`, z `EXECUTE` dla `PUBLIC`, `anon`, `authenticated`; 0 kont z `role=admin` w `raw_user_meta_data`/`raw_app_meta_data`.
- **2026-11-04, tj (po odczycie prod, pkt 1):** czwarta trasa — INSERT własnego profilu z `role='admin'` (polityka „User inserts own profile” sprawdza tylko `id`) — mieści się w punkcie zakresu „nie wstawiają profilu z rolą inną niż `angler`; dodane kryterium z red proofem (konto bez wiersza w `profiles`).
- **2026-11-04, tj (po odczycie prod, pkt 2):** zapytanie `information_schema.column_privileges` zastąpione odczytem z katalogu (`relacl`, ACL kolumn, `has_table_privilege` / `has_column_privilege` dla `anon` i `authenticated`). Powód: ten widok pokazuje tylko uprawnienia widoczne dla roli odpytującej — na prod zwrócił `[]` mimo pełnych grantów (`relacl` pokazuje `anon=arwdDxtm`, `authenticated=arwdDxtm`), czyli pusty wynik byłby fałszywym „czysto”.
- **2026-11-04, tj (po odczycie prod, pkt 3):** 5 kont `auth.users` bez wiersza w `profiles` → wiersz w `deferred-tasks.md` w tym PR; do czasu migracji to dokładnie te konta, które mogą użyć trasy INSERT. Agent nie tworzy ani nie zmienia tych wierszy.
- **2026-11-04, tj (zatwierdzenie planu migracji):** (a) mechanizm = uprawnienia na poziomie kolumn (`GRANT INSERT (id, full_name, avatar_url)` i `GRANT UPDATE (full_name, avatar_url)` dla `authenticated`; polityki bez zmian); (b) pełne `REVOKE ALL` dla `anon` i `authenticated` na `profiles` (w tym DELETE/TRUNCATE; poza `SELECT`), `service_role` bez zmian; (c) poprawka `supabase/seed.sql` w tym PR — jawny `UPDATE profiles SET role='admin'` dla `admin@seed.test`, bo dotąd rolę nadawał trigger z metadanych. Dodatek: kryterium z red proofem dla `admin.createUser` (trigger po `REVOKE EXECUTE`) i dla `admin@seed.test` po resecie.
- **2026-11-04, tj:** `email_confirm: true` w `signUp` (konto bez weryfikacji maila) + autolink po `invite_email` = wiersz bezpieczeństwa w deferred (nie otwarte pytanie), właściciel: przebudowa modułu kont. Druga pozycja: polityka „Public reads all profiles” + grant SELECT dla `anon` ujawniają każdemu `full_name` i `role` wszystkich profili (w tym kto jest adminem) — poza zakresem, ten sam właściciel.
- **2026-11-04, Claude (wf-plan):** trzy wejścia ustalone odczytem `origin/main` (`e1a84ac2`); stan prod niepotwierdzony — odczyt z app zablokowany przez filtr uprawnień.
