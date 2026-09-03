---
id: FA-0.03
title: Cron sync-google-ads odpowiada na GET (Vercel cron woła GET)
stage: 0
status: in_progress
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

