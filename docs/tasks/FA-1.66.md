---
id: FA-1.66
title: Hub kraju — mapa z pinami lokacji ofert (Leaflet jak `/trips`) + pomiar `hub_view` / `section_view` / `hub_card_click` tym samym helperem co lejek v2
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-web
branch: feat/fa-1.66-hub-map-events
pr: 156
depends_on: [FA-1.60, FA-1.65]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 7
owner: tj
---

# FA-1.66 — Mapa hubu i pomiar hubu

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.65.md` — `getDestinationHub()` (zwraca `location_lat/lng` ofert), kotwice `data-section`, układ hubu
- `docs/tasks/FA-1.60.md` — helpery GA4 w `src/lib/gtag.ts` (`trackSectionView`, guard „raz na załadowanie"), `send_to G-Z3Y8GMHR4J`, parametry `page_slug`
- `src/app/trips/exp-page-map-view.tsx`, `exp-page-map-wrapper.tsx` — mapa Leaflet (react-leaflet 5) z `MapBounds`; `src/components/offer/LocationMap.tsx` — mapa pojedynczej oferty
- `src/components/trips/exp-card.tsx` — karta (klik = `hub_card_click`)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Mapa pokazuje, gdzie w kraju łowią przewodnicy FA, i prowadzi do oferty — zamiast ilustracji; oferty bez współrzędnych są pomijane, hub bez współrzędnych nie pokazuje sekcji. Pomiar: test „frazy generyczne z Ads → hub" (po merge, tj w koncie Ads, 14 dni) wymaga widzenia hub → karta → oferta → formularz w jednym raporcie GA4 — hub wysyła te same rodzaje eventów co strony v2.

## Zakres
- [ ] Odczyt stanu: komponenty mapy `/trips` i oferty (co użyć bez kopiowania), ile aktywnych ofert ma `location_lat/lng` per kraj (lokalny stack, zapytanie), helpery `gtag.ts` po FA-1.60, `data-section` hubu
- [ ] `HubMap` (client, dynamic import bez SSR jak `/trips`): piny ofert ze współrzędnymi, bounds do pinów, popup z nazwą, ceną, przewodnikiem, linkiem; klik w pin przewija do karty (`id` = slug) i podświetla ją; sekcja między hero a sezonem (desktop obok hero, mobile pod); renderowana tylko przy ≥1 ofercie ze współrzędnymi; mobile ≤ 60vh, scroll-wheel zoom off
- [ ] `hub_view` (`page_slug` hubu) raz na załadowanie; `section_view` dla `season`, `trips`, `faq`, `reviews` (IntersectionObserver ≥50%, raz na sekcję); `hub_card_click` (`page_slug`, `experience_slug`, `position`) — wszystko przez helpery z `gtag.ts`
- [ ] Zero zmian w wywołaniu konwersji Ads i `SUBMIT_LEAD_FORM`

## Gotowe, gdy
- [ ] Zrzuty `/new-zealand` desktop i mobile z pinami; liczba pinów = `SELECT count(*) FROM experience_pages WHERE status='active' AND country=… AND location_lat IS NOT NULL` (oba w raporcie); hub bez współrzędnych (lokalnie `NULL`) → brak sekcji — zrzut
- [ ] Klik w pin → karta przewinięta i podświetlona — zrzut po kliknięciu
- [ ] GA4 DebugView, jeden przebieg lokalnie: `hub_view` → `section_view(season)` → `section_view(trips)` → `hub_card_click(experience_slug, position)` — lista w raporcie
- [ ] Guard „raz na załadowanie" na czerwono: po usunięciu guarda powrót do sekcji daje drugi `section_view` (fragment w raporcie)
- [ ] `git diff main...HEAD -- src/lib/gtag.ts | grep -n "conversion\|SUBMIT_LEAD_FORM"` → puste; `git diff main...HEAD -- package.json` → puste
- [ ] Lighthouse mobile `/new-zealand` nie gorszy niż po FA-1.65 o więcej niż 5 pkt (oba wyniki w raporcie); w raporcie lista nowych parametrów do rejestracji w GA4 (`experience_slug`, `position`)
- [ ] CI na head PR zielone — lista; brak `as any`

## Poza zakresem
- Ilustrowana mapa brandowa z mockupu Figma („You'd fly here for this") — osobna decyzja tj
- Edycja współrzędnych ofert — admin już to ma (`LatLngPickerMap`)
- Rejestracja wymiarów w GA4 i przepięcie final URL grup generycznych (PAT, IS) na huby — robi tj po merge; odczyt po 14 dniach do notatek tego zadania
- Zmiana `trackSubmitLeadForm` / konwersji Ads; eksperymenty Ads
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak. Dev server tylko z lokalnym URL.

## Weryfikacja
```
grep -rn "HubMap" 'src/app/(public)/[destination]' src/components | head
grep -n "hub_view\|hub_card_click" src/lib/gtag.ts 'src/app/(public)/[destination]' src/components/trips/exp-card.tsx
git diff main...HEAD -- src/lib/gtag.ts | grep -n "conversion\|SUBMIT_LEAD_FORM"   # puste
git diff main...HEAD -- package.json                                                # puste
ls .playwright-mcp | grep fa-1.66
```

## Notatki z realizacji
- 2026-10-20 tj (/wf-plan): O-45 (b) mapa z pinami w zakresie. Test landingu Ads (generyk PAT/IS → hub, 14 dni, koszt zapytania vs strony ofert) — czynność tj po merge, wynik wklejany tutaj.
- 2026-10-23 tj (/wf-task): D1 — event proof in `dataLayer` (as FA-1.60), not DebugView; the Ads test starts only after GA4 reception is fixed (deferred FA-1.60 URGENT). D2 — Lighthouse: tj measures PageSpeed on prod `/new-zealand` before and after merge; agent proves Leaflet is lazy-loaded. D3 — pins from temporary local SQL (seed untouched) + prod count read.
- 2026-10-23 tj (decision during implementation): pin click — option A. A pin click/tap scrolls to the card (`id` = slug) and highlights it; the popup (name, price, guide, link) opens on hover, so desktop only — a phone tap goes straight to the card. The popup's link leads to the offer without `hub_card_click` (desktop only) — flagged in the PR, not measured in this task.
- 2026-10-23 tj (decision during implementation): no hub has season/FAQ content in `destinations.ts` and prod has 0 published reviews, so of the four measured sections only `trips` can fire today (prod too, until the copy is written). Option A — the browser proof of `section_view(season)` runs on a temporary, uncommitted local edit of `destinations.ts` (NZ season months + one FAQ), reverted after the run; the revert and an empty `git diff main...HEAD -- src/lib/destinations.ts` go in the PR.
- 2026-10-23 tj: accepted on 8f53e4f (PR #156) — pins = local count (3), pin click scroll + highlight, dataLayer chain hub_view → section_view(season, trips) → hub_card_click, once-guard red proof (7 → 1), Leaflet lazy-loaded, gtag conversion/SUBMIT_LEAD_FORM and package.json untouched, CI green. After merge (tj): PageSpeed prod /new-zealand vs pre-merge baseline; register experience_slug and position in GA4; Ads test waits for the GA4 reception fix (deferred FA-1.60).
