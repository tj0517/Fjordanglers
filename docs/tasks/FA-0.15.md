---
id: FA-0.15
title: Własna telemetria lejka bez cookies — `web_events` (page_view / form_open / form_submit per strona)
stage: 0
status: done
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: feat/web-events
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 6
owner: tj
---

# FA-0.15 — Własna telemetria lejka bez cookies

**Skąd to zadanie (audyt lejka 5 IX 2026).** Między kliknięciem w reklamę a wysłaniem formularza
nie ma dziś wiarygodnych danych. NZ: 788 kliknięć w Ads → 42 sesje płatne w GA4 → 5 `form_start`
→ **6 zapytań w bazie** (więcej niż GA4 widzi startów). Islandia od 8 VII: 43 zapytania w bazie
przy 29 `form_start` i 113 `generate_lead` (które odpala się też na `/login` i `/dashboard`).
Przyczyna: Consent Mode v2 z domyślnym `denied` (`src/app/layout.tsx:79`) — kto odrzuci baner,
nie istnieje w Eksploracjach GA4. Geo-gating zgody dla ruchu z USA jest kuszący, ale kontroler
jest w Polsce (RODO art. 3 ust. 1 + PT art. 173) — to nie jest lever, który agent może pociągnąć.

Lever, który jest: **liczyć etapy lejka po swojej stronie, bez identyfikatora osoby** — wiersz
per zdarzenie z ścieżką, kampanią i klasą urządzenia, bez cookie, bez IP, bez user-agenta.
Same liczniki nie są danymi osobowymi i nie wymagają zgody. To wyciągnięty na wprost fragment
etapu 5 (warstwa pomiarowa), bo bez niego test Patagonii nie ma odczytu środka.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguła 1 (migracje) i 3 (warstwa danych); `docs/03-conventions.md`
- `docs/02-data-model.md`; `docs/tasks/FA-1.03.md` — `inquiry_events` (inny byt: zdarzenia zapytania, nie ruchu; nie łącz)
- `src/app/layout.tsx:74–92` — Consent Mode default; `src/components/ui/cookie-banner.tsx`
- `src/components/analytics/GclidCapture.tsx`, `src/lib/utm.ts` — skąd wziąć `utm_campaign` bez cookie (localStorage — patrz STOP)
- `src/components/inquiry/InquiryWidget.tsx` — gdzie jest otwarcie widgetu i submit (`submittingRef`)
- `src/app/api/inquiries/route.ts` — istniejący wzorzec route handlera publicznego z zod
- `docs/tasks/FA-0.05.md` „Notatki z realizacji" — lokalny stack, `db diff`, regeneracja typów

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dla każdej strony docelowej i dnia wiadomo: ile było wyświetleń, ile otwarć formularza, ile
wysłań — niezależnie od zgody na cookies, bez identyfikowania nikogo. Jeden SELECT daje lejek
środkowy per strona per dzień. Nic z tego nie trafia do Google.

## Zakres
- [ ] **Odczyt bieżącego stanu**: `select count(*) from information_schema.tables where table_name='web_events'` (0);
      otwórz widget i ustal dokładne miejsca `form_open` (pierwsze otwarcie modala / focus pierwszego pola) i `form_submit`
      (po `200` z `/api/inquiries`, ten sam guard co `trackSubmitLeadForm`).
- [ ] Migracja `supabase migration new web_events`:
      `web_events(id bigserial pk, created_at timestamptz default now(), event text check (event in ('page_view','form_open','form_submit')), path text not null, country text, utm_campaign text, utm_content text, device text check (device in ('mobile','desktop','tablet','unknown')), referrer_host text)`.
      **Bez** IP, user-agenta, gclid, e-maila, session id. Indeks `(path, created_at)`. RLS: brak SELECT dla anon; INSERT tylko przez service role w route handlerze.
- [ ] `POST /api/events` — zod, rate limit prosty (np. 60/min per ścieżka w pamięci procesu — dopuszczalny, bo to liczniki),
      `device` z `sec-ch-ua-mobile` / UA **po stronie serwera, bez zapisu UA**, `referrer_host` z nagłówka `Referer` (tylko host).
- [x] Klient: `page_view` z komponentu w layoucie strony doświadczenia i `/trips`; `/patagonia` podpięte w FA-0.14;
      `form_open`, `form_submit` z widgetu. `utm_campaign`/`utm_content` z `getStoredUtm()` — patrz STOP.
      `navigator.sendBeacon` z fallbackiem na `fetch keepalive`.
- [ ] Widok `web_funnel_daily` (zwykły VIEW): `day, path, page_views, form_opens, form_submits`.
- [ ] Regeneracja typów z lokalnej bazy; commit w tym samym PR.

## Gotowe, gdy
- [ ] Lokalnie: wejście na stronę doświadczenia z odrzuconym banerem (Decline) → 1 wiersz `page_view`; otwarcie
      widgetu → `form_open`; wysłanie → `form_submit` — SELECT z trzema wierszami w raporcie.
