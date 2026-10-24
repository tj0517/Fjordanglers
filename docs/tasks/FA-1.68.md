---
id: FA-1.68
title: Opinie klientów — tabela `testimonials` (cytat, imię, kraj, ocena, zdjęcie, źródło Trustpilot/direct + link, zgoda, aktywna, kolejność) + admin `/admin/testimonials` (lista, dodaj/edytuj, upload do `guide-photos/testimonials/`, włącz/wyłącz)
stage: 1
status: review
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/fa-1.68-testimonials
pr: 159
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 8
owner: tj
---

# FA-1.68 — Opinie klientów: tabela i panel admina

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/02-data-model.md` + `docs/audit/rebuild-audit-db-aug-2026.md` — konwencje schematu, RLS w tej samej migracji
- `docs/05-agent-operations.md` §3 — kolejność migracja → kod, `deploy-db.yml`
- `supabase/migrations/20261008000000_reviews_publish_consent.sql` — wzór: RLS włączone bez polityki anon, odczyt tylko rolą serwisową
- `src/lib/supabase/queries.ts` (`reviewCards`, `createServiceReadClient`) — jak publiczne strony czytają tabelę bez polityki anon
- `src/actions/knowledge.ts`, `src/app/admin/knowledge/**` — wzór CRUD w adminie (`requireAdmin()` + `createServiceClient()`, `ToggleActiveButton`)
- `src/components/admin/image-upload.tsx` — upload do publicznego bucketa `guide-photos` (O-47 a: folder `testimonials/`)
- `docs/04-open-questions.md` O-46, O-47

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Opinie z Trustpilota i bezpośrednio od klientów (ze zdjęciami spoza Trustpilota) nie mają dziś gdzie żyć: `reviews` wymaga zapytania i tokenu. Po zadaniu tj sam wpisuje, edytuje i włącza opinie w adminie, bez deployu. Każda opinia z Trustpilota ma link do swojej recenzji, a żadna nie może być aktywna bez zapisanej zgody — pilnuje tego baza, nie tylko formularz. Kolejność ustawiona w adminie decyduje, którą opinię pokaże baner (O-46 a, FA-1.69).

## Zakres
- [ ] Odczyt stanu: brak tabeli `testimonials` (`grep -rn testimonials supabase/migrations`), format `experience_pages.country` (lokalny stack, `SELECT DISTINCT country`), polityki storage `guide-photos` w baseline (admin może wstawiać — polityka „Authenticated users upload guide photos”, sprawdzone 2026-10-24)
- [ ] Migracja `testimonials`: `quote` (niepuste, rozsądny limit długości), `author_name` (imię do wyświetlenia), `author_country` (ISO alpha-2, opcjonalnie, jak `angler_country`), `trip_country` (format jak `experience_pages.country`, NULL = opinia ogólna), `rating` (1–5, opcjonalnie), `photo_url`, `source` (`trustpilot` | `direct`), `source_url`, `consent_confirmed_at`, `consent_note` (wewnętrzna, nigdy na stronę), `is_active` (domyślnie false), `sort_order`, `created_at`, `updated_at`
- [ ] Reguły w bazie: `source='trustpilot'` ⇒ `source_url` to `https://…trustpilot.com/…`; `is_active=true` ⇒ `consent_confirmed_at IS NOT NULL`
- [ ] RLS włączone w tej samej migracji, **bez** polityki dla anon/authenticated (jak `reviews` po FA-1.59); typy zregenerowane
- [ ] Warstwa danych: `getTestimonial(country: string | null)` — pierwsza aktywna wg `sort_order` z `trip_country = country`, inaczej pierwsza aktywna ogólna, inaczej `null`; zwraca tylko pola publiczne (bez `consent_note`); `listTestimonialsForAdmin()`
- [ ] Akcje admina (`src/actions/testimonials.ts`, `requireAdmin()`): create, update, toggle active, zmiana kolejności; błąd reguły z bazy pokazany w formularzu po ludzku
- [ ] `/admin/testimonials`: lista (miniatura, cytat, źródło, kraj, aktywna, kolejność), `new`, `[id]/edit`; formularz z uploadem zdjęcia do `guide-photos/testimonials/`, polem linku TP widocznym przy źródle Trustpilot, checkboxem „Mam zgodę klienta na publikację imienia i zdjęcia” (ustawia `consent_confirmed_at`) i notatką o zgodzie; link w nawigacji admina
- [ ] Seed: 2 opinie (jedna `trustpilot` z `trip_country` NZ, jedna `direct` ogólna), obie aktywne, ze zgodą — pod FA-1.69

## Gotowe, gdy
- [ ] Migracja przechodzi `supabase db reset` lokalnie; `\d public.testimonials` w raporcie
- [ ] Red proof w bazie (lokalnie, wklejone błędy): INSERT `source='trustpilot'` bez `source_url` → odrzucony; INSERT/UPDATE `is_active=true` przy `consent_confirmed_at IS NULL` → odrzucony
- [ ] Red proof RLS: `SELECT` z kluczem anon (`curl` do `/rest/v1/testimonials` lokalnie) → pusta lista mimo aktywnych wierszy w seedzie
- [ ] `getTestimonial` — testy: dopasowanie kraju, fallback na ogólną, `null` przy pustej tabeli, nieaktywna i bez zgody nigdy nie wraca, `consent_note` nie ma w zwracanym typie
- [ ] Admin: zrzuty listy, formularza z TP i formularza z uploadem zdjęcia (lokalnie); próba aktywacji bez zgody → komunikat w formularzu, nie 500 (zrzut)
- [ ] `/admin/testimonials` bez sesji admina → przekierowanie jak inne strony admina (`curl -I` w raporcie)
- [ ] Brak `.from('testimonials')` poza `src/lib/supabase/**` i `src/actions/**`: `git diff main...HEAD -- 'src/app/**' | grep -n "^+.*\.from("` → puste; typy w diffie; CI na head PR zielone (`check`, `knip`, `db`, `secrets`) — lista

## Poza zakresem
- Baner na stronach i zastępstwo za pusty S10 → FA-1.69
- Wpisanie prawdziwych opinii i zebranie zgód → FA-1.70 (tj)
- Import z API Trustpilota, widżet TrustBox, średnia ocena TP → nie planowane (decyzja tj 2026-10-23)
- Zmiany w `reviews`, formularzu recenzji z linku i S10 → nie ruszać
- Nowy bucket i polityki storage → O-47 (a): istniejący `guide-photos`
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.
- Przed zastosowaniem migracji poza lokalnym stackiem: pełny SQL + wynik `supabase db reset` → akceptacja tj.
- Migracja na prod **wyłącznie** przez `deploy-db.yml` (`migrate-prod`, `workflow_dispatch` z `main`, zatwierdza tj) — agent go nie uruchamia. Kolejność (decyzja tj 2026-10-24, wzór FA-1.63): osobny PR „db(FA-1.68): testimonials table — migration only” z `origin/main` (migracja + `docs/02-data-model.md` + zregenerowany `database.types.ts`) → merge (tj) → `migrate-prod` (tj) → odczyt, że tabela jest na prod → rebase gałęzi zadania na `main` → PR z adminem i warstwą danych. STOP przed otwarciem PR migracyjnego i przed merge PR głównego.
- Żadnego zapisu do prod (wierszy, plików w storage) — dema tylko na lokalnym stacku.

## Weryfikacja
```
ls supabase/migrations | grep -i testimonial
grep -n "testimonials" src/lib/supabase/database.types.ts | head -3
grep -rn "getTestimonial" src/lib/supabase | head
git diff main...HEAD -- 'src/app/**' | grep -n "^+.*\.from("     # puste
git diff main...HEAD | grep -n '^+.*eslint-disable'               # puste
```

## Notatki z realizacji
- 2026-10-23 tj (/wf-plan „testimonial baner”): D1 (b) tabela + admin zamiast listy w kodzie; „połączenie z Trustpilotem” = link do recenzji + oznaczenie źródła (bez API); O-46 (a) kolejność ręczna; O-47 (a) `guide-photos/testimonials/`; tabela i admin scalone w jedno zadanie (L).
- 2026-10-24 tj (/wf-task): migracja najpierw osobnym PR-em (opcja a, wzór FA-1.63) — `migrate-prod` uruchamia się tylko z `main`, więc pierwotna bramka „migracja przed merge” była niewykonalna.
- 2026-10-24 tj (bramka STOP 1 — SQL migracji): SQL zaakceptowany jak pokazany, łącznie z listą 8 krajów w `trip_country` i limitem 1000 znaków cytatu. D1 (a): stack lokalnie bez `storage-api` na liście `-x` (wg `docs/05` §9), przed startem `docker ps` — działa tylko stack fjordanglers. D2 (a): `photo_url` musi zaczynać się od naszego adresu Supabase Storage + `guide-photos/testimonials/` — pilnuje schemat zod w akcjach. D3 (a): `REVOKE` zostaje; kryterium RLS brzmi teraz „anon dostaje 42501 permission denied na odczyt i zapis”, jak `reviews`. Rozszerzenie testu synchronizacji krajów może wejść do PR migracyjnego.
- 2026-10-24 tj (dowód uploadu zdjęcia): D4 (c) — bucket `guide-photos` zadeklarowany w `supabase/config.toml` (`[storage.buckets.guide-photos]`), nie w seedzie i nie ręcznie; ustawienia skopiowane z prod odczytem read-only (public, 52428800 B, jpeg/jpg/png/webp); nigdy `supabase config push` ani nic, co stosuje config do zdalnego projektu. D5 (a) — tymczasowa, niecommitowana zmiana `next.config.ts` (host lokalnego Storage) na czas zrzutu, cofnięta przed commitem; w raporcie pusty `git diff next.config.ts`.
- 2026-10-24 (agent): PR migracyjny #158 („db(FA-1.68): testimonials table — migration only”) zmergowany przez tj, `migrate-prod` uruchomiony i zatwierdzony przez tj; odczyt prod read-only: `SELECT count(*) FROM public.testimonials` → 0, migracja `20261012000000 add_testimonials` na liście. PR główny: #159. Status `review` — czeka na review tj, merge robi tj.
