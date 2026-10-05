# Propozycja: strona ofertowa = oferta, nie przewodnik — zmiany schematu

**Status:** przyjęta 2026-10-05 (tj, /wf-plan) — zadania FA-1.50–1.57; decyzje D1–D6 rozstrzygnięte jako O-31–O-36 w `docs/04-open-questions.md`: cena całkowita, nadpisanie ceny per przewodnik do ~15%, warianty = osobna strona, S7 pokazuje wszystkich przypiętych, zwrot depozytu globalny FA + wyjątek pogodowy per oferta, SLA/ETA per oferta. `inquiries.brief jsonb` wchodzi już w EXPAND (FA-1.50). CONTRACT bez zadania do czasu etapu 4 (`docs/deferred-tasks.md`).
**Dotyczy:** `experience_pages` (→ `experiences`), `experience_page_options`, `guides`, `inquiries`, `reviews`
**Źródło:** benchmark stron ofertowych (Yellow Dog, Tailwaters, Fish Partner, FishingBooker, MBA, Intrepid, &Beyond, CMH) + wireframe strony ofertowej z 2026-10-05
**Zależy od:** ADR-0001 (agency model), ADR-0004 (centy + zamrożony FX), `docs/02-data-model.md` §2 (target state), O-04 (rename)

## 1. Decyzja do podjęcia

Dziś: **jedna strona = jeden przewodnik** (`experience_pages.guide_id`, nullable). Dwóch przewodników z tą samą ofertą = dwie strony.

Proponowane: **jedna strona = jeden produkt** (destynacja × typ wyprawy × próg cenowy). Przewodnicy są *realizatorami* produktu (N:M). Powody, w kolejności wagi:

1. Flow FA i tak brzmi „sprawdzimy, który z naszych przewodników jest wolny" — strona per przewodnik obiecuje konkretną osobę, której potem nie gwarantujemy.
2. Bottleneck = dostępność przewodnika. Jedna strona pozwala kierować lead do wolnego guide'a bez przepinania zapytania między stronami (M13 „pokrycie" liczy się wtedy naturalnie: `experience_guides` ∩ `guide_blocked_dates`).
3. Google Ads: fraza = destynacja/typ, nie nazwisko. Dwie bliźniacze strony = duplikat treści, rozbita statystyka, gorszy Quality Score.
4. FishingBooker jest per kapitan, bo tam kapitan sprzedaje. FA jest agentem, który dobiera — bliżej Yellow Doga (strona = program/lodge).

