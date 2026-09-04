---
id: FA-0.10
title: Google Ads sync — martwy/zły token (cron 500 mimo naprawionego routingu)
stage: 0
status: todo
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-web
branch: fix/google-ads-token-diagnostics
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 1
owner: tj
---

# FA-0.10 — Google Ads sync: martwy/zły token

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/deferred-tasks.md` — wpis "FA-0.03" z pełnym opisem znaleziska
- `src/lib/google-ads/client.ts` — `getApi()`, `getCustomer()`, `isGoogleAdsConfigured()`
- `src/lib/google-ads/fetch-campaigns.ts` — miejsce, gdzie `customer.query(...)` rzuca
- `src/app/api/cron/sync-google-ads/route.ts` — łapie błąd i zwraca tylko `err.message`, bez
  szczegółów gRPC

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
FA-0.03 naprawiło routing (`GET` zamiast tylko `POST`), ale odsłoniło osobny, wcześniej
niewidoczny problem: prawdziwe wywołanie Google Ads API kończy się błędem
`Cannot read properties of undefined (reading 'get')`, poprzedzonym w logu seriami
`No data type found for reason/domain/metadata...` — to biblioteka `google-ads-api` gubiąca
się przy dekodowaniu błędu gRPC typu `google.rpc.ErrorInfo`, którego sama nie potrafi
zdekodować. Zanim ktokolwiek będzie w stanie odświeżyć token, potrzebny jest **czytelny
komunikat błędu** zamiast tego crasha — inaczej każda kolejna diagnoza zaczyna się od zera.

## Zakres
- [ ] Odczyt bieżącego stanu: uruchom lokalnie `curl` z realnym `CRON_SECRET` (masz go w
      `.env.local`) i zapisz pełny output konsoli serwera (nie tylko treść odpowiedzi HTTP)
      — to już zostało zrobione 2026-09-03, wynik w `docs/tasks/FA-0.03.md` sekcja
      "GET z sekretem"; zacznij od przeczytania tego zanim odtworzysz test.
- [ ] W `fetch-campaigns.ts` (albo `client.ts`) opakuj wywołanie `customer.query(...)` w
      try/catch, które **przed** przepuszczeniem błędu dalej loguje surowy obiekt błędu
      (`JSON.stringify(err, Object.getOwnPropertyNames(err))` albo `err.errors` / `err.code`
      / `err.details` — sprawdź, co faktycznie oferuje typ błędu z `google-ads-api`) —
      celem jest zobaczyć **kod błędu Google** (np. `UNAUTHENTICATED`,
      `PERMISSION_DENIED`, `invalid_grant`), nie tylko to, że dekoder detali się wywalił.
- [ ] Z tym logiem uruchom ponownie curl (patrz Weryfikacja) i wklej w raporcie **surowy**
      kod błędu Google, nie tylko "nie działa".

## Gotowe, gdy
- [ ] Log serwera przy błędzie pokazuje kod/status błędu Google Ads API (np. `UNAUTHENTICATED`
      / `PERMISSION_DENIED` / konkretny numer błędu), nie tylko crash dekodera detali.
- [ ] Raport zawiera ten surowy kod błędu, wklejony z konsoli — nie interpretację.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` zielone (pełny surowy output w raporcie).

## Poza zakresem
- Samo odświeżenie/rotacja `GOOGLE_ADS_REFRESH_TOKEN` — to wymaga przejścia przez OAuth
  Google przez tj (przeglądarka, zalogowane konto reklamowe), agent tego nie zrobi.
- Zmiana zmiennych środowiskowych w Vercel.
- Zmiana logiki pobierania kampanii / mapowania `ad_campaign_defs` poza samym logowaniem błędu.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Nie zmieniaj żadnych sekretów ani zmiennych środowiskowych — ani lokalnie w `.env.local`,
  ani w Vercel. To wyłącznie diagnostyka, nie naprawa poświadczeń.
- Jeśli surowy kod błędu wskaże na konkretną przyczynę (np. wygasły refresh token) —
  **zatrzymaj się i zgłoś tj**, zamiast próbować cokolwiek naprawiać dalej; rotacja tokenu
  to osobna czynność człowieka, nie agenta.

## Weryfikacja
```
set -a; source .env.local; set +a
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3100/api/cron/sync-google-ads
# sprawdź log serwera (okno z `pnpm dev`) — szukaj kodu błędu Google, nie tylko treści crasha
pnpm typecheck && pnpm lint && pnpm build
```

## Notatki z realizacji
