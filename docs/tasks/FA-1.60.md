---
id: FA-1.60
title: Lejek stron v2 mierzalny etap po etapie — eventy GA4 (`experience_view`, `section_view`, `form_open`, `form_step`, `page_version`/`page_slug` przy `SUBMIT_LEAD_FORM`) + `inquiries.page_version`/`page_slug` + pola w adminie
stage: 1
status: in_progress
difficulty: M
model: opus
model_approved: opus by tj 2026-10-14
effort: medium
agent: fa-web
branch: feat/fa-1.60-v2-funnel-events
depends_on: [FA-1.57]
blocked_by_questions: []
touches_db: true
touches_prod: true       # tylko migracja + INSERT/DELETE zapytania testowego, każde po STOP
estimate_h: 6
owner: tj
---

# FA-1.60 — Lejek stron v2: eventy GA4 + wersja i slug strony przy zapytaniu

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje kodu, nazewnictwo, migracje, regeneracja typów
- `docs/tasks/FA-1.57.md` — pilot v2: flaga `EXPERIENCE_V2_ENABLED`, `page_version` na `experience_pages`, renderer v2 (S3–S14), wieloetapowy formularz. To zadanie dokłada **pomiar** do tego, co FA-1.57 wdrożyło
- `docs/02-data-model.md` + `docs/audit/rebuild-audit-db-aug-2026.md` — schemat `inquiries` (kolumny `trip_length`, `gclid`, `utm`, `source` dodane 20260820/27 — nowe kolumny dokładasz obok nich, tym samym wzorcem)
- `docs/REBUILD_PLAN.md` §7 — definicje metryk; lejek strony ma być spójny z tym, co tam opisano
- `docs/05-agent-operations.md` — §2 polityka modeli, §5 format raportu
- Plik z `trackSubmitLeadForm` i wywołaniem `gtag('event','conversion',{send_to:'AW-18171634204/yydcCKmuoe0cEJzE9NhD',…})` — ścieżkę ustal odczytem (`grep -rn "yydcCKmuoe0cEJzE9NhD" src`). To wywołanie jest pomiarem Google Ads i **nie może się zmienić**

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Pilot v2 stron NZ (live od 14.10.2026 ~16:40) ma być mierzalny etap po etapie. Dziś GA4 widzi
na stronach `/experiences/*` wyłącznie `page_view`, `scroll` i `SUBMIT_LEAD_FORM` (sprawdzone
w GA4 za 16.09–13.10: zero `form_start`, zero `generate_lead` — auto-pomiar formularzy tagu
Google nie łapie widgetu). Baza nie wie, która wersja strony ani która strona wygenerowała
zapytanie (`inquiries.experience_page_id` nie zgadza się z GA4 per strona — ustal odczytem, jak
jest ustawiane, i opisz w raporcie; nie zmieniaj tego w tym zadaniu). Po zadaniu każdy etap
lejka v1 i v2 jest w GA4 tą samą miarą, a każde zapytanie w bazie ma wersję i slug strony.

