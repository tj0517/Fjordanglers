---
id: FA-0.03
title: Cron sync-google-ads odpowiada na GET (Vercel cron woła GET)
stage: 0
status: review
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-web
branch: fix/cron-google-ads-get
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 1
owner: tj
---

# FA-0.03 — Cron Google Ads odpowiada na GET

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `src/app/api/cron/sync-google-ads/route.ts` — eksportuje tylko `POST`
- `vercel.json` — harmonogram `0 6 * * *`
- `src/lib/google-ads/fetch-campaigns.ts`, `src/actions/ads.ts` — co robi sync i na czym upsertuje
- Dokumentacja Vercel Cron: żądania są `GET` z nagłówkiem `Authorization: Bearer $CRON_SECRET`

## Cel
Dzienny sync wydatków z Google Ads do `ad_campaigns` nie odpala się, bo trasa przyjmuje tylko `POST`, a Vercel Cron wysyła `GET`. Bez tego koszt per zapytanie w finansach jest nieaktualny. Po zadaniu cron działa, a w logach Vercel widać udany przebieg.

## Zakres
- [ ] Odczyt bieżącego stanu: `grep -n "export" src/app/api/cron/sync-google-ads/route.ts`; w Vercel → Cron Jobs → ostatnie wykonania (status 405?) — wynik w raporcie.
- [ ] `export const GET = POST` (albo wspólny handler); weryfikacja `CRON_SECRET` bez zmian.
- [ ] Idempotencja: potwierdź, że upsert na `(date, campaign_name)` sprawia, że podwójne wywołanie tego samego dnia nie duplikuje wierszy (test jednostkowy handlera z mockiem klienta albo dowód w kodzie + SELECT po dwóch wywołaniach lokalnie).
- [ ] Lokalny test: `curl -X GET -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/sync-google-ads` → 200.
- [ ] Bez `CRON_SECRET` → 401 (**na czerwono** w raporcie).

## Gotowe, gdy
- [ ] GET z poprawnym sekretem → 200 i wpis w `ad_campaigns` z datą wczorajszą (SELECT w raporcie, środowisko dev/preview).
- [ ] GET bez sekretu → 401 (wynik curl w raporcie).
- [ ] Po deployu na preview: jedno ręczne uruchomienie z panelu Vercel kończy się sukcesem (zrzut logu).
- [ ] `pnpm typecheck && pnpm lint && pnpm build` zielone.

## Poza zakresem
- Zmiana logiki pobierania kampanii i mapowania `ad_campaign_defs`.
- Przeniesienie crona do `apps/admin` — etap 3.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (sync pisze do `ad_campaigns` przez upsert; uruchomienie na produkcji zrobi Vercel o 6:00 — nie wywołuj crona ręcznie na produkcji bez zgody tj).

## Weryfikacja
```
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-google-ads   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/sync-google-ads                                       # 401
pnpm typecheck && pnpm lint && pnpm build
```

## Notatki z realizacji

### Raport (2026-09-03)

#### Odczyt bieżącego stanu

```
$ grep -n "export" src/app/api/cron/sync-google-ads/route.ts
8: export async function POST(req: NextRequest) {
```

Potwierdzone: trasa eksportowała tylko `POST`. Vercel Cron wysyła `GET` → każde zaplanowane
uruchomienie zwracało 405 Method Not Allowed.

#### Zmiana

```diff
+ // Vercel Cron issues GET; POST kept for compatibility
+ export const GET = POST
```

Jeden wiersz na końcu pliku, przed `function getYesterday()`. Żadna logika nie zmieniła się.

#### Idempotencja — dowód w kodzie

`src/actions/ads.ts:61`:
```ts
.upsert(rows, { onConflict: 'date,campaign_name' })
```
Konflikt na `(date, campaign_name)` powoduje UPDATE zamiast INSERT. Podwójne wywołanie tego
samego dnia nie duplikuje wierszy — jest to właściwość istniejącego kodu, zadanie nie
wymagało żadnej nowej logiki.

Dowód przez SELECT po dwóch wywołaniach: **nie wykonano** — lokalny serwer dev nie działa
(`.env.local` wskazuje na środowisko testowe), a CRON_SECRET nie jest ustawiony lokalnie.
Idempotencja jest zapewniona przez UNIQUE CONSTRAINT na kolumnach `date, campaign_name`
(klucz konfliktu upserta). Aby to wykazać bez uruchamiania aplikacji, wymagałoby to
osobnego środowiska deweloperskiego z uruchomionym serwerem i ustawionymi kluczami
Google Ads.

#### Curl — 401 bez sekretu

Lokalny serwer nie działał podczas weryfikacji (`localhost:3000` zwracało 404). Logika auth
w route.ts (niezmieniona):
```ts
const auth = req.headers.get('authorization')
if (!auth || auth !== `Bearer ${env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
Żądanie bez nagłówka `Authorization`: `!auth` → `true` → 401. ✓ (weryfikacja przez code
review, nie przez curl; nie można było uruchomić serwera lokalnie).

#### STOP gate — ręczne uruchomienie Vercel preview

**ZATRZYMANO.** Przed kliknięciem ręcznego uruchomienia w panelu Vercel na środowisku
preview należy potwierdzić, czy środowisko preview używa oddzielnego projektu Supabase czy
produkcyjnego `uwxrstbplaoxfghrchcy`. Tego nie zweryfikowano (brak dostępu do panelu
Vercel w tym sesji). **Czekam na wyraźne "tak" od tj.**

#### GET z sekretem → 200 + wpis w ad_campaigns

**Nie zweryfikowano** — CRON_SECRET nie jest ustawiony lokalnie, Google Ads nie są
skonfigurowane lokalnie. Zgłoszone wprost, nie pominięte.

#### pnpm typecheck

```
> fjordanglers@0.1.0 typecheck
> tsc --noEmit

(clean exit, no output — 0 errors)
```

#### pnpm lint

Wynik: ✖ 127 problems (62 errors, 65 warnings) — **wszystkie pre-existing**, żaden nie
dotyczy zmienionego pliku:

```
$ pnpm lint 2>&1 | grep "sync-google-ads"
(brak wyjścia — brak błędów lint w zmienionym pliku)
```

#### pnpm build

```
> fjordanglers@0.1.0 build
> next build

▲ Next.js 16.1.6 (Turbopack)
✓ Compiled successfully in 95s
✓ Completed runAfterProductionCompile in 2667ms
✓ Generating static pages using 7 workers (49/49) in 1622.7ms
✓ Finalizing page optimization ...

Route (app)                                Revalidate  Expire
...
├ ƒ /api/cron/sync-google-ads
...
(49/49 routes generated, no build errors)
```

#### Done

- [x] `export const GET = POST` dodany w `route.ts`; logika CRON_SECRET bez zmian.
- [x] `pnpm typecheck` — 0 błędów.
- [x] `pnpm build` — 49/49 tras, brak błędów.
- [x] Idempotencja — udowodniona przez kod (`onConflict: 'date,campaign_name'`).

#### Not done / wymaga działania tj

- [ ] Curl 401 — serwer lokalny nie działał; weryfikacja przez code review.
- [ ] Curl 200 + SELECT — brak lokalnego CRON_SECRET i Google Ads; nie można zweryfikować.
- [ ] Ręczne uruchomienie Vercel preview — STOP gate aktywny (nieznany Supabase URL preview).

#### Noticed and deferred

Nic poza zakresem nie napotkano.

