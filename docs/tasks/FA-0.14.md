---
id: FA-0.14
title: Strony hub destynacji — `/patagonia`, `/iceland`, `/new-zealand` na jednej trasie dynamicznej
stage: 0
status: todo
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-web
branch: feat/destination-hubs
depends_on: [FA-0.11, FA-0.12]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-0.14 — huby destynacji na jednej trasie

**Skąd to zadanie.** Grupa reklam „Patagonia ogólna" (`claude/patagonia-test-campaign-2026-09.md`,
grupa 3) nie ma dokąd kierować: `/trips` mówiło o Skandynawii, a kierowanie na stronę Bariloche
zawęża ofertę do jednego przewodnika. To samo dotyczy Islandii i Nowej Zelandii, gdzie ruch
idzie dziś na pojedyncze strony doświadczeń.

**Zmiana względem pierwszej wersji zadania (tj, 11 IX):** zamiast samego `/patagonia` powstają
trzy huby na **jednej trasie dynamicznej**. Przy trzech destynacjach trzy kopie szkieletu
rozjadą się przy pierwszej zmianie; czwarty hub ma być trzema linijkami konfiguracji.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`; `docs/03-conventions.md`
- `src/lib/countries.ts` — `COUNTRIES`, `COUNTRY_REGION`, `RegionGroup`, `getRegionGroup()` (z FA-0.12).
  Grupy to `Nordic`, `Patagonia`, `New Zealand`. **Nie twórz drugiej mapy.**
- `src/app/trips/page.tsx` — pobieranie `experience_pages`, siatka kart, `generateMetadata`
  z `searchParams.country`, `revalidate`. Stąd bierzesz wzorzec i, jeśli się da bez zmiany
  wyglądu, wspólny komponent karty.
- `src/app/(public)/guides/page.tsx` — wzorzec trasy w grupie `(public)` (dziedziczy nav i stopkę)
- `src/lib/format-price.ts` — `formatPrice`/`currencySymbol` (FA-0.11); ceny w walucie strony
- `src/components/layout/footer.tsx` — kolumna „Destinations", dziś linkuje do `/trips?country=<kraj>`
  przez `getActiveDestinationCountries()`
- `src/app/sitemap.ts` — dopisanie tras
- `claude/patagonia-test-campaign-2026-09.md` (Notion/projekt) — kontekst kampanii, grupa 3

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Trzy adresy — `/patagonia`, `/iceland`, `/new-zealand` — odpowiadają 200, mają własny tytuł,
opis i akapit, i listują **wszystkie aktywne strony z danej grupy regionów**, prosto z bazy.
Ceny w walucie strony. Każda karta prowadzi na stronę doświadczenia; zapytanie składa się tam,
żeby `experience_page_id`/`trip_id` były wypełnione. Dodanie czwartego huba to wpis w konfiguracji.

## Zakres
- [ ] **Odczyt bieżącego stanu**: `curl -sI` na trzy adresy (oczekiwane 404); otwórz `trips/page.tsx`
      i ustal, czy siatkę kart da się wynieść do komponentu bez zmiany wyglądu. Jeśli nie da się
      bez przebudowy — **STOP**, opisz i zapytaj; kopiowanie znaczników jest dopuszczalne tylko
      jako świadoma decyzja, nie domyślnie.
- [ ] `src/app/(public)/[destination]/page.tsx` — trasa dynamiczna z `generateStaticParams()`
      dla trzech slugów. Nieznany slug → `notFound()`. Uwaga: grupa `(public)` zawiera już
      `/blog`, `/guides`; sprawdź, czy segment dynamiczny nie przechwytuje tych tras, i jeśli
      przechwytuje — **STOP**, zaproponuj rozwiązanie (np. `(public)/destinations/[slug]`),
      nie zmieniaj istniejących adresów bez zgody.
- [ ] `src/lib/destinations.ts` — konfiguracja, jedno źródło:
      ```ts
      { slug: 'patagonia',    group: 'Patagonia',    h1, intro, metaTitle, metaDescription }
      { slug: 'iceland',      group: 'Nordic',       countries: ['Iceland'], … }
      { slug: 'new-zealand',  group: 'New Zealand',  … }
      ```
      `iceland` zawęża grupę `Nordic` do jednego kraju — przewidź w typie opcjonalne `countries`,
      które zawęża listę krajów w obrębie grupy; brak → cała grupa.
- [ ] Dane: `experience_pages` gdzie `status='active'` i `country` w wyliczonej liście krajów.
      Kolejność jak na `/trips`. Brak wyników → strona renderuje nagłówek i akapit bez siatki,
      nie 404.
- [ ] Sekcja „How it works" — trzy kroki, wspólny komponent, ten sam tekst na wszystkich hubach.
- [ ] `generateMetadata` per slug: tytuł z konfiguracji (**jeden** sufiks `| FjordAnglers` —
      wzorzec z FA-0.12), opis, `canonical`, OG image = hero pierwszej aktywnej strony z grupy.
- [ ] `sitemap.ts` — trzy trasy; `robots.ts` bez zmian.
- [ ] `revalidate = 60` (jak `/trips`).
- [ ] **Stopka**: kolumna „Destinations" linkuje do huba, gdy dla kraju istnieje (Iceland →
      `/iceland`, Argentina i Chile → `/patagonia`, New Zealand → `/new-zealand`); pozostałe kraje
      bez zmian, na `/trips?country=<kraj>`. Mapowanie w `destinations.ts`, nie w komponencie.
- [ ] `<WebEventTracker />` na każdym hubie (FA-0.15) — bez `country`, to strona wielokrajowa.
      Zdejmij notatkę o tym z `docs/tasks/FA-0.14.md`… czyli stąd, i z FA-0.15, jeśli tam jest.

## Copy — zatwierdzone przez tj 11 IX, wstawiać dosłownie
Reguła stylu z FA-0.17 obowiązuje: żadnych półpauz ani pauz, cudzysłowy ASCII, zero przymiotników
wypełniaczy, zdania poniżej 20 słów. Nie przepisuj tych tekstów.

**`/patagonia`** · H1: `Patagonia Fly Fishing Trips`
> Two owner-guides, one in Bariloche and one in Coyhaique. Juan Leobono rows the Upper Limay and Manso. Alex Prior has guided the Aysén spring creeks since 1989. Guided days from $550 for two anglers, two and three day floats, hotel packages in Bariloche. Season runs November to April.

**`/iceland`** · H1: `Iceland Fly Fishing Trips`
> Andri Fannberg has guided out of Reykjavík for ten years. Brynjar Arnarsson runs river expeditions from the same base. Brown trout, arctic char and Atlantic salmon, depending on the river and the month. You talk to the guide who takes you out.

**`/new-zealand`** · H1: `New Zealand Fly Fishing Trips`
> Josh Hart guides the Tongariro and the Taupō rivers on the North Island. Kristina Placko walks the Southland spring creeks around Lumsden and Mossburn. Full days from 1 100 NZD for two anglers, gear included. Sight fishing to visible trout in clear water.

**„How it works" — wspólne**
> 1. Tell us your dates. Dates, group size, what you want to catch.
> 2. We check with the guide. We come back with availability and a price within two business days.
> 3. Deposit once dates are confirmed. You pay nothing to ask.

Tytuły meta: `Patagonia Fly Fishing Trips | FjordAnglers`, `Iceland Fly Fishing Trips | FjordAnglers`,
`New Zealand Fly Fishing Trips | FjordAnglers`. Opisy meta zaproponuj z akapitów powyżej, skracając
do 155 znaków, i **pokaż w raporcie przed PR** — to jedyny tekst, którego tj nie podał dosłownie.

## Gotowe, gdy
- [ ] Lokalnie (`pnpm build && pnpm start`, nie Turbopack): trzy adresy zwracają `200`, nieznany
      slug `/atlantis` → `404`. Wklej kody.
- [ ] Liczba kart na każdym hubie = liczba wierszy z SELECT-a `select count(*) from experience_pages
      where status='active' and country in (...)` — zestawienie dla trzech hubów w raporcie.
      Na dziś oczekiwane: Patagonia 5 (Argentyna 1, Chile 4), Iceland 4, New Zealand 3 —
      jeśli liczby się nie zgadzają, **nie dopasowuj kodu do tych liczb**, tylko zgłoś.
- [ ] `<title>` każdego huba zawiera nazwę destynacji i **dokładnie jedno** `FjordAnglers`.
- [ ] Ceny na kartach idą przez `formatPrice` — hub Patagonii pokazuje `$`, NZ `NZ$`, Islandia `€`
      (albo to, co mówi `currency` w bazie). Zrzut w raporcie.
- [ ] Każda karta linkuje do `/experiences/<slug>`; żaden hub nie ma własnego formularza.
- [ ] `grep -c "Scandinavia"` w HTML huba Patagonii i NZ → 0 (stopka ma wspólny tagline, więc
      liczy się treść strony; jeśli tagline wchodzi w grep, opisz to i policz bez stopki).
- [ ] Trzy trasy w `sitemap.xml`.
- [ ] Stopka: link „Iceland" prowadzi do `/iceland`, „Argentina" i „Chile" do `/patagonia`,
      „New Zealand" do `/new-zealand`, „Norway" nadal do `/trips?country=Norway`. Zrzut listy linków.
- [ ] `<WebEventTracker />` obecny — `page_view` z `path='/patagonia'` po wejściu, SELECT z lokalnej bazy.
- [ ] Dodanie czwartego huba = jeden wpis w `destinations.ts` i nic więcej. Udowodnij: dopisz
      tymczasowo `{ slug: 'norway', group: 'Nordic', countries: ['Norway'], … }`, pokaż `200`
      i kartę, usuń wpis, pokaż `404`. To czerwony dowód na to, że konfiguracja naprawdę wystarcza.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Nowy formularz zapytania na hubie — zapytanie składa się na stronie doświadczenia.
- Zmiana górnego menu (`nav.tsx`) — decyzja tj, osobno; dziś huby żyją w stopce i w reklamach.
- Redesign kart, siatki, layoutu — wynosimy istniejące, nie projektujemy nowego.
- Poprawa `experience_name` i `price_type` w danych (islandzkie tytuły z „Elite"/„Specialized",
  `per trip` vs `/ person`) — osobna sprawa, dopisz do `docs/deferred-tasks.md`.
- Zmiana kierowania grup w Google Ads — tj po deployu.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Copy z sekcji wyżej wstawiasz **dosłownie**. Jeśli tekst nie mieści się w layoucie — STOP, zrzut, pytanie.
  Opisy meta (155 znaków) pokazujesz przed PR.
- Jeśli segment dynamiczny w `(public)` przechwytuje `/blog` albo `/guides` — STOP, nie zmieniaj
  istniejących adresów.
- `touches_db: false` — żadnych zapisów; SELECT-y do policzenia kart wykonujesz na lokalnej bazie
  albo przez `supabase-fa` tylko do odczytu.

## Weryfikacja
```
pnpm build && pnpm start
for s in patagonia iceland new-zealand atlantis; do curl -s -o /dev/null -w "$s %{http_code}\n" localhost:3000/$s; done
curl -s localhost:3000/patagonia | grep -o "<title>[^<]*"
curl -s localhost:3000/sitemap.xml | grep -c "patagonia\|iceland\|new-zealand"
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji
