---
id: FA-0.22
title: Build nie zależy od Google Fonts — Fraunces i DM Sans self-hosted przez next/font/local
stage: 0
status: done
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-web
branch: fix/self-host-fonts
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: true
estimate_h: 2
owner: tj
---

# FA-0.22 — Self-hosting fontów: Fraunces + DM Sans

**Skąd to zadanie (hotfix 23 IX 2026).** Od ~22 IX Google Fonts zwraca URL-e fontów
w nowym formacie (`/l/font?kit=…&skey=…&v=…`), którego Next 16.1.6 Turbopack nie
potrafi rozwiązać. `pnpm build` pada z ~30 błędami:
```
Can't resolve '@vercel/turbopack-next/internal/font/google/font'
next/font/google queries have exactly one entry
```
Każdy PR jest czerwony, a następny deploy produkcyjny na Vercelu nie przejdzie.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `src/app/layout.tsx` — `Fraunces` (wagi 400/500/600/700/900, normalny + italic, latin,
  `--font-fraunces`) i `DM_Sans` (300/400/500/600, latin, `--font-dm-sans`), oba `display: 'swap'`
- `src/app/globals.css` (l.33–34, 213, 276–277) — konsumenci `--font-fraunces`/`--font-dm-sans`
- `docs/tasks/README.md` — reguła hotfix (PR do `main`)
- `docs/tasks/FA-0.21.md` — przykład formatu pliku zadania etapu 0

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś zamiast wymyślać.

## Cel
Po tym zadaniu fonty są dostarczane z repozytorium, `pnpm build` nie wysyła żadnego
zapytania do Google, strona wygląda tak samo co do kroju i grubości pisma.
Importy `next/font/google` znikają w całości — żaden przyszły deploy nie może być
zablokowany przez zmianę po stronie dostawcy CDN.

## Zakres
- [x] Plik zadania + wiersz w `docs/tasks/INDEX.md` — pierwszy commit (status `in_progress`).
- [x] Odczyt bieżącego stanu: `layout.tsx`, konsumenci css, `git diff origin/main origin/stage-1 -- src/app/layout.tsx` (jedna linia różnicy — zachować obie strony).
- [x] Pliki woff2 dla dokładnie używanych dziś wag/stylów, subset latin (lub variable fonts
  pokrywające te wagi), pod `src/app/fonts/`, z plikiem licencji SIL OFL i krótkim
  `README.md` podającym źródło i wersję każdego pliku. Bez nowej zależności npm.
- [x] `layout.tsx`: `next/font/local` z tymi samymi nazwami zmiennych CSS, `display: 'swap'`,
  te same wagi i italic; usunięcie każdego importu `next/font/google`.
- [x] Jeden wiersz w `docs/03-conventions.md`: fonty są self-hosted przez `next/font/local`;
  `next/font/google` nie jest używane (build nie może zależeć od zewnętrznego fetcha).

## Gotowe, gdy
- [ ] `grep -rn "next/font/google" src` → 0 trafień.
- [ ] Czerwona→zielona: na tej gałęzi, przed zmianą, `pnpm build` pada z błędem powyżej (wklej ~10 linii); po zmianie przechodzi (wklej ogon).
- [ ] Build bez Google: `pnpm build` przechodzi przy zablokowanym dostępie do `fonts.googleapis.com`/`fonts.gstatic.com` — wklej polecenie i ogon.
- [ ] Te same fonty, te same wagi: lista reguł `@font-face` w skompilowanym CSS (`.next/static/**/*.css`: family, weight, style, file) pokrywa Fraunces 400/500/600/700/900 normal+italic i DM Sans 300/400/500/600.
- [ ] CI na PR do `main`: `check`, `knip` zielone — link.
- [ ] `pnpm typecheck && pnpm lint && pnpm test run` zielone.
- [ ] Jeśli Chromium dostępny przez Playwright: screenshot nagłówka `/` (Fraunces) i body (DM Sans) w `.playwright-mcp`; w przeciwnym razie: „brak screenshota" — bez instalowania przeglądarek.

## Poza zakresem
- Upgrade Next.js ani przejście na webpack.
- Jakiekolwiek zmiany stylów lub typografii; inne fonty.
- Praca z FA-1.19 (osobna gałąź).

Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed dodaniem jakiejkolwiek zależności npm (np. `@fontsource*`) zamiast commitowania plików — STOP, przedstaw opcje i czekaj.
- Przed jakimkolwiek działaniem na produkcji wykraczającym poza deploy przez Vercel — STOP.

## Weryfikacja
```
grep -rn "next/font/google" src
docker ps                           # brak stack-u przed build
pnpm build                          # przed (czerwone) i po (zielone)
HTTPS_PROXY=http://127.0.0.1:9 pnpm build   # Google nieosiągalne → wciąż zielone
grep -ho "@font-face{[^}]*}" .next/static/**/*.css | head -40
pnpm typecheck && pnpm lint && pnpm test run
gh run list --branch fix/self-host-fonts --limit 3
```

## Notatki z realizacji

2026-09-23 tj: hotfix, plik zadania tworzony w PR (CI czerwone na bazie — wyjątek od reguły).
PR: https://github.com/tj0517/Fjordanglers/pull/92
2026-09-23 — odbiór (tj): PR #92 przyjęty po rundzie 2. Udowodnione: `next/font/google` usunięte (grep 0), build zielony przy zablokowanym Google (HTTPS_PROXY), pliki woff2 tylko z osią wght (fvar: Fraunces 100–900 normal+italic, DM Sans 100–1000; opsz usunięte w rundzie 2, żeby wygląd liter był jak na produkcji), @font-face pokrywa wszystkie używane wagi, CI 35863864312: check/knip/db zielone. Bez zrzutu (brak Chromium) — wygląd do sprawdzenia na produkcji po deployu.
