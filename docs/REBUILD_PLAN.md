# FjordAnglers — plan przebudowy architektury, schematu i panelu admina

**Wersja 2 · 31 sierpnia 2026** — v1 (architektura + schemat) rozszerzona o warstwę pomiarową i przebudowę panelu admina pod wszystkie metryki z tablicy FigJam.

Źródła: audyt aplikacji (`claude/rebuild-audit-app-aug-2026.md`), audyt bazy (`claude/rebuild-audit-db-aug-2026.md`), tablica FigJam `4AJ1JFSfj0tQcKDiVTKvsY` (audyt 25 VIII 2026), Notion „Fjordanglers – Plan Q4 2026" + 5 projektów, `head/05-brand-identity-and-metrics.md`, notatki planu finansowego i audytu Google Ads.

Ustalenia wejściowe: fundament to **model agencyjny** (zapytanie → kwalifikacja AI → oferta FA → depozyt na konto FA → prowizja), kod w **monorepo** (`packages/db` + `packages/core` + `apps/web` + `apps/admin`), **dashboard przewodnika zostaje** w odchudzonej formie, **wszystkie metryki mają być w panelu admina**.

---

## 0. Co zmienia wersja 2

v1 odpowiadała na pytanie „jak posprzątać kod i schemat". Po audycie metryk widać, że to za mało: **osiem z dwudziestu pięciu metryk z tablicy to metryki czasu i przejść**, a w bazie nie ma zapisu tego, *kiedy co się stało*. Nie da się ich policzyć wstecz — czasu do oferty za wrzesień nie odtworzysz w listopadzie. Stąd trzy zmiany:

1. **Rejestrator zdarzeń wchodzi wcześnie** — do etapu 1, jako zapis bez interfejsu, zanim powstanie cokolwiek, co go czyta. Historia zaczyna się narastać od pierwszego dnia przebudowy, nie od jej końca.
2. **Warstwa pomiarowa jest osobnym etapem** (5), a nie funkcją dopisaną do ekranów. Jedno miejsce z definicjami metryk, widoki liczone nocą, snapshoty dla danych spoza bazy.
3. **Panel admina dostaje własny etap** (6) z siedmioma ekranami, z czego dwa są nowe (`destinations`, `quality`), a `/admin` przestaje być listą kafelków i staje się ekranem cotygodniowego przeglądu — czyli zadaniem #24 z tablicy, tylko wykonanym raz, w kodzie, zamiast co tydzień w Excelu.

Reszta v1 (monorepo, wycięcie martwego kodu, rozbicie `inquiries`) zostaje bez zmian merytorycznych; zmienia się numeracja etapów.

---

## 1. Diagnoza w skrócie

Repo ma jeden zdrowy kręgosłup — `guides → experience_pages (+options) → inquiries → lead_messages / unmatched_messages` — obudowany dwiema warstwami gruzu. Pierwsza to schemat „marketplace" z kwietnia (`bookings` z 58 kolumnami, `payments`, `booking_messages`, sześć tabel kalendarza, `audit_log`, PostGIS), do którego kod już się nie odwołuje albo odwołuje wyłącznie z martwych modułów. Druga to dryf: tabele i kolumny robione w dashboardzie bez migracji (`inquiry_trip_details`, `guide_unavailable_dates`), typy Supabase z 28 maja, `as any` w 31 plikach, ~10 tys. linii nieimportowanego kodu. Do tego brak autoryzacji w server actions i kilka złamanych ścieżek na produkcji.

Do celów pomiarowych dochodzi trzecia luka: **system rejestruje stany, nie zdarzenia**. Wie, że zapytanie ma status `deposit_paid`, nie wie, kiedy przeszło przez `offer_sent`, kto je popchnął ani ile razy ktoś musiał w nie kliknąć. Pięć z dziesięciu statusów ustawia dziś człowiek ręcznie, więc nawet stan bywa niezgodny z rzeczywistością (`status` i `offer_sent_at` rutynowo się rozjeżdżają).

Werdykt bez zmian: **nie od zera**. Rdzeń domeny jest dobry i ma w sobie historię biznesową, której nie da się odtworzyć.

---

## 2. Co panel ma odpowiadać

Tablica FigJam definiuje dziesięć sekcji, każdą z pytaniem „po co", metryką i celem. Panel admina ma być miejscem, w którym na każde z tych pytań pada liczba — nie po to, żeby ładnie wyglądało, tylko dlatego, że zadanie #24 przewiduje **cotygodniowy przegląd od 1 IX**, a przegląd bez jednego źródła prawdy zamienia się w godzinę składania Excela.

| Sekcja | Pytanie | Cel z tablicy |
|---|---|---|
| Finances | Czy rok się spina? | 80 000 PLN prowizji do 31 XII 2026 (23 000 jest); 16 bookingów/mies. przy dzisiejszych ~13 |
| Marketing | Czy popyt jest tani? | 50–54 qualified requests/mies.; ~7 USD za request; < 24 USD za booking (< 10% opłaty) |
| Request Management | Czy popyt zamienia się w podaż? | 30% konwersji request → booking |
| Guide Partner Mgmt | Czy przewodnicy nadążają? | Czas do oferty < 3 dni (otwarte: 24 h dla 30% konwersji); pokrycie 90%; negatywne < 5% wyjazdów przewodnika |
| Platform / Tech | Czy rośniemy bez dokładania godzin? | ≤ 2 ręczne dotknięcia na booking; system przewodników live; intake + oferty z systemu |
| New Destinations | Czy zima ma co sprzedawać? | 3 zimowe destynacje live do **30 IX**; min. 3 aktywnych przewodników na destynację; < 6 tygodni od kontaktu do live |
| Trust & Safety | Czy klienci wracają zadowoleni? | Mierzone **31 III 2027**, nie 31 XII: review rate 75%, 90% ocen 4+, < 5% incydentów, 20+ opinii |
| Branding | Czy wyglądamy jak firma, która przetrwa? | Style book wdrożony, nowa strona live, konwersja odwiedzający → zapytanie 3% |
| Brand Partnerships | Czy da się rosnąć bez ad spendu? | 20 pitchy, 2 podpisane, 1 zrealizowane — tylko jeśli zima idzie zgodnie z planem (bramka 15 X) |
| Legal | Czy to jest legalne? | Binarnie: spółka, audyt prawny, umowy, przeszłość, model depozytowy |

Cztery definicje trzeba przesądzić **zanim** cokolwiek liczymy, bo dziś każda liczba w Google Ads, w Notion i w panelu znaczy co innego:

- **Booking** = zapłacony depozyt (`payments.kind='deposit' AND status='paid'`), datowany `paid_at`. Nie „oferta wysłana", nie „status przestawiony ręcznie". Prowizję inkasujecie przy depozycie, więc to jedyny twardy moment.
- **Qualified request** = zapisane pole `inquiries.qualified`, ustawiane przez agenta (`priority ≠ not_viable` + obsługiwany kraj) z możliwością ręcznej korekty. Nigdy liczone w locie — zmiana promptu nie może przesuwać historii. 39 starszych wierszy bez klasyfikacji oznaczamy jako `unknown` i wykluczamy z zakresu.
- **Live destination** = definicja z tablicy: ≥ 3 przewodników ze statusem `active`, materiały wgrane, opublikowana oferta. Trzy warunki sprawdzalne zapytaniem, nie ocena.
- **Waluta** — cel w PLN, deale w EUR, ads w PLN, ekonomia jednostkowa na tablicy w USD. Zasada: kwota w centach + waluta + **kurs zamrożony w momencie zdarzenia**; przeliczenie na PLN wyłącznie w prezentacji.

