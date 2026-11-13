---
id: FA-1.90
title: Linkowanie wewnętrzne — powiązane oferty i przewodnicy przy artykułach i hubach, artykuły kraju na hubie, blok bloga na stronie głównej
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-web
branch: feat/fa-1.90-internal-links
pr: 192
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
- [ ] Skrypt `.fa-proofs/FA-1.90/link-counts.mjs` (unikalne wewnętrzne href w `<main>`, bez nav/stopki), uruchomiony przed i po na lokalnym serwerze: artykuł → ≥ 2 `/experiences/`, ≥ 1 `/guides/`, 1 hub; hub z artykułami → ≥ 1 `/blog/`; główna → ≥ 1 `/blog/` — oba wyniki wklejone.
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
- **2026-11-12, tj:** D1 — dowód na danych: lokalnie wstawić (własne unikalne id) 2 aktywne `experience_pages` i 1 aktywnego przewodnika z Norwegii, zmierzyć, usunąć i wkleić delete + licznik 0; te same kryteria pokrywają testy na fixture'ach (tier kraju, fallback do grupy, artykuł bez kraju, brak przewodników, artykuły hubu po kraju, blok na głównej, fail-soft przy błędzie odczytu bloga), bo lokalny seed nie ma ofert ani przewodników z Norwegii.
- **2026-11-12, tj:** D2 — artykuły hubu czytane z `blog_posts` po `getHubCountries(hub)` (tylko opublikowane, od najnowszych); ręczne pole `articles` w `DESTINATION_HUBS` i jego typ usunięte, wiersz deferred FA-1.83 „Hand-typed article links on the hubs” zamknięty w tym samym diffie.
- **2026-11-12, tj:** D3 — oferty przy artykule poszerzane tierami jak `getRelatedExperiencePages`: ten sam kraj → ta sama grupa regionów → dowolne; nagłówek bloku zależy od tieru. Artykuł bez kraju (NULL) zaczyna od „dowolne” i nie ma linku do hubu. Przewodnicy: aktywni z tego samego kraju; gdy brak — część z przewodnikami ukryta.
- **2026-11-12, tj:** D4 — jeśli `pnpm build` na bazie pokazuje `/blog/[slug]` jako `ƒ`, dodać pusty `generateStaticParams` (wzorzec FA-1.80 z `/experiences/[slug]`), żeby trasa znów była ISR. Każdy nowy odczyt bloga na stronie prerenderowanej ma się degradować łagodnie (ukryty blok + log), nigdy przez `force-dynamic`.
- **2026-11-12, tj:** `<main>` — opcja B: na `/`, `/[destination]` i `/blog/[slug]` dokładnie jeden landmark `<main>` na stronę, dodany per strona (nie we wspólnym layoucie `(public)`, bo `/guides` ma już własny `<main>`). Bez zmiany wyglądu — zrzuty przed/po wszystkich trzech przy 1280 px i na mobile. Skrypt liczy unikalne wewnętrzne href tylko w `<main>`. Build „przed” i „po” w jednym oknie zatrzymania stosów pod koniec; „przed” z odłączonego checkoutu dokładnie `5550c79`.
- **2026-11-12, tj:** build evidence from the CI `check` job instead of a local `pnpm build` (no stack stop): before = PR #190 check job (feac13e, tree = 5550c79), after = check job on the PR head. The "Weryfikacja" line `pnpm build # stack zatrzymany` is superseded by this.
- **2026-11-13, tj:** commit with key-shaped dummy values in `.fa-proofs/FA-1.90/start-dev.sh` rewritten (values now read from `.env.test`); force-push with lease run by tj; gitleaks clean on 5550c79..HEAD.
- **2026-11-13, tj (review PR #192):** accepted. Proven: link counts before (eba4da6) / after with temporary Norway rows (deleted, counts 0), fixture tests incl. red/green fail-soft, route table ƒ → ● for /blog/[slug] with / and /[destination] unchanged, CI check/knip/db/secrets green on e0894a4. Vercel preview failure pre-existing (deferred FA-1.74/FA-1.91).
