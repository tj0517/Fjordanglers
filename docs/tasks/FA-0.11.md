---
id: FA-0.11
title: Cena mówi prawdę — jeden `formatPrice` z `currency` strony i jednostką ceny
stage: 0
status: in_progress
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/price-currency-unit
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 3
owner: tj
---

# FA-0.11 — Cena mówi prawdę: `formatPrice` z `currency` i jednostką

**Skąd to zadanie (audyt lejka 5 IX 2026).** Reklama Bariloche mówi „From $550/Day for Two",
strona pokazuje „from €550 / person". Coyhaique: reklama „$600/Day, All Included", strona
„from €600 / person" (Alex bierze $600 za jednego, $685 za dwóch). Symbol `€` jest zaszyty
na sztywno w trzech kopiach tej samej funkcji, a kolumna `experience_pages.currency` istnieje
i nie jest czytana. Para klikająca reklamę Bariloche widzi cenę ~2,2× wyższą niż realna.
To samo dotyczy stron NZ (NZD).

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły; `docs/03-conventions.md`
- `src/app/experiences/[slug]/page.tsx:117` — `formatPrice` (kopia 1) + `generateMetadata`
  linia ~62: opis meta z `From €${page.price_from}` (czwarte miejsce z `€` na sztywno)
- `src/components/trips/TripOptionsAccordion.tsx:49` — kopia 2 (ceny opcji)
- `src/app/trips/exp-page-map-section.tsx:34` — kopia 3 (karty na `/trips`)
- `src/lib/supabase/database.types.ts` — `experience_pages.currency: string`,
  `experience_pages.price_type: string` (DB default `'per_person'`); `experience_page_options.price_from/price_type`
  **nie mają własnej waluty** — opcja dziedziczy walutę strony
- `docs/tasks/FA-0.05.md` „Notatki z realizacji" — jak uruchomić lokalny stack i skąd wziąć env

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Każda cena na stronie, na `/trips` i w meta description jest w walucie z `experience_pages.currency`
i z jednostką, która odpowiada temu, co przewodnik faktycznie sprzedaje. Jedna funkcja, zero
kopii, zero `€` w literałach poza nią. Reklama i strona pokazują tę samą liczbę z tym samym
symbolem.

## Zakres
- [ ] **Odczyt bieżącego stanu** (kod): otwórz trzy kopie `formatPrice` i `generateMetadata`;
      `grep -rn "€" src --include=*.tsx --include=*.ts` — lista wszystkich miejsc z symbolem na sztywno
      (wklej do raportu; maile w `src/emails/` są poza zakresem, ale wymień je).
- [ ] **Odczyt bieżącego stanu** (dane, produkcja, tylko SELECT — wykonuje tj albo agent z read-only):
      ```sql
      select slug, country, currency, price_type, price_from, status
      from experience_pages
      where country in ('Argentina','Chile','New Zealand') order by country, slug;
      select ep.slug, o.label, o.price_from, o.price_type
      from experience_page_options o join experience_pages ep on ep.id = o.experience_page_id
      where ep.country in ('Argentina','Chile') order by 1,2;
      ```
      Jeśli `currency` dla stron Patagonii/NZ to `EUR` — to jest bloker danych, patrz Bramki STOP.
- [ ] `src/lib/format-price.ts`: `formatPrice({ priceFrom, priceType, currency })` → symbol z mapy
      `{EUR:'€', USD:'$', NZD:'NZ$', GBP:'£', SEK:'SEK ', NOK:'NOK ', ISK:'ISK '}`; nieznana waluta →
      kod ISO z prefiksem, nigdy `€`. Jednostki: `per_person` → „/ person", `flat` → „per trip"
      (nie „for the group" — patrz pytanie w STOP), `request` → „Price on request".
- [ ] Trzy kopie usunięte, wszystkie wywołania przez helper; `generateMetadata` używa helpera
      w opisie; opcje w akordeonie dostają `currency` strony przez props.
- [ ] Test jednostkowy helpera (vitest): USD/per_person, USD/flat, EUR/request, waluta nieznana.

## Gotowe, gdy
- [ ] `grep -rn "€" src --include=*.ts --include=*.tsx | grep -v "src/emails/" | grep -v format-price.ts` → 0 trafień.
- [ ] `grep -rn "function formatPrice" src` → wyłącznie `src/lib/format-price.ts`.
- [ ] Lokalnie, po zasianiu jednej strony testowej z `currency='USD'`, `price_type='flat'`, `price_from=550`:
      render `/experiences/<slug>` zawiera `from $550 per trip`, a `<meta name="description">` zawiera `From $550` —
      zrzut HTML w raporcie (`curl -s localhost:3000/experiences/<slug> | grep -o 'from \$550[^<]*'`).
- [ ] Ta sama strona na `/trips?country=<kraj>` pokazuje `$550`, nie `€550`.
- [ ] Testy helpera zielone; **czerwony dowód**: test z `currency: 'XXX'` oczekuje `XXX 550`, nie `€550`.
- [ ] Po zmianie danych na produkcji (STOP) — `curl -s https://fjordanglers.com/experiences/fly-fishing-bariloche-limay-manso | grep -o 'from [^<]*'`
      zwraca `$`, a nie `€`; to samo dla `fly-fishing-coyhaique-aysen`.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Ceny w mailach (`src/emails/*`) — mają własny kontekst oferty; osobne zadanie, jeśli wyjdzie z odczytu.
- Przeliczanie walut, kursy, `finance_settings`.
- Nowa kolumna z jednostką ceny („for two anglers") — jeśli okaże się potrzebna, to migracja i
  osobna decyzja; tutaj działamy na istniejących `currency` + `price_type`.
- Treść i copy stron (FA-0.12).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- **Dane na produkcji.** Jeśli odczyt pokaże `currency='EUR'` na stronach Argentyny/Chile/NZ albo
  `price_type='per_person'` przy cenie, która jest za dwóch (Leobono $550/$650 za 2), potrzebny jest
  `UPDATE experience_pages` na `uwxrstbplaoxfghrchcy`. **STOP**: pokaż dokładny `UPDATE ... WHERE slug IN (...)`
  i wynik SELECT-a przed, poczekaj na zgodę tj. Wykonanie — tj, nie agent (jak w FA-0.05).
- **Wording jednostki.** „per trip" vs „for two anglers" vs „for the group" — decyzja tj przed
  merge'em; agent nie wymyśla trzeciej wersji.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci ani z pliku typów.

## Weryfikacja
```
grep -rn "€" src --include=*.ts --include=*.tsx | grep -v "src/emails/" | grep -v format-price.ts   # oczekiwane: 0
grep -rn "function formatPrice" src                                                                # oczekiwane: tylko lib/format-price.ts
pnpm test -- --run src/lib/format-price.test.ts
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
curl -s https://fjordanglers.com/experiences/fly-fishing-bariloche-limay-manso | grep -o 'from [^<]*' | head -3   # po UPDATE: $
```

## Notatki z realizacji