---

## 3. Docelowa architektura

### 3.1 Układ monorepo

```
fjordanglers/
├── apps/
│   ├── web/                # fjordanglers.com — strona publiczna, strony tokenowe, portal przewodnika, webhooki
│   │   └── src/app/
│   │       ├── (marketing)/   # /, /trips, /experiences/[slug], /guides, /guides/[slug], /about, /blog, /legal/*, /lp/[slug]
│   │       ├── (angler)/      # /offers/[token], /reviews/[token], /inquiry/[id]/confirmed
│   │       ├── (guide)/       # /login, /dashboard/* (przypisania, kalendarz, zdjęcia, profil)
│   │       └── api/           # /api/inquiries, /api/webhooks/{stripe,resend,whatsapp}
│   └── admin/              # admin.fjordanglers.com — CRM, back-office, WSZYSTKIE metryki
│       └── src/app/
│           ├── (review)/      # / — przegląd tygodniowy
│           ├── (crm)/         # /inquiries, /inquiries/[id], /unmatched
│           ├── (analytics)/   # /pipeline, /finances, /ads, /quality
│           ├── (supply)/      # /destinations, /guides, /applications, /forms
│           ├── (content)/     # /experiences, /photos
│           └── api/cron/      # sync-google-ads, sync-ga4, refresh-metrics, fx-rates
├── packages/
│   ├── db/                 # jedyne miejsce, które zna Supabase: migracje, typy, klienci, zod
│   ├── core/               # domena: repozytoria, use-case'y, guardy, maszyna stanów, rejestrator zdarzeń
│   │   ├── auth/  inquiries/  offers/  payments/  messaging/  agent/
│   │   ├── guides/  experiences/  destinations/  quality/
│   │   ├── events/            # emitEvent(), typy zdarzeń, aktorzy
│   │   └── metrics/           # KATALOG DEFINICJI — jedno miejsce, w którym metryka ma formułę
│   ├── ui/                 # tokeny marki, prymitywy, preset Tailwind, komponenty wykresów
│   └── config/             # eslint, tsconfig, prettier
├── services/
│   └── whatsapp-bridge/    # bez zmian na start; docelowo do wygaszenia
└── CLAUDE.md               # przepisany pod rzeczywistość
```

### 3.2 Zasady warstwy danych

Aplikacje nigdy nie wołają Supabase bezpośrednio. `apps/*` importują wyłącznie z `@fa/core`. Reguła egzekwowana ESLintem: `@supabase/*` tylko w `packages/db`, `.from(` tylko w `packages/core`.

Każdy use-case mutujący dane zaczyna się od guarda (`requireAdmin()` / `requireGuide()` / `requireToken()`), dopiero potem repozytorium dostaje klienta service-role. Server actions w `apps/*` to jednolinijkowe wrappery. Autoryzacja siedzi przy danych, nie w layoucie — dziś 28 akcji w `inquiries.ts` zapisuje bez żadnego sprawdzenia, kto woła.

**Każda mutacja domenowa emituje zdarzenie.** To nie jest opcjonalny dodatek do repozytorium, tylko jego część: `transition()`, `assignGuide()`, `sendOffer()`, `recordPayment()` zapisują zmianę i zdarzenie w jednej transakcji. Jeśli zdarzenie da się pominąć, prędzej czy później zostanie pominięte i metryka skłamie.

Typy generowane w CI z migracji, `as any` zakazane lintem w `packages/core`.

### 3.3 Maszyna stanów zapytania

Dziesięć statusów zostaje (to Wasz język operacyjny), ale przejścia przestają być dowolne. `packages/core/inquiries/state.ts` definiuje dozwolone przejścia; każde idzie przez `transition(inquiryId, to, { actor, reason })` — niezależnie od tego, czy wywołał je webhook, agent, czy człowiek w `StatusChanger`. `stage_reached` przestaje być drugą prawdą utrzymywaną triggerem i staje się cache'em liczonym ze zdarzeń.

```
pending ─▶ in_negotiation ─▶ waiting_for_guide_offer ─▶ offer_sent ─▶ waiting_for_deposit ─▶ deposit_sent ─▶ deposit_paid ─▶ completed
   └──────────┴──────────────────┴──────────────────────┴─────────────┴──────────────────────┴───────────────┴──▶ lost | cancelled
```

---

## 4. Warstwa pomiarowa

Cztery elementy, każdy z jasną rolą. Zasada nadrzędna: **to, co da się wyliczyć ze zdarzeń, liczy się ze zdarzeń; to, czego nie ma w bazie, wchodzi snapshotem; nic nie jest wpisywane ręcznie dwa razy.**

### 4.1 Rejestrator zdarzeń — `inquiry_events`

Kręgosłup wszystkiego, co dotyczy czasu, lejka i pracy własnej.

```sql
inquiry_events (
  id           UUID PRIMARY KEY,
  inquiry_id   UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,                    -- katalog: załącznik C
  from_status  TEXT, to_status TEXT,             -- tylko dla type='status.changed'
  actor_kind   TEXT NOT NULL CHECK (actor_kind IN ('admin','guide','system','agent','angler')),
  actor_id     TEXT,                             -- uid admina, id przewodnika, null dla system/agent
  payload      JSONB NOT NULL DEFAULT '{}',
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON inquiry_events (inquiry_id, occurred_at);
CREATE INDEX ON inquiry_events (type, occurred_at DESC);
CREATE INDEX ON inquiry_events (actor_kind, actor_id, occurred_at DESC);
```

Tabela jest **append-only** — brak UPDATE i DELETE w politykach. `occurred_at` jest osobno od `created_at`, żeby dało się wprowadzić zdarzenie historyczne (np. import) bez fałszowania momentu zapisu.

Kluczowa definicja: **ręczne dotknięcie** = zdarzenie z `actor_kind='admin'` o typie z listy „akcji" (wysłanie wiadomości, zmiana statusu, przypisanie przewodnika, edycja oferty, wysłanie linku do depozytu). Odczyty i wejścia na stronę nie są dotknięciem. Metryka M11 to liczba takich zdarzeń na zapytanie zakończone depozytem.

### 4.2 Snapshoty — `metric_snapshots`

Dla wszystkiego, czego baza nie zna: GA4, Instagram, liczniki z Notion, wpisy ręczne.

```sql
metric_snapshots (
  id           UUID PRIMARY KEY,
  metric_key   TEXT NOT NULL,                    -- 'ga4.sessions', 'ga4.new_users', 'ig.followers', 'brands.pitched'
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  granularity  TEXT NOT NULL CHECK (granularity IN ('day','week','month')),
  value        NUMERIC NOT NULL,
  unit         TEXT,                             -- 'count','seconds','ratio','pln'
  source       TEXT NOT NULL CHECK (source IN ('ga4','manual','instagram','google_ads','notion')),
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  note         TEXT,
  UNIQUE (metric_key, period_start, granularity, source)
);
```

`UNIQUE` pozwala na idempotentny upsert z crona — powtórzone pobranie tego samego dnia nadpisuje, nie duplikuje. Wpisy ręczne (`source='manual'`) mają w panelu jeden mały formularz; nie budujemy pod nie osobnego modułu.

### 4.3 Kursy walut — `fx_rates`

