---
id: FA-1.75
title: Preview wyłączone do czasu środowiska dev — Ignored Build Step w Vercelu (tymczasowe, zdejmuje FA-1.18)
stage: 1
status: done
difficulty: S
model: — (człowiek)
model_approved:
effort:
agent:
branch:
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: true
estimate_h: 0.25
owner: tj
---

# FA-1.75 — Preview wyłączone do czasu środowiska dev

## Kontekst — przeczytaj przed startem
- `docs/deferred-tasks.md` — wiersz FA-1.16 „Vercel Preview wskazuje na produkcyjną bazę Supabase"
- `vercel.json` — `git.deploymentEnabled` (dziś wyłącza tylko `docs/*`, `chore/*`, `staging`, `preview`)
- `docs/tasks/FA-1.18.md` — zadanie, które to ustawienie zdejmuje

## Cel
Każdy deploy preview gałęzi `feat/*` i `fix/*` (a także `stage-1`) zapisuje dziś do bazy
produkcyjnej. Do czasu, aż FA-1.18 przepnie Preview na dev, preview nie powstaje wcale.
Produkcja (`main`) deployuje się bez zmian.

**Dlaczego dashboard, a nie `vercel.json`:** Vercel czyta `vercel.json` z commita, który
deployuje. Wpis w `stage-1` nie obejmie gałęzi wyciętych wcześniej ani hotfixów z `main`.
Ustawienie w dashboardzie działa od razu dla wszystkich gałęzi. Odstępstwo od zasady
„konfiguracja w kodzie" jest świadome i tymczasowe, bo FA-1.18 je zdejmuje.

## Zakres
- [ ] Vercel → projekt `fjordanglers` → Settings → Git → Ignored Build Step → Custom:
      `[ "$VERCEL_ENV" != "production" ]` (exit 0 = pomiń build; dla produkcji exit 1 = buduj)
- [ ] Wpis w „Notatkach z realizacji": data i godzina włączenia

## Gotowe, gdy
- [ ] Push pustej gałęzi testowej (`chore/…` jest wyłączone w `vercel.json`, więc użyj `fix/preview-off-check`) → w Vercelu deployment ma status „Ignored" / „Canceled" — **zrzut albo `gh api repos/tj0517/Fjordanglers/deployments?ref=fix/preview-off-check`**
- [ ] Najbliższy deploy `main` → „Ready" (albo, jeśli do FA-1.18 nie ma deployu `main`, redeploy ostatniego produkcyjnego z dashboardu → „Ready")
- [ ] Gałąź testowa usunięta

## Poza zakresem
- Przepięcie Preview na bazę dev → FA-1.18
- Zmiana `vercel.json`
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
Zmiana ustawień projektu Vercel — robi tj osobiście.

## Weryfikacja
```
gh api "repos/tj0517/Fjordanglers/deployments?ref=fix/preview-off-check" --jq '.[].id'
```

## Notatki z realizacji
- 2026-09-22 tj (wf-plan): preview wyłączyć od razu, nie czekać na FA-1.18 (D1).
- 2026-09-23 14:25 — tj: Ignored Build Step w Vercelu ustawiony na
  `[ "$VERCEL_ENV" != "production" ] || git diff --quiet HEAD^ HEAD -- . ':(exclude)docs/**' ':(exclude).claude/**' ':(exclude)*.md'`
  (połączony z istniejącą regułą „tylko docs”). Dowód: deployment `fix/preview-off-check`
  (commit z plikiem spoza docs) = Canceled; redeploy produkcji = Ready; gałąź testowa usunięta.
