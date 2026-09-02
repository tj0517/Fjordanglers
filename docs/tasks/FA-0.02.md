---
id: FA-0.02
title: Martwe redirecty i linki (/account, /auth/login, /admin/trips, /invite)
stage: 0
status: todo
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-web
branch: fix/dangling-routes
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 1
owner: tj
---

# FA-0.02 — Martwe redirecty i linki

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/audit/rebuild-audit-app-aug-2026.md` §2 „Broken / dangling links" — pełna lista z numerami linii
- `src/proxy.ts` (ok. linii 64) — redirect zalogowanych z `/login`|`/register`
- `src/app/dashboard/layout.tsx` — jak rozdziela admina i przewodnika (admin → `/admin`)

## Cel
Zalogowany użytkownik wchodzący na `/login` ląduje na nieistniejącym `/account` (404); trzy inne linki w aplikacji prowadzą do tras, których nie ma. Po zadaniu żaden link w `src/` nie wskazuje na trasę, która nie istnieje.

## Zakres
- [ ] Odczyt bieżącego stanu: `grep -rn "'/account\|/auth/login\|/admin/trips\|/invite/" src` — potwierdź cztery miejsca.
- [ ] `proxy.ts`: zalogowany na `/login`/`/register` → `/dashboard` (layout dashboardu sam przekieruje admina na `/admin`).
- [ ] `dashboard/profile/page.tsx`: `/auth/login` → `/login`.
- [ ] `admin/guides/[id]/trips/[expId]/edit/page.tsx`: `/admin/trips` → `/admin/guides/[id]` (powrót do karty przewodnika).
- [ ] `components/admin/copy-invite-link.tsx`: usunąć komponent, jeśli nigdzie nie jest renderowany (sprawdź importy); jeśli jest — link do `/login?tab=register` z `invite_email`.
- [ ] `robots.ts`: usunąć disallow dla `/account/`, `/book/`, `/invite/` (trasy nie istnieją).

## Gotowe, gdy
- [ ] `grep -rn "'/account'\|/auth/login\|/admin/trips\|/invite/" src` → 0 wyników.
- [ ] Skrypt: dla każdego `href="/…"` i `redirect('/…')` w `src/` istnieje odpowiadający `page.tsx`/`route.ts` (jednorazowy grep+ls w raporcie, wynik: brak brakujących).
- [ ] `pnpm typecheck && pnpm lint && pnpm build` zielone.

## Poza zakresem
- Strona `/inquiry-confirmed` — FA-0.01.
- Przenoszenie tras do route groups — etap 7.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
grep -rn "'/account'\|/auth/login\|/admin/trips\|/invite/" src || echo OK
pnpm typecheck && pnpm lint && pnpm build
```

## Notatki z realizacji

