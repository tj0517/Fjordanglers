---
id: FA-1.88
title: Higiena sitemapy i listingów — tylko indeksowalne adresy, prawdziwe `lastModified`, własny canonical stron 2+ listingów, opis `/trips`, domyślne `og:image`
stage: 1
status: review
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-web
branch: feat/fa-1.88-sitemap-hygiene
pr: 177
depends_on: [FA-1.79]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 3
owner: tj
---

# FA-1.88 — Higiena sitemapy i listingów

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/audit/seo-audit-2026-11.md` — F9, F13, F19 (og:image), §2.2, §2.5
- `src/app/sitemap.ts` (l. 11, 16, 24, 35)
- `src/app/trips/page.tsx` (l. 94–116), `src/app/(public)/guides/page.tsx` (l. 111), `src/app/(public)/blog/page.tsx`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Zanim tj zgłosi sitemapę w GSC, ma ona zawierać tylko strony do indeksu z prawdziwymi datami zmian. Dziś są w niej stuby z `noindex`, a `lastModified` to zawsze „teraz”. Strony 2+ listingów kanonikalizują się na stronę 1, więc oferty i profile z dalszych stron są osiągalne tylko przez sitemapę; opis `/trips` pomija Patagonię i NZ; `/blog` i `/guides` nie mają `og:image`.

## Zakres
- [ ] Odczyt stanu: `curl localhost:3000/sitemap.xml` — liczba URL per typ, wpisy z `noindex`.
- [ ] Sitemapa: bez stubów bloga (do czasu FA-1.83), `lastModified` z prawdziwych dat (`updated_at`, data wpisu; dla stron statycznych data stała albo brak pola).
- [ ] `/trips?page=N` i `/guides?page=N` — canonical na siebie; filtry krajów dalej na `/trips`.
- [ ] Opis `/trips` zgodny z krajami aktywnych ofert.
- [ ] Domyślne `og:image` na `/blog` i `/guides`.

## Gotowe, gdy
- [ ] Sitemapa: 0 adresów z `noindex` (skrypt: każdy URL z sitemapy → brak `noindex` w HTML) — wynik wklejony.
- [ ] Dwa kolejne pobrania sitemapy mają te same `lastmod` — wklejone.
- [ ] `/trips?page=2` canonical = `…/trips?page=2`; `/trips?country=Norway` canonical = `…/trips` — wklejone.
- [ ] `og:image` na `/blog` i `/guides` — wklejone; CI zielone.

## Poza zakresem
- Host w adresach → FA-1.79; przewodnicy z UUID → FA-1.86; blog z tabeli → FA-1.83.
- Zgłoszenie sitemapy w GSC — tj po merge.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- brak

## Weryfikacja
```
curl -s localhost:3000/sitemap.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//' | while read u; do p=${u#https://www.fjordanglers.com}; curl -s localhost:3000$p | grep -q 'noindex' && echo "NOINDEX $p"; done
```

## Notatki z realizacji
- **2026-11-03, tj:** zadanie z audytu SEO; po FA-1.79, przed zgłoszeniem sitemapy w GSC.
- **2026-11-05, tj:** model Sonnet · effort medium.
- **2026-11-05, tj:** D1 — `lastModified` w sitemapie tylko tam, gdzie jest prawdziwa data: oferty i przewodnicy → ich `updated_at`, a gdy jest null → pole pominięte (bez zastępczego „teraz”); wpisy bloga → `date` wpisu z `blog-data.ts`; strony statyczne (home, `/trips`, `/guides`, `/blog`, prawne) i huby → pole pominięte.
- **2026-11-05, tj:** D2 — opis `/trips` bez filtra kraju: jedno stałe zdanie wymieniające kraje aktywnych ofert (funkcja warstwy danych `getActiveDestinationCountries`), bez „20+” i bez liczby. Dokładny szablon idzie do opisu PR do mojej akceptacji.
- **2026-11-09, tj:** D3 — opis `/trips` (zatwierdzenie szablonu z PR #177): zdanie bez „, and filter by country” → „Browse hand-picked guided fishing trips with local guides in A, B and C.”; bez krajów → „Browse hand-picked guided fishing trips with local guides.”. Zmiana w osobnym PR `fix/fa-1.88-trips-description`.