- [ ] **Czerwony dowód 1**: `INSERT ... event='click'` → błąd CHECK, wklejony.
- [ ] **Czerwony dowód 2**: `select * from web_events` jako `anon` → 0 wierszy / błąd RLS, wklejony.
- [ ] **Czerwony dowód 3**: `POST /api/events` z `{event:'page_view', path:'/x', ip:'1.2.3.4', ua:'…'}` → `400` (zod odrzuca nieznane pola)
      albo pola zignorowane i **nie** zapisane — dowód SELECT-em.
- [ ] `grep -n "ip\|user_agent\|useragent\|gclid\|email" supabase/migrations/*web_events*` → 0 trafień.
- [ ] `select * from web_funnel_daily where path like '/experiences/%' limit 5` zwraca kolumny `day, path, page_views, form_opens, form_submits`.
- [ ] `supabase db diff --local` → `No schema changes found`; typy zregenerowane.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Ekran w adminie czytający `web_funnel_daily` — etap 6 (na razie SELECT wystarcza).
- Zmiany w GA4/GTM, w Consent Mode i w banerze — decyzje tj poza kodem.
- Łączenie `web_events` z `inquiries` po osobie — celowo niemożliwe; nie dodawaj identyfikatora „na przyszłość".
- `inquiry_events` (FA-1.03) — inny byt.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- `db push` na produkcję — **STOP**, treść migracji + `db diff`, zgoda tj, wykonuje tj (wzorzec FA-0.05).
- **`utm_campaign` z localStorage**: `utm.ts` zapisuje UTM-y w localStorage niezależnie od zgody (wzorzec z `gclid.ts`).
  Odczyt nazwy kampanii to nie identyfikator osoby, ale jeśli tj uzna inaczej — pole zostaje `NULL` do decyzji.
  **STOP i zapytaj przed podpięciem**, nie zakładaj.
- Jakiekolwiek pole, które pozwala połączyć dwa zdarzenia jako tę samą osobę (session id, fingerprint, hash IP) — **nie dodawaj**; jeśli wydaje się potrzebne, STOP i zapytaj.

## Weryfikacja
```
supabase migration up --local && supabase db diff --local           # No schema changes found
psql … -c "insert into web_events(event,path) values ('click','/x');"   # ERROR check
psql … -c "select day,path,page_views,form_opens,form_submits from web_funnel_daily order by day desc limit 5;"
grep -n "ip\|user_agent\|gclid\|email" supabase/migrations/*web_events*   # 0
supabase gen types typescript --local > src/lib/supabase/database.types.ts
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji

### Stan bieżący przed startem (2026-09-08)

```
select count(*) from information_schema.tables where table_name='web_events';
→ 0
```

Local stack running on ports 54421–54429 (same offset as FA-0.05).

Lokalizacja `form_open` i `form_submit` w kodzie:
- `form_open` — `useEffect(() => {...}, [])` w `InquiryModal` (montuje się gdy `isOpen=true` w `InquiryWidget`); linia ~284 po zmianach
- `form_submit` — po `trackSubmitLeadForm` w `handleSubmit`, po sprawdzeniu `res.ok`; ta sama garda co `submittingRef`

### Poprawki względem pliku zadania (za tj 2026-09-08)

1. Rate limit per `path` (nie per IP) — IP nie czytany w ogóle.
2. `referrer_host` wyłącznie z nagłówka `Referer` (host, `new URL(referer).host`); brak pola `referrer` w schemacie Zod.
3. `country` = kraj destynacji, z serwera, nie geolokalizacja — `COMMENT ON COLUMN`.
4. `path` = `window.location.pathname` bez query stringu.
5. `sendBeacon` z `Blob` (type `application/json`); handler parsuje `req.text()` → `JSON.parse` co obsługuje oba typy.
6. UTM — WARIANT B: tylko `utm_campaign` i `utm_content` z `window.location.search` bieżącej strony, wyłącznie przy `page_view`; zero importów z `src/lib/utm.ts`.
7. `/patagonia` — wypadło z tej rundy (FA-0.14 było wtedy `todo`); podpięte w FA-0.14 (huby `/patagonia`, `/iceland`, `/new-zealand` mają `<WebEventTracker />` bez `country`).

### Pliki

- `supabase/migrations/20260909131403_web_events.sql` — tabela + indeks + RLS + view
- `src/app/api/events/route.ts` — POST handler (Zod strict, rate limit, device, referrer_host)
- `src/lib/web-events.ts` — `sendWebEvent()`, sendBeacon + fetch keepalive
- `src/components/analytics/WebEventTracker.tsx` — Client component, `page_view` on mount
- `src/app/experiences/[slug]/page.tsx` — dodano `<WebEventTracker country={page.country} />`
- `src/app/trips/page.tsx` — dodano `<WebEventTracker />`
- `src/components/inquiry/InquiryWidget.tsx` — `form_open` w InquiryModal mount, `form_submit` po sukcesie POST
- `src/lib/supabase/database.types.ts` — zregenerowane z lokalnej bazy
- `docs/04-open-questions.md` — O-13 (GclidCapture + localStorage + PT art. 173)
- `docs/tasks/FA-0.14.md` — notatka o podpięciu `page_view` (zdjęta w FA-0.14, gdzie `<WebEventTracker />` faktycznie wszedł na huby)

### Test E2E lokalnie — runda finalna (2026-09-09)

Serwer: `pnpm build && pnpm start` z nadpisanymi env vars na lokalny stack Supabase
(`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` i
`SUPABASE_SERVICE_ROLE_KEY` z `supabase status --output env`, `NEXT_PUBLIC_GTM_ID=GTM-DUMMY`
— aby baner cookie był widoczny w buildzie produkcyjnym).
Przeglądarka: Playwright headless (chromium). Skrypt scratch w `/tmp/pw-test/e2e-web-events.mjs` (nie w repo).

**Strona**: `/experiences/test-e2e-web-events?utm_campaign=test-a&utm_content=v1&utm_term=x&gclid=y`
(minimalna strona doświadczenia wstawiona do lokalnej bazy i usunięta po teście).

**Wynik Playwright (sieć):**
```
-> Navigating to http://localhost:3000/experiences/test-e2e-web-events?utm_campaign=test-a&utm_content=v1&utm_term=x&gclid=y
   Page loaded
