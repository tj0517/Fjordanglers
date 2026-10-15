---
id: FA-1.60
title: Lejek stron v2 mierzalny etap po etapie — eventy GA4 (`experience_view`, `section_view`, `form_open`, `form_step`, `page_version`/`page_slug` przy `SUBMIT_LEAD_FORM`) + `inquiries.page_version`/`page_slug` + pola w adminie
stage: 1
status: done
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
- [x] Odczyt bieżącego stanu: plik z `trackSubmitLeadForm` / konwersją Ads; renderer v1 i v2 na `/experiences/[slug]` (jakie sekcje istnieją, jak się nazywają w kodzie); widget/formularz v1 i v2 (wspólny punkt zaczepienia dla `form_open`? identyfikatory kroków v2?); akcja zapisu zapytania z formularza; `information_schema.columns` dla `inquiries` na prod (zapytanie, nie plik typów); jak ustawiane jest `inquiries.experience_page_id` — notatki 14.10 „odczyt przed startem”
- [x] Eventy GA4 (gtag, ten sam kanał co `SUBMIT_LEAD_FORM` z `send_to` do `G-Z3Y8GMHR4J`), każdy z parametrami `page_version` (`'1'|'2'` — wersja faktycznie wyrenderowana, także przy `?preview=v2`) i `page_slug`: — PR #145; testy `experience-funnel.test.tsx`, `inquiry-wizard.test.tsx`
  - [x] a. `experience_view` — raz na załadowanie strony `/experiences/[slug]` (nie modyfikuj automatycznego `page_view`)
  - [x] b. `section_view` — raz na sekcję na załadowanie, IntersectionObserver (≥50% widoczne), param `section`: obowiązkowo `'pricing'` (grid/cennik v2); dodatkowo `'options'`, `'not_suited'`, `'faq'`, jeśli takie sekcje istnieją w rendererze v2 (nazwy z kodu, nie wymyślone). Na v1 — tylko sekcje, które tam realnie są
  - [x] c. `form_open` — pierwsze otwarcie / pierwsza interakcja z widgetem zapytania (v1 i v2)
  - [x] d. `form_step` — przy wejściu w każdy krok formularza v2: `step` (nazwa kroku z kodu), `step_index` (1..n), `total_steps`. Na v1 (jednoetapowy) jeden `form_step` ze `step='single'`, `step_index=1`, `total_steps=1`
  - [x] e. `SUBMIT_LEAD_FORM` — dołóż `page_version` i `page_slug` do istniejącego eventu GA4 (bez zmiany `value`/`currency`)
  - [x] wywołanie konwersji Ads (`gtag 'conversion'`, `send_to AW-…`) zostaje bajt w bajt — `ads-conversion-v1-before-after.log` (label, value, currency_code identyczne)
- [x] Baza: migracja dodająca do `inquiries` kolumny `page_version smallint NULL CHECK (page_version IN (1,2))` i `page_slug text NULL`; akcja zapisu zapytania z formularza ustawia obie (wersja wyrenderowana + slug strony, na której formularz wysłano). Bez backfillu. Typy Supabase przegenerowane, jeśli repo tak robi (wg `docs/03-conventions.md`) — migracja `20261010000000`, na prod 15.10 (odczyt w notatkach)
- [x] Admin: szczegół zapytania pokazuje `page_version` i `page_slug` (jedno pole tekstowe obok `source`/`utm`; bez nowych ekranów) — wiersz „Page” w karcie „Booking Request”, lokalnie `admin-page-row-local*.png`; na prod bez zrzutu (patrz wyjątek 2)

