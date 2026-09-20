---
id: FA-1.10
title: Tymczasowy przegląd tygodniowy w obecnym `/admin` — 8 liczb z dzisiejszych tabel, do wyrzucenia w etapie 6
stage: 1
status: review
difficulty: M
model: sonnet
model_approved:
effort: medium-high
agent: fa-core
branch: feat/admin-weekly-review
depends_on: [FA-1.04, FA-1.05]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-1.10 — Przegląd tygodniowy (wersja brzydka, świadomie tymczasowa)

## Kontekst — przeczytaj przed startem
- `docs/REBUILD_PLAN.md` §9 „Dorzucić jeden ekran, brzydki" — **to jest to zadanie**; §7 tabele
  metryk (M1, M2, M5, M6, M7, powody przegranych) — definicje i cele; §6 — docelowy ekran
  „Przegląd tygodniowy" (etap 6), którego ten zastępuje
- `docs/01-architecture.md` §5 (pieniądze — dziś `NUMERIC` EUR, jeden kurs) i §6 (warstwa metryk
  — docelowo widoki; **tu liczymy w TypeScript świadomie, bo ekran jest tymczasowy**)
- `docs/02-data-model.md` „Known wrong-but-live" — formuła przychodu
  `offer_deposit_eur ?? deposit_amount ?? internal_commission_eur`
- `src/app/admin/finances/page.tsx` (~96–160) — dzisiejsze liczenie przychodu po miesiącach i
  kurs z `finance_settings` (`eur_pln_rate`, `usd_eur_rate`); `src/actions/finances.ts`
- `src/app/admin/ads/page.tsx` (~22–30, ~147) — `ad_campaigns.spend` (waluta? sprawdź w
  `src/lib/google-ads` i `api/cron/sync-google-ads`), dzisiejszy „spend ÷ inquiries"
- `src/lib/periods.ts`, `src/lib/business-days.ts`, `src/lib/fx.ts`, `src/lib/leadValue.ts` —
  istniejące helpery; nie dubluj
- `src/lib/inquiries/qualified.ts` (FA-1.04) — `qualified ∈ {yes,no,unknown}`;
  `docs/tasks/FA-1.04.md` — kryteria 1 i 4 odroczone **do tego zadania**; wiersze FA-1.04 w
  `deferred-tasks.md` (seed, deduplikacja zdarzeń — M5/M6 liczyć z kolumny, nie ze zdarzeń)
- `supabase/migrations/20260910111336_inquiries_lost_reason_code.sql` — siedem kodów przegranych
- `supabase/migrations/20260904210532_inquiries_source_utm.sql` — `source`, `utm`, `gclid`
  (atrybucja kanału dla M6)
- `src/app/admin/layout.tsx` — sidenav
- `supabase/seed.sql` — wpis FA-1.12 w `deferred-tasks.md` (UUID z wersją `0`) — do naprawy tu,
  bo bez seeda nie da się udowodnić liczb lokalnie

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Cotygodniowy przegląd ma się zacząć teraz, nie po etapie 6. Jedna strona `/admin/weekly`
pokazuje osiem liczb policzonych z dzisiejszych tabel, każda z definicją pod spodem i linkiem
do listy rekordów, z których wynika. Ekran zostanie wyrzucony w etapie 6 — nie inwestujemy
w wygląd, inwestujemy w **poprawność formuł** (testy) i w to, żeby `/admin/finances` i ten
ekran pokazywały tę samą prowizję.

## Decyzje tj (19 IX 2026)

### D1 — trasa
`/admin/weekly`, link w sidenav jako pierwszy. Obecny `/admin` nietknięty. Plik z komentarzem
nagłówkowym `// TEMPORARY — replaced by stage 6 Przegląd (REBUILD_PLAN §6). Delete, don't refactor.`

### D2 — prowizja: wspólny helper, ta sama formuła
`src/lib/metrics/commission.ts` — `commissionPln(rows, rates)` wyciągnięte z
`finances/page.tsx` (formuła `offer_deposit_eur ?? deposit_amount ?? internal_commission_eur`,
`deal_currency`, kurs z `finance_settings`). `finances/page.tsx` przepięte na helper — **obie
strony jedna liczba**. Test: trzy wiersze z różnymi wypełnionymi polami + jeden USD → oczekiwana
suma PLN. Poprawna definicja (`deals.commission_cents`, kurs zamrożony) — etap 4; tu wpis w
komentarzu, nie w kodzie.