```sql
fx_rates (date DATE, base TEXT, quote TEXT, rate NUMERIC, PRIMARY KEY (date, base, quote));
```

Codzienny cron z NBP albo ECB. `deals` zamraża `fx_rate_pln` w momencie rozpoznania prowizji — dzięki temu suma narastająca do 80 000 PLN nie zmienia się przy każdym ruchu kursu, co przy celu rocznym w innej walucie niż przychód jest warunkiem tego, żeby licznik w ogóle miał sens. Dziś `finance_settings` trzyma jeden kurs jako pojedynczą wartość, więc historia przelicza się wstecz.

### 4.4 Widoki — liczone nocą, czytane natychmiast

Panel nie liczy metryk w TypeScripcie przy każdym wejściu. Sześć widoków materializowanych, odświeżanych cronem o 5:00 (przed przeglądem, po nocnym syncu Ads i GA4):

| Widok | Ziarno | Co zawiera |
|---|---|---|
| `mv_inquiry_facts` | zapytanie | wszystkie znaczniki czasu wyliczone ze zdarzeń (utworzenie, kompletny brief, przypisanie, oferta przewodnika, wysyłka oferty, depozyt, zakończenie), długości odcinków, liczba ręcznych dotknięć, kanał, qualified, destynacja, przewodnik |
| `mv_weekly_metrics` | tydzień × metryka | wszystkie metryki tygodniowe w jednej długiej tabeli (`week_start, metric_key, value`) — jedno źródło dla przeglądu i wykresów |
| `mv_monthly_cohorts` | miesiąc zapytania | liczba zapytań, ile zbookowało w 30/60/90 dniach i ostatecznie, przychód kohorty, koszt kohorty |
| `mv_guide_performance` | przewodnik | mediana czasu do oferty, liczba wyjazdów, odsetek negatywnych opinii, wskaźnik akceptacji przypisań, aktywność |
| `mv_destination_status` | destynacja | liczba aktywnych przewodników, opublikowane oferty, materiały, wynik trzech warunków live, tygodnie od pierwszego kontaktu |
| `mv_channel_costs` | tydzień × kampania | wydatek, zapytania, qualified, bookingi, koszt per qualified, koszt per booking |

`mv_inquiry_facts` jest tu bazą dla pozostałych — jedna definicja „kiedy zaczyna się zegar czasu do oferty" obowiązuje wszędzie.

### 4.5 Katalog definicji — `packages/core/metrics`

Jeden plik na rodzinę metryk, w każdym: klucz, nazwa PL/EN, jednostka, formuła (SQL albo funkcja na widoku), cel, źródło, właściciel sekcji z tablicy. Panel, ewentualny raport tygodniowy na maila i każdy przyszły eksport czytają stąd. Bez tego za trzy miesiące „konwersja" na `/admin/pipeline` i „konwersja" w podsumowaniu miesiąca będą dwiema różnymi liczbami — co jest dokładnie tym, co dziś robi Google Ads, licząc jedno zdarzenie trzema akcjami konwersji i zawyżając wynik ~2,7×.

---

## 5. Docelowy schemat bazy

Konwencje: kwoty jako `INTEGER` w centach + `currency`, `created_at`/`updated_at` wszędzie, FK z jawnym `ON DELETE`, RLS i polityka na każdej tabeli, bez prefiksów `offer_*` upchanych na cudzej tabeli.

### 5.1 Rdzeń domeny (z v1, bez zmian)

```sql
inquiries (
  id, created_at, updated_at,
  customer_id           → customers.id,
  experience_id         → experiences.id (nullable),
  destination_id        → destinations.id,
  guide_id              → guides.id,                    -- z wyprawy, denormalizacja
  assigned_guide_id     → guides.id, assigned_at, guide_acceptance, guide_offer_eta,
  angler_name, angler_email, angler_phone, angler_country,
  requested_dates DATE[], party_size, trip_length, message,
  source ('web_form'|'ads_landing'|'manual'|'email'|'whatsapp'), gclid, utm JSONB,
  trip_country, trip_type, priority,                    -- klasyfikacja agenta
  qualified BOOLEAN, qualified_reason TEXT, qualified_set_by TEXT,
  brief JSONB, brief_completed_at,                      -- dawne inquiry_trip_details
  trip_start_date, trip_end_date,
  agent_status, agent_round, email_thread_message_id,
  status, stage_reached, lost_reason, next_action, last_contact_at,
  internal_notes
)

offers   (id, inquiry_id, version, status, token UNIQUE, token_expires_at, sent_at,
          accepted_at, declined_at, total_cents, deposit_cents, currency,
          options JSONB, selected_option_id, trip_plan, notes, inclusions JSONB,
          what_to_bring JSONB, questions JSONB, answers JSONB, license_heading,
          license_info, refund_reason, location, location_lat, location_lng,
          location_zoom, location_geojson JSONB, photos JSONB, schedule JSONB)

payments (id, inquiry_id, offer_id, kind ('deposit'|'balance'|'refund'),
          provider, provider_session_id, provider_payment_intent_id,
          amount_cents, currency, status, paid_at, metadata JSONB)

deals    (inquiry_id PK, offer_id, total_cents, commission_cents, currency,
          fx_rate_pln, recognized_at, closed_at, notes)
```

### 5.2 Nowe tabele pod pomiar

```sql
-- Tożsamość klienta: bez niej nie ma metryki powracających (M4)
customers (id, email_normalized UNIQUE, name, phone, country,
           first_inquiry_at, created_at)

-- Destynacje jako byt, nie tekst w kolumnie country (M18–M20)
destinations (id, slug, name, country, region,
              season ('winter'|'summer'|'all'),
              status ('planned'|'building'|'live'|'paused'),
              first_contact_at, target_live_at, live_at, created_at)

guide_destinations (guide_id, destination_id,
                    status ('candidate'|'vetted'|'active'),
                    vetted_at, PRIMARY KEY (guide_id, destination_id))

-- Binarki prawne i brandingowe na jednym ekranie (M21–M22)
checklist_items (id, group_key ('legal'|'branding'|'compliance'), key, label,
                 done BOOLEAN, done_at, reviewed_at, note, sort_order)

-- Incydenty: reklamacje, zwroty, sprawy bezpieczeństwa (M16)
incidents (id, inquiry_id, kind ('complaint'|'refund'|'safety'), severity,
           description, opened_at, resolved_at, created_by)

inquiry_events   -- §4.1
metric_snapshots -- §4.2
fx_rates         -- §4.3
```

### 5.3 Zmiany w istniejących tabelach

`experiences` (po rename z `experience_pages`) dostaje `destination_id` i `max_guests`. `guides` traci Stripe Connect, IBAN-y, `calendar_disabled`/`calendar_mode`, `average_rating`/`total_reviews` (liczone z `reviews`); dostaje `season_from`/`season_to`. `guide_unavailable_dates` staje się `guide_blocked_dates(guide_id, date_from, date_to, reason)` — zakresy zamiast wiersza na dzień, co jest jednocześnie warunkiem policzenia pokrycia (M13). `lead_messages` → `messages` + `external_id UNIQUE` (deduplikacja obu ścieżek wejścia) + `thread_id`. `leads` → `guide_applications` z `first_contact_at`. `ad_campaign_defs` dostaje `destination_id`, żeby koszt per destynacja nie był hardkodowany. `reviews` dostaje jawny `guide_id` i `inquiry_id`.

### 5.4 Do skasowania

