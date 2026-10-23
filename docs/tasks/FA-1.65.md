---
id: FA-1.65
title: Hub kraju v2 — `getDestinationHub()` w warstwie danych, `ExpCard` wyniesiony, szablon: hero z linią dowodu, sezon, gatunki, karty z przewodnikiem, FAQ, recenzje, 3 kroki, inne kraje, kontakt
stage: 1
status: in_progress
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-web
branch: feat/fa-1.65-hub-v2
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 12
owner: tj
---

# FA-1.65 — Hub kraju v2 (dane + szablon)

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne; reguła 3: żadnego `.from(` poza `src/actions/*` i `src/lib/supabase/queries.ts`
- `docs/03-conventions.md` — konwencje kodu
- `src/lib/destinations.ts` — `DESTINATION_HUBS` (slug, grupa krajów, H1, intro, meta); tu dochodzą pola redakcyjne hubu
- `src/app/(public)/[destination]/page.tsx` — dzisiejsza strona hubu: dwa `.from('experience_pages')` (metadata + lista) i skopiowany `ExpCard` (deferred FA-0.14); zachowaj `generateStaticParams`, metadata, schema.org `ItemList`, `WebEventTracker`
- `src/app/trips/exp-page-map-section.tsx` — oryginał `ExpCard`/`ExpPage`
- `src/lib/supabase/queries.ts` — wzorzec `getExperienceV2()` (ok. l. 825): `Promise.all`, recenzje tylko ze zgodą (FA-1.59), `experience_guides` (FA-1.50); `unstable_cache` z `CACHE_TAG_EXPERIENCES`
- `src/lib/experience-v2-content.ts` — typy `FaqEntry`, `SeasonPeriod`
- `src/components/experience-v2/offer-season-bar.tsx`, `offer-faq.tsx`, `offer-reviews.tsx`, `offer-how-it-works.tsx`, `offer-section.tsx` — do ponownego użycia; jeśli zależą od kontekstu oferty (`OfferSection` S-xx, currency context), wydziel część prezentacyjną zamiast kopiować
- `src/app/experiences/[slug]/` renderer v2 — język wizualny (paleta `#0A2E4D` / `#F3EDE4` / `#E67E50`, `f-display`/`f-body`)
- `docs/deferred-tasks.md` — wiersze FA-0.14 (`ExpCard` — zamykasz; `price_type` — zostaje)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Hub kraju (`/iceland`, `/new-zealand`, `/patagonia`) ma odpowiadać na intencję „research" (kiedy, na co, z kim, za ile) i prowadzić do karty oferty; dziś to H1, akapit i karty. Nowy kraj (Norwegia, gru/sty) ma wchodzić wpisem w `destinations.ts` + ofertami w adminie, bez zmian UI. Po zadaniu: jedna funkcja warstwy danych zwraca wszystko, co hub pokazuje; strona nie robi zapytań sama; kolejność sekcji: hero (H1, intro, linia dowodu „N guides · from X / day · gear included", opcjonalny cytat) → sezon → gatunki (chipy filtrujące karty) → oferty (karty z ceną i przewodnikiem) → FAQ → recenzje → „jak to działa" → inne kraje → kontakt. Sekcja bez danych nie renderuje się. Formularza zapytania na hubie nie ma.

## Zakres
- [ ] Odczyt stanu: `page.tsx` hubu, `exp-page-map-section.tsx`, `getExperienceV2()`, `DESTINATION_HUBS`, komponenty v2 z kontekstu (co jest czysto prezentacyjne)
- [ ] `DestinationHub` rozszerzony o pola opcjonalne (trzy obecne huby nadal się kompilują): `seasonMonths: number[]`, `peakMonths: number[]`, `seasonNote?: string`, `species: string[]`, `faq: FaqEntry[]`, `heroQuote?: { text; author; country }`, `contact?: { name; email; whatsapp }`. Treść wpisuje tj po merge — agent zostawia puste tablice i `// TODO tj`, nie pisze copy
- [ ] `getDestinationHub(slug)` w `queries.ts`: oferty `status='active'` z krajów hubu (pola karty + `location_lat/lng` + przewodnicy z `experience_guides`: imię, avatar), `guideCount` (unikalne id), `priceFrom` (min `price_from` + waluta + `price_type`), `reviews` kraju (zgoda jak w `getExperienceV2`, max 6, najnowsze), `ogImage`; `unstable_cache` z `CACHE_TAG_EXPERIENCES`; nieznany slug → `null`
- [ ] `ExpCard` + `ExpPage` → `src/components/trips/exp-card.tsx`, prop `guideName?`; `/trips` i hub importują stamtąd
- [ ] `page.tsx` i `generateMetadata` tylko przez `getDestinationHub()`; sekcje jak w Celu; chipy gatunków filtrują karty po `target_species` client-side („All" resetuje); karty z pierwszym przypiętym przewodnikiem („+1" przy wielu); „More destinations" z pozostałych `DESTINATION_HUBS`; kontakt mail + WhatsApp
- [ ] Mobile: jedna kolumna, hero ≤ 1 ekran, pasek sezonu przewijany poziomo, brak poziomego scrolla strony
- [ ] Kotwice `data-section` (`season`, `species`, `trips`, `faq`, `reviews`, `contact`) — punkt zaczepienia dla FA-1.66

