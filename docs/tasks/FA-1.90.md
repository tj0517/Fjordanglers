---
id: FA-1.90
title: Linkowanie wewnętrzne — powiązane oferty i przewodnicy przy artykułach i hubach, artykuły kraju na hubie, blok bloga na stronie głównej
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-web
branch: feat/fa-1.90-internal-links
pr:
depends_on: [FA-1.82, FA-1.83]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.90 — Linkowanie wewnętrzne

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/audit/seo-audit-2026-11.md` — F16, §2.7
- `docs/tasks/FA-1.82.md`, `docs/tasks/FA-1.83.md` — huby i blog (powiązanie artykułu z krajem/hubem)
- `src/app/page.tsx`, `src/app/(public)/[destination]/page.tsx`, `src/app/(public)/blog/[slug]/page.tsx`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś strona główna nie linkuje do bloga, artykuł nie linkuje do ofert ani przewodników, a hub nie linkuje do artykułów. Po zadaniu artykuł ma blok „powiązane oferty i przewodnicy” ze swojego kraju i link do hubu, hub pokazuje artykuły swojego kraju, a strona główna ma blok najnowszych artykułów. Dzięki temu Google rozumie strukturę tematów, a czytelnik artykułu ma drogę do oferty.

## Zakres
- [ ] Odczyt stanu: liczby linków per typ strony (skrypt z audytu §2.7).
- [ ] Artykuł: 2–3 oferty + 1–2 przewodników z kraju wpisu, link do hubu.
- [ ] Hub: lista artykułów kraju (gdy są).
- [ ] Strona główna: 3 najnowsze artykuły.
- [ ] Zapytania przez warstwę danych; cache z tagiem `blog`.

## Gotowe, gdy
- [ ] Ten sam skrypt po zmianie: artykuł → ≥ 2 linki `/experiences/`, ≥ 1 `/guides/`, 1 hub; hub → ≥ 1 `/blog/` (gdy są artykuły kraju); główna → ≥ 1 `/blog/` — wklejone.
- [ ] Strony dalej idą z cache (`pnpm build` — brak `ƒ` na tych trasach) — wklejone.
- [ ] CI zielone — lista wklejona.

## Poza zakresem
- Linki wpisywane ręcznie w treści artykułów (robi autor).
- Strony regionów (D5).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- brak

## Weryfikacja
```
pnpm build   # stack zatrzymany
```

## Notatki z realizacji
- **2026-11-03, tj:** zadanie z audytu SEO (F16).
