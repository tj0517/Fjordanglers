---
id: FA-1.62
title: Strona v2 — poprawki z przeglądu Figmy (copy, kolejność, linki, listy, zdjęcia ryb, licencja, kalendarz)
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: fix/v2-figma-review
pr: 149
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 8
owner: tj
---

# FA-1.62 — Strona v2: poprawki z przeglądu Figmy

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje kodu
- `src/app/experiences/[slug]/_v2/ExperienceV2.tsx` — kolejność sekcji S10–S14 (OfferLogistics, OfferBring, OfferFaq)
- `src/components/experience-v2/offer-body.tsx` — kolejność S3–S9; tu wypada S5 (`OfferFit`)
- `src/components/experience-v2/offer-how-it-works.tsx` — krok 4 (`balanceText`), tytuł kroku
- `src/components/experience-v2/offer-day.tsx` — notatka pod planem dnia (linia ~44)
- `src/components/experience-v2/offer-story.tsx` — karty ryb („What you fish for”), `SPECIES_MAX_CHARS`
- `src/components/experience-v2/offer-story-block.tsx` — galeria bloku treści; wzorzec dla galerii ryby
- `src/components/experience-v2/offer-guides.tsx` — karta przewodnika (bez linku); `guide.slug` jest w `ExperienceV2Guide`
- `src/components/experience-v2/offer-included.tsx` — render licencji (`license.buyUrl`)
- `src/lib/experience-v2-content.ts` — `SpeciesDetail`, `parseSpeciesDetails`, `LicenseInfo`, `parseLicenseInfo`
- `src/lib/experiences/v2-editor.ts` — zod: `licenseInfoSchema`, `CONTENT_BLOCK_MAX_PHOTOS`
- `src/components/admin/ExperiencePageForm.tsx` — `SpeciesDetailRecord` (`image_urls`, `season_months`, `peak_months`), limity `max={12}` / `max={6}`, lista `TECHNIQUES`
- `src/components/admin/edit-guide-form.tsx`, `create-guide-form.tsx`, `src/components/dashboard/profile-edit-form.tsx` — `ALL_LANGUAGES`
- `src/lib/fish.ts` — jedyne źródło gatunków; `public/fish_catalog/`
- `src/components/offer/LocationMap.tsx` — pomarańczowa kropla; `src/app/trips/exp-page-map-view.tsx` `pinIcon()` — sygnet FA (`/brand/sygnet.png`) do wspólnego modułu
- `src/components/inquiry-wizard/inquiry-wizard.tsx` — formularz v2; jak przyjmuje miesiąc (do kalendarza ryby)
- `docs/design/` — jeśli jest zrzut z Figmy z przeglądu 20 X 2026

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Strona ofertowa v2 dostaje poprawki z przeglądu tj w Figmie (20 X 2026) — wszystko, co nie
wymaga migracji. Po zadaniu: krok 4 bookingu mówi, że saldo płaci się bezpośrednio
przewodnikowi; plan dnia kończy się nową notatką; „What to bring” jest przed „Included”;
S5 „Who it's for” nie jest renderowane; karta przewodnika prowadzi na jego profil; ryba ma
galerię (jak blok treści), pełny opis, sezon, średnią wielkość i ikonę kalendarza
przewijającą do formularza; licencja ma dowolnie wiele linków; limity zdjęć to 30;
lista języków ma Spanish, gatunków — Chinook Salmon; pinezka na mapie to sygnet FA.

