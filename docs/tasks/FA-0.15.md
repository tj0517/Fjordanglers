---
id: FA-0.15
title: Własna telemetria lejka bez cookies — `web_events` (page_view / form_open / form_submit per strona)
stage: 0
status: todo
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
- [ ] Klient: `page_view` z komponentu w layoucie strony doświadczenia i `/trips`, `/patagonia` (po FA-0.14);
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
