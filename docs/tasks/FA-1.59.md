---
id: FA-1.59
title: Recenzje dla v2 — zgoda na publikację w formularzu recenzji, `reviews.experience_id` zapisywane przy tworzeniu linku, backfill istniejących na prod, S10 pokazuje tylko recenzje ze zgodą
stage: 1
status: done
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/reviews-consent-experience
pr: 140
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 6
owner: tj
---

# FA-1.59 — Recenzje: przypięcie do strony i zgoda na publikację

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`, `docs/02-data-model.md` + `docs/audit/rebuild-audit-db-aug-2026.md`
- `docs/04-open-questions.md` — O-37, O-38 (rozstrzygnięte 2026-10-08)
- `supabase/migrations/20260904165037_baseline_prod.sql` l. ~1800 — tabela `reviews` (brak kolumny zgody); `supabase/migrations/20261007000000_experience_offer_centric_expand.sql` l. ~90 — `reviews.experience_id` (FA-1.50, bez backfillu)
- `src/actions/reviews.ts` — `generateReviewLink` (wstawia tylko `inquiry_id, token`), `getReviewByToken`, `submitReview`
- `src/app/reviews/[token]/ReviewForm.tsx`, `page.tsx` — formularz, który wypełnia klient
- `src/lib/supabase/queries.ts` — `getExperienceV2` (zapytanie S10, l. ~795) i `reviewCards` (l. ~681): dziś pierwsze imię + kraj + pierwsze zdjęcie
- `src/lib/inquiries/experience-lookup.ts` — jak recenzja dochodzi do strony przez zapytanie
- `src/app/legal/privacy-policy/page.tsx` — dziś nie wspomina o publikacji recenzji
- `docs/deferred-tasks.md` — wiersze FA-1.55 o `experience_id` i braku zgody

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Sekcja recenzji (S10) ma pokazywać prawdziwe opinie o tej konkretnej ofercie — i tylko te, których autor zgodził się na publikację imienia, kraju i zdjęć. Dziś nic nie zapisuje `reviews.experience_id`, więc S10 na produkcji jest puste, a formularz recenzji nie pyta o zgodę. Po zadaniu: nowa recenzja przypina się do strony już przy tworzeniu linku, istniejące są uzupełnione z zapytania, formularz ma jedno pole zgody, a recenzje sprzed zadania (bez zgody) nie są nigdy pokazywane (O-37 a).

## Zakres
- [ ] Odczyt stanu (prod, tylko SELECT przez MCP `supabase-prod`, wklej): `SELECT count(*) total, count(submitted_at) submitted, count(experience_id) stamped FROM reviews;` oraz ile recenzji da się przypiąć: `SELECT count(*) FROM reviews r JOIN inquiries i ON i.id = r.inquiry_id WHERE r.experience_id IS NULL AND i.experience_page_id IS NOT NULL;`
- [ ] Migracja (jedna): `reviews.publish_consent boolean NOT NULL DEFAULT false` + `publish_consent_at timestamptz`; backfill `experience_id` z `inquiries.experience_page_id` dla wierszy z `experience_id IS NULL` (strona kanoniczna — alias nie ma znaczenia, bo FK wskazuje stronę); istniejące wiersze zostają z `publish_consent=false` (O-37 a); `COMMENT ON COLUMN`
- [ ] STOP — przed zastosowaniem migracji gdziekolwiek poza lokalnym stackiem pokaż tj pełny SQL, wynik `supabase db reset` lokalnie i liczby z odczytu prod (ile wierszy zmieni backfill)
- [ ] Regeneracja typów
- [ ] `generateReviewLink`: przy wstawianiu wiersza zapisuje `experience_id` = `experience_page_id` zapytania (jeśli jest)
- [ ] Formularz recenzji: jedno pole wyboru (O-38 a), domyślnie niezaznaczone, tekst po angielsku: „Publish my review with my first name, country and photos on fjordanglers.com” (dokładne brzmienie do potwierdzenia przez tj w PR); `submitReview` zapisuje `publish_consent` i `publish_consent_at`; walidacja zod po stronie serwera
- [ ] S10: zapytanie w `getExperienceV2` filtruje `publish_consent = true`; brak recenzji ze zgodą → brak sekcji (jak dziś)
- [ ] Polityka prywatności: placeholder akapitu o publikacji recenzji `[Reviews publication — text from tj]` w `privacy-policy/page.tsx` + wiersz w deferred „tekst od tj — blokuje FA-1.57”
- [ ] STOP — `supabase db push` na prod robi tj ręcznie po akceptacji; PR nie jest mergowany, dopóki migracja nie jest zastosowana (merge = deploy kodu, który czyta nową kolumnę)

## Gotowe, gdy
- [ ] Odczyt prod przed zmianą wklejony (obie liczby z pierwszego punktu zakresu)
- [ ] Lokalnie po `supabase db reset`: `\d reviews` pokazuje `publish_consent` i `publish_consent_at`; backfill przypina recenzje z zapytań mających `experience_page_id` — test na danych testowych (wiersz z i bez strony)
- [ ] Test akcji: `generateReviewLink` dla zapytania ze stroną → wiersz z `experience_id`; bez strony → `NULL`
- [ ] Test `submitReview`: z zaznaczoną zgodą → `publish_consent=true` i `publish_consent_at` ustawione; bez zgody → `false`; red proof: gdy serwer ignoruje pole zgody, test czerwony
- [ ] Test S10: strona z dwiema przypiętymi recenzjami, jedna ze zgodą, jedna bez → renderuje się tylko ta ze zgodą; red proof: usunięcie filtra zgody → test czerwony
- [ ] Playwright: formularz recenzji z polem zgody (desktop + mobile 390) i strona v2 z sekcją S10 z recenzją ze zgodą — ścieżki w raporcie
- [ ] `git diff origin/main...HEAD -- src/lib/supabase/database.types.ts --stat` niepusty (typy zregenerowane)
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone lokalnie **i** checki CI (`check`, `knip`, `db`, `secrets`) zielone na PR
- [ ] Po `db push` przez tj: odczyt prod wklejony — `SELECT count(*) FILTER (WHERE experience_id IS NOT NULL), count(*) FILTER (WHERE publish_consent) FROM reviews;` (drugie = 0)

## Poza zakresem
- Pokazywanie starych recenzji anonimowo albo proszenie dawnych autorów o zgodę mailem (O-37 b/c odrzucone)
- Osobne zgody na tekst i zdjęcia (O-38 b odrzucone)
- Moderacja treści recenzji, odpowiedzi FA na recenzje
- Pobieranie recenzji z Google
- Admin: podgląd/zmiana zgody na karcie zapytania → zgłoś do deferred
- Treść akapitu polityki prywatności — dostarcza tj
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed zastosowaniem migracji poza lokalnym stackiem: pełny SQL + wynik `db reset` + liczby z prod → akceptacja tj
- `supabase db push` na prod wyłącznie tj (agent-guard blokuje bez `FA_ALLOW_PROD=1`); merge dopiero po zastosowaniu migracji
- Żadnego SQL innego niż SELECT na prod przez MCP
- Edycja istniejących plików migracji — zakazana

## Weryfikacja
```
supabase db reset && psql "$LOCAL_DB" -c "\d reviews"
pnpm exec vitest run reviews experience-v2
git diff origin/main...HEAD -- src/lib/supabase/database.types.ts --stat
ls .playwright-mcp | grep -i review
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
# prod (MCP, SELECT): SELECT count(*) FILTER (WHERE experience_id IS NOT NULL), count(*) FILTER (WHERE publish_consent) FROM reviews;
```

## Notatki z realizacji
- 2026-10-08 tj (/wf-plan): O-37 (a) — recenzje zebrane bez zgody nigdy nie są pokazywane; O-38 (a) — jedno pole zgody obejmuje imię, kraj i zdjęcia. Zadanie wynika z review FA-1.55 (S10 puste na prod, brak zgody).
- 2026-10-08 tj — D1 (c): backfill dowiedziony lokalnie (idempotentna migracja uruchomiona ponownie na własnych wierszach testowych) i na prod (liczby przed/po).
- 2026-10-08 tj — D2 (a): usuń politykę anon `"Public read reviews"` w tej samej migracji — ujawnia każdą recenzję, w tym tokeny linków i treść bez zgody.
- 2026-10-08 tj — D3 (a): `generateReviewLink` emituje `review.requested`; `submitReview` emituje `review.submitted` z wartością zgody w payloadzie.
- 2026-10-08 tj — review PR 140: treść checkboxa zatwierdzona (ostateczna): „Publish my review with my first name, country and photos on fjordanglers.com”. Limity zod zostają: 5000 znaków dla opisu i komentarza, 50 zdjęć, tylko http(s). Nieudana emisja `review.*` nadal rzuca wyjątek do wołającego (obecne zachowanie); wiersz o niepełnej atomowości zostaje w deferred. Odebranie grantów kolumnowych anon na `reviews` — osobne małe zadanie; wiersz w deferred bez zmian. Atomowość zdarzeń (pkt 4): przyjęta na razie, naprawa później, wiersz w deferred zostaje.
- 2026-10-08 tj: accepted (PR #140). Migration 20261008000000 applied to prod by tj; post-apply: 1 review pinned, 0 consented, no policies on reviews, RLS on, anon REST []. CI green on d7f81b8. Screenshots reviewed by tj. Follow-ups in deferred: anon column grants, event atomicity, privacy text (blocks FA-1.57).