## Gotowe, gdy
- [ ] `grep -n "\.from(" 'src/app/(public)/[destination]/page.tsx'` → 0; `git diff main...HEAD -- 'src/app/**' | grep -n '^+.*\.from('` → 0; `grep -rn "function ExpCard" src` → 1 trafienie w `components/trips/exp-card.tsx`
- [ ] Test `getDestinationHub` na lokalnym stacku z seedem: `guideCount`, `priceFrom`, `reviews` — przypadek czerwony: recenzja bez zgody w seedzie **nie** trafia do wyniku (nazwa testu + wynik w raporcie); `getDestinationHub('nope')` → `null`, `curl localhost:3000/nope` → 404
- [ ] Zrzuty Playwright `/new-zealand` desktop (1280) i mobile (390): 9 sekcji w kolejności z Celu; ścieżki w raporcie (`ls .playwright-mcp`); tj ogląda przed merge'em
- [ ] Hub z pustym `faq`, `reviews`, `seasonMonths` (lokalnie: seed bez recenzji ze zgodą + hub testowy w konfiguracji) renderuje hero + karty + 3 kroki + inne kraje + kontakt **bez** pustych nagłówków — zrzut
- [ ] Filtr gatunków: klik w chip zostawia tylko karty z tym gatunkiem, „All" przywraca — test komponentu (nazwa w raporcie) + zrzut
- [ ] Linia dowodu zgodna z `SELECT count(distinct guide_id) … / min(price_from) …` dla kraju na lokalnym stacku — oba wyniki w raporcie
- [ ] `grep -rn "InquiryWidget\|inquiry-wizard" 'src/app/(public)/[destination]'` → 0; `curl -s localhost:3000/new-zealand | grep -c '"ItemList"'` → 1; `/trips` → 200
- [ ] `pnpm typecheck && pnpm lint` zielone; CI na head PR (`check`, `knip`, `db`, `secrets`) zielone — lista; brak `as any`; wiersz FA-0.14 o `ExpCard` w `docs/deferred-tasks.md` oznaczony closed (FA-1.65) w tym samym PR

## Poza zakresem
- Mapa z pinami i eventy GA4 hubu → FA-1.66
- Treść redakcyjna hubów (miesiące, FAQ, cytaty, kontakt) — tj po merge
- Formularz zapytania na hubie — świadomie nie
- Flaga / `?preview` — decyzja tj D1 2026-10-20: live od razu po merge
- Ujednolicenie `price_type` / tytułów islandzkich (deferred FA-0.14); `return []` po błędzie w `queries.ts` (deferred FA-0.12)
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (bez bazy, bez prod). Dev server tylko z URL `127.0.0.1`/`localhost` potwierdzonym przed pierwszym krokiem (`envs.local.dev_server`). Merge do `main` = deploy — przed merge'em zrzuty obejrzane przez tj.

## Weryfikacja
```
grep -n "\.from(" 'src/app/(public)/[destination]/page.tsx'                       # 0
grep -rn "function ExpCard" src                                                    # 1
grep -rn "InquiryWidget\|inquiry-wizard" 'src/app/(public)/[destination]'         # 0
grep -o 'data-section="[a-z]*"' <(curl -s localhost:3000/new-zealand) | sort -u   # season species trips faq reviews contact
curl -s localhost:3000/new-zealand | grep -c '"ItemList"'                         # 1
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/trips                     # 200
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/nope                      # 404
pnpm test -- exp-card destination-hub species-filter
ls .playwright-mcp | grep fa-1.65
```

## Notatki z realizacji
- 2026-10-20 tj (/wf-plan): O-42 (c) hybryda — dane z ofert + treść redakcyjna w `destinations.ts`; O-43 (b) sezon/FAQ ręcznie per hub; O-44 hero: liczba przewodników i cena z danych, cytat jako pole ręczne; D1 live od razu po merge. Scalone z planowanego podziału dane/szablon na prośbę tj (mniej zadań).
- 2026-10-23 tj (prompt startowy): **D1** — pełny układ dowodzi test komponentu na danych fixture plus lokalny podgląd wizualny z treścią-zaślepką, cofnięty przed commitem (zmienione kryteria: brak huba testowego w `DESTINATION_HUBS`, bo każdy wpis staje się publiczną stroną na prod; seed nie ma recenzji, więc test wstawia własne). **D2** — chipy gatunków wyliczane z aktywnych ofert hubu; niepusty `species` w konfiguracji hubu je nadpisuje. **D3** — cena w linii dowodu = minimum `price_from` w dominującej walucie hubu (najwięcej aktywnych ofert), jednostka z `price_type` tak jak na karcie (`formatPrice`); remis walut → stop i pytanie.