Po `pg_dump` i eksporcie `guide_submissions` do JSON w `packages/db/archive/`: `bookings`, `booking_messages`, stary `payments`, `guide_calendars`, `calendar_blocked_dates`, `calendar_experiences`, `experience_availability_config`, `experience_blocked_dates`, `guide_weekly_schedules`, `audit_log`, `experience_images`, `guide_images`, `guide_accommodations`, `experience_accommodations`, `inquiry_messages`, `guide_submissions`, `inquiry_trip_details` (po przeniesieniu do `brief`), legacy `experiences`. Funkcje `search_trips_near`, `get_licenses_for_point`, `import_license_zone` i rozszerzenie PostGIS. Enumy `booking_status`, `payment_status`, `trip_inquiry_status`.

---

## 6. Panel admina — siedem ekranów

Zasada układu: **jeden ekran na jedno pytanie biznesowe**, a nie jeden ekran na jedną tabelę. Każda liczba na każdym ekranie ma klucz z katalogu `packages/core/metrics` i klikalne przejście do listy rekordów, z których powstała — metryka bez możliwości zejścia do wierszy jest nieweryfikowalna i po pierwszym zaskoczeniu przestaje być używana.

### 6.1 `/` — Przegląd tygodniowy (nowy kształt `/admin`)

To jest zadanie #24 zamienione w ekran. Selektor tygodnia (pon–niedz), domyślnie ostatni zamknięty.

**Górny pas — cztery liczby roku.** Prowizja narastająco do 80 000 PLN z paskiem postępu i linią potrzebnego tempa; pod spodem druga linia: ile z tego dotyczy wyjazdów kończących się po 31 XII (bo sekcja Trust & Safety sama zauważa, że zimę bookuje się X–XII, a realizuje I–III — to jest gotówka zainkasowana, ale usługa niewykonana). Bookingi w miesiącu vs 16. Qualified requests w tygodniu vs 12–13. Koszt akwizycji jako % opłaty vs 10%.

**Środek — cztery wykresy tygodniowe** (13 tygodni): bookingi, qualified requests, koszt per qualified request, mediana czasu do oferty. Każdy z linią celu.

**Dół — kolejki do działania**, czyli to, po co się na ten ekran wchodzi w środku tygodnia: zapytania bez przypisanego przewodnika, zapytania z ofertą starszą niż 3 dni bez odpowiedzi, nieprzypisane wiadomości przychodzące, oferty wygasające w ciągu 48 h, destynacje z brakującym warunkiem live. Każda pozycja to link do rekordu.

**Pasek binarek** — pięć pozycji prawnych i dwie brandingowe z datą ostatniego przeglądu.

### 6.2 `/pipeline` — lejek, konwersja, czasy

Lejek od ruchu do depozytu: sesje (GA4) → zapytania → qualified → oferta wysłana → depozyt zapłacony, z konwersją między każdą parą i z możliwością filtrowania po kraju, kanale i destynacji.

**Kohorty konwersji** — tabela miesięcy zapytań z kolumnami „zbookowało w 30 / 60 / 90 dniach / ostatecznie". To jest najważniejszy pojedynczy widok w całym panelu i jednocześnie ten, którego dziś nie ma: naiwne „bookingi w tym miesiącu ÷ zapytania w tym miesiącu" kłamie, bo Wasze własne dane pokazują, że wygrane mają 60+ dni wyprzedzenia (20 zapytań z wyprzedzeniem 60+ dni → 3 wygrane; 10 zapytań z wyprzedzeniem ≤ 7 dni → 0 wygranych). Bez kohort nie da się odpowiedzieć, czy wrześniowa reklama się zwróciła.

**Czasy** — mediana i rozkład (nie średnia; jeden wyjazd czekający miesiąc niszczy średnią) w trzech odcinkach: zapytanie → kompletny brief, brief → oferta przewodnika, oferta przewodnika → wysyłka do klienta. Rozbicie pokazuje, czy stoi na Was, czy na przewodniku — z audytu Ads wiadomo, że ~1/4 przegranych to brak przewodnika lub zbyt wolna odpowiedź.

**Praca własna** — ręczne dotknięcia per booking (rozkład, nie średnia) i zapytania na foundera na tydzień.

**Pokrycie** — odsetek zapytań, dla których w momencie wpłynięcia istniał co najmniej jeden dostępny przewodnik w tej destynacji, plus lista braków.

### 6.3 `/finances` — pieniądze

Miesięczny P&L (przychód z `deals`, koszty z `ad_campaigns` + `fixed_costs` + `manual_cost_entries`), prowizja narastająco, koszt akwizycji jako % opłaty, ROAS per destynacja, otwarte deale w pipeline, powracający klienci. Wszystko w PLN po kursie zamrożonym, z przełącznikiem na EUR.

Jedna rzecz, której dziś nie ma, a która jest sednem pytania „czy 20% to nadal właściwa liczba" z tablicy: **marża per destynacja i per typ wyjazdu** — prowizja minus przypisany koszt reklamy, w rozbiciu na Islandię/NZ i day trip / multi-day. To jest liczba, która przesądza o alokacji budżetu na zimę.

### 6.4 `/ads` — skuteczność kanałów

Wydatek, zapytania, qualified, bookingi, koszt per qualified, koszt per booking — per kampania, tydzień i destynacja. **Koszt liczony z `ad_campaigns.spend` i własnej liczby zapytań, nigdy z kolumny konwersji Google Ads** — trzy akcje konwersji liczą to samo zdarzenie i zawyżają ~2,7×. Ekran ma to mówić wprost w stopce, żeby za pół roku nikt nie „poprawił" liczby na tę z panelu Google.

Warunkiem sensu tego ekranu jest atrybucja: `gclid` jest łapany, ale UTM-ów nie ma, a leady z `/plan-your-trip` w ogóle nie trafiają do bazy. Jedno i drugie naprawia etap 0.

### 6.5 `/guides` i `/guides/[id]` — przewodnicy

Lista z kolumnami, które realnie oceniają współpracę: mediana czasu do oferty, wskaźnik akceptacji przypisań, liczba wyjazdów, odsetek negatywnych opinii **jako procent wyjazdów tego przewodnika** (nie liczba bezwzględna — przewodnik z 20 wyjazdami i jedną skargą jest lepszy niż ten z trzema wyjazdami i jedną skargą), destynacje, status weryfikacji, dostępność w najbliższych 60 dniach.

Karta przewodnika to te same liczby w czasie plus historia zapytań. Razem daje to „guide performance review" z lewej strony tablicy bez budowania osobnego modułu.

### 6.6 `/destinations` — NOWY

Najpilniejszy ekran w całym planie, bo dotyczy jedynego celu z datą 30 IX. Lista destynacji z **checklistą trzech warunków live** (≥ 3 aktywnych przewodników / materiały / opublikowana oferta) i wyraźnym zaznaczeniem, czego brakuje. Metryka i lista zadań to ten sam widok — nie ma sensu osobno liczyć „ile destynacji jest live" i osobno prowadzić listy tego, co zostało do zrobienia.

Do tego: przewodnicy na destynację, tygodnie od pierwszego kontaktu do live (mediana i per destynacja), popyt bez podaży — czyli zapytania o kraje, których nie obsługujecie, posortowane malejąco. To ostatnie jest darmową listą kandydatów na kolejne destynacje; dziś te dane leżą w `trip_country` i nikt na nie nie patrzy.

### 6.7 `/quality` — NOWY