## Zakres
- [ ] Odczyt bieżącego stanu: plik z `trackSubmitLeadForm` / konwersją Ads; renderer v1 i v2 na `/experiences/[slug]` (jakie sekcje istnieją, jak się nazywają w kodzie); widget/formularz v1 i v2 (wspólny punkt zaczepienia dla `form_open`? identyfikatory kroków v2?); akcja zapisu zapytania z formularza; `information_schema.columns` dla `inquiries` na prod (zapytanie, nie plik typów); jak ustawiane jest `inquiries.experience_page_id`
- [ ] Eventy GA4 (gtag, ten sam kanał co `SUBMIT_LEAD_FORM` z `send_to` do `G-Z3Y8GMHR4J`), każdy z parametrami `page_version` (`'1'|'2'` — wersja faktycznie wyrenderowana, także przy `?preview=v2`) i `page_slug`:
  - [ ] a. `experience_view` — raz na załadowanie strony `/experiences/[slug]` (nie modyfikuj automatycznego `page_view`)
  - [ ] b. `section_view` — raz na sekcję na załadowanie, IntersectionObserver (≥50% widoczne), param `section`: obowiązkowo `'pricing'` (grid/cennik v2); dodatkowo `'options'`, `'not_suited'`, `'faq'`, jeśli takie sekcje istnieją w rendererze v2 (nazwy z kodu, nie wymyślone). Na v1 — tylko sekcje, które tam realnie są
  - [ ] c. `form_open` — pierwsze otwarcie / pierwsza interakcja z widgetem zapytania (v1 i v2)
  - [ ] d. `form_step` — przy wejściu w każdy krok formularza v2: `step` (nazwa kroku z kodu), `step_index` (1..n), `total_steps`. Na v1 (jednoetapowy) jeden `form_step` ze `step='single'`, `step_index=1`, `total_steps=1`
  - [ ] e. `SUBMIT_LEAD_FORM` — dołóż `page_version` i `page_slug` do istniejącego eventu GA4 (bez zmiany `value`/`currency`)
  - [ ] wywołanie konwersji Ads (`gtag 'conversion'`, `send_to AW-…`) zostaje bajt w bajt
- [ ] Baza: migracja dodająca do `inquiries` kolumny `page_version smallint NULL CHECK (page_version IN (1,2))` i `page_slug text NULL`; akcja zapisu zapytania z formularza ustawia obie (wersja wyrenderowana + slug strony, na której formularz wysłano). Bez backfillu. Typy Supabase przegenerowane, jeśli repo tak robi (wg `docs/03-conventions.md`)
- [ ] Admin: szczegół zapytania pokazuje `page_version` i `page_slug` (jedno pole tekstowe obok `source`/`utm`; bez nowych ekranów)

## Gotowe, gdy
- [ ] Na stronie NZ v2 w GA4 DebugView jeden przebieg daje w tej kolejności: `experience_view(page_version=2, page_slug)` → `section_view(section=pricing)` → `form_open` → `form_step` dla KAŻDEGO kroku (`trip`/`angler`/`contact`, indeksy 1..3, `total_steps=3`) → `SUBMIT_LEAD_FORM` z `value`, `page_version`, `page_slug`. Zrzut/lista z DebugView w raporcie (kroki i nazwy: decyzja tj D2, 14.10)
- [ ] Ten sam przebieg na stronie v1 (np. Brynjar, Islandia): `experience_view(page_version=1)` → `section_view(section=pricing)` (blok „Price” v1) → `form_open` → `form_step(calendar,1,2)` → `form_step(form,2,2)` → `SUBMIT_LEAD_FORM` (v1 ma dwa kroki, nie jeden; blok „Price” liczy się jako `pricing` — decyzje tj D2 i D3, 14.10)
- [ ] Żaden event nie odpala się podwójnie na jedno załadowanie/krok (guard jak `submittingRef` przy konwersji) — pokazany na czerwono (guard usunięty → podwójny event)
- [ ] Request konwersji Ads (`googleadservices.com/pagead/conversion/18171634204/…`) na v1 niezmieniony — porównanie parametrów przed/po (label, value, currency_code) w raporcie; na v2 request pojawia się (wcześniej go nie było) z tym samym labelem i walutą PLN (decyzja tj D1, 14.10)
- [x] Migracja w `supabase/migrations` (nazwa wg konwencji repo); `CHECK` pokazany na czerwono (`page_version=3` odrzucone); na prod po STOP (15.10: 2 wiersze, wynik w notatkach): `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='inquiries' AND column_name IN ('page_version','page_slug')` zwraca 2 wiersze — wynik w raporcie
- [ ] Zapytanie testowe wysłane z v2 ma w bazie `page_version=2` i `page_slug` strony (SELECT w raporcie), a następnie jest USUNIĘTE (DELETE po STOP, wynik w raporcie; jak `audit_20260903` we wrześniu)
- [ ] Admin pokazuje oba pola dla tego zapytania (zrzut przed usunięciem)
- [ ] Parytet zapisu v2 z v1: testowe zapytanie z v2 ma w bazie `gclid`, `utm`, `source`, `trip_length`, `party_size` tak jak v1, a `value` w `SUBMIT_LEAD_FORM` liczone przez `estimateLeadValue` (region z `getRegionGroup(location)`) — SELECT tych kolumn w raporcie (decyzja tj, „go” 14.10, pkt 1)
- [ ] Test na prod z consentem `ad_storage=denied`, `analytics_storage=granted`: brak requestu do `googleadservices.com`; request konwersji Ads zweryfikowany lokalnie Playwrightem (przed/po). Zapytanie testowe: imię „TEST FA-1.60”, mail tj (decyzja tj, „go” 14.10, pkt 2)
- [ ] Lista zapytań ze stron NZ v2 z `created_at ≥ 2026-10-14 16:40` (Europe/Warsaw) sprzed merge'a — do ręcznego importu offline konwersji w Ads (decyzja tj, „go” 14.10, pkt 3)
- [ ] Build i lint przechodzą; brak `as any` w nowym kodzie

### Rozszerzenie: Waters / Programs w „About this trip” (decyzja tj 2026-10-15, przed merge'em)
Strona v2 ma dwie listy bloków ze zdjęciami — **Waters** i **Programs** — tego samego kształtu
co dzisiejsze Programs (`offer-story-block.tsx`: nagłówek, tekst, galeria, lightbox przy ≥2
zdjęciach). Zapis bez migracji: blok w `experience_pages.content_blocks` ma opcjonalne
`section: 'waters' | 'programs'`, brak pola = `programs`. Waters bez bloków → dzisiejsza linijka
`environment.join(' · ')`; kolumny `environment` i jej użyć nie ruszamy. Bloki opcji, edytor v2,
v1, przenoszenie danych z `environment` — poza zakresem.
- [x] Test jednostkowy schematu: blok z `section:'waters'` przechodzi przez `contentBlocksSchema` i zachowuje pole; red proof: bez zmiany w schemacie test pada (pole wycięte)
- [x] Test `parseContentBlocks`: brak / `'programs'` / śmieciowa wartość → programs; `'waters'` → waters
- [x] Testy `offer-story`: (a) bloki Waters → `offer-waters` zawiera karty bloków, nie linijkę; (b) brak bloków Waters + niepuste environment → linijka jak dziś; (c) bloki Waters nie pojawiają się w `offer-programs`
- [x] Lokalnie (Playwright): w adminie blok Waters z 2 zdjęciami → zapis → na v2 karta w Waters z badge „+1 photos” i działającym lightboxem; strona bez bloków Waters wygląda jak przed zmianą; zrzuty przed/po w `.fa-proofs/fa-1.60/`
- [x] Strona v1: bloki z `section:'waters'` renderują się jak każdy inny blok, bez zmian w kodzie v1 — odczyt renderera v1 + jeden zrzut
- [x] `pnpm typecheck`, `lint`, `test`, `knip` zielone

### Rozszerzenie: mapa v2 nad innymi warstwami (decyzja tj 2026-10-15)
Na stronach v2 mapa (S11, `offer-logistics.tsx`) bywa renderowana NAD innymi warstwami.
Tylko kontener mapy i jej kontrolki — innych z-indexów nie dotykamy, bez doraźnego `z-index: 9999`.
- [x] Reprodukcja Playwrightem na 390 i 1280 px przy przewijaniu przez mapę z otwartym widgetem/headerem/drawerem; zrzuty „przed” w `.fa-proofs/fa-1.60/`; w raporcie: co dokładnie przykrywa i na jakiej szerokości
- [x] Przyczyna z odczytu kodu: kontekst stackowania kontenera mapy i biblioteka (Leaflet/Mapbox/Google — domyślne z-index panów i kontrolek 400–1000)
- [ ] Naprawa: izolacja kontenera mapy (`isolation: isolate` / własny kontekst stackowania); skala z-index z `docs/03-conventions.md`, a jeśli jej nie ma — propozycja skali (mapa < treść sticky < header < drawer/modal) i czekanie na akceptację tj
- [x] Zrzuty „po” na 390 i 1280 bez nachodzenia; red proof: cofnięcie poprawki przywraca nachodzenie

