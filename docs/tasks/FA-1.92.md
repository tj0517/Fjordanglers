---
id: FA-1.92
title: Lżejsze obrazy i szybszy LCP — kompresja źródeł w `public/`, priorytet obrazu LCP na ofercie i artykule, mniej JS na ofercie
stage: 1
status: in_progress
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
- [ ] Priorytet obrazu: lokalnie, dla seedowej oferty v1, seedowej oferty v2 i seedowego artykułu, `curl -s http://localhost:3000/<path> | grep -o '<img[^>]*fetchpriority="high"[^>]*>'` zwraca dokładnie jeden tag na stronę i jest to obraz hero / pierwszy obraz galerii — wklejone dla każdej strony. (Zastępuje bramkę Lighthouse na produkcji: mierzone strony istnieją tylko na produkcji, a merge = deploy — decyzja tj D1, 2026-11-13.) Jeśli seed nie ma oferty v2 albo artykułu z obrazem hero — stop i pytanie do tj.
- [ ] Mniej JS na ofercie: „First Load JS” dla `/experiences/[slug]` w tabeli tras joba CI `check` jest niższe na head PR niż na `main` — obie linie wklejone z hashami commitów. `/blog/[slug]` i `/` nie rosną.
- [ ] `find public -type f -size +500k` nic nie zwraca, a sprawdzenie wymiarów (komenda wklejona) nie pokazuje obrazu powyżej 2560 px na dłuższym boku — oba wklejone. (Rekurencyjnie zamiast `ls -lS public | head`, które pomija `public/fish_catalog/` — decyzja tj D2.)
- [ ] Wizualnie bez zmian: zrzuty Playwright hero oferty (v1, v2) i hero artykułu, przed i po, oraz jeden obraz `fish_catalog` wyrenderowany w artykule, przed i po — ścieżki wypisane; tj porównuje okiem.
- [ ] CI zielone na head commit PR (`check`, `knip`, `db`, `secrets`) — lista wklejona.
- [ ] Lighthouse „przed” na produkcji (3 przebiegi + mediana, z komendą) jest w opisie PR. „Po” na produkcji mierzy tj po merge i nie jest kryterium agenta.

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
- **2026-11-13, tj:** D1 (a) — gate on mechanisms (priority hint in HTML, First Load JS from the CI route table), production Lighthouse after merge by tj (median of 3); D2 (a) — the size criterion is recursive over the whole `public/`; FA-1.94 paused, this task starts from clean `main`.
- **2026-11-13, tj:** D3 (a) — the single `fetchpriority="high"` on offer pages goes on the mobile top photo; the desktop cover keeps its preload at normal priority; the two never-visible gallery copies lose theirs. D4 (a) — Next 16 has no "First Load JS" column in the route table; JS is measured locally instead: production build of `main` and of the PR head, `next start` against the local stack, sum of compressed own `/_next/static` scripts loaded by the seed offer, article and `/` (script in `.fa-proofs/FA-1.92/`); a CI step for it goes to deferred. D5 (a) — fish PNGs keep palette q90 and give way on resolution (1440–2240 px long side) to stay ≤ 500 KB. STOP `public/` deletions: delete nothing (production DB references not ruled out).