Review rate, rozkład ocen, odsetek wyjazdów z incydentem, lista incydentów, opinie do zebrania. **Z jawnym oknem sezonowym**, nie „ostatnie 30 dni" — tablica mówi wprost, żeby mierzyć to na koniec sezonu zimowego 31 III 2027, bo zimowe wyjazdy bookuje się X–XII, a realizuje I–III, więc pomiar 31 XII zmierzyłby wyłącznie lato.

Mianownikiem jest liczba **zrealizowanych** wyjazdów, więc ekran jest tak wiarygodny, jak `trip_end_date`. Dopóki „zrealizowany" wynika z ręcznego przestawienia statusu, ta sekcja pokazuje przybliżenie i ma to komunikować.

### 6.8 Ekrany operacyjne bez zmian koncepcyjnych

`/inquiries` (+ `[id]`, `/unmatched`), `/experiences`, `/applications`, `/forms`, `/photos` — zostają, przechodzą na wspólną warstwę danych, dostają guardy i tracą martwe komponenty (`InquiryActionPanel`, `AssignGuidePanel`, `OfferBuilderModal`, `SendDepositButton`, `InquiriesFilters`). Karta zapytania dostaje jedno nowe: **oś czasu zdarzeń** — to samo `inquiry_events`, które zasila metryki, czytane po jednym zapytaniu. Zero dodatkowej pracy, a rozwiązuje codzienne „co się z tym działo".

---

## 7. Katalog metryk

25 pozycji z tablicy i z `head/05-brand-identity-and-metrics.md`, każda z formułą, źródłem, ekranem i tym, czego brakuje dziś. Kolumna „etap" wskazuje, kiedy metryka staje się liczalna.

### 7.1 Pieniądze (sekcja Finances)

| # | Metryka | Definicja i formuła | Źródło | Ekran | Brakuje dziś | Etap |
|---|---|---|---|---|---|---|
| M1 | Prowizja zarobiona (PLN) | `SUM(deals.commission_cents × fx_rate_pln)` dla zapytań z zapłaconym depozytem, po `payments.paid_at` | `deals`, `payments`, `fx_rates` | Przegląd, Finanse | Rozdzielenia `offer_deposit_eur ?? deposit_amount ?? internal_commission_eur` na jedno pole; zamrożonego kursu | 4 |
| M2 | Bookingi na miesiąc | `COUNT(DISTINCT inquiry_id)` z `payments.kind='deposit' AND status='paid'` w okresie | `payments` | Przegląd, Pipeline | — (liczalne dziś w przybliżeniu) | 4 |
| M3 | Koszt akwizycji jako % opłaty | `spend_pln ÷ commission_pln` w okresie; cel < 10%, tj. ~24 USD/booking | `ad_campaigns`, `deals` | Przegląd, Finanse | Wspólnej waluty i okna czasowego | 5 |
| M4 | Powracający podróżni | Udział zapytań od `customer_id`, który ma wcześniejszy zapłacony depozyt | `customers`, `inquiries`, `payments` | Finanse | Tabeli `customers` i normalizacji e-maila | 4 |
| M4b | Marża per destynacja | `commission_pln − przypisany spend_pln`, per destynacja i typ wyjazdu | `deals`, `ad_campaigns`, `destinations` | Finanse | `ad_campaign_defs.destination_id` | 5 |

### 7.2 Popyt (Marketing + Request Management + north-star)

| # | Metryka | Definicja i formuła | Źródło | Ekran | Brakuje dziś | Etap |
|---|---|---|---|---|---|---|
| M5 | Qualified requests / mies. | `COUNT(*) WHERE qualified = true` po `created_at`; cel 50–54 | `inquiries` | Przegląd, Pipeline | Zapisanego pola `qualified` (dziś tylko `priority` z agenta) | 1 |
| M6 | Koszt per qualified request | `spend_pln(kanał) ÷ qualified(kanał)`; cel ~7 USD | `ad_campaigns`, `inquiries.utm/gclid` | Ads | UTM-ów; leadów z `/plan-your-trip` w bazie | 0–5 |
| M7 | Konwersja request → booking | **Kohortowo**: z zapytań miesiąca X ile ma zapłacony depozyt w 30/60/90 dniach i ostatecznie; cel 30% | `mv_monthly_cohorts` | Pipeline | Widoku kohortowego (dziś liczone okresowo, co kłamie przy 60+ dniach wyprzedzenia) | 5 |
| M8 | Konwersja odwiedzający → zapytanie | `inquiries ÷ sesje GA4`; cel 3% | `metric_snapshots` (GA4) | Pipeline | Pobierania z GA4 Data API | 5 |
| M9 | Ruch: nowi użytkownicy, czas na stronie | Bezpośrednio z GA4, tygodniowo | `metric_snapshots` (GA4) | Pipeline | j.w. | 5 |
| M9b | Zapytania na tydzień (north-star z repo) | To ta sama metryka co M5 w ziarnie tygodniowym — **ujednolicić nazewnictwo**, dziś dwa dokumenty firmowe mówią o tym samym dwoma językami | `inquiries` | Przegląd | Decyzji nazewniczej | 1 |

### 7.3 Operacja (Platform / Tech + Guide Partner Management)

| # | Metryka | Definicja i formuła | Źródło | Ekran | Brakuje dziś | Etap |
|---|---|---|---|---|---|---|
| M10 | Czas do oferty | Mediana `offer.sent − brief.completed`, rozbita na trzy odcinki; cel < 3 dni, otwarte 24 h | `inquiry_events` | Pipeline, Guides | Rejestratora zdarzeń i definicji „kompletnego briefu" | 1 |
| M11 | Ręczne dotknięcia per booking | `COUNT(events WHERE actor_kind='admin' AND type IN akcje)` na zapytanie z depozytem; cel ≤ 2 | `inquiry_events` | Pipeline | j.w. | 1 |
| M12 | Zapytania na foundera / tydzień | Liczba zapytań z ≥ 1 zdarzeniem danego admina w tygodniu | `inquiry_events` | Przegląd, Pipeline | j.w. | 1 |
| M13 | Pokrycie | Odsetek zapytań, dla których w chwili wpłynięcia istniał ≥ 1 przewodnik `active` w destynacji i wolny w żądanym terminie; cel 90% | `guide_destinations`, `guide_blocked_dates` | Pipeline, Destynacje | Mapowania przewodnik→destynacja i zakresów dostępności | 4 |

### 7.4 Jakość (Trust & Safety + Guide Partner Management)

| # | Metryka | Definicja i formuła | Źródło | Ekran | Brakuje dziś | Etap |
|---|---|---|---|---|---|---|
| M14 | Review rate | `opinie ÷ zrealizowane wyjazdy` w oknie sezonowym; cel 75% | `reviews`, `inquiries.trip_end_date` | Quality | Daty zakończenia wyjazdu (dziś `completed` ustawiane ręcznie) | 4 |
| M15 | Odsetek ocen 4+ | `COUNT(rating >= 4) ÷ COUNT(*)`; cel 90% | `reviews` | Quality | — | 4 |
| M16 | Odsetek wyjazdów z incydentem | `wyjazdy z incydentem ÷ zrealizowane`; cel < 5% | `incidents` | Quality | Tabeli `incidents` (dziś nigdzie nie rejestrowane) | 4 |
| M17 | Negatywne opinie per przewodnik | `oceny ≤ 2 tego przewodnika ÷ jego wyjazdy`; cel < 5% | `reviews`, `mv_guide_performance` | Guides | Jawnego `reviews.guide_id` | 4 |

