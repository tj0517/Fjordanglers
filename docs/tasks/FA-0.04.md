---
id: FA-0.04
title: AI_AUTO_REPLY_ENABLED jako enum 'true'|'false' (dziś "false" włącza agenta)
stage: 0
status: review
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

### Raport — Sonnet 5, effort medium (2026-09-04)

Wykonane wg "Uzupełnienia od tj" (mają pierwszeństwo przed treścią zadania powyżej —
patrz różnice w punktach 2, 3, kryteriach akceptacji i weryfikacji).

**Stan repo przed startem** — zgodny z opisem tj: gałąź `feat/patagonia-ai-agent` z tymi
samymi 5 zmodyfikowanymi i 6 nieśledzonymi plikami. `git checkout main` przeszło bez
konfliktu (dirty state to working-tree, nie branch-specific). `fix/env-boolean-flags`
założona z `main`. Żadne z tych plików nie zostało dotknięte poza jednym punktem niżej.

**Done:**

1. **`grep` przed:**
```
$ grep -n "coerce.boolean" src/lib/env.ts
114:  AI_AUTO_REPLY_ENABLED: z.coerce.boolean().optional().default(false),
```

2. **`src/lib/env.ts:114`** →
```ts
AI_AUTO_REPLY_ENABLED: z.enum(['true', 'false']).optional().default('false').transform(v => v === 'true'),
```
`.default('false')` przed `.transform()` — string przechodzi przez transform, zgodnie z
instrukcją. `Env['AI_AUTO_REPLY_ENABLED']` pozostaje `boolean` (patrz typecheck niżej,
`z.infer<typeof envSchema>` nie zmienia się co do kształtu wyjściowego).

3. **`export const envSchema`** — `src/lib/env.ts:31` (`const` → `export const`).

4. **`src/lib/env.test.ts`** (nowy plik) — testuje `envSchema.shape.AI_AUTO_REPLY_ENABLED`
   bezpośrednio, bez importu `env`. **Problem napotkany i rozwiązany:** samo zaimportowanie
   `envSchema` z `./env` i tak wykonuje cały moduł, w tym `export const env = ...validateEnv()`
   na końcu pliku — to wywaliło się na braku `STRIPE_SECRET_KEY`/`RESEND_API_KEY` w środowisku
   testowym (pierwszy przebieg testu, wklejone niżej jako dowód). Naprawione przez dynamiczny
   `import('./env')` w `beforeAll` po ustawieniu `process.env.NEXT_PHASE = 'phase-production-build'`
   — czyli ponowne użycie **już istniejącego** obejścia z `env.ts:149-152` (Next.js build phase),
   a nie dodanie nowego. Nic w `env.ts:148-156` nie zostało zmienione.

   Pierwszy przebieg (przed poprawką testu) — dowód problemu:
```
FAIL src/lib/env.test.ts [ src/lib/env.test.ts ]
Error:
❌ Invalid environment variables:
  RESEND_API_KEY: Invalid input: expected string, received undefined
```

   Finalny przebieg — zielony, `pnpm test -- --run src/lib/env.test.ts`:
```
 ✓ src/lib/env.test.ts (5 tests) 46ms
 Test Files  3 passed (3)
      Tests  17 passed (17)
```

   **Oba czerwone przypadki** (uruchomione osobno przez `envSchema.shape.AI_AUTO_REPLY_ENABLED.safeParse(...)`
   poza test runnerem, żeby wkleić surowy komunikat walidacji Zoda):
```
case "1": [{"code":"invalid_value","values":["true","false"],"path":[],"message":"Invalid option: expected one of \"true\"|\"false\""}]
case "": [{"code":"invalid_value","values":["true","false"],"path":[],"message":"Invalid option: expected one of \"true\"|\"false\""}]
```

5. **`grep` po:**
```
$ grep -n "coerce.boolean" src/lib/env.ts
$ echo $?
1
```
0 wyników.

6. **`pnpm typecheck`** — 0 błędów:
```
> tsc --noEmit
(no output)
```

7. **`pnpm build`** — zielony, 49 route'ów skompilowanych (tło, exit code 0, pełny log
   w `/private/tmp/.../b36wzk7h6.output` — dostępny w tej sesji, nie w repo).

8. **`npx eslint src/lib/env.ts src/lib/env.test.ts`** — 0 błędów, brak wyjścia.

9. **`pnpm lint` (pełny) — liczba błędów przed i po, bez zmian:**
   - Przed: `128 problems (62 errors, 66 warnings)`
   - Po: `128 problems (62 errors, 66 warnings)`
   Identyczne — wszystkie pre-existing w `src/emails/*` i `whatsapp-bridge/`, nic nowego.

10. **Oba miejsca odczytu flagi kompilują się bez rzutowania** — potwierdzone przez zielony
    `pnpm typecheck` (żadnych zmian w `src/app/api/inquiries/route.ts:177` ani
    `src/app/api/webhooks/email-inbound/route.ts:139` — nadal `if (env.AI_AUTO_REPLY_ENABLED)`,
    typ `boolean`, bez `as`).

11. **`src/lib/ai/inquiry-agent.ts:24`** — komentarz `"Feature-flagged: only runs when
    AI_AUTO_REPLY_ENABLED=true in env."` sprawdzony — pozostaje prawdziwy po zmianie
    (flaga nadal `=true` włącza agenta, teraz poprawnie). Nie zmieniony.

12. **`docs/deferred-tasks.md`** — dopisany wiersz FA-0.04 opisujący realną dziurę w
    `env.ts:149-156` (build-phase bypass omija walidację, `Env` obiecuje `boolean` ale
    wartość to surowy string) — zgodnie z instrukcją, nienaprawione tutaj.
    **Uwaga proceduralna:** plik miał już niescommitowaną linię FA-0.03 (cudza WIP, nie
    moja) w working tree przed startem. Wyodrębniłem swoją linię do osobnego commitu przez
    tymczasowe usunięcie cudzej linii z indeksu, commit, i przywrócenie jej z powrotem do
    working tree jako nadal niescommitowanej — żeby nie połknąć czyjejś pracy do tej gałęzi
    ani jej nie zgubić przy późniejszym powrocie na `main`.

**Needs a decision:**
- tj: sprawdź wartość `AI_AUTO_REPLY_ENABLED` w Vercel (production i preview) i podaj ją
  jako `true`/`false`. Jeśli jest tam cokolwiek innego niż dokładnie te dwa stringi, build
  padnie z błędem walidacji po wejściu tej zmiany — i to jest zamierzone.
- Dwa niescommitowane pliki zauważone na gałęzi wyjściowej (`main`), nie moje i nietknięte:
  `.claude/agents/fa-reviewer.md`, `.claude/commands/fa-review.md` — jeśli jeszcze nie
  rozwiązane z poprzedniego zadania (FA-0.02), wciąż czekają na decyzję tj.

**Poza zakresem — potwierdzone nietknięte:** zachowanie agenta/prompt/rundy, wartość env w
Vercel, `PLATFORM_COMMISSION_RATE` i pozostałe `z.coerce.*`, naprawa `env.ts:149-156`
(build-phase bypass), migracje Patagonii (nieśledzone, zostawione bez zmian).

**Proponowany status:** `review` — ustawiony we frontmatterze tego pliku i w
`docs/tasks/INDEX.md` (wiersz FA-0.04).
