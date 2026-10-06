---
id: FA-1.53
title: Szablon v2 — górna część strony (S0–S2): hero i galeria, H1 z chipami, trzy linie redukcji ryzyka, sticky widget z kalkulatorem Razem / Depozyt / Saldo; dane przez `getExperienceV2()`
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/experience-v2-hero-widget
depends_on: [FA-1.52]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 10
owner: tj
---

# FA-1.53 — v2: hero, chipy, sticky widget

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/proposals/2026-10-05-experience-offer-centric.md` §1–2 (model), §7 krok 3
- Wireframe (artefakt Claude „FjordAnglers — Wireframe strony ofertowej”, 2026-10-05): artboard Desktop S0–S2 i Mobile — układ, kolejność, treść widgetu; tj udostępnia zrzuty w `docs/brand/wireframes/` albo link
- `docs/04-open-questions.md` — O-31 (cena całkowita), O-32 (nadpisanie do 15%)
- `src/lib/format-price.ts` — jeden `formatPrice` (FA-0.11); jednostka i waluta
- `src/lib/supabase/queries.ts` — warstwa danych; tu wchodzi `getExperienceV2(slug)`
- `src/app/experiences/[slug]/_v2/ExperienceV2.tsx` — szkielet z FA-1.52
- `src/components/ui/*` — design system shadcn w barwach FA (FA-1.15); v2 używa tych samych tokenów
- `src/lib/availability-window.ts` — okno sezonu (chip „sezon”)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Pierwszy ekran v2 ma pokazać cenę, pojemność, sezon, poziom i trzy gwarancje bez przewijania, a sticky widget ma liczyć na żywo „Razem / Depozyt teraz 20% / Saldo przewodnikowi” z `experience_prices` i `fee_pct`, z orientacyjnym przeliczeniem na walutę klienta. CTA „Sprawdź dostępność” prowadzi do formularza (FA-1.55) — tu jest kotwicą. Cały odczyt danych idzie przez jedną funkcję warstwy danych, bez `.from(` w komponentach.

## Zakres
- [ ] Odczyt bieżącego stanu: `grep -n "experience_pages\|experience_page_options" src/lib/supabase/queries.ts`; schemat `experience_prices`, `experience_guides` z `database.types.ts`; wireframe
- [ ] `getExperienceV2(slug)` w `queries.ts`: strona + `experience_guides` (active, `show_on_page`, wg `sort_order`, z danymi `guides`) + `experience_prices` (bieżące wg `valid_from/to`) + opcje; jeden typ zwrotny; cache tag jak dla v1
- [ ] Logika ceny w `src/lib/pricing/experience-price.ts` (czysta funkcja, testowalna): `quote({days, anglers, prices, feePct, override?}) → {guideCents, feeCents, totalCents, currency}`; „od” = min total; dla `custom` tylko widełki `price_from_cents–price_to_cents`
- [ ] S0: lekki pasek (logo, „Jak to działa” anchor, FAQ anchor, waluta, WhatsApp) — bez pełnej nawigacji
- [ ] S1: galeria 1+4 (desktop) / swipe z licznikiem (mobile) z `hero_image_url` + `gallery_image_urls`; H1 = `experience_name`; podtytuł = `intro_text`; chipy: region, długość (`min_days`/dzień), `max_anglers_per_guide`, sezon (`season_months`), `skill_level/5`, „sprzęt w cenie” gdy w `includes`; ocena z `guides.google_rating`/`google_review_count` przewodnika primary z linkiem do `google_profile_url`; trzy linie: „zapytanie bezpłatne”, „depozyt dopiero po akceptacji oferty”, „odpowiedź w {response_sla_hours} h”
- [ ] S2 widget (desktop: prawa kolumna sticky od końca galerii do kotwicy `#recenzje`; mobile: dolny pasek po przewinięciu hero, chowany przy `#zapytanie`): cena „od”, mini-avatar przewodnika primary, pola Kiedy (konkretne / elastycznie-miesiąc), Wędkarze, Dni → trzy liczby; `custom`: zamiast kalkulatora widełki i CTA „Zaplanuj wyprawę”
- [ ] Przeliczenie walut: kurs z istniejącego mechanizmu FX (FA-1.28/1.37) jako „≈ USD, kurs orientacyjny”; wybór waluty z S0
- [ ] `generateMetadata` dla v2 z `meta_title`/`meta_description` (bez podwójnego sufiksu — FA-0.12)

## Gotowe, gdy
- [ ] Testy `experience-price`: (a) 1 dzień × 2 wędkarzy = cena z `experience_prices` × 1.20; (b) brak wiersza dla (days, anglers) → najbliższy dostępny z informacją „na zapytanie”; (c) override 10% → liczony z override; (d) `custom` → tylko widełki — zielone
- [ ] Red proof: przy `fee_pct=0.20` suma `feeCents + guideCents` = `totalCents` co do centa dla 20 losowych kwot (test property-based albo tabela) — bez zaokrągleń gubiących centy
- [ ] `grep -rn "\.from(" "src/app/experiences/[slug]/_v2" src/components/experience-v2` → 0
- [ ] Playwright (lokalny seed, strona z `page_version=2`, flaga on): zrzut desktop 1440 i mobile 390 above the fold — widoczne: cena, chipy, 3 linie, CTA; na mobile pasek dolny pojawia się po przewinięciu 600 px — ścieżki zrzutów w raporcie (`.playwright-mcp/`)
- [ ] Strona `custom` (seed: Islandia) pokazuje widełki i „Zaplanuj wyprawę”, bez kalkulatora — zrzut
- [ ] Lighthouse mobile na lokalnym buildzie: LCP ≤ 2.5 s na stronie seedowej — wynik w raporcie (jeśli build na PC/WSL niemożliwy obok stacku — zgłoś, nie pomijaj po cichu)
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone

## Poza zakresem
- Sekcje S3–S9 → FA-1.54; S10–S14 i formularz → FA-1.55
- Edycja nowych pól w adminie → FA-1.56
- Zmiana `formatPrice` / jednostek → nie; użyj istniejącego
- Pokazywanie ceny przewodnika osobno od opłaty FA — O-31 rozstrzygnięte: całkowita
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
pnpm test -- experience-price
grep -rn "\.from(" "src/app/experiences/[slug]/_v2" src/components/experience-v2   # 0
ls .playwright-mcp | grep -i v2
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji
- 2026-10-05 tj: O-31 — klient widzi cenę całkowitą (przewodnik + opłata FA), bez osobnej linii „opłata”.