Wszystkie cztery mają w panelu **okno sezonowe z datą odczytu 31 III 2027**, nie kwartał kalendarzowy.

### 7.5 Podaż (New Destinations)

| # | Metryka | Definicja i formuła | Źródło | Ekran | Brakuje dziś | Etap |
|---|---|---|---|---|---|---|
| M18 | Live destynacje | Liczba destynacji spełniających trzy warunki: ≥ 3 przewodników `active`, materiały, opublikowana oferta; cel 3 do **30 IX** | `mv_destination_status` | Destynacje, Przegląd | Tabel `destinations` i `guide_destinations` | 4 |
| M19 | Przewodnicy per live destynacja | `COUNT(guide_destinations WHERE status='active')`; min. 3 | `guide_destinations` | Destynacje | j.w. | 4 |
| M20 | Tygodnie od kontaktu do live | `destinations.live_at − first_contact_at`; cel < 6 tygodni | `destinations` | Destynacje | j.w. | 4 |
| M20b | Popyt bez podaży | Zapytania per `trip_country` bez aktywnej destynacji, malejąco | `inquiries`, `destinations` | Destynacje | Niczego — dane są, brak ekranu | 6 |

### 7.6 Binarki i dane zewnętrzne

| # | Metryka | Jak mierzyć | Gdzie | Uwaga |
|---|---|---|---|---|
| M21 | Legal (5 pozycji) | `checklist_items` group `legal`, ręcznie, z datą przeglądu | Pasek na Przeglądzie | Zadania zostają w Notion; panel pokazuje tylko stan |
| M22 | Style book wdrożony | `checklist_items` group `branding` | j.w. | Binarne, bez historii |
| M23 | Brands pitched / signed / delivered | `metric_snapshots`, `source='manual'`, wpis miesięczny | Finanse (sekcja poboczna) | **20 firm to lista w Notion, nie CRM** — nie budujemy modułu; dopiero po bramce 15 X |
| M24 | Instagram followers | `metric_snapshots`, wpis tygodniowy ręczny (API dopiero, gdy się opłaci) | Przegląd (mała liczba) | Nie automatyzować teraz |
| M25 | Czas produkcji jednego posta | **Nie mierzymy w systemie.** Stoper przy pierwszych pięciu postach, potem koniec | — | Metryka procesu, nie produktu |

---

## 8. Plan migracji — dziewięć etapów

Każdy etap kończy się deployem działającej aplikacji. Nie ma momentu „przez trzy tygodnie nic nie działa". Szacunki dla dwóch osób pracujących z Claude Code, przy równoległej obsłudze zapytań.

### Etap 0 — zatamować krwawienie (1–2 dni, obecne repo)

Rzeczy, które szkodzą dziś i nie zależą od przebudowy:

1. Strona `/inquiry-confirmed` albo zmiana `success_url` w `actions/inquiries.ts:290,598` — klient po wpłacie depozytu ląduje na 404.
2. `proxy.ts:64` — redirect zalogowanych z `/account` (nie istnieje) na `/dashboard`.
3. `api/cron/sync-google-ads/route.ts` — `export const GET = POST`; Vercel cron woła GET, więc dzienny sync Ads nie ma prawa się odpalać.
4. `env.ts` — `AI_AUTO_REPLY_ENABLED` na `z.enum(['true','false']).transform(...)`; dziś `z.coerce.boolean()` sprawia, że `"false"` **włącza** agenta.
5. **`/plan-your-trip` zapisuje do `inquiries`** z `source='ads_landing'` zanim wyśle maila. To są płatne leady, dziś niewidoczne w pipeline ani w finansach.
6. **Przechwytywanie UTM** obok istniejącego `gclid` — bez tego M6 nie ma sensu, a każdy dzień bez tego to bezpowrotnie utracona atrybucja.
7. `requireAdmin()` w `inquiries.ts`, `experience-pages.ts`, `ads.ts`, `finances.ts`, `messages.ts`, `reviews.ts`, `ai.ts` — wzorzec z `admin.ts`, tymczasowo w `lib/auth.ts`.
8. Naprawić `20260815_fix_nz_species_casing.sql` (plik ma 1 bajt: znak `4`).
9. `pg_dump` całej bazy. Bez tego nie ruszamy dalej.

### Etap 1 — schemat mówi prawdę + rejestrator zdarzeń (3–4 dni)

Cel: migracje w repo = stan bazy, typy = schemat, zero martwego kodu, **i zaczynamy zbierać historię**.

1. `supabase db pull` → migracja „baseline" zapisująca wszystko, co zrobiono w dashboardzie (tabele-duchy, kolumny na `inquiries`, polityki bucketów). Od tego momentu drift wykrywa CI.
2. Migracja `drop_marketplace_leftovers` — tabele z §5.4 poza `experiences` i `inquiry_trip_details` (te wymagają przeniesienia danych, etap 4).
3. **`inquiry_events` + `emitEvent()` podpięte w kilkunastu miejscach** (lista w załączniku C), na razie **bez żadnego interfejsu**. Nic tego nie czyta — chodzi wyłącznie o to, żeby wrzesień i październik miały historię, gdy w listopadzie powstaną ekrany. To jest najważniejsza pojedyncza decyzja w tym planie.
4. **`inquiries.qualified`** wypełniane przez agenta przy klasyfikacji + ręczna korekta na karcie zapytania; starsze wiersze na `unknown`.
5. `supabase gen types` → koniec `as any` tam, gdzie wynikało z braku typów.
6. Wycięcie martwego kodu z audytu (~10 tys. linii): `actions/bookings.ts`, `actions/accommodations.ts`, `lib/mock-data.ts`, `lib/stripe/{connect,webhooks}.ts`, `lib/field-encryption.ts`, sześć iteracji home, pięć komponentów trips, oba wizardy onboardingu, `GuideSubmissionForm`, `BookingChat`, `InquiryActionPanel`, `AssignGuidePanel`, `OfferBuilderModal`, `SendDepositButton`, `InquiriesFilters`, faceted search w `/trips`, całe UI Stripe Connect w `/dashboard/account`, `actions/stripe-connect.ts`, gałąź `booking_fee` w webhooku, 8 martwych eksportów `queries.ts`. `tsc --noEmit` + `next build` po każdej paczce.
7. Legacy edytor `experiences` wyłączony z nawigacji; cztery gorące akcje w `inquiries.ts` i webhook depozytu przepięte na `experience_pages`.

Tag `v1-clean`.

### Etap 2 — szkielet monorepo (3–4 dni)

`pnpm-workspace.yaml` + `turbo.json`; obecna aplikacja w całości do `apps/web` (Vercel root directory `apps/web`, zero zmian funkcjonalnych). `packages/db` przejmuje `supabase/`, typy i klientów. `packages/core` zaczyna od `auth/` (guardy), `events/` (rejestrator) i czterech repozytoriów: `inquiries`, `guides`, `experiences`, `messaging`; `inquiries.ts` (1621 linii) rozbite przy okazji na `inquiries/`, `offers/`, `payments/`, `messaging/`. `packages/ui` — tokeny i preset Tailwind. Reguły ESLint z §3.2 jako błąd; CI: `turbo lint typecheck build` + `supabase db diff`.

### Etap 3 — wydzielenie `apps/admin` (3–5 dni)

Nowa aplikacja na `admin.fjordanglers.com`, auth przez ten sam Supabase, guard w `packages/core`. `git mv` tras `/admin/*` — one już wołają tylko `@fa/core`, więc przenosiny to głównie importy i layout. Crony przechodzą do admina; webhooki zostają w web. Sidenav dostaje `/applications` i `/forms`, których dziś brakuje.

### Etap 4 — refaktor schematu domeny (4–6 dni, najbardziej ryzykowny)

1. Migracja tworząca `offers`, `payments`, `deals`, `customers`, `destinations`, `guide_destinations`, `incidents`, `checklist_items`, `guide_blocked_dates`, `messages` (rename) — **obok** starych kolumn.
2. Backfill w migracji: `inquiries.offer_*` → `offers`; `deposit_*` → `payments`; `internal_*` → `deals`; `inquiry_trip_details` → `brief`; `guide_unavailable_dates` → zakresy; `experiences.max_guests` → `experience_pages`; e-maile → `customers`; `trip_country` + istniejące oferty → `destinations`. Kwoty ×100 → centy, kurs zamrożony z `fx_rates`.
3. `packages/core` przełączony na nowe tabele; maszyna stanów z §3.3 wchodzi tutaj; `emitEvent` z etapu 1 zaczyna wypełniać także zdarzenia płatności i jakości.
4. Tydzień pracy na obu zestawach kolumn (stare read-only), potem `drop_legacy_inquiry_columns`, drop `experiences`/`inquiry_trip_details`/`guide_unavailable_dates`, rename `experience_pages → experiences`.
5. `/offers/[token]` i webhook depozytu przepisane na `offers`/`payments`; idempotency key Stripe bez `Date.now()`.

### Etap 5 — warstwa pomiarowa (3–4 dni)

1. `metric_snapshots`, `fx_rates` + crony: NBP/ECB dziennie, GA4 Data API dziennie (sesje, nowi użytkownicy, czas na stronie), Google Ads (istniejący, naprawiony w etapie 0).
2. Sześć widoków materializowanych z §4.4 + cron `refresh-metrics` o 5:00.
3. `packages/core/metrics` — katalog definicji: klucz, nazwa, jednostka, formuła, cel, źródło, sekcja z tablicy.
4. Testy na formułach: kohorty, mediany, ręczne dotknięcia, przeliczenia walutowe. To jedyne miejsce w systemie, gdzie cicha pomyłka arytmetyczna prowadzi do złej decyzji biznesowej, a nie do widocznego błędu — więc tu testy są obowiązkowe, nie opcjonalne.

### Etap 6 — panel admina (5–7 dni)

Siedem ekranów z §6, w kolejności wartości: **Przegląd tygodniowy → Destynacje → Pipeline → Ads → Finanse → Guides → Quality**. Destynacje tak wysoko, bo dotyczą jedynego celu z twardą datą; Quality na końcu, bo i tak odczyt jest 31 III 2027. Każda liczba klikalna do listy rekordów. Oś czasu zdarzeń na karcie zapytania.

### Etap 7 — front i portal przewodnika (5–8 dni, równolegle z 5–6)

`(marketing)` na `@fa/ui`; `experiences/[slug]` (1617 linii) rozbite na sekcje czytające jeden obiekt z `core.experiences.getPublic(slug)`. Landingi pod reklamy jako `(marketing)/lp/[slug]` — pliki, nie CMS w bazie. `(guide)`: dashboard odchudzony do czterech ekranów (przypisania z accept/decline, kalendarz zakresów, zdjęcia, profil), bez Stripe i IBAN-ów. Blog jako MDX, w nawigacji. Jedno wejście dla leadów: `core.inquiries.create({ source })` używane przez widget, landing, formularz ręczny i matcher wiadomości.

### Etap 8 — utwardzenie (2–3 dni, rozłożone)

Testy tam, gdzie dziś zero pokrycia, a ryzyko największe: maszyna stanów, matcher e-mail/telefon, weryfikacja i idempotencja webhooków, matematyka finansów i metryk, guardy. Playwright na ścieżce zapytanie → oferta → depozyt (Stripe test mode). Przegląd RLS (`get_advisors`). Wygaszenie `whatsapp-bridge`, jeśli Meta Cloud API + Resend Inbound pokrywają cały ruch.

**Suma: ~30–40 dni roboczych.** Etapy 0–1 (4–6 dni) dają większość korzyści operacyjnych i są bezpieczne do zrobienia od razu.

### Zależności

```
Etap 0 ─▶ Etap 1 ─▶ Etap 2 ─▶ Etap 3 ─▶ Etap 4 ─▶ Etap 5 ─▶ Etap 6 ─▶ Etap 8
                                   └──────────────────────▶ Etap 7 ─┘
```

Etap 1 jest bramą do wszystkiego, co czasowe — im później, tym mniej historii na starcie sezonu. Etap 4 jako jedyny niesie ryzyko utraty danych: robimy go na gałęzi Supabase albo na kopii, z backfillem przetestowanym przed dotknięciem produkcji.

---

## 9. Ścieżka minimalna do 30 IX

Wrzesień jest przeładowany — osiem zadań z deadline'em do 15 IX na dwóch founderów, przy jednoczesnym celu 3 destynacji live do 30 IX. Pełna przebudowa nie zmieści się przed sezonem i **nie powinna** próbować. Realny wybór na wrzesień:

**Zrobić (4–6 dni roboczych, rozłożone):** etap 0 w całości, etap 1 punkty 1, 3, 4 (baseline, rejestrator zdarzeń, flaga qualified). To zamyka dziury, które kosztują pieniądze dziś, i uruchamia zbieranie historii przed sezonem.

**Dorzucić jeden ekran, brzydki, w obecnym panelu (1–2 dni):** przegląd tygodniowy na istniejących tabelach. Bez monorepo, bez widoków materializowanych, bez `packages/metrics`. Osiem liczb, które da się policzyć z dzisiejszych danych: prowizja narastająco, bookingi w miesiącu, zapytania i qualified w tygodniu, wydatek na reklamy, koszt per zapytanie, konwersja narastająca, powody przegranych. Ten ekran zostanie wyrzucony w etapie 6 — i to jest w porządku. Cotygodniowy przegląd zaczyna się 1 IX, a nie w listopadzie; ekran, który działa we wrześniu, jest wart więcej niż doskonały ekran w listopadzie.

**Odłożyć na po 30 IX:** monorepo, `apps/admin`, refaktor schematu, warstwa pomiarowa, pozostałe sześć ekranów, front.

Jedyny wyjątek, który warto rozważyć przed 30 IX, to **`/destinations` w prostej formie** — nawet jako ręczna checklista trzech warunków na trzy destynacje. Nie dlatego, że to metryka, tylko dlatego, że to jedyna lista, która pilnuje celu z twardą datą.

---

## 10. Zasady na przyszłość

Syf powstał z szybkiego eksperymentowania, a eksperymentować będziecie dalej. Różnica ma być w sprzątaniu:

