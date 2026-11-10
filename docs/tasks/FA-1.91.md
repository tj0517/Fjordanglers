---
id: FA-1.91
title: Strony techniczne poza indeksem — `noindex` i prawdziwy 404 dla nieznanych tokenów, `alt` na pinach mapy, bez `SearchAction`
stage: 1
status: in_progress
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-web
branch: feat/fa-1.91-utility-noindex
pr:
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 2
owner: tj
---

# FA-1.91 — Strony techniczne poza indeksem

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/audit/seo-audit-2026-11.md` — F18, F19
- `src/app/offers/[token]/`, `src/app/guide-intake/[token]/`, `src/app/reviews/[token]/`, `src/app/inquiry/[id]/confirmed/`
- `src/app/trips/exp-page-map-view.tsx` (l. 199, 219, 242), `src/app/layout.tsx` (l. 98–105)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Strony z tokenem dla nieznanego tokenu zwracają 200 z `index, follow` (miękki 404), a żadna z nich nie ma `noindex`. Po zadaniu wszystkie strony z tokenem i potwierdzenia mają `noindex`, nieznany token → 404, piny mapy mają `alt`, a `WebSite.SearchAction` (wskazuje filtr, nie wyszukiwarkę) znika.

## Zakres
- [ ] Odczyt stanu: `curl -s -o /dev/null -w '%{http_code}'` dla `/offers/test-token`, `/guide-intake/test-token`, `/reviews/test-token`.
- [ ] `robots: { index: false }` na trasach z tokenem i potwierdzenia; `notFound()` dla nieznanego tokenu.
- [ ] `alt=""` na dekoracyjnych pinach.
- [ ] Usunięcie `SearchAction` z JSON-LD `WebSite`.

## Gotowe, gdy
- [ ] Nieznany token → 404 na trzech trasach; ważny token dalej działa (test) — wklejone.
- [ ] `grep -n 'noindex\|index: false'` na czterech trasach — wklejony.
- [ ] Lighthouse SEO hubu bez `image-alt` (jeśli lighthouse działa; inaczej „niezweryfikowane”).
- [ ] CI zielone — lista wklejona.

## Poza zakresem
- Zmiany w logice ofert, opinii i formularza przewodnika.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- brak (bez wysyłania formularzy i maili; strony z tokenem tylko GET).

## Weryfikacja
```
for p in offers guide-intake reviews; do curl -s -o /dev/null -w "$p %{http_code}\n" localhost:3000/$p/test-token; done
```

## Notatki z realizacji
- **2026-11-03, tj:** zadanie z audytu SEO (F18, F19).
- **2026-11-10, tj:** D1 — 404 dla nieznanego, wygasłego i nieaktywnego linku (oferta, formularz przewodnika); ekran z komunikatem i kontaktem bez zmian, w `not-found.tsx` trasy.
- **2026-11-10, tj:** D2 — `alt=""` także na wspólnym pinie `src/components/map/pin-icon.ts`; kryterium Lighthouse zastąpione grepem, Lighthouse jako dodatek.