-> Waiting for and clicking cookie banner Decline...
   CLICKED Decline
   declineClicked: true
-> Opening InquiryWidget...
   Clicked "Send Inquiry"
-> Skipping date selection...
   Clicked skip-dates button
-> Filling contact form...
   firstName filled / lastName filled / email filled / tripLength set to "1"
-> Submitting form...
   Clicking: Send

(a) /api/events network requests:
    [1] POST /api/events -> HTTP 204
    [2] POST /api/events -> HTTP 204
    [3] POST /api/events -> HTTP 204

(b) /api/inquiries responses:
    [1] HTTP 201: {"id":"34ec7374-09f0-4691-939e-3f462eff2088","status":"pending"}
```

Decline na banerze **KLIKNIĘTY** (`declineClicked: true`). Wynik: **3 eventy** (produkcja, bez HMR).

**SELECT po teście:**
```
 id |    event    |               path               | country | utm_campaign | utm_content | device  | referrer_host
----+-------------+----------------------------------+---------+--------------+-------------+---------+----------------
 30 | page_view   | /experiences/test-e2e-web-events | Iceland | test-a       | v1          | desktop | localhost:3000
 31 | form_open   | /experiences/test-e2e-web-events |         |              |             | desktop | localhost:3000
 32 | form_submit | /experiences/test-e2e-web-events |         |              |             | desktop | localhost:3000
(3 rows)
```

Obserwacje:
- Baner cookie pojawił się po hydratacji (`GTM_ID=GTM-DUMMY` w buildzie) — Decline kliknięty ✓
- `utm_term=x` i `gclid=y` z URL → NIE zapisane (zgodnie z projektem) ✓
- `country=Iceland` pochodzi z serwera (`experience_pages.country`), nie z geolokalizacji ✓
- `form_open` i `form_submit` → `country`, `utm_*` = NULL (wysyłane wyłącznie przy `page_view`) ✓
- `referrer_host` zapisany prawidłowo ✓

**Duplikat form_open w trybie dev (wyjaśnienie):**
Wcześniejszy test na `pnpm next dev --webpack` dał 4 zdarzenia (dwa `form_open`). Przyczyna:
webpack HMR rekompiluje moduły w trakcie testu i powoduje odmontowanie/remontowanie
`InquiryModal` przez warunek `mounted && isOpen && createPortal(...)` — drugi `form_open`
to artefakt HMR, nie StrictMode (WebEventTracker ma identyczny `useEffect(fn,[])` i
`page_view` wpadł raz, co obala hipotezę StrictMode). W produkcji (bez HMR): jeden `form_open` ✓.

**Testowa encja zapytania + usunięcie:**
```
DELETE FROM inquiries WHERE id='34ec7374-09f0-4691-939e-3f462eff2088' RETURNING id, angler_name, angler_email, status, created_at;
                  id                  | angler_name |     angler_email     | status  |          created_at
--------------------------------------+-------------+----------------------+---------+-------------------------------
 34ec7374-09f0-4691-939e-3f462eff2088 | E2E Test    | e2e-test@example.com | pending | 2026-09-09 12:51:23.281324+00
DELETE 1
```

### Smoke prod (2026-09-09)

Migracja zastosowana przez MCP `supabase-fa`, smoke test ręczny od tj:

```
 id |   event   |                      path                      | country   | utm_campaign | utm_content | device  | referrer_host
----+-----------+------------------------------------------------+-----------+--------------+-------------+---------+---------------------
  2 | form_open | /experiences/fly-fishing-bariloche-limay-manso | null      | null         | null        | desktop | www.fjordanglers.com
  1 | page_view | /experiences/fly-fishing-bariloche-limay-manso | Argentina | smoke        | 1           | desktop | www.fjordanglers.com
(2 wiersze, id 1–2)
```

`country=Argentina` z `experience_pages.country` ✓ · `utm_campaign=smoke` zapisany ✓ · `referrer_host=www.fjordanglers.com` ✓ · `form_open` → UTM i country NULL ✓

### Raport (format §5)

Patrz PR body.
