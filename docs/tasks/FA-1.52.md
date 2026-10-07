---
id: FA-1.52
title: Dwa szablony na jednej trasie — `_v1/` bez zmian, router po fladze i `page_version`, podgląd `?preview=v2` dla admina
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/experience-page-router-v2
depends_on: [FA-1.50]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
pr: 133
owner: tj
---

# FA-1.52 — Router v1 / v2 na `/experiences/[slug]`

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` (reguła 3: `.from(` tylko w warstwie danych; reguła o `requireAdmin`), `docs/03-conventions.md`
- `docs/proposals/2026-10-05-experience-offer-centric.md` §7 krok 3 — flaga globalna × `page_version`, podgląd admina
- `src/app/experiences/[slug]/page.tsx` — dzisiejszy szablon (ma 6× `.from(` wprost — legacy; przenosisz **bez zmian**, nie naprawiasz)
- `src/lib/env.ts` (albo miejsce, gdzie żyją flagi typu `AI_AUTO_REPLY_ENABLED` z FA-0.04) — wzór flagi jako enum
- `src/actions/auth.ts` / `requireAdmin` — rozpoznanie admina dla `?preview=v2`
- `src/lib/supabase/queries.ts` — gdzie dołożyć odczyt `page_version` i aliasu slugu

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Nowy szablon ma wchodzić na tę samą ścieżkę co stary, strona po stronie, a rollback ma być wyłączeniem flagi. Po tym zadaniu klient nie widzi żadnej różnicy: v2 to jeszcze pusty komponent, który renderuje się tylko adminowi z `?preview=v2`. Stary kod ląduje w `_v1/` jeden do jednego.

## Zakres
- [ ] Odczyt bieżącego stanu: otwórz `src/app/experiences/[slug]/page.tsx`, wypisz eksporty (`generateMetadata`, `generateStaticParams`, default) i wszystkie importy; sprawdź, jak dziś jest zbudowana flaga env z FA-0.04
- [ ] `src/app/experiences/[slug]/_v1/ExperienceV1.tsx` = dzisiejsza treść strony bez zmian logiki (dozwolone: zamiana na komponent przyjmujący `slug`); `page.tsx` staje się routerem
- [ ] Flaga `EXPERIENCE_V2_ENABLED` (enum `on|off`, jak FA-0.04), domyślnie `off`
- [ ] `getExperienceRouting(slug)` w warstwie danych: zwraca `{ pageVersion, canonicalSlug }` — jeśli slug jest w `experience_slug_aliases`, 301 na `canonicalSlug`
- [ ] Router: v2 gdy `flag=on AND page_version=2`, albo gdy admin (`requireAdmin`-podobny odczyt sesji bez rzucania) i `?preview=v2`; w każdym innym przypadku v1
- [ ] `src/app/experiences/[slug]/_v2/ExperienceV2.tsx` — szkielet: nagłówek „v2 preview” + `slug`; nic więcej (treść → FA-1.53–1.55)
- [ ] `generateMetadata` niezmienione dla v1; v2 na razie dziedziczy to samo

## Gotowe, gdy
- [ ] `git diff main...HEAD -- src/app/experiences/[slug]/_v1/ExperienceV1.tsx` vs stary `page.tsx`: różnice tylko w sygnaturze komponentu i importach — wklej `diff` z `--stat` i fragment
- [ ] Przy `EXPERIENCE_V2_ENABLED=off` snapshot HTML strony aktywnej (lokalny seed) identyczny jak na `main` — test porównawczy albo `curl | diff`
- [ ] Red proof: `EXPERIENCE_V2_ENABLED=on` + `page_version=2` na stronie bez v2 renderuje szkielet v2 (200), a nieistniejący slug → 404, nie 500 — oba wklejone
- [ ] `?preview=v2` bez sesji admina → v1; z sesją admina → v2 — test
- [ ] Alias slugu → 301 na kanoniczny; kanoniczny slug → 200 — test
- [ ] `grep -n "\.from(" "src/app/experiences/[slug]/page.tsx"` → 0 (router bez zapytań); `_v1/` wolno mieć stare `.from(` (legacy, do usunięcia z v1 w CONTRACT)
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone

## Poza zakresem
- Naprawa `.from(` w v1 (reguła 3) — v1 znika w CONTRACT; nie refaktoruj
- Treść v2 → FA-1.53, FA-1.54, FA-1.55
- Ustawianie `page_version=2` na prod → FA-1.57
- Osobny slug `/trips/…` dla v2 — nie; ta sama trasa
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
git diff main...HEAD --stat
grep -n "\.from(" "src/app/experiences/[slug]/page.tsx"      # 0
pnpm test -- experience-router
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji

2026-10-06 tj (/wf-task): admin preview via proxy rewrite to a hidden dynamic route, public page stays ISR (revalidate 3600); alias redirect = permanentRedirect (308); flag = 'true'|'false' like AI_AUTO_REPLY_ENABLED; snapshot criterion compares visible text; v1 has 8 `.from(` calls, not 6.

2026-10-06 tj (/wf-review): FA-1.52 accepted with additions (PR #133, head 60659e08). Router, admin preview via proxy rewrite, 308 alias redirect and the flag verified against the task; comment corrected; deferred rows added for the dynamic rendering of /experiences/[slug] (cause not confirmed) and for cache invalidation of getExperienceRouting (affects FA-1.56/1.57).