### D3 — osiem liczb (z §9)
| # | Liczba | Formuła (dzisiejsze tabele) | Okno | Metryka §7 |
|---|---|---|---|---|
| 1 | Prowizja narastająco | D2, wiersze z `deposit_paid_at IS NOT NULL` | od 1 I 2026 do dziś; cel 80 000 PLN | M1 |
| 2 | Bookingi w miesiącu | `COUNT(*) WHERE deposit_paid_at` w bieżącym miesiącu (+ poprzedni obok) | miesiąc kalendarzowy | M2 |
| 3 | Zapytania w tygodniu | `COUNT(*) WHERE created_at` w tygodniu | ISO tydzień pon–nd, Europe/Warsaw; bieżący + 4 poprzednie | M5 (licznik) |
| 4 | Qualified w tygodniu | j.w. `AND qualified='yes'`; obok liczba `unknown` (żeby było widać, ile nie ocenione) | j.w. | M5 |
| 5 | Wydatek na reklamy | `SUM(ad_campaigns.spend)` w tygodniu, przeliczony na PLN (waluta `spend` — ustal odczytem, patrz Zakres) | tydzień | M6 (licznik) |
| 6 | Koszt per zapytanie / per qualified | 5 ÷ 3 oraz 5 ÷ 4, tylko zapytania z `gclid IS NOT NULL OR utm->>'utm_medium' IN ('cpc','paid')` (atrybucja) — druga para liczb dla wszystkich | tydzień | M6 |
| 7 | Konwersja narastająca | `COUNT(deposit_paid_at) ÷ COUNT(*)` dla zapytań z `created_at ≥ 1 I 2026`; **z ostrzeżeniem** w UI, że kohortowo liczy się w etapie 5 (M7) i ta liczba kłamie przy 60+ dniach wyprzedzenia | od 1 I 2026 | M7 (przybliżenie) |
| 8 | Powody przegranych | `COUNT(*) GROUP BY lost_reason_code WHERE status='lost'`, ostatnie 90 dni; `NULL` jako osobny wiersz „bez kodu" | 90 dni | powody przegranych |

Każda liczba: wartość, definicja jednym zdaniem, link do `/admin/inquiries?…` (filtr, jeśli
istnieje) albo do `/admin/finances` / `/admin/ads`.

### D4 — liczymy z kolumn, nie ze zdarzeń
M5 z `inquiries.qualified`, nie z `inquiry_events` (deduplikacja zdarzeń nierozwiązana — wpis
FA-1.04). `inquiry_events` w tym ekranie **nie** są używane; historia z FA-1.05 zasila etap 5.

## Zakres
- [ ] **Odczyt (do raportu):** waluta `ad_campaigns.spend` (kod syncu + dashboard Google Ads);
      klucze w `finance_settings`; na lokalnym stacku po naprawie seeda: `SELECT qualified,
      count(*) FROM inquiries GROUP BY 1` i rozkład `priority`/`trip_country` — **domyka
      kryterium 1 FA-1.04**.
- [ ] `supabase/seed.sql` — UUID wersji `4` (wpis FA-1.12); seed pokrywa: zapytania w 3 różnych
      tygodniach, 2 z `deposit_paid_at` (jeden USD), 3 `lost` z różnymi kodami + 1 bez kodu,
      2 z `gclid`, `ad_campaigns` w dwóch tygodniach, `qualified` yes/no/unknown.
- [ ] `src/lib/metrics/` — czyste funkcje, jedna na liczbę, wejście = wiersze, wyjście = liczba
      (+ `commission.ts` z D2, `weeks.ts` — ISO tydzień w Europe/Warsaw, użyj `periods.ts` jeśli
      pasuje). Zero zapytań do bazy w tym katalogu.
- [ ] `src/app/admin/weekly/page.tsx` — server component: jedno–trzy zapytania (`inquiries`
      z potrzebnymi kolumnami od 1 I 2026, `ad_campaigns` od 5 tygodni, `finance_settings`),
      przekazane do funkcji z `src/lib/metrics/`; tabela 8 wierszy / kafelków, bez wykresów.
      `requireAdmin()`.
