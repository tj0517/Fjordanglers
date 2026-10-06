---
id: FA-1.56
title: Admin — zakładka v2 na stronie oferty: przewodnicy (wielu, primary/backup), tryb oferty, cennik dni × wędkarze, nowe pola treści, `page_version`, aliasy slugów
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/admin-experience-v2-tab
depends_on: [FA-1.50]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 10
owner: tj
---

# FA-1.56 — Admin: edycja danych v2

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` (reguła 4: `requireAdmin()` w każdej mutacji), `docs/03-conventions.md`
- `docs/proposals/2026-10-05-experience-offer-centric.md` §2, §3 krok 8 (scalanie stron ręcznie), §7 krok 3
- `src/components/admin/ExperiencePageForm.tsx`, `src/app/admin/experiences/[id]/edit/page.tsx`, `src/actions/experience-pages.ts` — dzisiejszy edytor; stare pola zostają edytowalne
- `src/components/ui/*` — design system admina (FA-1.15)
- `docs/tasks/FA-1.51.md` — triggery: zapis `primary` w nowej zakładce ma odbić się w `guide_id`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Bez admina pola z FA-1.50 trzeba by wpisywać SQL-em na prod. Po tym zadaniu tj edytuje w jednym miejscu: listę przewodników strony z rolą i widocznością, tryb oferty, cennik, treść sekcji S3–S9 i S11–S13, przełącznik `page_version` oraz aliasy slugów do scalania bliźniaczych stron. Stare pola i stare zakładki działają jak dotąd.

## Zakres
- [ ] Odczyt bieżącego stanu: struktura `ExperiencePageForm` (zakładki, akcje), lista akcji w `experience-pages.ts`, które z nich mają `requireAdmin()`
- [ ] Zakładka „Oferta v2” z sekcjami: Przewodnicy (lista `experience_guides`: dodaj/usuń, rola, status, `show_on_page`, kolejność, nadpisanie ceny z walidacją ≤ 15%), Tryb i cena (`offer_mode`, `price_from/to_cents`, `fee_pct`, `max_anglers_per_guide`, `min/max_days`), Cennik (`experience_prices` jako siatka dni × wędkarze, `valid_from/to`), Treść (S3–S9, S11–S13 pola z FA-1.50; `day_schedule` i `suggested_lodging` jako listy wierszy, nie surowy JSON), Opcje (`kind`, centy, `sample_itinerary`), Publikacja (`page_version`, aliasy slugów)
- [ ] Akcje w `src/actions/experience-pages.ts` (nowe funkcje, z `requireAdmin()`), zapis w jednej transakcji tam, gdzie zmienia się wiele tabel (RPC albo sekwencja z kontrolą błędów)
- [ ] Podgląd: przycisk „Podgląd v2” → `/experiences/[slug]?preview=v2` (FA-1.52)
- [ ] Walidacja po stronie serwera (zod): `page_version=2` dozwolone tylko gdy `price_from_cents > 0`, ≥ 1 `primary active`, `suited_for` niepuste — inaczej błąd z listą braków
- [ ] Lista `/admin/experiences`: kolumna „v2” (1/2) i liczba przewodników

## Gotowe, gdy
- [ ] Test akcji: dodanie drugiego przewodnika jako `backup` → 2 wiersze, `guide_id` strony bez zmian; zmiana `primary` → `guide_id` = nowy (trigger FA-1.51) — wklejony odczyt
- [ ] Red proof 1: zapis `page_version=2` bez `primary active` → błąd z komunikatem, `page_version` dalej 1
- [ ] Red proof 2: nadpisanie ceny +30% → błąd walidacji w akcji **i** (jeśli przez formularz obejdzie) błąd z bazy — oba wklejone
- [ ] Red proof 3: akcja wywołana bez sesji admina → odmowa (`requireAdmin`) — test
- [ ] Alias slugu zapisany → `/experiences/<stary-slug>` daje 301 (FA-1.52) — test lub `curl -I`
- [ ] Playwright: zrzut zakładki v2 z wypełnioną siatką cen i dwoma przewodnikami — ścieżka w raporcie
- [ ] `grep -n "\.from(" src/components/admin/ExperiencePageForm.tsx "src/app/admin/experiences/[id]/edit/page.tsx"` → 0 nowych względem `main` (`git diff main...HEAD -- <pliki> | grep '^+.*\.from('` pusty)
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone

## Poza zakresem
- Usuwanie starych pól z formularza (`guide_id`, `price_from`, `boat_*`) → CONTRACT
- Automatyczne scalanie bliźniaczych stron — ręcznie przez aliasy i `status='archived'`
- Guide dashboard („moje oferty” z `experience_guides`) → osobne zadanie po pilotażu; zgłoś do deferred
- Edycja `agent_knowledge` — nie tu (FA-1.24)
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
pnpm test -- experience-pages admin-experience-v2
git diff main...HEAD -- src/components/admin "src/app/admin/experiences" | grep -n '^+.*\.from('   # pusty
ls .playwright-mcp | grep -i admin-v2
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji
