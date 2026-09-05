---
id: FA-0.12
title: Strona mówi o swoim regionie — stopka, `/trips` per kraj, cross-sell po kraju, tytuł bez podwójnego sufiksu
stage: 0
status: review
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/region-aware-chrome
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 5
owner: tj
---

# FA-0.12 — Strona mówi o swoim regionie

**Skąd to zadanie (audyt lejka 5 IX 2026).** Amerykanin z reklamy Patagonii ląduje na stronie,
której stopka mówi „Connecting anglers with the best fishing trips in **Scandinavia**", lista
destynacji to Norwegia/Szwecja/Finlandia/Islandia/Dania, „More like this" pod Bariloche
proponuje archipelag sztokholmski i Finnmark, a `/trips?country=New Zealand` ma tytuł
„Guided Fishing Trips in Norway, Sweden, Iceland & Finland". Tytuł każdej strony kończy się
„| FjordAnglers | FjordAnglers". Żadna z tych rzeczy nie jest redesignem — to dane i konfiguracja.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`; `docs/03-conventions.md`
- `src/components/layout/footer.tsx:22` (tagline) i `:66–70` (lista destynacji na sztywno)
- `src/app/trips/page.tsx:91–100` — statyczne `metadata` mimo `searchParams.country` (linia 128)
- `src/app/experiences/[slug]/page.tsx:191–200` — `similarTrips`: fallback bierze **dowolne** 3 aktywne strony
- `src/app/experiences/[slug]/page.tsx:45–70` — `generateMetadata`: `title = meta_title ?? experience_name`
- `src/app/layout.tsx:28–29` — `title.template: '%s | FjordAnglers'` → jeśli `meta_title` w bazie już ma sufiks, jest podwójny
- `docs/tasks/FA-0.11.md` — równoległe zadanie na cenach; nie dubluj `formatPrice`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Strona doświadczenia, `/trips` z filtrem kraju i stopka mówią o kraju, w którym jest klient,
a nie o Skandynawii. Cross-sell nigdy nie wysyła klienta z Argentyny do Szwecji ani na stronę
partnera, którego nie umiemy wycenić. Tytuł strony ma jeden sufiks.

## Zakres
- [ ] **Odczyt bieżącego stanu** (kod): otwórz pliki z kontekstu; `grep -rn "Scandinavia\|Nordic" src --include=*.tsx`
      (lista do raportu; maile poza zakresem, ale wymień).
- [ ] **Odczyt bieżącego stanu** (dane, produkcja, SELECT):
      ```sql
      select country, count(*) filter (where status='active') as active, count(*) as total
      from experience_pages group by country order by 1;
      select slug, meta_title from experience_pages where meta_title ilike '%fjordanglers%';
      select slug, country, status from experience_pages
      where slug in ('split-destination-lodge-week-aysen','torres-del-paine-magallanes','patagonia-river-guides%') or experience_name ilike '%flywise%' or experience_name ilike '%natales%' or experience_name ilike '%patagonia river guides%';
      ```
      (dokładne slugi Flywise / Natales / PRG ustal z pierwszego zapytania — nie zgaduj).
- [ ] **Stopka**: tagline zależny od kontekstu — na stronach z `country` spoza Nordyku i na `/trips?country=…`
      tekst neutralny („Hand-picked guided fishing trips with local owner-guides."), na reszcie może zostać
      obecny. Lista destynacji budowana z `experience_pages` (kraje z ≥1 stroną `active`), nie z tablicy na sztywno;
      flagi z mapy kraj→emoji w jednym miejscu. Dania bez aktywnych stron znika sama.
- [ ] **`/trips`**: `generateMetadata({ searchParams })` — `country` obecne → „Guided Fishing Trips in {Country}"
      + opis per kraj; brak → obecny tytuł, ale bez wyliczanki krajów w tytule (użyj „Guided Fishing Trips with Local Guides").
- [ ] **Cross-sell**: fallback `similarTrips` po **grupie regionu** (mapa kraj→grupa: Nordic / Patagonia / New Zealand),
      nigdy „dowolne 3"; jeśli w grupie nie ma innych aktywnych stron — sekcja się nie renderuje.
- [ ] **Partnerzy bez potwierdzonej prowizji** (Flywise, PRG, Natales) → `status='draft'` — patrz STOP; to wypina ich
      jednocześnie z cross-sellu, `/trips` i sitemapy bez dodatkowej flagi w kodzie.
- [ ] **Stary tag Ads**: `src/app/layout.tsx` ładuje `AW-18008446689` obok właściwego `AW-18171634204`
      (Tag Assistant 5 IX: 4 tagi na stronie). Usunąć stary; zostaje jedno `gtag('config','AW-18171634204')`.
      Przed usunięciem `grep -rn "18008446689" src` — lista do raportu.
- [ ] **Tytuł**: w `generateMetadata` — jeśli `meta_title` kończy się na `| FjordAnglers`, zwróć `title: { absolute: meta_title }`;
      w przeciwnym razie zostaw template. Nie edytuj danych w tym zadaniu.

## Gotowe, gdy
- [ ] `curl -s https://fjordanglers.com/experiences/fly-fishing-bariloche-limay-manso | grep -c "Scandinavia"` → 0.
- [ ] `curl -s "https://fjordanglers.com/trips?country=New%20Zealand" | grep -o "<title>[^<]*"` → zawiera `New Zealand`, nie `Norway`.
- [ ] `curl -s https://fjordanglers.com/experiences/fly-fishing-coyhaique-aysen | grep -o "<title>[^<]*"` → dokładnie jedno wystąpienie `FjordAnglers`.
- [ ] Sekcja „More like this" pod Bariloche pokazuje wyłącznie strony z grupy Patagonia (Argentyna/Chile) — zrzut listy slugów w raporcie.
- [ ] Stopka na stronie Bariloche zawiera `Argentina` i `Chile` w destynacjach, a nie zawiera `Denmark` (o ile Dania nie ma aktywnej strony — z odczytu).
- [ ] Po STOP-owanym UPDATE: `select slug, status from experience_pages where slug in (<Flywise, PRG, Natales>)` → `draft`; strony zwracają 404 lub redirect, nie treść.
- [ ] `grep -rn "18008446689" src` → 0 trafień; Tag Assistant na produkcji pokazuje 3 tagi (GTM, G-, jeden AW-), nie 4.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Strona hub `/patagonia` — FA-0.14.
- Poprawa `meta_title` w danych (podwójny sufiks u źródła) — dopisz listę slugów do `docs/deferred-tasks.md`.
- Maile i teksty w `src/emails/`.
- Jakikolwiek redesign layoutu — zmieniamy dane wejściowe komponentów, nie komponenty.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- `UPDATE experience_pages SET status='draft' WHERE slug IN (...)` na produkcji — **STOP**: pokaż SELECT przed,
  dokładny UPDATE, poczekaj na zgodę tj; wykonuje tj. Lista slugów z odczytu, nie z pamięci.
- Jeśli odczyt pokaże, że kraj w `experience_pages.country` jest zapisany niespójnie (`Chile` vs `chile`,
  `New Zealand` vs `NZ`) — **STOP**, nie normalizuj w locie; zgłoś i zaproponuj migrację.

## Weryfikacja
```
grep -rn "Scandinavia\|Nordic" src --include=*.tsx | grep -v src/emails/        # oczekiwane: tylko warunkowy tagline
curl -s "http://localhost:3000/trips?country=Chile" | grep -o "<title>[^<]*"
curl -s http://localhost:3000/experiences/<slug-patagonia> | grep -o "<title>[^<]*" | grep -o FjordAnglers | wc -l   # 1
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji (2026-09-05)

## Report — FA-0.12 Strona mówi o swoim regionie

### Done

- **Odczyt bieżącego stanu (kod)** — `grep -rn "Scandinavia\|Nordic" src --include=*.tsx` → 40 trafień
  w 21 plikach. Poza zakresem/maile: `src/emails/*` (10), `src/app/offers/[token]/page.tsx`,
  `src/app/guide-intake/[token]/page.tsx` (transakcyjne, poza zakresem). Właściwe do naprawy/decyzji
  tutaj: `src/components/layout/footer.tsx:22` (naprawione), `src/app/layout.tsx` (metadata default +
  `keywords` — patrz "Needs a decision"), `src/app/page.tsx`, `src/components/home/home-faq.tsx`,
  `src/components/ui/contact-expert-button.tsx`, `src/app/admin/inquiries/[id]/LocationPicker.tsx`
  (centrum mapy `[65,14]` — kod, nie copy, nieszkodliwe, nie dotknięte), `src/components/dashboard/profile-edit-form.tsx`
  (opis zdjęć w bibliotece, nie dotknięte — copy niezwiązane z regionem klienta).
- **`grep -rn "18008446689" src`** → 0 trafień (evidence poniżej w Verification).
- **`src/lib/countries.ts`** — `Argentina`/`Chile` dodane w `COUNTRIES`, `COUNTRY_CODE`, `COUNTRY_FLAG`,
  `EXTENDED_CODES` (4 miejsca, `grep -n "Argentina"` poniżej). Kolejność: 5 krajów nordyckich, potem
  Argentina, Chile, New Zealand — nie alfabetycznie. Dodane `COUNTRY_REGION`/`getRegionGroup()` obok
  `COUNTRIES`, używane przez footer i cross-sell. `pnpm typecheck` przeszedł dopiero **po** uzupełnieniu
  obu map (`COUNTRY_CODE`, `COUNTRY_FLAG`) — zgodnie z oczekiwaniem z zadania, sprawdzone przez realne
  poleganie na `Record<Country,...>`, nie przez próbę pominięcia i obserwację błędu.
- **13 konsumentów `countries.ts` sprawdzonych** (`grep -rln "from '@/lib/countries'" src`) — wszystkie
  iterują przez `.map()` w `flex-wrap`/scrollowanym rzędzie albo `<option>` w select/dropdown; żaden nie
  zakłada stałej liczby 6 ani sztywnej siatki. `create-guide-form.tsx:154` używa `COUNTRIES[0]` jako
  domyślnej wartości (Norway) — dopisanie na końcu tablicy tego nie zmienia.
- **Stopka (`footer.tsx`)** — `SiteFooter` to teraz async Server Component; lista destynacji z nowego
  `getActiveDestinationCountries()` (`queries.ts`, ten sam wzorzec `unstable_cache` co reszta pliku,
  `revalidate: 300`, tag `CACHE_TAG_EXPERIENCES`) zamiast tablicy 5 krajów na sztywno; flagi przez
  `<CountryFlag>`, nie emoji w literale. Tagline: nowy prop `neutralTagline` — **decyzja jawna dla
  `src/app/(public)/layout.tsx`** (patrz niżej), pozostałe callery (home, about, legal ×4) bez zmian —
  domyślny tagline zostaje.
- **`(public)/layout.tsx`** — ten layout obsługuje `/blog`, `/blog/[slug]`, `/guides`, `/guides/[id]`;
  pojedynczy przewodnik może być spoza Nordyku, a layout nie ma dostępu do danych konkretnej strony bez
  przebudowy (poza zakresem — "żadnego redesignu layoutu"). Ustawiono `neutralTagline` **bezwarunkowo**
  dla tego callera — nigdy błędne dla przewodnika z Patagonii, tylko odrobinę mniej barwne dla
  nordyckiego. Jawna decyzja, nie przypadek.
- **`/trips` `generateMetadata`** — zamienione ze statycznego `metadata` na funkcję czytającą
  `searchParams.country`; `country` obecne → `Guided Fishing Trips in {Country}` + opis per kraj
  (dopasowanie case-insensitive do `COUNTRIES`, więc `?country=chile` też pokazuje "Chile", nie
  "chile"); brak → `Guided Fishing Trips with Local Guides` (bez wyliczanki krajów). Przy okazji
  ujednolicone: `<h1 className="sr-only">` i `itemListSchema.name` (JSON-LD) używają tej samej logiki
  zamiast osobno wpisanej listy 4 krajów — nie było to osobnym punktem w Zakresie, ale to dokładnie ten
  sam tekst w tym samym pliku, więc zostawienie go niespójnym z tytułem po zmianie byłoby błędem, nie
  ostrożnością.
- **`experiences/[slug]` `generateMetadata`** — double-suffix: jeśli `meta_title` kończy się na
  `| FjordAnglers`, `title: { absolute: meta_title }`; inaczej zwykły string (template się stosuje).
  Dane nie ruszone.
- **Cross-sell (`similarTrips`)** — fallback "dowolne 3" zastąpiony grupą regionu
  (`COUNTRIES.filter(c => getRegionGroup(c) === pageRegion)` + `.in('country', regionCountries)`);
  brak innych aktywnych stron w grupie → `similarTrips` zostaje pustą tablicą i sekcja się nie renderuje
  (istniejący guard `similarTrips.length > 0 &&` w JSX, nietknięty).
- **Stary tag Ads** — `AW-18008446689` usunięty z `<Script src>` i z `gtag('config', ...)` w
  `layout.tsx`; zostaje wyłącznie `AW-18171634204` (potwierdzone przez `src/lib/gtag.ts:10`
  `ADS_CONVERSION_SEND_TO`).
- **`pnpm typecheck`** → exit 0. **`pnpm test -- --run`** → 4 pliki, 21 passed (bez zmian vs FA-0.11).
  **`pnpm build`** → exit 0, 46/46 stron; `/trips` teraz `ƒ` (dynamic) zamiast wcześniejszego stanu, bo
  `generateMetadata` czyta `searchParams` — oczekiwana, poprawna zmiana. **`pnpm lint`** — identyczne
  100 problemów (40/60) na branchu i na `main` (worktree), zero nowych.
- **Weryfikacja lokalna** — lokalny stack Supabase padł w trakcie sesji (OrbStack/Docker daemon zszedł
  z powodów niezwiązanych z tym zadaniem — proces `next-server` z poprzedniej sesji też się nie zamknął
  poprawnie i nasłuchiwał na porcie 3000 równolegle, co dało fałszywie "puste" wyniki, zanim to
  wykryłem). OrbStack wznowiony (`open -a OrbStack` + `orbctl start`), kontenery Supabase wróciły same
  (dane przetrwały — wolumeny Dockera), `next dev` uruchomiony od nowa na czystym porcie z env
  wskazującym na lokalny stack (nigdy na testowy projekt z `.env.local`, zgodnie ze standing rule).
  Zasiane 4 strony testowe (`fa-0-12-bariloche-test`=Argentina, `fa-0-12-coyhaique-test`=Chile z
  `meta_title` kończącym się sufiksem, `fa-0-12-nz-test`=New Zealand, `fa-0-12-norway-test`=Norway),
  usunięte po weryfikacji. Wyniki w sekcji Verification.

### Not done

- **Punkt 8 (partnerzy → draft)** — pominięty na wyraźną prośbę tj; bramka STOP zostaje otwarta,
  wiersz w `docs/deferred-tasks.md` z dokładnymi dwoma slugami z odczytu 5 IX
  (`flywise-anglers-aysen-lodge-week`, `fly-fishing-torres-del-paine-puerto-natales`;
  `patagonia-river-guides-argentina` już `draft`, więc poza `UPDATE`). Nie wykonuję `UPDATE` sam.
- **Trzy produkcyjne SELECT-y z Zakresu** (rozkład krajów, `meta_title ilike '%fjordanglers%'`, spójność
  zapisu kraju) — brak poświadczeń Supabase w tej sesji (`mcp__supabase` → `Unauthorized`, jak w
  FA-0.11/FA-1.06). Bez nich nie mogę: potwierdzić listy slugów z podwójnym sufiksem do
  `deferred-tasks.md`, ani sprawdzić bramki STOP o niespójnej wielkości liter w `country`. Kod sam w
  sobie jest odporny na literówki case-insensitive (`getRegionGroup`/`COUNTRIES.find` normalizują do
  porównania), ale źle zapisany wiersz cicho zniknie z grupy regionu zamiast rzucić błąd — opisane w
  `deferred-tasks.md`.

### Noticed, not touched (→ `docs/deferred-tasks.md`)

- `src/app/layout.tsx:28/44/50` (domyślny title/OG "Nordic Countries") i `keywords` (linie 33-37,
  "fishing guide Scandinavia" itd.) — odczyt tj z 5 IX, copy/pozycjonowanie, nie ruszone. FA-0.12
  neutralizuje to tylko przez jawny `keywords` w `generateMetadata` dwóch stron, które ten task dotyka.
- `src/app/page.tsx` (hero, eyebrow "Guided fishing in the Nordic countries") i `home-faq.tsx` — copy
  strony głównej, poza zakresem.
- `src/components/ui/contact-expert-button.tsx:10` — WhatsApp URL z tekstem "Scandinavia" wpisanym na
  sztywno, widoczny niezależnie od strony, z której klika klient.
- Podwójny sufiks `meta_title` u źródła i spójność `country` — patrz "Not done" wyżej.

### Needs a decision

1. **`(public)/layout.tsx` neutralTagline** — ustawiony bezwarunkowo (patrz "Done"), bo layout nie zna
   kraju pojedynczej strony przewodnika. Skutek uboczny: `/guides`, `/blog` i profile nordyckich
   przewodników tracą barwniejszy tekst "Connecting anglers... Scandinavia" na rzecz neutralnego.
   Do potwierdzenia — alternatywa (przenieść `<SiteFooter>` z layoutu do każdej strony osobno, żeby
   `/guides/[id]` mogło znać kraj przewodnika) to redesign struktury, wykluczony w Poza zakresem.
2. **Partnerzy → draft** — patrz "Not done"; dwa sluigi gotowe do `UPDATE`, czekam na twoje wykonanie.
3. **Produkcyjne SELECT-y** — muszę je dostać, żeby zamknąć bramkę STOP o spójności `country` i
   uzupełnić listę podwójnych sufiksów w `deferred-tasks.md`.

### Verification

```
$ grep -rn "18008446689" src
(0 hits)

$ grep -n "Argentina" src/lib/countries.ts
  6:  'Argentina',
  20:  Argentina:   'ar',
  32:  Argentina:   'Patagonia',
  59:      Argentina:     '🇦🇷',
  73:  argentina: 'ar', chile: 'cl',
(COUNTRIES, COUNTRY_CODE, COUNTRY_REGION, COUNTRY_FLAG, EXTENDED_CODES — wszystkie 4+1 miejsca)

$ pnpm typecheck && pnpm test -- --run && pnpm build
tsc --noEmit → exit 0
Test Files 4 passed (4) · Tests 21 passed (21)
pnpm build → exit 0, 46/46 pages

$ pnpm lint   # branch and main (git worktree) — identical
✖ 100 problems (40 errors, 60 warnings)

# --- local pnpm dev against local Supabase stack, seeded test rows ---

$ curl -s http://localhost:3000/experiences/fa-0-12-bariloche-test | grep -c "Scandinavia"
0

$ curl -s "http://localhost:3000/trips?country=New%20Zealand" | grep -o "<title>[^<]*"
<title>Guided Fishing Trips in New Zealand | FjordAnglers

$ curl -s http://localhost:3000/experiences/fa-0-12-coyhaique-test | grep -o "<title>[^<]*"
<title>Coyhaique Fly Fishing | FjordAnglers
$ curl -s http://localhost:3000/experiences/fa-0-12-coyhaique-test | grep -o "<title>[^<]*" | grep -o FjordAnglers | wc -l
1

$ curl -s http://localhost:3000/experiences/fa-0-12-bariloche-test | grep -oE '/trips\?country=[A-Za-z%20]*' | sort -u
/trips?country=Argentina
/trips?country=Chile
/trips?country=New%20Zealand
/trips?country=Norway

$ curl -s http://localhost:3000/experiences/fa-0-12-bariloche-test | grep -o 'Hand-picked guided fishing trips with local owner-guides\.'
Hand-picked guided fishing trips with local owner-guides.   (Argentina — neutral, not "Scandinavia")

$ curl -s http://localhost:3000/ | grep -o 'Connecting anglers with the best fishing trips in Scandinavia\.'
Connecting anglers with the best fishing trips in Scandinavia.   (home — default stays, per spec)

$ curl -s http://localhost:3000/experiences/fa-0-12-bariloche-test | grep -oE '/experiences/fa-0-12-[a-z-]*' | sort -u
/experiences/fa-0-12-coyhaique-test   (only Chile — same Patagonia group; Norway/NZ correctly excluded)

$ curl -s http://localhost:3000/experiences/fa-0-12-nz-test | grep -c "More like this"
0   (NZ is alone in its region group — section correctly doesn't render)

$ curl -s "http://localhost:3000/trips?country=Chile" | grep -o "<title>[^<]*"
<title>Guided Fishing Trips in Chile | FjordAnglers

$ curl -s http://localhost:3000/guides | grep -o 'Hand-picked guided fishing trips with local owner-guides\.'
Hand-picked guided fishing trips with local owner-guides.   ((public)/layout.tsx caller — explicit decision above)

$ curl -s http://localhost:3000/experiences/fa-0-12-coyhaique-test | grep -o '<meta name="keywords"[^>]*>'
<meta name="keywords" content="Chile,Patagonia,fishing guide"/>

$ curl -s "http://localhost:3000/trips" | grep -o '<meta name="keywords"[^>]*>'
<meta name="keywords" content="guided fishing trip,fishing guide"/>

$ curl -s "http://localhost:3000/trips" | grep -o "<title>[^<]*"
<title>Guided Fishing Trips with Local Guides | FjordAnglers
```