## Zakres
- [ ] Odczyt bieżącego stanu: otwórz pliki z Kontekstu; wypisz w notatkach, skąd dziś bierze się każdy zmieniany element (krok 4, notatka dnia, limity, parser ryb, licencja)
- [ ] Copy: tytuł kroku 4 „Remaining balance”, tekst „The balance is paid directly to your guide.” dla każdej metody (`cash`/`stripe`/`null`); notatka pod planem dnia: „Please note: This is a sample itinerary. The exact schedule will be customized to suit your preferences, the weather, and the state of the water.”
- [ ] Kolejność: `OfferBring` przed `OfferIncluded` (tj. S12 przed S4 — zaktualizuj komentarz w `offer-body.tsx` o decyzję tj 2026-10-20); `OfferFit` (S5) nie renderowane — komponent, dane i admin zostają
- [ ] Linki i listy: karta przewodnika w S7 jako `<Link href={/guides/${slug}}>` (bez linku, gdy `slug == null`); `'Spanish'` w `ALL_LANGUAGES` (3 formularze — zrób jedną stałą współdzieloną); `'Chinook Salmon'` w `fish.ts` obok Coho (z ikoną katalogu lub fallbackiem, jak inne bez pliku)
- [ ] Pinezka: wspólny `pinIcon()` z sygnetem FA (wyciągnięty z `exp-page-map-view.tsx`) użyty w `LocationMap.tsx`; `/trips` bez zmian wizualnych
- [ ] Zdjęcia: limity 12→30 dla galerii strony, content photos i `CONTENT_BLOCK_MAX_PHOTOS`; ryby 6→30 w adminie
- [ ] Karta ryby v2: `SpeciesDetail.imageUrls: string[]` (parser jak `blockImageUrls`: `image_urls` wygrywa, `image_url` jako galeria jednego); galeria w karcie wg `offer-story-block.tsx`; opis bez ucinania do 150 znaków (pełny tekst, karta rośnie); pod opisem sezon z `season_months` (format jak `seasonLabel` w chipach) i „Average size: …” z nowego pola `avg_size_text` (`species_details` jsonb, admin: jedno pole tekstowe; brak = nie rysuj); pomarańczowa ikona kalendarza w lewym górnym rogu zdjęcia, gdy ryba ma `season_months` — klik przewija do formularza v2 (`INQUIRY_ANCHOR`), bez modala (O-40 b)
- [ ] Licencja: `license_info.links: [{label, url}]` w zod i parserze; `buy_url` czytany jako pierwszy link (kompatybilność, bez backfillu); admin: lista linków z etykietą (dodaj/usuń); render: każdy link osobną linią, nie-http(s) jako tekst (jak dziś `buyText`)

## Gotowe, gdy
- [ ] `pnpm test run -- experience-v2 offer-` zielone, w tym nowe testy: parser ryb (image_urls / image_url / brak), parser licencji (links + stary buy_url + nie-http), kolejność sekcji (Bring przed Included, brak `data-section="S5"`), krok 4 dla 3 metod, link karty przewodnika (z i bez slug)
- [ ] Na lokalnym stacku strona pilotażowa (`?preview=v2`) — zrzuty w `docs/screenshots/FA-1.62/`: krok 4, notatka dnia, karta ryby z galerią + sezon + średnia wielkość + ikona, 2 linki licencji, pinezka z sygnetem; każdy punkt z Figmy odhaczony w notatkach z nazwą zrzutu
- [ ] Admin: ryba z 7+ zdjęciami, galeria strony z 13+ zdjęciami zapisują się i wracają po odświeżeniu (zrzut); próba 31 zdjęć odrzucona w UI i w zod (pokazany na czerwono)
- [ ] `grep -rn "'Spanish'" src | wc -l` ≥ 1 i tylko w jednej współdzielonej stałej; `grep -n "Chinook" src/lib/fish.ts` = 1 wiersz
- [ ] Klik ikony kalendarza przewija do formularza v2 — test komponentu sprawdza `href`/`scrollIntoView` na `INQUIRY_ANCHOR`
- [ ] `git diff main...HEAD -- src/app/experiences/[slug]/_v1 src/components/trips` pusty poza wyciągnięciem `pinIcon()` (v1 bez zmian)

## Poza zakresem
- Pola faktów w hero i nowe techniki muchowe → FA-1.63 (migracja)
- Biblioteka zdjęć „wybierz z wgranych” → FA-1.64
- Modal z kalendarzem (O-40 a) — odrzucone, tylko przewinięcie
- Usunięcie `OfferFit`, `suited_for`/`not_suited_for` z admina i bazy — zostaje (może się przydać)
- Zmiany tekstów w formularzu v2 (FA-1.61)
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
pnpm test run -- experience-v2 offer- experience-v2-content v2-editor
ls docs/screenshots/FA-1.62/
grep -rn "'Spanish'" src | wc -l
grep -n "Chinook" src/lib/fish.ts
git diff main...HEAD --stat -- "src/app/experiences/[slug]/_v1" src/components/trips
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip && pnpm build
```

## Notatki z realizacji
- 2026-10-20 tj (przegląd w Figmie, plik `rk2npoNp3oSQO9km7SN2tE`): O-40 → (b) ikona przewija do formularza; krok 4 jeden tekst dla wszystkich metod; S5 tylko schowane.
- 2026-10-20 tj (decyzje przy starcie FA-1.62):
  - D1 — jedna wspólna lista języków = 12 z formularza profilu przewodnika (English, Norwegian, Swedish, Finnish, Danish, Icelandic, German, Polish, French, Dutch, Russian, Spanish); formularze admina dostają Dutch, Russian i Spanish.
  - D2 — Chinook Salmon w obu listach `fish.ts`, jak Coho (`FISH_ALL` + `FISH_IMG` → `salmon.png`); `grep Chinook` = 2 wiersze, po jednym na listę (kryterium „1 wiersz” czytane jako 1 wpis na listę).
  - D3 — sygnet zamiast pomarańczowej kropli wszędzie, gdzie rysuje `LocationMap` — także na `/offers/[token]`.
  - D4 — lokalny stack FA startowany obok działających stacków innych projektów (Seaclouds, hydra-arms); `storage-api` włączony (upload zdjęć w adminie).
  - Zawężenie kryterium zod (z promptu): czerwony dowód zod tylko dla bloków treści; galeria strony i zdjęcia ryb nie mają dziś schematu po stronie serwera — zapisane w deferred.
- 2026-10-20 odczyt stanu przed zmianami (skąd dziś bierze się każdy zmieniany element):
  - Krok 4: `offer-how-it-works.tsx` — tytuł „You pay the balance to the guide”, tekst z `balanceText(method)` (3 warianty: stripe / cash / brak) z `primary.balancePaymentMethod` ← `guides.default_balance_payment_method` (`queries.ts`).
  - Notatka dnia: `offer-day.tsx` `SAMPLE_PLAN_NOTE` („This is a sample plan — your guide picks the water…”).
  - Kolejność: `offer-body.tsx` S3 · story · S7 · S6 · S4 · S5 · S8 · S9; `OfferBring` (S12) renderowany w `_v2/ExperienceV2.tsx` między S11 a S13.
  - Limity zdjęć: `ExperiencePageForm.tsx` galeria `max={12}`, content photos `max={12}`, ryba `max={6}` (+ etykieta „up to 6”), Views `max={6}` (inne pole — bez zmian); `CONTENT_BLOCK_MAX_PHOTOS = 12` w `v2-editor.ts` (zod). Galeria i ryby nie mają schematu po stronie serwera.
  - Parser ryb: `parseSpeciesDetails` czytał tylko `name`, `description`, `image_url`; `image_urls` i `season_months` z `species_details` (zapisywane przez admina od dawna) były ignorowane; opis cięty do 150 znaków (`SPECIES_MAX_CHARS` w `offer-story.tsx`).
  - Licencja: parser `parseLicenseInfo` → `buyUrl` / `buyText` z jednego `buy_url`; render w `offer-included.tsx` jednym linkiem „how to buy it ›”; zod `licenseInfoSchema.buy_url`; admin — jedno pole „Where to buy (link)” w `experience-v2-editor/ContentSection.tsx`; `buyUrl` szedł też do formularza (`licenseUrl`).
  - Języki: 3 listy — admin create/edit po 9, profil przewodnika 12 (decyzja D1).
  - Pinezka: `LocationMap.tsx` — pomarańczowa kropla (`orangeMarker`), używana na v2 (S11) i na `/offers/[token]`; sygnet w `pinIcon()` w `src/app/trips/exp-page-map-view.tsx`.
- 2026-10-20 tj: po restarcie WSL z braku pamięci (3 stacki Supabase + 2× `next dev`) — opcja C: PR otwarty bez zrzutów; zrzuty (strona pilotażowa, admin 13+/31 zdjęć, `/trips` przed/po) i `curl` 200 do zrobienia, gdy będzie wolna pamięć. Punkty z Figmy NIE są jeszcze odhaczone zrzutami.
- 2026-10-20 tj (decyzje po PR #149):
  - S5 — opcja A: pole „Suited for” zostaje wymagane dla stron v2 (S5 może wrócić); krok lejka GA4 `fit` (`section_view:fit`, FA-1.60) oznaczony jako zatrzymany 2026-10-20 — od tej daty raportuje 0, bo S5 nie jest renderowane; to nie spadek zainteresowania. Komentarz przy `FUNNEL_SECTIONS_V2.fit` w `_v2/ExperienceV2.tsx`.
  - Pięć drobnych decyzji agenta zatwierdzonych bez zmian: limit 12 linków licencji; link bez etykiety = „how to buy it ›”; plakietka „+N photos” na karcie ryby w prawym górnym rogu; `INQUIRY_ANCHOR` we własnym module `components/experience-v2/inquiry-anchor.ts`; czerwona linia „N photos not added” we współdzielonym `MultiImageUpload` (także formularze przewodnika).
- 2026-10-20 zrzuty (`docs/screenshots/FA-1.62/`, lokalny stack 127.0.0.1:54421, strona testowa `fa162-pilot` = klon `seed-backcountry-day-nz` z własnym id, podgląd admina `?preview=v2`); punkty z Figmy:
  - [x] krok 4 „Remaining balance” / „The balance is paid directly to your guide.” — `01-step4-remaining-balance.png`
  - [x] nowa notatka pod planem dnia — `02-day-note.png`
  - [x] „What to bring” przed „Included”, S5 nie renderowane — kolejność `data-section` na żywej stronie: S3 · story · S7 · S6 · S12 · S4 · S8 · S9 · S11 · S14 (odczyt Playwright; bez osobnego zrzutu)
  - [x] karta ryby: galeria „+2 photos”, pełny opis, „Season: Oct–Apr”, „Average size: 2–4 kg”, pomarańczowa ikona kalendarza — `03-species-cards.png`; lightbox 2 / 3 — `07-species-gallery-lightbox.png`
  - [x] klik ikony kalendarza przewija do formularza (scrollY 1699 → 5691, góra `#zapytanie` 96 px pod górą okna, 0 dialogów) — `06-calendar-click-scrolled-to-form.png`
  - [x] dwa linki licencji — `04-licence-two-links.png`; admin, lista linków — `14-admin-licence-links-editor.png`
  - [x] pinezka = sygnet FA — `05-map-sygnet-pin.png`; `/trips` bez zmian: `08-trips-map-before.png` (kod z `main`) i `08-trips-map-after.png` są identyczne bajt w bajt (`cmp`)
  - [x] admin: galeria 14 zdjęć i Brown Trout 8 zdjęć + „2–4 kg” zapisane i po przeładowaniu — `09-admin-gallery-14-after-reload.png`, `10-admin-species-8-photos-avg-size-after-reload.png`
  - [x] 31. zdjęcie odrzucone w UI (kafelek 31. wyłączony, czerwona linia „1 photo not added — this field takes at most 30 photos.”) — galeria `11-…`, content photos `12-…`, ryba `13-…`
  - [ ] karta przewodnika jako link — tylko testy komponentu (przewodnicy w seedzie nie mają `slug`; deferred)
  - Środowisko do zrzutów: lokalnie brak bucketu `guide-photos` (utworzony jednym `insert into storage.buckets` w lokalnej bazie), a upload na 127.0.0.1 wywraca formularz (`next/image` nie zna hosta) — dlatego zdjęcia w adminie wybrane z galerii przewodnika testowego (`FA-1.62 Test Guide`, 31 zdjęć z `public/`, własne id, podpięty tylko do `fa162-pilot`). Fikstury SQL: `.fa-proofs/fa-1.62/{pilot,admin}-fixture.sql` (lokalnie, nie w repo). Dev server z fikcyjnymi kluczami Stripe w env procesu (`sk_test_fake_fa162` …), bez zmian w plikach `.env*`.
- 2026-10-20 odbiór tj (PR #149): wszystkie kryteria udowodnione — 220/1130 testów, CI zielone na 97a2f06, 14 zrzutów obejrzanych, /trips bajt w bajt bez zmian, red proofs zod/javascript:/scroll.