- [ ] `finances/page.tsx` przepięte na `commissionPln` (D2) — bez zmiany wyświetlanej liczby
      (zrzut przed/po w raporcie).
- [ ] Sidenav: „Weekly" jako pierwsza pozycja.
- [ ] Testy Vitest na każdej funkcji z `src/lib/metrics/` (tydzień na granicy roku, brak wierszy
      → 0 nie NaN, USD → PLN, `lost_reason_code NULL`, atrybucja `gclid`/`utm`).
- [ ] **Kryterium 4 FA-1.04:** na lokalnym stacku klasyfikacja testowego zapytania przez agenta →
      `qualified='yes'` + jeden wiersz `inquiry_events` typu `inquiry.qualified_set`,
      `actor_kind='agent'` — SELECT w raporcie; wiersz FA-1.04 w `deferred-tasks.md` zamknięty;
      status FA-1.04 w `INDEX.md` bez dopisku „kryteria odroczone".
- [ ] `docs/REBUILD_PLAN.md` §9 — dopisek: „zrobione w FA-1.10, `/admin/weekly`, do usunięcia w
      etapie 6".

## Gotowe, gdy
- [ ] `/admin/weekly` na lokalnym stacku z seedem pokazuje 8 liczb; zrzut ekranu w raporcie;
      każda liczba zgadza się z ręcznym SELECT-em na tych samych danych (8 SELECT-ów w raporcie).
- [ ] Prowizja na `/admin/weekly` == prowizja na `/admin/finances` (obie z seeda, w raporcie).
- [ ] **Na czerwono:** test `commissionPln` z wierszem `deal_currency='USD'` pada, gdy przeliczenie
      USD zostanie usunięte z helpera.
- [ ] **Na czerwono:** test tygodnia dla `2026-12-31` / `2027-01-01` (ISO tydzień 53/1) pada przy
      liczeniu po roku kalendarzowym.
- [ ] Brak wierszy (pusta baza) → strona renderuje zera, nie 500 (test lub zrzut).
- [ ] Kryteria 1 i 4 z FA-1.04 udowodnione (SELECT-y w raporcie), wpis w `deferred-tasks.md`
      zamknięty.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone (lint: zero błędów, jeśli
      FA-1.08 już weszło; inaczej nie gorzej niż `main`).

## Poza zakresem
- Widoki materializowane, `metric_snapshots`, `packages/core/metrics` — etap 5.
- Kohorty (M7 poprawnie), GA4 (M8/M9), czasy z `inquiry_events` (M10–M12) — etap 5/6.
- Wykresy, filtry dat, eksport — nie; ekran leci w etapie 6.
- Zmiana formuły prowizji na poprawną — etap 4 (D2).
- Naprawa `google-ads-api` crash (wpis FA-0.10) — nie; jeśli sync nie działa, `spend` w
  tygodniu pokazuje 0 z adnotacją „ostatni sync: <data>".
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis na produkcji — STOP; odczyt produkcji tylko SELECT z hasłem na jedno polecenie, jeśli
  seed nie wystarczy do ustalenia waluty `spend`.
- Jeśli `ad_campaigns.spend` okaże się w mieszanych walutach albo bez jednoznacznej — STOP,
  pokaż, nie zgaduj kursu.