## Gotowe, gdy
- [ ] Na stronie NZ v2 w GA4 DebugView jeden przebieg daje w tej kolejności: `experience_view(page_version=2, page_slug)` → `section_view(section=pricing)` → `form_open` → `form_step` dla KAŻDEGO kroku (`trip`/`angler`/`contact`, indeksy 1..3, `total_steps=3`) → `SUBMIT_LEAD_FORM` z `value`, `page_version`, `page_slug`. Zrzut/lista z DebugView w raporcie (kroki i nazwy: decyzja tj D2, 14.10) — **wyjątek 1 (decyzja tj 15.10):** na prod udowodnione w `dataLayer` (`experience_view`, `form_open`, `form_step` ×3, `conversion`, `SUBMIT_LEAD_FORM`; `section_view` tylko po przewinięciu do cen), nie w DebugView — GA4 nie odbiera requestów, przyczyna w GTM (pilny wiersz w deferred)
- [ ] Ten sam przebieg na stronie v1 (np. Brynjar, Islandia): `experience_view(page_version=1)` → `section_view(section=pricing)` (blok „Price” v1) → `form_open` → `form_step(calendar,1,2)` → `form_step(form,2,2)` → `SUBMIT_LEAD_FORM` (v1 ma dwa kroki, nie jeden; blok „Price” liczy się jako `pricing` — decyzje tj D2 i D3, 14.10) — **wyjątek 1 (decyzja tj 15.10):** na prod `dataLayer`: `experience_view`, `section_view`, `form_open`, `form_step` ×2, `conversion`, `SUBMIT_LEAD_FORM`; DebugView — jak wyżej
- [x] Żaden event nie odpala się podwójnie na jedno załadowanie/krok (guard jak `submittingRef` przy konwersji) — pokazany na czerwono (guard usunięty → podwójny event) — `red-once-guard-removed.log` (guard usunięty → 4 testy padają)
- [x] Request konwersji Ads (`googleadservices.com/pagead/conversion/18171634204/…`) na v1 niezmieniony — porównanie parametrów przed/po (label, value, currency_code) w raporcie; na v2 request pojawia się (wcześniej go nie było) z tym samym labelem i walutą PLN (decyzja tj D1, 14.10) — `ads-conversion-v1-before-after.log`, `ads-conversion-v2-before-after.log`, `ads-conversion-v1-vs-v2-after.log`
- [x] Migracja w `supabase/migrations` (nazwa wg konwencji repo); `CHECK` pokazany na czerwono (`page_version=3` odrzucone); na prod po STOP (15.10: 2 wiersze, wynik w notatkach): `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='inquiries' AND column_name IN ('page_version','page_slug')` zwraca 2 wiersze — wynik w raporcie
- [x] Zapytanie testowe wysłane z v2 ma w bazie `page_version=2` i `page_slug` strony (SELECT w raporcie), a następnie jest USUNIĘTE (DELETE po STOP, wynik w raporcie; jak `audit_20260903` we wrześniu) — SELECT sprzed usunięcia i odczyt po DELETE (0 wierszy) — `stop2-prod-reads.log` § 1–2; DELETE zrobił tj ręcznie w panelu
- [ ] Admin pokazuje oba pola dla tego zapytania (zrzut przed usunięciem) — **wyjątek 2 (decyzja tj 15.10):** zrzutu nie ma — zapytania usunięte przed zrzutem; zastąpiony SELECT-em sprzed usunięcia (`stop2-prod-reads.log` § 1)
- [x] Parytet zapisu v2 z v1: testowe zapytanie z v2 ma w bazie `gclid`, `utm`, `source`, `trip_length`, `party_size` tak jak v1, a `value` w `SUBMIT_LEAD_FORM` liczone przez `estimateLeadValue` (region z `getRegionGroup(location)`) — SELECT tych kolumn w raporcie (decyzja tj, „go” 14.10, pkt 1) — `stop2-prod-reads.log` § 1 (`gclid`/`utm` null przy wejściu bezpośrednim, `source`, `trip_length`, `party_size` w v2 i v1); `value` przez `estimateLeadValue` — `inquiry-wizard.test.tsx`
- [x] Test na prod z consentem `ad_storage=denied`, `analytics_storage=granted`: brak requestu do `googleadservices.com`; request konwersji Ads zweryfikowany lokalnie Playwrightem (przed/po). Zapytanie testowe: imię „TEST FA-1.60”, mail tj (decyzja tj, „go” 14.10, pkt 2) — procedura faktyczna w notatkach 15.10 (Decline + `consent update` analytics); przy blokadzie `googleadservices.com` 0 requestów (#2, #3); #1 bez blokady — bez działania w Ads (decyzja tj); konwersja lokalnie: `ads-conversion-*.log`
- [x] Lista zapytań ze stron NZ v2 z `created_at ≥ 2026-10-14 16:40` (Europe/Warsaw) sprzed merge'a — do ręcznego importu offline konwersji w Ads (decyzja tj, „go” 14.10, pkt 3) — pusta — `stop2-prod-reads.log` § 0
- [x] Build i lint przechodzą; brak `as any` w nowym kodzie — CI #145 `check`/`db`/`knip`/`secrets` pass, deploy prod `2159df5` success; `git diff 2159df5^1 2159df5 -- src | grep '^+.*as any'` → 0

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
- [x] Naprawa: izolacja kontenera mapy (`isolation: isolate` / własny kontekst stackowania); skala z-index z `docs/03-conventions.md`, a jeśli jej nie ma — propozycja skali (mapa < treść sticky < header < drawer/modal) i czekanie na akceptację tj — `isolate` w `LocationMap` (`29134ba`); skala z-index — propozycja w deferred, decyzja tj otwarta
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
- 2026-10-15 typ działań konwersji w Ads — zweryfikowane (zrzut Ads od tj, 15.10):
  - GA4 `SUBMIT_LEAD_FORM` = działanie „Formularz”, **Dodatkowe**, stan **Nieaktywny** — kryterium z planu STOP 2 („`SUBMIT_LEAD_FORM` w Ads jest działaniem Dodatkowym”) spełnione.
  - Bezpośrednia konwersja `AW-18171634204/yydcCKmuoe0cEJzE9NhD` = „Lead form (direct) (1)”, **Podstawowe** — główny sygnał licytacji, zamierzone. Test zapytania na prod przy STOP 2 trafiłby więc do licytacji, dlatego blokada `*pagead/conversion/18171634204*` (i `*googleadservices.com*`) w DevTools jest przy STOP 2 **obowiązkowa**, nie tylko druga warstwa — Consent Mode jej nie zastępuje (wiersz deferred o pingu przy `ad_storage` denied).
  - Nieaktywny import „Formularz” — wiersz w deferred (sprawdzić, czy `SUBMIT_LEAD_FORM` jest zdarzeniem kluczowym w GA4).
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
- 2026-10-15 decyzja tj: `isolate` przeniesione do `LocationMap` (root kontenera), wrapper w `offer-logistics.tsx` bez klasy — jedno źródło dla v2 S11 i `/offers/[token]` (commit `29134ba`; `offer-logistics.tsx` identyczny z `main`).
  - Test nakładania (`map-run.mjs`, uogólniony na ścieżkę): `/offers/[token]` nie ma własnych warstw nad mapą (bez nav, paska, dialogu; cookie banner z 9999 i tylko na prod) — dlatego obie strony dostały ten sam dodatkowy scenariusz: wstrzyknięta warstwa testowa `position: fixed; z-index: 50` (wartość wizarda i nav) na górnej połowie mapy, próbki na kontrolce zoom i kafelkach. Lokalnie na czas dowodu: `offer_token`/`offer_location*` na lokalnym zapytaniu `70616515…` i `location_lat/lng` na `seed-backcountry-day-nz`, po dowodzie wycofane.
  - `/offers/[token]`: przed (kod `56fd94f`, bez klasy w `LocationMap`) — warstwy strony 0 z 0, warstwa testowa z-50: mapa nad nią **4 z 4** (`offers-map-before.log`, `offers-map-before-*-probe-*.png`); po — **0 z 4** (`offers-map-after.log`).
  - v2 S11 po przeniesieniu: warstwy strony **0 z 8**, warstwa testowa **0 z 4** (`map-after.log`).
  - Red proof (bez klasy w `LocationMap`, wrapper S11 też bez): `/offers/[token]` warstwa testowa 4 z 4; v2 S11 warstwy strony 4 z 8 (390: pasek ×2, wizard; 1280: wizard), warstwa testowa 4 z 4 (`red-locationmap-isolate-removed.log`).
  - Wiersz deferred o `/offers/[token]` zamknięty (przekreślony, odnośnik do `29134ba`); wiersz o skali z-index zostaje.
  - Weryfikacja: `tsc` czysty, eslint zmienionych plików bez uwag, knip czysty, vitest 88 plików zielone (`full-suite-locationmap.log`).
- 2026-10-15 merge #145 (`2159df5`, 14:39:58 Warsaw); deploy prod Vercel na `2159df5` = `success`. Lista zapytań ze stron NZ v2 od 14.10 16:40 do merge'a (do importu offline konwersji w Ads): **pusta** (`[]`; od 14.10 16:40 jedno zapytanie w ogóle, 15.10 05:38, spoza NZ v2). Zapytanie i wynik: `.fa-proofs/fa-1.60/stop2-prod-reads.log` § 0.
- 2026-10-15 STOP 2 — zgoda tj („go”, oba przebiegi v2 i v1; blokada `*googlesyndication.com*` dodana). Przebiegi robił tj w swojej przeglądarce.
  - **Faktyczna procedura consent** (banner ma tylko Accept / Decline, bez wyboru „tylko analityka”): Decline → w konsoli `gtag('consent','update',{analytics_storage:'granted'})` → przejście na stronę kliknięciem z `/trips` (bez `gclid`). `dataLayer` potwierdza `consent default` = denied + `update` `analytics_storage: granted`. Request blocking w DevTools włączony przed pierwszym wejściem na stronę: `*pagead/conversion/18171634204*`, `*googleadservices.com*`, `*googlesyndication.com*`. Pułapka: `querySelectorAll('input[name="trip_notes_extra"]')` na wszystkich polach, na ostatnim kroku tuż przed „Send”.
  - Wysłane trzy zapytania (żadne nie nazywało się „TEST FA-1.60” — odnalezione po czasie):
    - #1 `d0ee7569…` v2 South Island, 15:23 — w karcie **bez** blokady DevTools, consent Decline (wszystko denied), pułapka niewypełniona → pełny pipeline: `inquiry.qualified_set` (O-10 = yes), szkic `messages` `4ffa4d07…` (`draft`), `agent.auto_send_decided {sent:false}` z powodu błędu parsowania odpowiedzi sędziego. Maile FA i do klienta poszły wg kodu `route.ts` (nie są w bazie). Ping konwersji Ads bez ciasteczek mógł wyjść (Consent Mode advanced) — **decyzja tj: bez działania w Ads**.
    - #2 `254cfe02…` v2 South Island, 15:29 — z blokadą, pułapka zadziałała: `agent.auto_send_decided {sent:false, reasons:["trap field filled"]}`, bez maili i AI. `dataLayer`: `experience_view`, `form_open`, `form_step` ×3, `conversion` → `AW-18171634204/yydcCKmuoe0cEJzE9NhD`, `SUBMIT_LEAD_FORM` → `G-Z3Y8GMHR4J`. Brak `section_view` — formularz otwarty bez przewinięcia do cen; zachowanie poprawne (na v1 z przewinięciem `section_view` jest).
    - #3 `18f03a3a…` v1 Brynjar, 15:43 — z blokadą, ale **bez** powodu pułapki w zdarzeniach → pipeline AI: szkic `d9c5f297…` (`draft`), `agent.auto_send_decided {sent:false, score:0.85}` (sędzia odrzucił szkic); maile FA i do klienta wg kodu poszły. `dataLayer`: `experience_view`, `section_view`, `form_open`, `form_step` ×2, `conversion` → `AW-…/yydcCKmuoe0cEJzE9NhD`, `SUBMIT_LEAD_FORM` → `G-Z3Y8GMHR4J`.
  - Blokada (Network, tj): wszystkie requesty z `18171634204` `blocked:devtools`, `googlesyndication` 7× zablokowane, `googleadservices.com` — 0 requestów.
  - Baza przed usunięciem (SELECT, pełny wynik w `stop2-prod-reads.log` § 1): `page_version` / `page_slug` = `2` / `fly-fishing-south-island-new-zealand` (#1, #2) i `1` / `brynjar-arnarsson-iceland-fly-fishing` (#3). Parytet v2/v1: `gclid` null, `utm` null, `source` `web_form`, `trip_length` (`7+`, `1`, `2-3`), `party_size` (2, 2, 1) zapisane tak samo w v2 i v1. #3 (v1 przez `trip_id`) ma `experience_page_id` null — znany wiersz deferred, `page_slug` to pokrywa.
  - Czas od zapisu do ostatniego zdarzenia (trasa czeka na AI przed `201`): #1 ≈ 32 s, #3 ≈ 15 s, #2 (pułapka, bez AI) ≈ 0,3 s — wyjaśnia „długie pierwsze wysłanie”; logów Vercel nie odczytano. Naprawa → FA-1.61.
  - **Zrzutu admina nie ma** — tj usunął zapytania przed zrzutem; dowodem `page_version` / `page_slug` jest powyższy SELECT sprzed usunięcia (decyzja tj).
  - DELETE: tj ręcznie w panelu Supabase (nie proponowanym SQL-em), trzy zapytania #1–#3. Odczyt po (`stop2-prod-reads.log` § 2): `inquiries` 0, `inquiry_events` 0, `inquiry_trip_details` 0, `messages` 0 (w tym oba szkice), `offers` 0 dla tych id; osieroconych wierszy w całych tabelach `inquiry_trip_details` / `messages` / `inquiry_events`: 0. Reszta nietknięta: łącznie 124 zapytania, ostatnie prawdziwe `a86b0a0b…` z 15.10 05:38 istnieje; kontrola z wierszem deferred z 14.10 (web_form od 1 IX: 8 tylko z `trip_id`, 30 z `experience_page_id`) → teraz 8 i 30 + `a86b0a0b` = 31. Liczby wszystkich wierszy sprzed DELETE nie zebrano — „nietknięta” opiera się na tej kontroli, nie na porównaniu przed/po.
  - Zgłoszenia tj z testu (wiersze w deferred, poza FA-1.60): GA4 — 0 requestów do GA4 w Network na stronach experience mimo eventów w `dataLayer`; Consent Mode advanced (fakt); błąd walidacji bez przewinięcia do pola (→ FA-1.61); czwarty tag `AW-18008446689` ładowany przez GTM.
- 2026-10-15 decyzja tj: **status `done` z dwoma wyjątkami** — (1) kryteria DebugView v2/v1 udowodnione w `dataLayer`, nie w GA4: GA4 nie odbiera requestów ze stron experience, przyczyna w GTM, wiersz w deferred oznaczony jako pilny (blokuje pomiar lejka pilota FA-1.57), osobne zadanie po FA-1.61; (2) zrzut admina zastąpiony SELECT-em sprzed usunięcia. Dowody `.fa-proofs/fa-1.60/*` poza `stop2-prod-reads.log` są tylko lokalnie (nie w repo).