1. **Schemat tylko przez migracje.** `supabase migration new` → PR → CI sprawdza `db diff`. Zmiana w dashboardzie to incydent, nie skrót.
2. **Eksperyment ma termin.** Każda nowa tabela/kolumna „na próbę" dostaje w opisie PR datę decyzji (max 30 dni). Po terminie albo wchodzi do `packages/core` z testem, albo wylatuje razem z migracją drop.
3. **Jedno miejsce na tabelę.** Każda tabela ma dokładnie jeden plik repozytorium; nowy `.from()` poza nim nie przechodzi lintu.
4. **Jedno miejsce na metrykę.** Formuła żyje w `packages/core/metrics` i nigdzie indziej. Liczba w panelu, w raporcie i w Notion ma wychodzić z tego samego kodu.
5. **Zdarzenie razem z mutacją.** Zmiana stanu bez zdarzenia to błąd tej samej klasy co zapis bez autoryzacji.
6. **Typy w CI, nie z ręki.** `gen types` w pipeline; `as any` w `packages/core` to błąd lintu.
7. **`CLAUDE.md` opisuje to, co jest.** Dzisiejszy opisuje marketplace ze Stripe Connect, którego nie ma, więc każda sesja z agentem zaczyna od złych założeń. Nowy: krótki root + per pakiet (`packages/core/CLAUDE.md` — maszyna stanów, guardy, zdarzenia; `packages/db/CLAUDE.md` — konwencje migracji).
8. **Martwy kod znika w tym samym PR, który go zastępuje.** `knip` w CI.

---

## 11. Czego świadomie nie robimy

Stripe Connect, tiery płatności, silnik anulacji i payouty z `CLAUDE.md` — nie budujemy; `payments` jest na to gotowe, gdyby wróciło. Nie migrujemy bazy ani frameworka. Nie przepisujemy `experiences/[slug]` wizualnie — działa i konwertuje, zmienia się tylko źródło danych. Nie budujemy CMS-a dla bloga i landingów. Nie budujemy CRM-u dla dwudziestu marek ani modułu do liczenia followersów. Nie mierzymy w systemie czasu produkcji posta. Nie robimy big-bangowego cutovera: ani jednego dnia z dwiema wersjami bazy na produkcji.

---

## Załącznik A — skrypt do policzenia bazy przed etapem 1

```sql
-- A1. tabele: wiersze, rozmiar, aktywność
select c.relname as table_name, c.reltuples::bigint as est_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) as size,
       s.n_tup_ins, s.n_tup_upd, s.n_tup_del, s.last_autoanalyze
from pg_class c join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname='public' and c.relkind='r' order by est_rows desc;

-- A2. kolumny w 100% NULL na kluczowych tabelach
do $$
declare r record; cnt bigint; nulls bigint;
begin
  for r in select table_name, column_name from information_schema.columns
           where table_schema='public' and table_name in
             ('inquiries','guides','experience_pages','experience_page_options','bookings','experiences')
  loop
    execute format('select count(*), count(*) filter (where %I is null) from public.%I',
                   r.column_name, r.table_name) into cnt, nulls;
    if cnt > 0 and nulls = cnt then raise notice 'ALL NULL: %.%', r.table_name, r.column_name; end if;
  end loop;
end $$;

-- A3. dryf: kolumny w bazie vs migracje w repo (porównaj ręcznie)
select table_name, column_name, data_type from information_schema.columns
where table_schema='public' and table_name in ('inquiries','guides','experience_pages')
order by table_name, ordinal_position;

-- A4. bookings: czy jest cokolwiek poza pending
select status, count(*) from bookings group by 1;

-- A5. baseline metryk: ile historii da się odtworzyć bez zdarzeń
select date_trunc('month', created_at) as m,
       count(*) as zapytania,
       count(*) filter (where offer_sent_at is not null) as z_ofertą,
       count(*) filter (where deposit_paid_at is not null) as z_depozytem,
       round(avg(extract(epoch from (offer_sent_at - created_at))/86400)::numeric, 1) as dni_do_oferty_avg
from inquiries group by 1 order by 1;
```

## Załącznik B — mapowanie starych kolumn na nowe (backfill, etap 4)

| Stare | Nowe |
|---|---|
| `inquiries.offer_total_eur`, `offer_deposit_eur` | `offers.total_cents`, `deposit_cents` (×100), `currency='EUR'` |
| `inquiries.offer_token`, `offer_token_expires_at`, `offer_sent_at` | `offers.token`, `token_expires_at`, `sent_at` |
| `inquiries.offer_{trip_plan,notes,inclusions,what_to_bring,questions,answers,license_*,refund_reason,location*,photos,schedule,options}`, `selected_option_id` | `offers.*` 1:1 |
| `inquiries.deposit_amount`, `deposit_stripe_session_id`, `deposit_paid_at` | `payments(kind='deposit', provider='stripe', amount_cents, provider_session_id, paid_at, status='paid')` |
| `inquiries.internal_deal_total_eur`, `internal_commission_eur`, `deal_currency` | `deals.total_cents`, `commission_cents`, `currency`, `fx_rate_pln` |
| `inquiry_trip_details.*` | `inquiries.brief JSONB` |
| `guide_unavailable_dates(guide_id, date)` | `guide_blocked_dates(guide_id, date_from, date_to)` — scalanie ciągłych dni |
| `experiences.max_guests` | `experience_pages.max_guests` po `trip_id` |
| `inquiries.angler_email` (znormalizowany) | `customers.email_normalized` + `inquiries.customer_id` |
| `inquiries.trip_country` + opublikowane oferty | `destinations` + `experiences.destination_id` |
| `lead_messages` | `messages` (rename) + `external_id UNIQUE` |
| `leads` | `guide_applications` (rename); `guides.lead_id` → `application_id` |
| `guides.boat_{name,type,length_m,engine,capacity}` | `guides.boat JSONB` |
| `guides.average_rating`, `total_reviews` | liczone z `reviews` |

## Załącznik C — katalog typów zdarzeń (etap 1)

Minimalny zestaw, który pokrywa wszystkie metryki czasowe. Kolumna „aktor" wskazuje typową wartość `actor_kind`.

| Typ | Aktor | Emitowany w | Zasila |
|---|---|---|---|
| `inquiry.created` | system / admin | `core.inquiries.create` | M5, M7, M9b |
| `inquiry.qualified_set` | agent / admin | klasyfikacja + korekta ręczna | M5, M6 |
| `agent.round_completed` | agent | `inquiry-agent` | M10 (start zegara) |
| `inquiry.brief_completed` | agent / admin | gdy zapytanie ma kraj + termin + liczbę osób | M10 |
| `guide.assigned` / `guide.unassigned` | admin | `assignGuideToInquiry` | M10, M11, M13 |
| `guide.accepted` / `guide.declined` | guide | `respondToAssignment` | M10, guide perf. |
| `guide.offer_received` | admin | `saveGuideOfferResponse` | M10 (odcinek 2) |
| `offer.created` / `offer.updated` | admin | `saveRichOffer` | M11 |
| `offer.sent` | admin | `sendOfferEmail` | M7, M10 |
| `offer.viewed` | angler | `/offers/[token]` | konwersja oferty |
| `offer.accepted` / `offer.declined` | angler | `acceptOffer`, `declineOffer` | M7 |
| `deposit.link_sent` | admin | `sendDepositLink` | M11 |
| `deposit.paid` | system | webhook Stripe | M1, M2, M3, M7 |
| `message.sent` | admin / system | `sendMessageToAngler`, maile | M11, M12 |
| `message.received` | angler / guide | webhooki e-mail/WhatsApp | czas odpowiedzi |
| `status.changed` | admin / system | `transition()` | lejek, `stage_reached` |
| `inquiry.lost` | admin | `declineOffer`, ręczna zmiana | powody przegranych |
| `trip.completed` | admin / system | data zakończenia | M14, M15, M16 |
| `review.requested` / `review.submitted` | system / angler | `reviews` | M14 |
| `incident.opened` / `incident.resolved` | admin | `incidents` | M16 |
