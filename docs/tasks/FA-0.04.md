---
id: FA-0.04
title: AI_AUTO_REPLY_ENABLED jako enum 'true'|'false' (dziś "false" włącza agenta)
stage: 0
status: in_progress
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-core
branch: fix/env-boolean-flags
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 1
owner: tj
---

# FA-0.04 — Flaga agenta jako enum

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md` „TypeScript" (booleany w env)
- `src/lib/env.ts` — `AI_AUTO_REPLY_ENABLED: z.coerce.boolean()...`; `Boolean("false") === true`
- `src/app/api/inquiries/route.ts` (ok. 177) i `src/app/api/webhooks/email-inbound/route.ts` (ok. 139) — miejsca odczytu flagi
- Vercel → Environment Variables — sprawdź, jaką wartość ma flaga na production i preview (nie wypisuj innych zmiennych)

## Cel
`z.coerce.boolean()` traktuje każdy niepusty string jako `true`, więc ustawienie `AI_AUTO_REPLY_ENABLED=false` **włącza** automatyczne odpowiedzi agenta do klientów. Po zadaniu flaga jest parsowana jako `'true' | 'false'`, a każda inna wartość zatrzymuje build z czytelnym błędem. To samo dla każdej innej flagi boolowskiej w `env.ts`.

## Zakres
- [ ] Odczyt bieżącego stanu: `grep -n "coerce.boolean" src/lib/env.ts`; wartość flagi w Vercel (production, preview) — tylko ta jedna zmienna, w raporcie jako `set: true/false`, bez innych wartości.
- [ ] Helper `envBool = z.enum(['true','false']).transform(v => v === 'true')` i użycie dla każdej flagi boolowskiej.
- [ ] Test Vitest: `"false"` → `false`, `"true"` → `true`, `"1"` i `""` → błąd walidacji (**na czerwono**).
- [ ] Jeśli w Vercel flaga ma wartość inną niż `true`/`false` — zgłoś w raporcie „Needs a decision", nie zmieniaj env samodzielnie.

## Gotowe, gdy
- [ ] `grep -n "coerce.boolean" src/lib/env.ts` → 0.
- [ ] Testy z zakresu przechodzą; przypadek `"1"` pokazany jako błąd.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Zmiana zachowania agenta, promptu, rund.
- Zmiana wartości env w Vercel — decyzja tj (STOP).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Jakakolwiek zmiana zmiennych środowiskowych w Vercel — STOP, pokaż co i dlaczego.

## Weryfikacja
```
grep -n "coerce.boolean" src/lib/env.ts || echo OK
pnpm test -- env
pnpm typecheck && pnpm lint && pnpm build
```

## Notatki z realizacji

