---
id: FA-1.81
title: Oferta v2 — dane strukturalne jak v1 (`TouristTrip` + `Offer`, `BreadcrumbList`, `FAQPage`, `og:url`/`og:type`)
stage: 1
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-web
branch: feat/fa-1.81-v2-structured-data
pr:
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.81 — Oferta v2: dane strukturalne jak v1

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje
- `docs/audit/seo-audit-2026-11.md` — F11, §2.6
- `src/app/experiences/[slug]/_v1/ExperienceV1.tsx` (l. 283–357) — wzorzec JSON-LD v1
- `src/app/experiences/[slug]/_v2/ExperienceV2.tsx` — szablon docelowy (metadane l. 76–82)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Szablon v2 nie emituje żadnych danych strukturalnych oferty, więc każda oferta przenoszona z v1 na v2 traci je po cichu (dziś 7 z 24 aktywnych jest na v2). Po zadaniu v2 emituje to samo co v1 (oferta z ceną, okruszki, FAQ gdy jest) i ma `og:url`/`og:type`, a brak danych strukturalnych pilnuje test.

## Zakres
- [ ] Odczyt stanu: `grep -n "ld+json" src/app/experiences/[slug]/_v1/*.tsx src/app/experiences/[slug]/_v2/*.tsx` — wklejony.
- [ ] Wspólny builder JSON-LD oferty używany przez v1 i v2 (bez zmiany wyniku v1).
- [ ] v2: `TouristTrip` z `offers` (cena, waluta), `BreadcrumbList` (Home → kraj/hub → oferta), `FAQPage` gdy oferta ma FAQ.
- [ ] v2: `openGraph.url` i `openGraph.type`.
- [ ] Test: render v2 zawiera trzy typy JSON-LD; v1 bez zmian.

## Gotowe, gdy
- [ ] Test zielony; red proof: test pada po usunięciu buildera z v2 — oba przebiegi wklejone.
- [ ] `curl` lokalnej oferty v2 → JSON-LD z `TouristTrip`, `BreadcrumbList` (+ `FAQPage`, jeśli oferta ma FAQ), każdy blok parsuje się przez `JSON.parse` — wklejone.
- [ ] Wynik JSON-LD v1 identyczny przed/po (diff wklejony).
- [ ] `curl` strony v2 = 200 (FA-1.54) i CI zielone — wklejone.

## Poza zakresem
- Opisy `meta_description` ofert (treść) i podwójny H1 → FA-1.89.
- Walidator rich results Google — tj ręcznie po deployu.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- brak

## Weryfikacja
```
pnpm test -- experience
curl -s localhost:3000/experiences/<slug-v2> | grep -o '"@type":"[A-Za-z]*"' | sort | uniq -c
```

## Notatki z realizacji
- **2026-11-03, tj:** zadanie z audytu SEO (F11); przed migracją kolejnych ofert na v2.
- **2026-11-05, tj:** model Sonnet · effort high.
- **2026-11-05, tj:** D1 — cena w `offers` = cena, którą pokazuje strona: `fixed` → „od” z opłatą FA (to samo co `fromTotalCents`) jako `Offer`; `custom` → zapisany zakres (`customRange`, bez opłaty) jako `AggregateOffer` (`lowPrice`/`highPrice`); brak ceny → bez `offers`.
- **2026-11-05, tj:** D2 — kraj bez huba (`getHubSlugForCountry` = null) → okruszek Home → Trips (`/trips`) → oferta, jak w v1; z hubem: Home → hub → oferta. Etykieta okruszka huba — otwarta, pytam przed wyborem.
- **2026-11-05, tj:** D3 — tożsamość wyniku v1 dowodzi test z golden fixture (wynik z kodu na `main`, nie przepisany); zamiast „diff v1 przed/po” (seed nie ma aktywnej oferty v1, `curl` lokalnie niemożliwy) kryterium to: test golden zielony i `git diff main -- <fixture>` pusty po refaktorze.
