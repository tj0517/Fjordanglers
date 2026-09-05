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

### Faza A — inwentaryzacja (2026-09-05)

**Model:** Fable 5.1 (L → Opus-class, effort high; brak wymogu zgody) · **Branch:** `chore/types-truth`
od `main` @ `fb3da9b8` (po merge `db/baseline-2026-09`, PR #10).

#### Stan bieżący — odczyt, nie pamięć

**Lokalny stack.** `supabase init` (brak `config.toml` na gałęzi), porty przesunięte +100
(54421/54422/54420/54423/54424/54427/54429), bo domyślne trzyma `supabase_*_Seaclouds_management_system`.
`supabase start` na świeżych wolumenach (stack z FA-0.05 miał już `source`/`utm` — zatrzymany
`supabase stop --project-id uwxrstbplaoxfghrchcy --no-backup`). `supabase migration list`:
`20260904165037`, `20260904165038` — lokalnie i zdalnie identycznie.

**Tabele w lokalnej bazie** (`information_schema.tables`, `BASE TABLE`):

```
archive | booking_messages, bookings, experience_accommodations, experience_availability_config,
          experience_blocked_dates, experience_images, experiences, guide_accommodations, leads, payments
public  | ad_campaign_defs, ad_campaigns, audit_log, countries, expedition_guides, expedition_options,
          expedition_private, expedition_waters, expeditions, experience_page_options, experience_pages,
          finance_settings, fixed_costs, guide_availability, guide_images, guide_intake_forms,
          guide_intake_responses, guide_intake_submissions, guide_photos, guide_private, guide_submissions,
          guide_unavailable_dates, guides, inquiries, inquiry_messages, inquiry_todos, inquiry_trip_details,
          lead_messages, manual_cost_entries, media, media_links, offers, profiles, regions, request_guides,
          requests, reviews, spatial_ref_sys, species_windows, unmatched_messages, waters
```
`inquiries.source` / `utm`: 0 wierszy w `information_schema.columns` — FA-0.05 nie przecieka do tej gałęzi.
`guide_images` jest w `public` — potwierdzone; **nie jest** przyczyną żadnego błędu poniżej.

**Regeneracja typów:** `supabase gen types typescript --local > src/lib/supabase/database.types.ts`
→ `1 file changed, 2111 insertions(+), 975 deletions(-)`. Typy zawierają dokładnie 41 tabel `public`
z listy wyżej.

**`pnpm typecheck` po regeneracji: 805 błędów w 24 plikach** (FA-0.05 pisało „23", wymieniło 24):

| błędów | plik |
|---:|---|
| 202 | `src/lib/mock-data.ts` |
| 183 | `src/actions/bookings.ts` |
| 154 | `src/app/admin/guides/[id]/page.tsx` |
| 42 | `src/app/admin/guides/[id]/trips/[expId]/edit/page.tsx` |
| 31 | `src/actions/experience-pages.ts` |
| 29 | `src/lib/supabase/queries.ts` |
| 23 | `src/actions/inquiries.ts` |
| 22 | `src/actions/experiences.ts` |
| 19 | `src/actions/admin.ts` |
| 18 | `src/app/admin/leads/page.tsx` |
| 11 | `src/app/admin/page.tsx` |
| 10 | `src/app/admin/inquiries/[id]/page.tsx` |
| 10 | `src/app/admin/guides/new/page.tsx` |
| 9 | `src/app/admin/inquiries/page.tsx` |
| 9 | `src/actions/accommodations.ts` |
| 8 | `src/app/admin/experiences/new/page.tsx` |
| 4 | `src/types/index.ts` |
| 4 | `src/app/api/webhooks/stripe-deposit/route.ts` |
| 4 | `src/app/api/stripe/webhook/route.ts` |
| 3 | `src/app/experiences/[slug]/page.tsx` |
| 3 | `src/app/dashboard/trips/page.tsx` |
| 3 | `src/actions/guide-apply.ts` |
| 2 | `src/app/admin/guides/page.tsx` |
| 2 | `src/actions/reviews.ts` |

Wszystkie 805 to ten sam rodzaj: `.from('<tabela z archive>')` (TS2769) i pochodne (`Property 'x'
does not exist on SelectQueryError`), plus 4× `Tables<'…'>` w `src/types/index.ts` i 202× `never`
w `mock-data.ts` (literały typowane aliasami z `types/index.ts`).

**Grep `from('<10 tabel>')` w `src`: 96 trafień w 27 plikach.** Trzy pliki spoza listy typecheck,
bo rzutują przez `as any` (kompilują się, ale kryterium grep = 0 je obejmuje):
`src/actions/ai.ts:88`, `src/lib/ai/inquiry-agent.ts:504`, `src/app/admin/submissions/[id]/page.tsx:107`.
Rozkład wg tabeli: experiences 20 plików · leads 5 · bookings 4 · experience_accommodations 3 ·
experience_images 2 · guide_accommodations 2 · booking_messages 1 · payments 1 ·
**experience_availability_config 0 · experience_blocked_dates 0** (potwierdzone — nic do zrobienia).

**Baseline reszty suite (przed zadaniem):** `pnpm test -- --run` → 3 pliki, **17 testów, zielone**.
`pnpm lint` → **127 problemów (62 błędów, 65 ostrzeżeń)**. `pnpm build` czerwony (typecheck).

**Produkcja (SELECT) — NIE odczytane.** `SUPABASE_DB_PASSWORD` nie jest ustawione w tej sesji,
MCP Supabase zwraca `Unauthorized`, CLI 2.75 nie ma `db query`. Liczby, które chciałem mieć przy
tabeli (ile `inquiries` ma `trip_id` vs `experience_page_id`, ile wierszy w `archive.leads`,
data ostatniego leada) — do pobrania przez tj albo po `! export SUPABASE_DB_PASSWORD=…`.
Klasyfikacja poniżej opiera się wyłącznie na kodzie (importy, nawigacja) i nie zależy od tych liczb.

#### Tabela klasyfikacji

Dowód „nawigacja": sidenav admina (`src/components/admin/sidenav.tsx`) linkuje wyłącznie
`/admin`, `/admin/guides`, `/admin/experiences`, `/admin/inquiries(+/unmatched)`, `/admin/pipeline`,
`/admin/ads`, `/admin/finances`, `/admin/forms`. `sitemap.ts` linkuje tylko `/experiences/[slug]`
i `/guides/[slug]` + statyczne. Żadna z tras poniżej nie jest w sitemapie.

**(a) plik/trasa martwa w całości → usunąć**

| # | plik | tabela | dowód |
|---|---|---|---|
| a1 | `src/actions/bookings.ts` (183 bł.) | bookings ×16, booking_messages ×2, experiences ×5 | jedyny importer: `src/components/booking/BookingChat.tsx`, którego **nie importuje nic** |
| a2 | `src/components/booking/BookingChat.tsx` | — (via a1) | importerów 0; kompiluje się, ale po a1 przestanie — idzie razem |
| a3 | `src/actions/accommodations.ts` (9 bł.) | guide_accommodations ×4, experience_accommodations ×2 | importerów **0** |
| a4 | `src/lib/mock-data.ts` (202 bł.) | — (typy `Experience`, `ExperienceImage`) | importerów **0**; audyt 31 VIII: „imported by nothing" |
| a5 | `src/app/admin/guides/[id]/trips/[expId]/edit/page.tsx` (42 bł.) | experiences ×2, guide_accommodations, experience_accommodations | **legacy edytor `experiences`** (przedmiot FA-1.09). Link tylko z listy „Trips" na `/admin/guides/[id]` (b13, wycinana). Nie w sidenav |
| a6 | `src/app/admin/guides/[id]/trips/new/page.tsx` | — (renderuje `ExperienceForm`, który istnieje tylko po to, żeby pisać do `experiences`) | link tylko z `/admin/guides/[id]` „Add Trip" ×3 (b13). Kompiluje się dopóki istnieje a7 |
| a7 | `src/components/trips/experience-form.tsx` (2370 linii) | — (woła `createExperience`/`updateExperience` z a8) | importerzy: wyłącznie a5 i a6 |
| a8 | `src/actions/experiences.ts` (22 bł.) | experiences ×5, experience_images ×3, experience_accommodations ×3 | eksporty: `createExperience`/`updateExperience` ← tylko a3, a7; `deleteExperience` ← a9 i `admin.ts`; `togglePublishExperience` ← nikt |
| a9 | `src/components/admin/delete-experience-button.tsx` | — (woła `deleteExperience`) | importer: tylko lista „Trips" w `/admin/guides/[id]` (b13) |

**Skutek a5–a9: FA-1.09 („legacy edytor `experiences` poza nawigacją") traci przedmiot** — edytor
znika w całości, nie ma czego wynosić poza nawigację. Nie rozstrzygam; tj decyduje, czy a5–a9 idą
tutaj, czy zostają na FA-1.09 (wtedy typecheck NIE będzie zielony — a5 i a8 mają 64 błędy).

**(b) plik żywy, martwy fragment → wyciąć fragment i to, co go renderuje**

| # | plik : linie | tabela | co robi fragment | co po wycięciu |
|---|---|---|---|---|
| b1 | `src/actions/admin.ts` : 183–207 (`deleteGuide`) | experiences, bookings, payments, experience_images | kaskada usuwania po tabelach archive przed `guides.delete` | zostaje samo `guides.delete` (+ auth user) |
| b2 | `src/actions/admin.ts` : 243–288 (`deleteExperience`) | bookings, payments, experience_images, experiences | cała funkcja | usunięta; wołający = a8, a9 |
| b3 | `src/actions/inquiries.ts` : 232, 380, 476, 563, 751, 1457, 1651 | experiences | 7× lookup `experiences` po `inquiry.trip_id` → `title` (maile, Stripe product name), `slug` (cancel_url), `price_per_person_eur` (**wyliczenie depozytu w `sendDepositLink`, 239**), `guide_id` (fallback przewodnika) | **dziś każde z tych zapytań już zwraca błąd na produkcji** (tabeli nie ma w `public`) → fallback `'Your trip'`, a `sendDepositLink` zwraca `Trip not found` dla każdego zapytania. Patrz „Decyzja D2" |
| b4 | `src/actions/experience-pages.ts` : 225–310 (`generateExperienceDrafts`) | experiences | tworzy szkice `experience_pages` z opublikowanych `experiences` | usunąć funkcję **i** `src/app/admin/experiences/GenerateDraftsButton.tsx` (jedyny wołający; importowany przez `admin/experiences/page.tsx` — tam usunąć jeden `<GenerateDraftsButton/>`) |
| b5 | `src/actions/reviews.ts` : 93–99 | experiences | tytuł tripa na stronie recenzji | D2 |
| b6 | `src/actions/ai.ts` : 86–92 (`as any`) | experiences | tytuł tripa do promptu ekstrakcji | D2 |
| b7 | `src/lib/ai/inquiry-agent.ts` : 502–508 (`as any`) | experiences | gałąź `trip_id`; gałąź `experience_page_id → experience_pages.experience_name` już istnieje obok | wyciąć gałąź `trip_id`; D2 |
| b8 | `src/app/admin/page.tsx` : 29, 43, 50, 60–62 | experiences | licznik „active guides with no published trips" | wyciąć pozycję attention |
| b9 | `src/app/admin/guides/page.tsx` : 46–56 | experiences | `tripCountByGuide` (kolumna liczby tripów) | wyciąć licznik i to, co go renderuje |
| b10 | `src/app/admin/inquiries/page.tsx` : 28–39 | experiences | `tripMap/slugMap/countryMap` po `trip_id` | D2 |
| b11 | `src/app/admin/inquiries/[id]/page.tsx` : 199–203, 289, 358, 369, 595, 629, 663 | experiences | `trip` → tytuł, cena listowa, `guide_id` → guide, `location_country` → lista przewodników z kraju | D2 |
| b12 | `src/app/admin/experiences/new/page.tsx` : 68–101 | experiences | prefill z `?experience_id=` | wyciąć gałąź; jedyny link z tym parametrem jest w b13 |
| b13 | `src/app/admin/guides/[id]/page.tsx` : 107–115, 125–135, 322–360, 260–266, 545–617 | experiences, bookings | lista „Trips" (+ Edit/Add Trip/+ Exp page/Delete), karta „Booking Stats" | wyciąć obie sekcje i przyciski „Add Trip" (linki do a5/a6) |
| b14 | `src/app/admin/submissions/[id]/page.tsx` : 106–109 (`as any`) | experiences | slug do publicznego URL | wyciąć; `expSlug = null` |
| b15 | `src/app/api/stripe/webhook/route.ts` : 66–94 (`handleCheckoutCompleted`) | bookings | `payment_type='booking_fee'` → `bookings.balance_paid_at` | wyciąć handler; zostaje `account.updated`. Konfiguracji webhooka w Stripe nie dotykam (STOP) |
| b16 | `src/app/api/webhooks/stripe-deposit/route.ts` : 109–113 | experiences | tytuł tripa do 3 maili po depozycie | D2 |
| b17 | `src/app/dashboard/trips/page.tsx` : 73–84 | experiences | nazwy tripów w dashboardzie przewodnika | D2 |
| b18 | `src/app/experiences/[slug]/page.tsx` : 131–132, 144 | experiences | `max_guests` do `InquiryWidget` (default 12) | wyciąć; `experience_pages` **nie ma** `max_guests` (mapowanie w `02-data-model.md` §3 to etap 4) |
| b19 | `src/lib/supabase/queries.ts` : 87–235, 271–424, 513–569, 656–698, 781–koniec | experiences | 8 funkcji z **0 importerami**: `getExperiences`, `getFeaturedExperiences`, `getExperience`, `getAllExperiencesWithCoords`, `getMoreFromGuide`, `getExperienceLocations`, `getGuideExperiences`, `getCountryStats` + `EXP_SELECT` + typy `ExperienceSearchParams`, `ExperiencesPage`, `MapBounds`, `CountryStat` | usunąć. Typ `LocationEntry` zostaje (importuje `hero-search-bar.tsx`) |
| b20 | `src/lib/supabase/queries.ts` : 437–440 (`getPlatformStats`), 485–488 (`getSpeciesCounts`) | experiences | licznik opublikowanych tripów na `/guides`; licznik gatunków na `/` | **żywe strony publiczne.** Dziś oba zapytania padają → `0` / `{}`. Propozycja: przepiąć na `experience_pages` (`status='published'`, `target_species`) — to samo znaczenie, tabela żywa. Alternatywa: wyciąć |
| b21 | `src/types/index.ts` : 15–18, 26, 144–159 | — | aliasy `Experience`, `ExperienceImage`, `GuideAccommodation`, `Lead`, `LeadStatus`, `ExperienceWithGuide`, `GuideWithExperiences` | usunąć; `ExperienceWithGuide` używa tylko b19, `Lead`/`LeadStatus` → (c) |

**(c) użycie żywe mimo pozorów → nie ruszam, czekam na decyzję**

| # | plik | tabela | dlaczego to wygląda na żywe |
|---|---|---|---|
| c1 | `src/actions/guide-apply.ts` : 45 (`submitGuideApplication` → `leads.insert`) | leads | wołane z `src/components/guides/apply-form.tsx` ← **`src/app/(public)/guides/apply/page.tsx` — publiczna trasa**, linkowana z `components/layout/footer.tsx:87` („Apply as Guide"), `(public)/guides/page.tsx:406`, `dashboard/profile/page.tsx:42`; `lib/email.ts:122` wysyła maila potwierdzającego |
| c2 | `src/app/admin/leads/page.tsx` + `src/components/admin/lead-actions.tsx` | leads | trasa `/admin/leads` linkowana z `/admin` (b8: „Active Leads" widget, „All Leads" quick-nav) i z `admin/guides/new`. **Nie ma jej w sidenav** |
| c3 | `src/app/admin/page.tsx` : 30–39, 71, 166–208, 214 | leads | licznik „Active leads" + lista „Recent Leads" + link „All Leads" |
| c4 | `src/app/admin/guides/new/page.tsx` : 67–96 | leads | prefill formularza z `?lead_id=` (link z c2) |
| c5 | `src/actions/admin.ts` : 139–144 (`createBetaGuide` → `leads.status='onboarded'`), 290–320 (`deleteLead`), 603–630 (`updateLeadStatus`), typ `LeadStatus` | leads | wołane z c2/c4 |
| c6 | `src/components/guides/onboarding-wizard.tsx` | — (importuje c1) | importerów 0 — martwy, ale kompiluje się; idzie razem z c1 albo zostaje na FA-1.08 |

Kontekst do c1–c6: audyt 31 VIII klasyfikował `leads` jako **PERIPHERAL (żywe)**: „Guide-application
intake → guides.lead_id". FA-1.01 przeniosło ją do `archive` mimo to. `02-data-model.md` §3 mapuje
`leads → guide_applications` (etap 4). W `public` istnieje drugi, nowszy lejek `guide_intake_forms`
(`/guide-intake/[token]`, `/admin/forms` — w sidenav). **Dziś każde wysłanie `/guides/apply` kończy się
„Failed to submit your application"** (insert do nieistniejącej tabeli).

#### Decyzje do podjęcia przez tj (zanim ruszy faza B)

**D1 — legacy edytor (a5–a9): usuwać tutaj czy zostawić FA-1.09?**
Rekomendacja: **usuwać tutaj.** Bez tego typecheck nie będzie zielony (64 błędy w a5+a8), a FA-1.09
i tak nie ma co „wynosić poza nawigację" — trasa jest osiągalna tylko z fragmentu b13, który znika.
FA-1.09 → `dropped` z adnotacją.

**D2 — fragmenty „tytuł/cena tripa po `inquiry.trip_id`" (b3, b5, b6, b7, b10, b11, b16, b17):
wyciąć czy przepiąć?**
- **Opcja A — wyciąć** (litera zadania): tytuł → `'Your trip'`, `sendDepositLink` bez `price_per_person_eur`
  liczy depozyt tylko z `offer_deposit_eur` (dziś i tak `Trip not found`). Zachowanie identyczne z tym,
  co produkcja robi **dziś** (zapytania padają), więc zero regresji względem stanu faktycznego.
- **Opcja B — przepiąć** na `experience_pages`: jeden helper w warstwie danych
  (`experience_page_id` → `experience_pages.id`, fallback `trip_id` → `experience_pages.trip_id`),
  zwraca `experience_name`, `slug`, `guide_id`, `price_from`. Naprawia maile/Stripe/dashboard, ale
  to zmiana funkcjonalna, nie „wycięcie".
Rekomendacja: **Opcja A w tym PR** (zakres = zielony typecheck, nic ponadto), Opcja B jako osobne
zadanie S/M w `deferred-tasks.md` z listą 8 miejsc. Wyjątek: b7 — gałąź `experience_page_id` już
tam jest, wycięcie `trip_id` nic nie psuje.

**D3 — lejek `leads` (c1–c6): co z nim?**
- **Opcja A — wyciąć wszystko, co dotyka `leads`**, łącznie z trasą `/guides/apply` i linkami
  (footer, `/guides`, `dashboard/profile`). Publiczna strona znika.
- **Opcja B — wyciąć tylko warstwę DB**, `/guides/apply` zostaje, `submitGuideApplication` wysyła
  maila (Resend) do FA zamiast insertu; admin (`/admin/leads`, prefill, akcje statusu, widgety na
  `/admin`) — usunąć. Lejek nie traci zgłoszeń, tylko przestaje mieć tabelę do etapu 4.
- **Opcja C — nie ruszać kodu**, przywrócić `leads` do `public` — to zmiana w bazie = FA-1.02 /
  decyzja poza tym zadaniem; typecheck zostaje czerwony do tego czasu.
Rekomendacja: **Opcja B.** Strona jest w stopce i w sitemapie linkowanych stron; zerwanie jej to
decyzja produktowa, a mail-only kosztuje ~20 linii i nie wymaga tabeli. Jeśli tj woli A — tak samo
wykonalne w tym PR.

**D4 — b20 (`getPlatformStats`, `getSpeciesCounts` na publicznych `/guides` i `/`): przepiąć na
`experience_pages` czy wyciąć?** Rekomendacja: **przepiąć** — jednolinijkowa zamiana tabeli i kolumny,
tabela żywa, semantyka ta sama; wycięcie zostawia „0 trips" na stronie głównej.

#### Poza tabelą — zauważone, nie ruszam (→ `deferred-tasks.md` na końcu)
- `src/components/trips/experience-location-map.tsx` — importerów 0, kompiluje się → FA-1.08.
- `src/types/index.ts`: `IcelandicFormConfig`, `INQUIRY_PRESET_FIELDS`, `InquiryCustomField`,
  `Difficulty`, `LocationSpot` — po a7/a8 bez użycia; kompilują się → FA-1.08.
- `src/lib/supabase/queries.ts`: `CACHE_TAG_EXPERIENCES` używane przez `actions/dashboard.ts` i a8 —
  po a8 zostaje jeden użytkownik; nie ruszam.
- `src/app/api/stripe/webhook/route.ts` `handleAccountUpdated` (Stripe Connect `account.updated`)
  — kompiluje się, ale produkt nie ma Connect (ADR-0001) → FA-1.08 / etap 7.
- 142 `as any` w 32 plikach (tj pisał 140/32) — po regeneracji sprawdzę, które stają się zbędne;
  na oko większość dotyczy `inquiries` z kolumnami, które **są** w typach, więc część zniknie.

⛔ **STOP — czekam na akceptację tabeli i odpowiedzi D1–D4. Zero usunięć przed zgodą.**
