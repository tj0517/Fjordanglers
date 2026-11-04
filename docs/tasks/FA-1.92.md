---
id: FA-1.92
title: Lżejsze obrazy i szybszy LCP — kompresja źródeł w `public/`, priorytet obrazu LCP na ofercie i artykule, mniej JS na ofercie
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-web
branch: feat/fa-1.92-images-lcp
pr:
depends_on: [FA-1.80]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.92 — Obrazy i LCP

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/audit/seo-audit-2026-11.md` — F4, §2.10 (pomiar Lighthouse, obejście chrome-launcher na WSL)
- `docs/deferred-tasks.md` — wiersz FA-1.53 (duże pliki w `public/`)
- `src/app/experiences/[slug]/_v1/`, `_v2/`, `src/app/(public)/blog/[slug]/page.tsx`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
W pomiarze laboratoryjnym oferta ma wynik 61 i LCP 9,0 s, artykuł 67 i 6,8 s; obraz LCP nie ma priorytetu, oferta ładuje ~519 KiB nieużywanego JS, a źródła w `public/` ważą do 21 MB. Po FA-1.80 (cache, krótszy TTFB) zadanie domyka resztę: priorytet obrazu LCP, lżejsze źródła, mniej JS na ofercie. Mierzymy przed i po tym samym sposobem.

## Zakres
- [ ] Odczyt stanu: Lighthouse mobile (ta sama metoda co w audycie) na ofercie i artykule po FA-1.80 — wklejony jako „przed”.
- [ ] `priority`/`fetchPriority="high"` na pierwszym obrazie hero/galerii oferty i artykułu.
- [ ] Kompresja i zmniejszenie źródeł w `public/` (≤ 500 KB, ≤ 2560 px); nieużywane pliki — lista, usunięcie tylko po STOP.
- [ ] Ograniczenie JS klienta na ofercie (dynamiczny import ciężkich komponentów, np. mapy/galerii).

## Gotowe, gdy
- [ ] Lighthouse po: LCP oferty i artykułu niższe niż „przed”, wynik perf ≥ 80 (lab, 1 przebieg, ta sama metoda) — tabela przed/po wklejona.
- [ ] `ls -lS public | head` — największy obraz ≤ 500 KB — wklejone.
- [ ] Wizualnie bez zmian (zrzuty przed/po hero oferty) i CI zielone.

## Poza zakresem
- Cache i TTFB → FA-1.80.
- Przeprojektowanie galerii.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Usunięcie plików z `public/` — pokaż listę z dowodem nieużywania i czekaj.

## Weryfikacja
```
ls -lS public | head
```

## Notatki z realizacji
- **2026-11-03, tj:** zadanie z audytu SEO (F4); po FA-1.80, bez strojenia przed nim.