- Jeśli przepięcie `finances/page.tsx` zmienia wyświetlaną liczbę — STOP, pokaż różnicę.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- metrics
pnpm typecheck && pnpm lint && pnpm build
supabase db reset && pnpm dev   # /admin/weekly vs 8 SELECT-ów
# SELECT qualified, count(*) FROM inquiries GROUP BY 1;
# SELECT lost_reason_code, count(*) FROM inquiries WHERE status='lost' AND updated_at > now()-interval '90 days' GROUP BY 1;
# SELECT date_trunc('week', created_at AT TIME ZONE 'Europe/Warsaw'), count(*), count(*) FILTER (WHERE qualified='yes') FROM inquiries GROUP BY 1 ORDER BY 1 DESC LIMIT 5;
```

## Notatki z realizacji

## Report — FA-1.10 Tymczasowy przegląd tygodniowy `/admin/weekly`

**Model:** Sonnet 5 (`claude-sonnet-5`), effort medium-high, difficulty M. Biblioteka `src/lib/metrics/` napisana przez subagenta `fa-core` (Sonnet), zweryfikowana ponownie przeze mnie (testy, `tsc`, red proofy odtworzone ręcznie).
**Gałąź:** `feat/admin-weekly-review` odcięta od **`origin/stage-1`** (`0b8f8d7`), nie od `main`: plik zadania i FA-1.09 są tylko na `stage-1`. PR celuje w `stage-1`.
**Dowody:** wszystko w `docs/proof/FA-1.10/` (zrzuty `.png`, zrzuty tekstu `.txt`, `selects.sql/.out`, `fa-1.04-crit{1,4}.sql/.out`). Zebrane 20 IX 2026 ok. 11:30 czasu warszawskiego; seed jest liczony względem `now()`, więc konkretne tygodnie i miesiące w wynikach zależą od dnia uruchomienia.

### Done
- **Odczyt stanu (pierwszy punkt zakresu).** `ad_campaigns.spend` = `numeric(10,2)`; kod syncu zapisuje `costMicros/1e6` w walucie konta (nazwa `spendEur` myląca, `AdsClient.tsx:409` renderuje to przez `fmtPln`) — decyzja T1: PLN, bez przeliczania. Klucze `finance_settings`: `eur_pln_rate`, `usd_eur_rate` (`finances/page.tsx:134-135`, domyślne 4.25 / 0.92). Odczyt produkcji **nie** wykonany — patrz „Not done".
- **T2 — dev nie idzie na produkcję.** `.env.development.local` (URL + `ANON_KEY` + `SERVICE_ROLE_KEY` z `supabase status`, `ANTHROPIC_API_KEY` przepisany z `.env.local` bez wypisywania) + dwa zdania w README. `.gitignore` **nie wymagał zmiany**: `.env*` (linia 34) już go pokrywa — `git check-ignore -v .env.development.local` → `.gitignore:34:.env*`. Dowód przed pierwszym uruchomieniem, ładowarką Next (`@next/env`), tryb dev vs kontrola:
  ```
  next dev         -> supabase host: 127.0.0.1:54421 | is prod ref: false | RESEND_DEV_FAKE: 1
  next build/start -> supabase host: uwxrstbplaoxfghrchcy.supabase.co | is prod ref: true | RESEND_DEV_FAKE: (unset)
  ```
  Dowód na poziomie aplikacji (po starcie): log Nexta `Environments: .env.development.local, .env.local`, a `/admin/inquiries` renderuje wiersze istniejące tylko w lokalnym seedzie (`Frida Weekly`, `Gunnar Weekly`, `Nora Weekly` — `seeded-admin-inquiries.png`).
  W sesji nie były wyeksportowane żadne zmienne Supabase (sprawdzone `test -n`), więc nic nie przesłaniało pliku.
- **Seed** (`supabase/seed.sql`, dopisane po wierszach FA-1.05, które zostały nietknięte): 9 zapytań w 3 tygodniach (W0/W-1/W-2, względem `now()` w Europe/Warsaw), 2 z `deposit_paid_at` (EUR i USD), 4 `lost` (`price`, `no_guide`, `went_elsewhere` + 1 bez kodu), 2 z `gclid` + 1 z `utm_medium=cpc`, `qualified` yes/no/unknown, 5 wierszy `ad_campaigns` w dwóch tygodniach, kursy w `finance_settings`. Zastosowany przez `db reset --local` na czystych migracjach. UUID v4 (punkt z FA-1.12 był już zamknięty).
- **`src/lib/metrics/`** — `weeks.ts`, `commission.ts`, `weekly.ts` + 3 pliki testów, **60 testów**; zero zapytań do bazy, zero `as any`/`!`. Pełny zestaw: `vitest run` → 25 plików, **251 testów zielone** (na lokalnym stacku).
- **`/admin/weekly`** — `src/app/admin/weekly/page.tsx` + odczyty w `src/actions/weekly.ts` (`requireAdmin()` przed klientem serwisowym; reguła 3 zabrania `.from()` w stronie, więc zapytania siedzą w warstwie danych, nie w pliku strony). Sidenav: „Weekly" pierwszy.
- **`finances/page.tsx` przepięte na `commissionPln`/`parseFxRates`/`rowCommissionEur`**, wybór wierszy nietknięty.

**Kryteria „Gotowe, gdy":**

1. **8 liczb na lokalnym seedzie = 8 ręcznych SELECT-ów.** Zrzut: `seeded-admin-weekly.png`. SELECT-y (`selects.sql`, wynik `selects.out`) niezależne od TypeScriptu (SQL liczy tygodnie własnym `date_trunc` w Europe/Warsaw):

   | # | Strona | SELECT |
   |---|---|---|
   | 1 | 2838 zł, 3 wpłacone depozyty | `2838.00`, `3` |
   | 2 | 2 w 2026-09, 0 w 2026-08 | `2026-09 → 2` (sierpnia brak wiersza = 0; lipiec: 1) |
   | 3 | W38..W34: 2 / 3 / 4 / 0 / 0 | 2 / 3 / 4 / 0 / 0 |
   | 4 | yes/no/unknown: W38 1/0/1, W37 2/1/0, W36 1/1/2 | identycznie |
   | 5 | 0 / 300,00 / 210,00 / 0 / 0; ostatni sync 2026-09-09 | 0 / 300.00 / 210.00 / 0 / 0; `2026-09-09` |
   | 6 | W37: paid 1 zapytanie, 300 zł/zap., 300 zł/qual.; all 100 / 150; W36: all 52,50 / 210 | identycznie (wszystkie pola tabeli) |
   | 7 | 21.4% (3 z 14) | `3 / 14 / 21.4` |
   | 8 | `no_guide` 1, `price` 1, `went_elsewhere` 1, `no code` 1 | identycznie |

2. **Prowizja weekly vs finances — spełnione częściowo, decyzja tj (opcja A).** Ta sama formuła i te same wiersze wejściowe przez wspólny helper; **wybór wierszy się różni** (patrz „Needs a decision" / deferred): na seedzie z realistycznymi statusami `/admin/finances` = **1548 zł (€360,00)**, `/admin/weekly` = **2838 zł**; różnica 1290 zł = jedno zapytanie `paid` (300 € × 4,30), które filtr `status IN ('deposit_paid','completed')` pomija. Po tymczasowym ustawieniu tego zapytania na `completed` (lokalnie, cofnięte) obie strony pokazują **2838 zł** (`aligned-admin-finances.txt` → `2838 zł / €660.00`, `aligned-admin-weekly.txt` → `2838 zł of 80 000 zł`).
   **Przepięcie finances bez zmiany liczby:** `diff before-admin-finances.txt after-admin-finances.txt` → `IDENTICAL` (cała strona, także tabela miesięczna), zrzuty `before-/after-admin-finances.png`. Bramka STOP nie zadziałała.
3. **Liczby 5 i 6 w PLN wprost z kolumny** (T1), bez przeliczania; adnotacja „last sync (newest ad_campaigns row)" pokazuje `2026-09-09`, a przy pustej tabeli `no data`. Skala `spend` na produkcji **niezweryfikowana**.
4. **Na czerwono — USD** (odtworzone ręcznie: linia `return amt` zamiast konwersji w `rowCommissionEur`):
   ```
   × converts USD rows with usdEur and leaves other currencies alone
   × sums rows with different filled fields plus one USD row      AssertionError: expected 380 to be 280
   × reproduces the /admin/finances inline formula to the last bit AssertionError: expected 955.2724999999999 to be 920.8577
   × counts only paid rows on or after `since`, USD converted
   ```
   Po przywróceniu: 60/60 zielone.
5. **Na czerwono — tydzień 53/1.** **Poprawka założenia:** 2026-12-31 (czw) **i** 2027-01-01 (pt) należą do tego samego ISO tygodnia **2026-W53** (pon 28 XII – niedz 3 I); W01 2027 zaczyna się 4 I. Test zatem sprawdza: oba dni → `2026-W53`, 2027-01-04 → `2027-W01`, plus krawędzie stref (`2026-09-20T22:30:00Z` → poniedziałek W39 w Warszawie, `2026-12-27T23:30:00Z` → W53). Klucz po roku kalendarzowym (odtworzone ręcznie):
   ```
   × puts 2026-12-31 and 2027-01-01 both in ISO 2026-W53      expected '2027-W53' to be '2026-W53'
   × starts 2027-W01 on Monday 2027-01-04, zero-padded
   × buckets a plain date without timezone shifting
   Tests  3 failed | 57 passed (60)
   ```
6. **Pusta baza → zera, nie 500:** po `TRUNCATE inquiries, ad_campaigns, finance_settings CASCADE` (lokalnie) `/admin/weekly` → **HTTP 200**, wszystkie liczby `0`, ostatni sync `no data`, kursy domyślne 4.25 / 0.92, brak `NaN`/`Infinity` (`empty-admin-weekly.png/.txt`, `grep` po `NaN|Infinity|undefined|Application error` → pusty).
7. **FA-1.04 kryteria 1 i 4.**
   - Kryterium 1 (`fa-1.04-crit1.out`, zasiany stack, 14 zapytań): `qualified`: `no 2 / unknown 8 / yes 4`; `priority`: `(null) 7 / high 3 / medium 2 / not_viable 2`; `trip_country`: `(null) 8 / Iceland 3 / New Zealand 1 / Norway 1 / Spain 1`; zgodność z O-10: 4 wiersze `yes` = 4 wiersze spełniające O-10, 2 wiersze `no` = 2 × `not_viable`, 0 rozjazdów.
   - Kryterium 4 (`fa-1.04-crit4.out`): `POST /api/inquiries` → agent Round 1 (prawdziwe wywołanie Anthropic: `country: Iceland, priority: low`) → `qualified='yes'`, `qualified_set_by='agent'`, **dokładnie jeden** `inquiry.qualified_set` z `actor_kind='agent'`, payload `{"rule":"O-10","value":"yes"}`.
   - Wiersze FA-1.04 w `deferred-tasks.md` zamknięte (skreślony „Kryteria 1 i 4", wiersz o duplikatach zdarzeń uzupełniony), `INDEX.md` bez dopisku „kryteria odroczone", komentarz w frontmatterze `FA-1.04.md` usunięty.
8. **`typecheck` / `test` / `build` zielone; lint nie gorzej:**
   - `tsc --noEmit` → rc 0; `vitest run` → 251/251; `next build` (stack zatrzymany, sprawdzone `docker ps --filter label=…fjordanglers` → 0) → `Compiled successfully`, `/admin/weekly` na liście tras.
   - `eslint`: **przed** (baza `origin/stage-1`, przed zmianami): **117 problemów (40 błędów, 77 ostrzeżeń)**; **po**: **117 (40 / 77)**; pliki dotknięte tym zadaniem: 0 problemów. `git status` przed pomiarem czysty.
   - Uwaga: `pnpm` przerywa się na `ERR_PNPM_IGNORED_BUILDS` (wiersz FA-1.09 w deferred), więc użyte `./node_modules/.bin/{tsc,vitest,eslint,next,supabase}` — te same polecenia co skrypty z `package.json`.
9. **`docs/REBUILD_PLAN.md` §9** — dopisek „zrobione w FA-1.10, `/admin/weekly`, do usunięcia w etapie 6" (akapit „Dopisek 20 IX").

### Not done
- **Odczyt produkcji (skala `ad_campaigns.spend`, bramka STOP T1)** — MCP Supabase: „no permission", w sesji brak hasła bazy. T1 opiera się na kodzie i decyzji tj, nie na odczycie. Wiersz w `deferred-tasks.md`.
- **Kryterium 2 w brzmieniu dosłownym** (dwie strony pokazują to samo na uczciwym seedzie) — świadomie, opcja A; patrz wyżej i „Needs a decision".
- **Przebieg agenta bez stubu poczty** — `src/lib/email.ts` nie ma trybu dev-fake, a `runAgentRound1` wysyła mail **przed** zapisem klasyfikacji: pierwsza próba z fałszywym kluczem Resend (`401 API key is invalid`) przerwała rundę (`qualified='unknown'`, `agent_round=0`); tę próbę usunąłem. Udany przebieg (dowód kryterium 4) poszedł z preloadem `NODE_OPTIONS=--require`, który odpowiada `200` tylko na `fetch` do `api.resend.com` (3 wywołania przechwycone, żadne nie wyszło); Anthropic i Supabase prawdziwe/lokalne. Kod repo nietknięty.
- Liczba zapytań na stronie: **4 zamiast „jedno–trzy"** — czwarte (`ORDER BY date DESC LIMIT 1`) daje datę ostatniego syncu także wtedy, gdy okno 5 tygodni jest puste.
- Zrzuty ekranu są plikami `.png` w repo (`docs/proof/FA-1.10/`, ~1,1 MB łącznie), nie wklejone do treści PR.

### Noticed, not touched (→ `docs/deferred-tasks.md`, wiersze „FA-1.10")
- `/admin/finances` pomija status `paid` i `handed_over` (filtr sprzed FA-1.03) + drugi rozjazd (miesiąc UTC z fallbackiem na `updated_at` vs Warszawa) — `finances/page.tsx:99`.
- `spendEur`/`avgCpcEur` to PLN (T1) — `fetch-campaigns.ts:61`.
- `email.ts` bez dev-fake + wysyłka poprzedza zapis klasyfikacji w `runAgentRound1`.
- Agent wstawia wiadomość wychodzącą bez `message.sent` (reguły 5 i 8) — zapytanie testowe ma tylko `inquiry.created` i `inquiry.qualified_set`.
- `dev.sh` eksportuje produkcyjne `.env.local` do powłoki; zmienne procesu wygrywają z każdym `.env*` (README opisuje zasadę).
- `commissionPln` na float-euro = świadomy wyjątek od reguły 6 (etap 4).
- Skala `spend` na produkcji nieodczytana.

### Needs a decision
- **Filtr wierszy w `/admin/finances`.** Rozstrzygnięte przez tj w tej sesji: **opcja A** — zostaje, gap zaraportowany, poprawka jako zadanie S. Do decyzji na później: kiedy zrobić to zadanie S (zmieni wyświetlaną liczbę na produkcji), skoro na prod `deposit_paid_at` jest dziś puste dla wszystkich 99 zapytań i do pierwszej wpłaty po stage-1 oba ekrany pokażą ~0.
- **Dodatek do T2 poza wymienioną listą:** `.env.development.local` zawiera też `RESEND_API_KEY` (atrapa), `RESEND_DEV_FAKE=1`, `AI_AUTO_REPLY_ENABLED=true`, `NEXT_PUBLIC_APP_URL=http://localhost:3000` — bo `.env.local` niesie produkcyjny klucz Resend, a `/api/inquiries` wysyła pocztę bez dev-fake. Jeśli nie chcesz tych czterech linii, usuń je z pliku (lokalny, gitignorowany).
- **Zrzuty w repo:** zostawić `docs/proof/FA-1.10/*.png` w PR czy usunąć przed merge (rekomendacja: zostawić do review, usunąć przy merge do `main`).

### Verification
```
git status                                  → czysty przed pomiarem lint
eslint (przed, base stage-1)                → ✖ 117 problems (40 errors, 77 warnings)
supabase start -x studio,imgproxy,mailpit,logflare,vector,edge-runtime,realtime,storage-api,postgres-meta
supabase db reset --local                   → migracje + seed OK
vitest run src/lib/metrics                  → 60 passed
vitest run                                  → 25 files, 251 passed
tsc --noEmit                                → rc 0
eslint (po)                                 → ✖ 117 problems (40 errors, 77 warnings); pliki FA-1.10: 0
supabase stop → docker ps --filter label=…  → 0 kontenerów FA
next build                                  → ✓ Compiled successfully; ƒ /admin/weekly
red (a) USD usunięte z helpera              → 4 testy padają (wyżej), po przywróceniu 60/60
red (b) tydzień po roku kalendarzowym       → 3 testy padają (wyżej), po przywróceniu 60/60
```
Uwaga środowiskowa: zrzuty zrobiono Playwrightem z Chromium z cache; brakujące biblioteki systemowe (`libnss3`, `libnspr4`, `libasound2`) pobrane przez `apt-get download` + `dpkg -x` do katalogu tymczasowego sesji — bez `sudo` i bez zmian w systemie.