Wyjątek, który **nie wymaga osobnego modelu**: Islandia / Norwegia / Finlandia (oferta personalizowana) — produkt jest tożsamy z przewodnikiem, więc taka strona ma po prostu jeden wiersz w `experience_guides`. Dzielimy strony **po intencji wyszukiwania i progu cenowym, nigdy po przewodniku** (np. „day trip z Reykjavíku" i „lodge week" to osobne strony; dwóch guide'ów na South Island to jedna).

## 2. Model docelowy (delta wobec `02-data-model.md` §2)

```sql
-- 2.1 Przewodnicy realizujący ofertę (N:M) — zastępuje experiences.guide_id
experience_guides (
  experience_id  uuid REFERENCES experiences(id) ON DELETE CASCADE,
  guide_id       uuid REFERENCES guides(id)      ON DELETE RESTRICT,
  role           text NOT NULL DEFAULT 'primary' CHECK (role IN ('primary','backup')),
  status         text NOT NULL DEFAULT 'active'  CHECK (status IN ('active','paused')),
  show_on_page   boolean NOT NULL DEFAULT true,   -- sekcja S7 „Twój przewodnik" pokazuje wiersze z true, wg sort_order
  sort_order     int NOT NULL DEFAULT 0,
  guide_price_override_cents bigint,              -- NULL = cena z experience_prices; patrz decyzja D2
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (experience_id, guide_id)
);
CREATE UNIQUE INDEX experience_guides_one_primary
  ON experience_guides (experience_id) WHERE role = 'primary' AND status = 'active';

-- 2.2 Tryb oferty — osobno od price_type (jednostka ceny)
ALTER TABLE experiences
  ADD COLUMN offer_mode        text NOT NULL DEFAULT 'fixed' CHECK (offer_mode IN ('fixed','custom')),
  --  fixed  = NZ / Patagonia / Szwecja: stała cena, kalkulator w widgecie, tabela cen
  --  custom = Islandia / Norwegia / Finlandia: widełki + archetypy, „Zaplanuj wyprawę"
  ADD COLUMN price_from_cents  bigint,            -- oba tryby: „od" nad zgięciem
  ADD COLUMN price_to_cents    bigint,            -- custom: górna granica widełek
  ADD COLUMN fee_pct           numeric(5,4) NOT NULL DEFAULT 0.20,   -- opłata FA = depozyt (ADR-0001)
  ADD COLUMN max_anglers_per_guide int NOT NULL DEFAULT 2,
  ADD COLUMN min_days int NOT NULL DEFAULT 1,
  ADD COLUMN max_days int;                        -- NULL = bez limitu (custom)
-- price_from / currency (numeric EUR) → price_from_cents + currency wg ADR-0004; stare kolumny drop po dual-read.

-- 2.3 Cennik oferty stałej — źródło kalkulatora „Razem / Depozyt / Saldo"
experience_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  days           int  NOT NULL CHECK (days >= 1),
  anglers        int  NOT NULL CHECK (anglers >= 1),
  guide_price_cents bigint NOT NULL,              -- cena przewodnika; total = guide_price × (1 + fee_pct)
  currency       char(3) NOT NULL,
  valid_from     date, valid_to date,             -- ceny na kolejny sezon (wzór CMH)
  UNIQUE (experience_id, days, anglers, valid_from)
);

-- 2.4 Opcje = archetypy (custom) lub warianty (fixed). Tabela zostaje, dostaje:
ALTER TABLE experience_options
  ADD COLUMN kind              text NOT NULL DEFAULT 'variant' CHECK (kind IN ('variant','archetype','addon')),
  --  variant   = fixed: np. „z noclegiem w lodge" (ma własny wiersz w experience_prices? nie — patrz D3)
  --  archetype = custom: „Day trip z Reykjavíku", „Lodge week", „Ekspedycja" — karta z ceną orientacyjną
  --  addon     = opcje z ceną (Intrepid): heli-access, dodatkowy dzień, single supplement
  ADD COLUMN price_from_cents  bigint,
  ADD COLUMN price_to_cents    bigint,
  ADD COLUMN currency          char(3),
  ADD COLUMN duration_days_min int, ADD COLUMN duration_days_max int,
  ADD COLUMN sample_itinerary  jsonb NOT NULL DEFAULT '[]';   -- [{day, title, waters, lodging, meals, transfer, notes}]
-- price_from numeric → price_from_cents; price_type zostaje (per_person | flat).

-- 2.5 Treść sekcji z wireframe'u, której dziś nie ma gdzie zapisać
ALTER TABLE experiences
  ADD COLUMN suited_for        text[] NOT NULL DEFAULT '{}',   -- S5 „Idealna, jeśli…"
  ADD COLUMN not_suited_for    text[] NOT NULL DEFAULT '{}',   -- S5 „Nie dla Ciebie, jeśli…"
  ADD COLUMN expectations_text text,                           -- S5 „bez gwarancji dużej ryby"
  ADD COLUMN skill_level       smallint CHECK (skill_level BETWEEN 1 AND 5),  -- chip „poziom 3/5"; zastępuje difficulty/physical_effort (text)
  ADD COLUMN walking_km_min    numeric(4,1), ADD COLUMN walking_km_max numeric(4,1),
  ADD COLUMN day_schedule      jsonb NOT NULL DEFAULT '[]',    -- S6 fixed: [{time, title, meta:{drive_min, walk_km, wading}}]
  ADD COLUMN nearest_airport   text,                           -- S11
  ADD COLUMN suggested_lodging jsonb NOT NULL DEFAULT '[]',    -- S11: [{name, url, note}]
  ADD COLUMN license_info      jsonb,                          -- S4/S13: {required, buy_url, steps[], price_text} — dziś tylko w offers
  ADD COLUMN tip_guidance_text text,                           -- S4 „napiwek zwyczajowo…"
  ADD COLUMN weather_policy_text text,                         -- S9/S13 wyjątek pogodowy
  ADD COLUMN response_sla_hours int NOT NULL DEFAULT 24,       -- S1/S8 „odpowiedź w 24 h"
  ADD COLUMN offer_eta_text    text;                           -- S8 „oferta w 48–72 h" / „3–5 dni roboczych"

-- 2.6 Treść per przewodnik przestaje mieszkać na stronie
--  experiences.boat_description, boat_image_url, boats, rod_setup → guides.boat (jsonb, już w planie) + guides.gear_text
--  experiences.special_attraction_* → drop (02-data-model już to zakłada)
ALTER TABLE guides
  ADD COLUMN association       text,     -- „NZPFGA" — certifications[] zostaje na licencje
  ADD COLUMN response_time_hours int,    -- karta S7 „odpowiada zwykle w 24 h" (docelowo liczone z inquiry_events)
  ADD COLUMN gear_text         text;

-- 2.7 Recenzje widoczne na stronie oferty = recenzje przewodników z experience_guides
ALTER TABLE reviews ADD COLUMN experience_id uuid REFERENCES experiences(id) ON DELETE SET NULL;
-- guide_id jawny — już w planie etapu 4. Link zewnętrzny: guides.google_profile_url (istnieje).

-- 2.8 Stare adresy stron per przewodnik
experience_slug_aliases (slug text PRIMARY KEY, experience_id uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE);
-- 301 ze starych slugów po scaleniu dwóch stron w jedną; slug unikalny globalnie (dziś też).
```

### Co z `inquiries`

- `experience_page_id` **zostaje** (źródło leadu = strona oferty; po rename `experience_id`).
- `guide_id` („przewodnik strony") **do usunięcia** w `drop_legacy_inquiry_columns` — po zmianie nie ma jednego przewodnika strony. Jedyny przewodnik na zapytaniu to `assigned_guide_id`. Kandydaci do przypisania = `experience_guides WHERE status='active'` minus `guide_blocked_dates` w żądanym terminie (to jest dokładnie M13).
- `brief` (jsonb, etap 4) dostaje klucze z formularza 3-krokowego: `dates_mode ∈ exact|flexible`, `date_from`, `date_to`, `flex_month`, `days`, `anglers`, `non_anglers`, `skill_level 1–5`, `priority ∈ trophy|numbers|learning|scenery`, `fitness ∈ low|mid|high`, `wading_ok bool`, `budget_ack bool` (fixed) / `budget_band` (custom), `selected_option_id` (archetyp). Walidacja kształtu w `packages/core`, nie w DB.
- `trip_country` → `destination_id` przez `experiences.destination_id` (już w planie).

### Co z `offers`

Bez zmian strukturalnych. `offer_options` powstają z `experience_prices` (fixed) albo ręcznie (custom); `deposit_cents = total × fee_pct` liczone z `experiences.fee_pct` w chwili tworzenia oferty (zamrożone w wierszu, nie liczone na żywo).

## 3. Backfill (etap 4, obok starych kolumn)

1. `INSERT INTO experience_guides (experience_id, guide_id, role) SELECT id, guide_id, 'primary' FROM experience_pages WHERE guide_id IS NOT NULL;`
2. `offer_mode`: `'custom'` dla `country IN ('Iceland','Norway','Finland')`, inaczej `'fixed'` — do ręcznej korekty w adminie.
3. `price_from_cents = round(price_from * 100)`, `currency` bez zmian.
4. `experience_prices`: dla `fixed` jeden wiersz `(days=1, anglers=max_anglers_per_guide, guide_price_cents=price_from_cents)`; resztę tabeli uzupełnia admin.
5. `experience_options`: `kind='variant'` (fixed) / `'archetype'` (custom), `price_from_cents = round(price_from*100)`.
6. `difficulty` / `physical_effort` (text) → `skill_level` mapowaniem Low=2, Medium=3, High=4; stare kolumny drop.
7. `boat_*`, `boats` → `guides.boat` dla przewodnika z kroku 1; `rod_setup` → `guides.gear_text`.
8. Scalanie bliźniaczych stron (ten sam produkt, dwóch przewodników): ręcznie w adminie — wybrać stronę docelową, dodać drugiego przewodnika do `experience_guides`, stary slug do `experience_slug_aliases`, stara strona `status='archived'`. **Nie automatyzować.**
9. Dual-read tydzień (`experience_pages.guide_id` read-only), potem drop `guide_id`, `price_from`, `difficulty`, `physical_effort`, `boat_*`, `boats`, `rod_setup`, `special_attraction_*`, `best_months`, `season_start`, `season_end`.

## 4. Wpływ na kod (do rozpisania w /wf-plan)

- `src/app/experiences/[slug]/page.tsx` — pobranie przewodników z `experience_guides` (dziś `page.guide_id` → jeden `guides`), sekcja S7 z 1–2 kartami, widget liczący z `experience_prices` × `fee_pct`.
- `src/actions/inquiries.ts` — `resolveOfferGuide(assigned_guide_id, exp)` traci fallback na `exp.guide_id`; przypisanie wybiera z `experience_guides`.
- `src/components/admin/ExperiencePageForm.tsx` + `src/actions/experience-pages.ts` — multiselect przewodników, przełącznik `offer_mode`, edytor `experience_prices` i `kind` opcji.
- Guide dashboard — lista „moje oferty" z `experience_guides`, nie z `experience_pages.guide_id`.
- `agent_knowledge` — bez zmian (klucz `guide_id` / `country` nadal pasuje).
- Typy Supabase — regeneracja.

## 5. Decyzje do podjęcia (blokują migrację)

| # | Decyzja | Domyślnie | Dlaczego to ważne |
|---|---|---|---|
| D1 | Cena na stronie: przewodnika + „opłata FA 20%" czy całkowita? | **Całkowita** (trend total price; Airbnb) | Zmienia tylko warstwę widoku — schemat trzyma `guide_price_cents` + `fee_pct`, total liczony. Ale różnica do oferty bezpośredniej przewodnika staje się widoczna — trzeba ją uzasadnić w S7/S13. |
| D2 | Dwóch przewodników na tej samej stronie z różną ceną: `guide_price_override_cents` czy osobne strony? | **Override**, ale tylko gdy różnica ≤ ~15%; większa = inny produkt = osobna strona | Override komplikuje kalkulator (cena zależy od tego, kto będzie wolny). Alternatywa: „od" = min z obu, oferta precyzuje. |
| D3 | Warianty `fixed` (np. „z lodge") — osobne wiersze w `experience_prices` z `option_id`, czy osobna strona? | **Osobna strona**, `experience_prices` bez `option_id` | Prostszy kalkulator; wariant z noclegiem to zwykle inna intencja w Ads. |
| D4 | S7 pokazuje jednego przewodnika (primary) czy wszystkich `show_on_page`? | Wszystkich (max 2–3) | Zaufanie do konkretnych ludzi vs. ryzyko „ale ja chciałem tego pierwszego". |
| D5 | `response_sla_hours` / `offer_eta_text` per oferta czy globalnie w `finance_settings`-podobnej tabeli? | Per oferta (custom ma inny SLA niż fixed) | Obietnica na stronie musi być dotrzymywana — admin powinien widzieć SLA vs. realny czas z `inquiry_events`. |
| D6 | Polityka zwrotu depozytu: per oferta, per przewodnik (`guides.cancellation_policy` istnieje) czy globalna FA? | **Globalna FA** + `weather_policy_text` per oferta | Depozyt = opłata FA, więc to polityka FA, nie przewodnika. `guides.cancellation_policy` dotyczy salda. |

## 6. Dane potrzebne, żeby domknąć propozycję (nie mam do nich dostępu z tego miejsca)

- `SELECT country, count(*), count(guide_id) FROM experience_pages GROUP BY 1;` — ile stron, ile bez przewodnika.
- Które strony są bliźniacze (ten sam produkt, inny przewodnik) — lista par do scalenia w kroku 8.
- `SELECT experience_page_id, count(*) FROM experience_page_options GROUP BY 1;` — czy opcje są realnie używane i jak (warianty czy archetypy).
- Czy przewodnicy na tej samej destynacji mają różne ceny za ten sam dzień (D2).
- Liczba recenzji z `guide_id` vs bez.

## 7. Strategia wdrożenia: expand → migrate → switch → contract

Zasada: **żadna migracja do kroku 4 nie usuwa ani nie zmienia znaczenia istniejącej kolumny**. Stary kod działa na starych kolumnach przez cały czas; nowy kod czyta nowe tabele; o tym, co widzi klient, decyduje flaga, nie migracja. Rollback = wyłączenie flagi, bez cofania migracji.

### Krok 1 — EXPAND (jedna migracja, w pełni addytywna, bezpieczna na prod)

```sql
-- 20261010000000_experience_offer_centric_expand.sql
CREATE TABLE experience_guides (...);          -- §2.1
CREATE TABLE experience_prices (...);          -- §2.3
CREATE TABLE experience_slug_aliases (...);    -- §2.8
ALTER TABLE experience_pages ADD COLUMN offer_mode ..., price_from_cents ..., fee_pct ..., suited_for ..., ...;  -- §2.2, §2.5 — wszystko z DEFAULT lub NULL
ALTER TABLE experience_page_options ADD COLUMN kind ..., price_from_cents ..., sample_itinerary ...;             -- §2.4
ALTER TABLE guides ADD COLUMN association ..., response_time_hours ..., gear_text ...;                           -- §2.6
ALTER TABLE reviews ADD COLUMN experience_id ...;                                                                -- §2.7
ALTER TABLE experience_pages ADD COLUMN page_version smallint NOT NULL DEFAULT 1 CHECK (page_version IN (1,2));  -- przełącznik per strona

-- Backfill w tej samej migracji (idempotentny):
INSERT INTO experience_guides (experience_id, guide_id, role)
  SELECT id, guide_id, 'primary' FROM experience_pages WHERE guide_id IS NOT NULL
  ON CONFLICT DO NOTHING;
UPDATE experience_pages SET price_from_cents = round(price_from * 100) WHERE price_from_cents IS NULL;
UPDATE experience_pages SET offer_mode = 'custom' WHERE country IN ('Iceland','Norway','Finland');
UPDATE experience_page_options SET price_from_cents = round(price_from * 100) WHERE price_from_cents IS NULL;
INSERT INTO experience_prices (experience_id, days, anglers, guide_price_cents, currency)
  SELECT id, 1, max_anglers_per_guide, price_from_cents, currency FROM experience_pages
  WHERE offer_mode = 'fixed' AND price_from_cents > 0
  ON CONFLICT DO NOTHING;

-- RLS + policy jak na experience_pages (konwencja 02-data-model §2).
```

Nic nie zostaje usunięte ani przemianowane. Rename `experience_pages → experiences` (O-04) **nie wchodzi** w ten krok — zostaje w kroku 4 etapu 4 razem z resztą dropów.

### Krok 2 — SYNC w obie strony na czas przejścia

Dopóki admin i stary szablon piszą `guide_id` / `price_from`, a nowy kod pisze `experience_guides` / `price_from_cents`, trzymamy je w zgodzie triggerami, żeby żadna ścieżka nie zobaczyła przestarzałych danych:

```sql
-- stare → nowe: ktoś zmienił guide_id w starym adminie
CREATE FUNCTION sync_guide_id_to_experience_guides() RETURNS trigger AS $$
BEGIN
  IF NEW.guide_id IS DISTINCT FROM OLD.guide_id THEN
    UPDATE experience_guides SET status = 'paused' WHERE experience_id = NEW.id AND role = 'primary';
    IF NEW.guide_id IS NOT NULL THEN
      INSERT INTO experience_guides (experience_id, guide_id, role, status) VALUES (NEW.id, NEW.guide_id, 'primary', 'active')
      ON CONFLICT (experience_id, guide_id) DO UPDATE SET role = 'primary', status = 'active';
    END IF;
  END IF;
  IF NEW.price_from IS DISTINCT FROM OLD.price_from THEN NEW.price_from_cents := round(NEW.price_from * 100); END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_guide_id BEFORE UPDATE ON experience_pages FOR EACH ROW EXECUTE FUNCTION sync_guide_id_to_experience_guides();

-- nowe → stare: nowy admin zmienił primary w experience_guides
CREATE FUNCTION sync_primary_guide_to_guide_id() RETURNS trigger AS $$
BEGIN
  UPDATE experience_pages SET guide_id = (
    SELECT guide_id FROM experience_guides WHERE experience_id = COALESCE(NEW.experience_id, OLD.experience_id)
      AND role = 'primary' AND status = 'active' LIMIT 1
  ) WHERE id = COALESCE(NEW.experience_id, OLD.experience_id);
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_primary AFTER INSERT OR UPDATE OR DELETE ON experience_guides FOR EACH ROW EXECUTE FUNCTION sync_primary_guide_to_guide_id();
```

Strona z dwoma aktywnymi przewodnikami ma w `guide_id` tego oznaczonego `primary` — stary szablon dalej działa, pokazuje jednego. Triggery są tymczasowe i spadają w kroku CONTRACT.

### Krok 3 — SWITCH: dwa szablony, ta sama ścieżka `/experiences/[slug]`

```
src/app/experiences/[slug]/page.tsx       → router: page_version === 2 && flag ? <ExperienceV2/> : <ExperienceV1/>
src/app/experiences/[slug]/_v1/*          → dzisiejszy kod, przeniesiony bez zmian
src/app/experiences/[slug]/_v2/*          → nowy szablon z wireframe'u (sticky widget, kalkulator, S3–S14)
```

- Flaga globalna `EXPERIENCE_V2_ENABLED` (env) **i** `experience_pages.page_version` per strona. Obie muszą być „on", żeby klient zobaczył v2. Pozwala to włączyć v2 na jednej stronie (np. NZ sight-fishing) i porównać konwersję w Ads, zanim przełączy się resztę.
- Podgląd v2 bez włączania: `?preview=v2` dla zalogowanego admina (`profiles.role`).
- Formularz 3-krokowy pisze do `inquiries` tak jak dziś (`experience_page_id`, `party_size`, `requested_dates`, `message`) **plus** nowe klucze do `brief` jsonb. Stary formularz nic nie wie o `brief` i dalej działa. `inquiries.guide_id` v2 ustawia na `primary` z `experience_guides` — żeby `resolveOfferGuide` i agent nie zmieniły zachowania.
- Stary slug po scaleniu dwóch stron: `experience_slug_aliases` → 301 w `page.tsx` (lookup przed 404). Scalanie dopiero po włączeniu v2 na stronie docelowej.
- Admin: `ExperiencePageForm` dostaje zakładkę „v2" (przewodnicy, tryb, cennik, nowe pola) obok obecnych pól; stare pola nadal edytowalne, triggery z kroku 2 trzymają zgodność.

### Krok 4 — CONTRACT (po ≥ 1 tygodniu v2 na wszystkich stronach, w etapie 4 razem z rename)

```sql
-- 2026xxxx_experience_offer_centric_contract.sql — poprzedzona STOP gate i pg_dump
DROP TRIGGER trg_sync_guide_id ON experience_pages;  DROP TRIGGER trg_sync_primary ON experience_guides;
ALTER TABLE experience_pages DROP COLUMN guide_id, DROP COLUMN price_from, DROP COLUMN difficulty, DROP COLUMN physical_effort,
  DROP COLUMN boat_description, DROP COLUMN boat_image_url, DROP COLUMN boats, DROP COLUMN rod_setup,
  DROP COLUMN special_attraction_text, DROP COLUMN special_attraction_image_url, DROP COLUMN best_months,
  DROP COLUMN season_start, DROP COLUMN season_end, DROP COLUMN page_version;
ALTER TABLE experience_page_options DROP COLUMN price_from;
ALTER TABLE inquiries DROP COLUMN guide_id;          -- razem z drop_legacy_inquiry_columns
ALTER TABLE experience_pages RENAME TO experiences;  -- O-04
ALTER TABLE experience_page_options RENAME TO experience_options;
```

Usunięcie `_v1/*` i flagi w tym samym PR.

### Warunki przejścia między krokami (bramki)

| Z → do | Warunek | Dowód |
|---|---|---|
| 1 → 2 | migracja expand na prod, typy zregenerowane, `SELECT count(*) FROM experience_guides` = liczba stron z `guide_id` | `docs/proof/` |
| 2 → 3 | zmiana `guide_id` w starym adminie odbija się w `experience_guides` i odwrotnie (test w `__tests__`) | red proof: trigger wyłączony → test czerwony |
| 3 (jedna strona) → 3 (wszystkie) | ≥ 2 tygodnie v2 na stronie pilotażowej; brak regresji w `inquiry_events` (`inquiry.created` z tej strony ≥ poziom v1); formularz v2 zapisuje `brief` | admin Pipeline / zapytanie SQL |
| 3 → 4 | wszystkie strony `page_version = 2`, zero odwołań do `guide_id` / `price_from` w `src/` poza `_v1` | `grep` w CI |

### Gdzie to robić: gałąź Supabase, nie prod

Krok 1 i 2 najpierw na gałęzi Supabase (preview branch z kopią schematu) + Vercel preview: tam odpala się migrację, regeneruje typy i klika v2 z `?preview=v2`. Na prod wchodzi dopiero PR z zieloną migracją na gałęzi. Jedna migracja = jeden PR = jedno zadanie FA-x.yy, zgodnie z ADR-0005.

### Podział na zadania (zapisane 2026-10-05 jako FA-1.50–1.57; CONTRACT odłożony)

1. FA-x.a — migracja EXPAND + backfill + RLS + typy (bez kodu UI).
2. FA-x.b — triggery SYNC + testy obustronne.
3. FA-x.c — `_v1/` wydzielenie + router z flagą (zero zmian wizualnych; red proof: flaga on bez v2 → 500).
4. FA-x.d — szablon v2: S0–S2 (hero, chipy, sticky widget z kalkulatorem z `experience_prices`).
5. FA-x.e — szablon v2: S3–S9.
6. FA-x.f — szablon v2: S10–S14 + formularz 3-krokowy → `inquiries` + `brief`.
7. FA-x.g — admin: zakładka v2 (przewodnicy, tryb, cennik, nowe pola) + aliasy slugów.
8. FA-x.h — pilot: `page_version=2` na jednej stronie NZ; pomiar 2 tygodnie.
9. FA-x.i — CONTRACT (etap 4, razem z rename).
