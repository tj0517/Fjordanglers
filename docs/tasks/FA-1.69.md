---
id: FA-1.69
title: Baner z jedną opinią — strona główna + zastępstwo za pusty S10 na stronach v2 i hubie (opinia z kraju strony, inaczej ogólna; „Read on Trustpilot ›” przy źródle TP; pusto = brak sekcji)
stage: 1
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-web
branch: feat/fa-1.69-testimonial-banner
depends_on: [FA-1.68]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.69 — Baner z jedną opinią

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.68.md` — `getTestimonial(country)`, pola publiczne, seed z dwiema opiniami
- `src/components/experience-v2/offer-reviews.tsx` — S10: wygląd pasa, zasada „brak danych = brak sekcji”, linia o pochodzeniu opinii
- `src/app/experiences/[slug]/_v2/ExperienceV2.tsx` (~l. 329) — gdzie renderuje się S10
- `src/components/destination-hub/destination-hub-view.tsx` (`Reviews`) — sekcja recenzji hubu
- `src/app/page.tsx` — sekcje strony głównej
- `src/lib/angler-countries.ts` — nazwa kraju z kodu

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Strony v2 i huby bez własnych recenzji nie pokazują dziś żadnego dowodu od klientów, a strona główna nie ma go wcale. Po zadaniu każda z tych stron pokazuje **jedną** opinię: zdjęcie, cytat, imię i kraj oraz źródło podane zgodnie z prawdą (Trustpilot z linkiem albo „sent to us by…”). Prawdziwe recenzje oferty z S10 zawsze mają pierwszeństwo, bo baner pojawia się tylko tam, gdzie S10 jest puste.

## Zakres
- [ ] Odczyt stanu: `getTestimonial` po FA-1.68, gdzie S10 i `Reviews` hubu zwracają `null`, układ strony głównej (między którymi sekcjami baner)
- [ ] `TestimonialBanner` (server component): zdjęcie (jeśli jest), cytat, gwiazdki (jeśli `rating`), „Imię, Kraj”, linia źródła: TP → „Read on Trustpilot ›” (`source_url`, `target=_blank rel=noopener noreferrer`); direct → jedno zdanie, że opinia przyszła bezpośrednio do FA; ten sam język wizualny co S10
- [ ] Strona główna: `getTestimonial(null)`; sekcja tylko przy opinii
- [ ] Strona v2: gdy `page.reviews` puste → `getTestimonial(page.country)` w miejscu S10; gdy recenzje są → bez zmian
- [ ] Hub: gdy `data.reviews` puste → `getTestimonial(<kraj hubu>)` w miejscu sekcji recenzji
- [ ] Testy komponentu: TP z linkiem, direct bez linku, bez zdjęcia, `null` → nic

## Gotowe, gdy
- [ ] Zrzuty lokalnie (desktop + mobile): strona główna z banerem; strona v2 NZ bez recenzji → opinia z `trip_country` NZ; strona v2 innego kraju → opinia ogólna; strona v2 z recenzją w seedzie → S10, bez banera
- [ ] Pusta tabela (`UPDATE testimonials SET is_active=false` lokalnie) → brak sekcji na wszystkich trzech typach stron — zrzut albo `curl … | grep -c data-section="testimonial"` = 0
- [ ] Link TP w HTML: `curl -s localhost:3000/ | grep -o 'href="https://[^"]*trustpilot[^"]*"'` → URL z seeda
- [ ] `curl -s -o /dev/null -w '%{http_code}'` dla `/`, strony v2 i hubu = 200 (FA-1.54)
- [ ] `consent_note` nie trafia do HTML: `curl -s localhost:3000/ | grep -c <treść notatki z seeda>` = 0
- [ ] CI na head PR zielone — lista; brak `as any`, brak `.from(` w `src/app/**`

## Poza zakresem
- Schemat i admin → FA-1.68
- Karuzela lub kilka opinii naraz, losowanie → O-46 (a): jedna, wg kolejności
- Zmiana S10 i formularza recenzji z linku; cytat w hero hubu (`heroQuote`) → bez zmian
- Widżet Trustpilota / średnia TP → nie planowane
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (tylko odczyt). Dev server tylko z lokalnym URL (`scripts/dev-preflight.sh`, jeśli FA-1.67 już zmergowane). Merge dopiero po merge FA-1.68 i migracji na prod — baner czyta tabelę, której bez niej nie ma.

## Weryfikacja
```
grep -rn "TestimonialBanner" src/app src/components | head
git diff main...HEAD -- 'src/app/**' | grep -n "^+.*\.from("     # puste
git diff main...HEAD -- src/components/experience-v2/offer-reviews.tsx --stat   # puste albo uzasadnione w raporcie
```

## Notatki z realizacji
- 2026-10-23 tj (/wf-plan „testimonial baner”): D2 (b) strona główna + zastępstwo za pusty S10 (v2, hub), opinia z kraju strony, inaczej ogólna; D3 (a) cytat + „Read on Trustpilot ›”; O-46 (a) jedna opinia wg kolejności z admina.
- 2026-10-24 tj (prompt do realizacji) — zmiany w „Gotowe, gdy”:
  - Strona v2 z recenzją: seed nie ma żadnych wierszy `reviews` (`grep -n reviews supabase/seed.sql`), więc dowód „S10 wygrywa” to JEDEN review wstawiony lokalnie SQL-em (powiązany z zapytaniem z seeda i `experience_id` strony); SQL i zrzut w raporcie. Seed bez zmian.
  - Znacznik banera to `data-block="testimonial"`, nie `data-section`: na hubie i stronach v2 `data-section` to mierzona kotwica, a test FA-1.66 oczekuje dokładnie sześciu. Red proof pustej tabeli: `curl … | grep -c 'data-block="testimonial"'` = 0.
- 2026-10-24 tj (decyzje w trakcie): (1) A — strona główna pokazuje pierwszą aktywną opinię **ogólną** (`trip_country` puste), jak `getTestimonial` po FA-1.68; z seedem to Jonas (direct), więc dowodem na `/` jest zdanie o źródle bezpośrednim, nie link Trustpilota. (2) B — `getTestimonial` przyjmuje listę krajów: pierwsza aktywna opinia dla któregokolwiek z nich, inaczej ogólna; hub podaje `getHubCountries(hub)` (Patagonia = Argentyna + Chile), strona v2 `[page.country]`, główna `[]`. Nadal jedno zapytanie.
- 2026-10-24 tj (decyzja w trakcie): (3) B — po każdej zmianie w adminie (create/update/toggle/move) akcje odświeżają od razu `/`, każdy hub (`/${slug}` z `DESTINATION_HUBS`, ścieżki dosłowne, bo trasa siedzi w grupie `(public)`) i wszystkie strony ofert (`/experiences/[slug]`, `'page'`). Bez tego strona oferty trzymała starą opinię do 1 h (ISR 3600), także po wycofaniu zgody. Zamyka wiersz FA-1.68 „How admin edits reach the banner”.