## Poza zakresem
- Split per cookie / A/B, Google Ads Experiments
- Backfill `page_version` dla historycznych zapytań
- Naprawa sposobu ustawiania `experience_page_id` (tylko opis w raporcie)
- Zmiany w treści/układzie stron v2, cenach, tekstach — tj poprawia w adminie
- Rejestracja wymiarów niestandardowych w GA4 (`page_version`, `page_slug`, `section`, `step`, `step_index`) — robi tj w panelu GA4; w raporcie dokładna lista nazw parametrów do zarejestrowania
- Jakiekolwiek zmiany env w Vercel, flag, `EXPERIENCE_V2_ENABLED`
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Decyzje
Każdą decyzję, której ten plik nie rozstrzyga, agent zatrzymuje i przedstawia tj: opcje z opisem
konsekwencji + rekomendacja. Nie wybiera sam. W szczególności: nazwy kroków formularza v2 (jeśli
kod nie ma czytelnych identyfikatorów kroków — propozycja listy i czekanie), lista sekcji poza
`'pricing'`, oraz co zrobić, jeśli widget v1 i v2 to różne komponenty bez wspólnego punktu
zaczepienia dla `form_open`.

## Bramki STOP
- przed każdym zapisem na prod `uwxrstbplaoxfghrchcy`: `db push` / `apply_migration` / INSERT testowego zapytania przez prod / DELETE zapytania testowego — diff migracji i dokładne SQL, czekanie na zgodę
- przed jakąkolwiek zmianą w wywołaniu `gtag('event','conversion',…)` do `AW-18171634204` — docelowo zero zmian; jeśli agent uważa, że trzeba, zatrzymuje się i uzasadnia
- jeśli trzeba dotknąć istniejącego pliku migracji, typów RLS, env Vercel
- stan bazy ustalany bieżącym odczytem, nigdy z pamięci, z notatek ani z pliku typów

## Weryfikacja
```
grep -rn "yydcCKmuoe0cEJzE9NhD" src                      # konwersja Ads — diff przed/po pusty
git diff main -- <plik z konwersją> | grep -n "conversion"  # brak zmian w wywołaniu 'conversion'
grep -rn "as any" $(git diff --name-only main -- src)     # 0 trafień
pnpm typecheck && pnpm lint && pnpm test && pnpm build   # build przy zatrzymanym stacku (§9) albo zielony CI
-- prod, po STOP:
SELECT column_name, data_type, is_nullable FROM information_schema.columns
 WHERE table_name='inquiries' AND column_name IN ('page_version','page_slug');
SELECT id, page_version, page_slug, created_at FROM inquiries WHERE id='<testowe>';
```
DebugView v1 i v2 — lista eventów z parametrami; Network — request do `googleadservices.com` przed/po.

