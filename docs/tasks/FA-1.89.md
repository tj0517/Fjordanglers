---
id: FA-1.89
title: Oferty — alias dla wycofanego adresu chilijskiego (→ Punta Arenas), jeden H1 na stronie v1, generator slugów bez „--”
stage: 1
status: in_progress
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-web
branch: feat/fa-1.89-offer-slugs
pr:
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 3
owner: tj
---

# FA-1.89 — Aliasy, H1 i slugi ofert

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/02-data-model.md` — `experience_pages`, `experience_slug_aliases`
- `docs/audit/seo-audit-2026-11.md` — F7, F8, F12, D3
- `src/app/experiences/[slug]/page.tsx` (l. 50–52), `src/lib/supabase/queries.ts` (l. 509–549) — aliasy
- `src/app/experiences/[slug]/_v1/ExperienceV1.tsx` (l. 414, 474) — dwa H1

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Adres `fly-fishing-across-magallanes-torres-del-paine--tierra-del-fuego` z indeksu Google zwraca 404; po zadaniu przekierowuje 308 na `fly-fishing-across-punta-arenas-tierra-del-fuego--torres-del-paine` (decyzja tj D3, 2026-11-03). Strona v1 ma jeden H1 (dziś kopia mobilna i desktopowa). Nowe slugi nie mają „--”/„---” (generator); istniejących 4 slugów nie zmieniamy (D3).

## Zakres
- [ ] Odczyt stanu (SELECT): `experience_slug_aliases` (7 wierszy), strona docelowa aktywna.
- [ ] Wiersz aliasu dla wycofanego adresu — STOP: pokaż zapis i sposób (migracja danych / panel).
- [ ] Jeden H1 w v1 (drugi jako element nie-nagłówkowy, wygląd bez zmian).
- [ ] Generator slugów: transliteracja (ō → o, å → a, ø → o, & → and), bez wielokrotnych myślników + test.

## Gotowe, gdy
- [ ] Po deployu: stary adres → 308 na Punta Arenas — `curl -sI` wklejony.
- [ ] Oferta v1: `grep -c '<h1' ` = 1 — wklejone.
- [ ] Test generatora: „Fly fishing – Taupō & Tongariro” → `fly-fishing-taupo-and-tongariro`; red proof na starym zachowaniu — wklejone.
- [ ] CI zielone — lista wklejona.

## Poza zakresem
- Zmiana 4 istniejących slugów z „--” (D3: nie teraz).
- Przepisywanie tytułów i opisów ofert (GSC: niski CTR wynika z pozycji, nie z opisu) → treść, nie kod.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis aliasu na prod — pokaż i czekaj; migracja tylko przez `migrate-prod` (tj).
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
curl -sI https://www.fjordanglers.com/experiences/fly-fishing-across-magallanes-torres-del-paine--tierra-del-fuego | grep -iE '^HTTP|^location'
pnpm test -- slug
```

## Notatki z realizacji
- **2026-11-03, tj:** D3 — alias na Punta Arenas; slugów z „--” nie ruszamy.
- **2026-11-03, Claude (GSC):** niski CTR `fiskedan-stockholm-fishing` i `/trips` wynika z pozycji 20–90 na ogólne frazy, nie z opisu — przepisywanie opisów wycięte z zakresu audytu (zadanie 9 raportu).