## Notatki z realizacji
- 2026-10-14 tj: zadanie zlecone jako „FA-1.58”; numer zajęty (FA-1.58 = flaga `RESEND_DEV_FAKE`, done, PR #139) → decyzja tj: FA-1.60. `depends_on: [FA-1.57]` — decyzja tj: FA-1.57 przechodzi na `in_progress` (pilot live od 14.10 ~16:40), co wystarcza do startu tego zadania. Model: Opus, effort medium — zatwierdzone przez tj 14.10.
- 2026-10-14 odczyt przed startem (agent):
  - Formularz v2 (`src/components/inquiry-wizard/inquiry-wizard.tsx`, `submit`) nie woła `trackSubmitLeadForm` — na v2 nie ma ani konwersji Ads, ani `SUBMIT_LEAD_FORM`. Na prod `page_version=2` mają 3 strony NZ (`fly-fishing---taup--tongariro-central-north-island`, `fly-fishing-south-island-new-zealand`, `guided-fly-fishing-north-island-new-zealand`); od 14.10 z nich 0 zapytań.
  - Modal v1 ma dwa kroki (`'calendar' | 'form'`, `InquiryWidget.tsx:68`), nie jeden.
  - v2: sekcje mają `data-section` S3–S14 (`offer-section.tsx`); osobnych sekcji „options” i „not_suited” nie ma (S5 `OfferFit` = suited + not suited; archetypy w S6/S9, dodatki w S4).
  - `trackFormStart` (`form_start`) nie ma `send_to` do GA4 — stąd zero `form_start` w GA4.
- 2026-10-14 decyzje tj (AskUserQuestion):
  - D1 (STOP konwersji): v2 woła `trackSubmitLeadForm` bez zmian w `gtag.ts`; `value = estimateLeadValue({ tripLength: przedział z brief.days, groupSize: anglers, location: kraj strony })`, PLN.
  - D2: `form_step` v2 = `trip`/`angler`/`contact` (1..3), krok 1 odpala razem z `form_open` (także gdy CTA widgetu otwiera od razu krok 2); v1 = `calendar` (1/2), `form` (2/2).
  - D3: `section_view` v2 = `pricing` (S9), `faq` (S13), `fit` (S5); `options` pominięte. v1 = `pricing` (blok „Price”), `faq`.
  - D4: `form_open` v2 = pierwsze z: otwarcie overlayu z dowolnego CTA, pierwsza zmiana pola kroku 1 inline w S14, pierwsza zmiana dat/liczby osób w sticky widgecie. v1 = pierwsze otwarcie modala. Wspólny helper w `gtag.ts`, raz na załadowanie strony.
- 2026-10-14 tj „go” z uzupełnieniami: (1) parytet zapisu v2 z v1 (`gclid`, `utm`, `source`, `trip_length`, `party_size`, `value` przez `estimateLeadValue`) — braki naprawiane w ramach D1; (2) test prod z `ad_storage=denied` / `analytics_storage=granted`, konwersja Ads tylko lokalnie Playwrightem, imię „TEST FA-1.60”, mail tj, przy STOP propozycja zatrzymania agenta/maili; (3) kolejność: migracja → merge → test prod → SELECT + zrzut admina → DELETE; w raporcie lista zapytań NZ v2 od 14.10 16:40.
- 2026-10-14 STOP 1 — decyzje tj: (A) migrację na prod puszcza tj (push migracji CLI Supabase wg `docs/ops/db-push-checklist.md`, przed nim lista migracji → pending tylko `20261010000000`); agent po „zrobione” odpala SELECT z `information_schema`. Nit: `ADD CONSTRAINT` nie jest idempotentne → oba polecenia bez warunku (zrobione przed push'em; ponowne wykonanie pliku pada głośno na obu — `.fa-proofs/fa-1.60/red-check-constraint-after-nit.log`). Plan STOP 2 przyjęty z dodatkami: test z bezpośredniego wejścia, bez `gclid` i bez kliknięcia w reklamę; blokada `*pagead/conversion/18171634204*` i `*googleadservices.com*` w DevTools jako druga warstwa; trap field `trip_notes_extra='FA-1.60 test'`; DELETE obejmuje `inquiries` + `inquiry_events`, w raporcie `count(*) = 0` po obu; potwierdzenie, że `SUBMIT_LEAD_FORM` w Ads jest działaniem Dodatkowym.
- 2026-10-15 odczyt prod po zgłoszonym „done” push'a (MCP `supabase-prod`, read-only): `information_schema` → 0 wierszy `page_version`/`page_slug`, `pg_constraint` → brak `inquiries_page_version_check`, `max(version)` = `20261009000000`, `list_migrations` kończy się na `20261009000000`. Migracja **nie** jest na prod; push się nie wykonał (tj: CLI na Macu ma nieaktualne hasło do bazy).
- 2026-10-15 decyzja tj: opcja B — `apply_migration` (MCP) na `uwxrstbplaoxfghrchcy`, nazwa `inquiries_page_version_slug`, treść = plik z `79ccb1a`; potem zmiana nazwy pliku na wersję z MCP (osobny commit) i cztery odczyty. **Nie wykonane:** MCP `supabase-prod` ma w `.mcp.json` `read_only=true` (brak `apply_migration`), a konektor Supabase w claude.ai jest zalogowany na konto bez FjordAnglers — `list_projects` pokazuje 5 innych projektów, `get_project uwxrstbplaoxfghrchcy` → „You do not have permission to perform this action”. Na prod nic nie zapisano. Lekcja dopisana do `docs/ops/db-push-checklist.md` § Lekcje.
- Typ działania `SUBMIT_LEAD_FORM` w Ads (Główne/Dodatkowe): niezweryfikowane — czeka na zrzut tj.
- 2026-10-15 tj: migrację `20261010000000` zastosował z Maca push'em CLI (`migration list --linked`: Local = Remote we wszystkich wierszach). Odczyt prod (MCP `supabase-prod`, read-only) po tym:
  - `information_schema.columns` (`inquiries`, `page_version`/`page_slug`) → `page_slug | text | YES`, `page_version | smallint | YES`
  - `pg_constraint` → `inquiries_page_version_check | CHECK (((page_version IS NULL) OR (page_version = ANY (ARRAY[1, 2]))))`
  - `max(version)` w `schema_migrations` → `20261010000000`; `list_migrations` kończy się `20261010000000 inquiries_page_version_slug` — wersja = nazwa pliku, zmiana nazwy pliku niepotrzebna
  - wierszy `inquiries` z niepustym `page_version`/`page_slug`: 0 (kod jeszcze niezmergowany)
- 2026-10-15 decyzja tj: rozszerzenie zakresu o Waters/Programs (bloki z `section` w `content_blocks`, bez migracji, fallback do `environment`) — pierwszeństwo przed plikiem zadania, robione przed merge'em; kolejność merge → test prod → SELECT + zrzut → DELETE bez zmian. Kryteria w „Gotowe, gdy” § Rozszerzenie. Zapis bloku Waters przez admin na prod robi tj.
- 2026-10-15 decyzja tj (wiadomość z 15.10 przed STOP 2): mapa v2 nad innymi warstwami — osobne kryterium w „Gotowe, gdy” § Rozszerzenie.
- 2026-10-15 Waters/Programs — wykonane (commity `a51bb74`, `aec61e5`):
  - Zapis: `contentBlockSchema` (`v2-editor.ts`) dostał `section: z.enum(['waters','programs']).optional()`; bez tego zod wycinał pole — red proof `.fa-proofs/fa-1.60/red-waters-section-schema.log` (`expected [ undefined, undefined ] to deeply equal [ 'waters', 'programs' ]`). Test DB `experience-pages-v2.test.ts` potwierdza zapis przez `updateExperiencePage`. `ContentBlock` (akcje) ma `section?`.
  - Odczyt: `parseContentBlocks` → `StoryBlock.section`; `'waters'` tylko przy dokładnie tej wartości, wszystko inne (brak, `programs`, `Waters`, liczba, null) → `programs` (`pageBlockSection`, jedna funkcja dla parsera i formularza).
  - Wybór techniczny: **jedno pole** `ExperienceV2.contentBlocks` z sekcją przy każdym bloku, podział w `OfferStory` — bez nowego pola w `queries.ts`, kolejność z bazy zachowana, a warunek (c) „Waters nie w Programs” jest testem renderera, który faktycznie dzieli.
  - `OfferStory`: Waters = siatka `OfferStoryBlock` (ten sam grid 1/2 kolumny i `single`), bez bloków Waters → linijka `environment.join(' · ')`; Programs bez bloków Waters; warunek niepustej sekcji i odstępy liczą bloki Waters. Komentarz na górze pliku zaktualizowany.
  - Admin: dwie listy `PageBlockList` („Waters”, „Programs”), każda z „+ Add block”; zapis `mergePageBlocks` — najpierw Waters, potem Programs, kolejność wewnątrz listy zachowana, `section` ustawione przy każdym bloku; bloki bez `section` trafiają do Programs. Edycja wierszy po kluczu, nie indeksie.
  - Playwright lokalnie (`waters-run.mjs`, seed `seed-backcountry-day-nz`, zdjęcia z lokalnej galerii przewodnika dodanej na czas dowodu i usuniętej): admin → Waters „Tongariro River” z 2 zdjęciami → zapis → `content_blocks` w bazie (`waters-local-content-blocks.log`: Waters pierwszy z `section:'waters'`, dwa dotychczasowe z `section:'programs'`) → v2: karta w Waters, badge `+1 photos`, `aria-label` „Open 2 photos of Tongariro River”, lightbox `1 / 2 → 2 / 2 → Esc`. Zrzuty `waters-admin-lists.png`, `waters-v2-story.png`, `waters-lightbox.png`.
  - Strona bez bloków Waters jak przed zmianą: zrzut sekcji przed (kod `0f46649`, osobny worktree) i po — identyczne bajtowo (`no-waters-before-after-compare.log`, ten sam sha256).
  - v1: renderer (`ExperienceV1.tsx` „PAGE CONTENT BLOCKS”) czyta tylko `headline`/`image_url`/`text`, `section` ignoruje; zrzut `waters-v1-blocks.png` — Tongariro River jako zwykły blok, pierwszy. Kod v1 bez zmian.
  - Zauważone: `createExperiencePage` nie zapisuje `content_blocks` (wiersz „exp-v2 feedback 1” w deferred już to opisuje) — bloki Waters dodane przy tworzeniu nowej strony giną do drugiego zapisu, tak jak Programs dziś.
- 2026-10-15 mapa v2 — wykonane (commit `56fd94f`):
  - Biblioteka: Leaflet przez `react-leaflet` (`src/components/offer/LocationMap.tsx`). Odczyt stylów (`stack-probe`): `.leaflet-map-pane` z-index 400 + transform, `.leaflet-tile-pane` 200, `.leaflet-top` 1000, `.leaflet-control-zoom` 800; żaden przodek mapy nie tworzył kontekstu stackowania, więc te wartości konkurowały z warstwami strony: pasek mobilny 40, wizard 50, nav 50, menu mobilne 49.
  - Reprodukcja (`map-run.mjs`, `elementFromPoint` + zrzuty, 390 i 1280 px; lokalnie na czas dowodu `location_lat/lng` na seedzie, potem wycofane): **przed** mapa nad warstwą w 4 przypadkach — 390: pasek rezerwacji (kontrolka zoom i kafle), wizard (mapa na kroku 2 formularza); 1280: wizard (kontrolka i kafle nad tłem i dołem panelu). Nav i menu mobilne nie mogą się nałożyć: na stronach experience nav chowa się po przewinięciu >80 px i wraca tylko na górze strony, menu zamyka się przy przewijaniu w dół (`nav.tsx`). Zrzuty `map-before-*.png`, log `map-before.log`.
  - Naprawa: `isolate` (`isolation: isolate`) na kontenerze mapy w S11 (`offer-logistics.tsx`) — żadna wartość z-index nie zmieniona. **Po**: 0 z 8 (`map-after.log`, `map-after-*.png`). Red proof: bez `isolate` znów 4 z 8 (`red-map-isolation-removed.log`).
  - Skala z-index: w `docs/03-conventions.md` jej nie ma → propozycja w deferred (nie wprowadzona), czeka na decyzję tj. Ta sama mapa na `/offers/[token]` bez izolacji — poza zakresem, wiersz w deferred.
  - Weryfikacja: `tsc` czysty; vitest 88 plików / 1062 testy zielone (`full-suite-waters-map.log`); eslint 0 błędów (`lint-waters-map.log`; w zmienionych plikach te same 4 ostrzeżenia co na `main`); knip czysty (`knip-waters.log`).
