---
id: FA-1.33
title: Karta zapytania — zakładki natychmiast i jako pigułki; Overview nie wychodzi poza ekran
stage: 1
status: review
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/inquiry-card-tabs-overflow
depends_on: [FA-1.32]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 3
owner: tj
---

# FA-1.33 — Karta zapytania: zakładki natychmiast i jako pigułki; Overview nie wychodzi poza ekran

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `src/app/admin/inquiries/[id]/InquiryDetailTabs.tsx` — zakładki; dziś każde kliknięcie robi `router.replace('?tab=…')`, czyli pełny re-render strony na serwerze (~15 sekwencyjnych zapytań) bez żadnego feedbacku
- Styl zakładek z FA-1.15 (pigułka Fjord Navy w wyciszonym pasku): `git show dbd3618a:src/app/admin/inquiries/[id]/InquiryDetailTabs.tsx`
- `src/app/admin/inquiries/[id]/page.tsx` — zawartość Overview (Angler, Booking Request, Event timeline) i jej układ dwukolumnowy
- `docs/design/fa-1.32/README.md` — decyzje o układzie karty, które zostają

## Cel
Na produkcji karta zapytania ma trzy problemy. (1) Przełączanie zakładek jest wolne i nic nie pokazuje w trakcie, bo każde kliknięcie prosi serwer o przebudowanie całej karty, choć zawartość wszystkich pięciu zakładek jest już w przeglądarce. (2) W Overview prawa kolumna (Deal status, Qualified, Next step, Delete) jest wypchnięta poza ekran: wpis osi zdarzeń z długimi id w jednej nieprzerwanej linii (`guide_id: … · experience_page_id: …`) rozszerza lewą kolumnę. (3) Pasek zakładek z podkreśleniem (FA-1.32) wygląda słabo. Po zadaniu zakładki przełączają się natychmiast, nic na karcie nie jest szersze niż ekran, a pasek zakładek używa stylu pigułek z FA-1.15.

## Zakres
- [ ] Odczyt bieżącego stanu: odtworzyć overflow lokalnie na zapytaniu, którego zdarzenie `inquiry.created` ma w payloadzie guide_id + experience_page_id + trip_country + inquiry_source, i z długim e-mailem (np. a.very.long.address.for.testing@example-longdomain.com). Zrzuty „before" przy 1440 i 1024 px.
- [ ] Zakładki przełączane po stronie klienta: aktywna zakładka w stanie klienta, URL aktualizowany przez `window.history.replaceState` (deep-linki `?tab=` i przeładowanie działają), bez round-tripu do serwera przy kliknięciu. Domyślna zakładka per status bez zmian.
- [ ] Pasek zakładek w stylu pigułek FA-1.15: wyciszony pasek, aktywna zakładka wypełniona Fjord Navy z białym tekstem; licznik Conversation jako mała plakietka w zakładce. Bez łososia.
- [ ] Brak overflow gdziekolwiek na karcie: dzieci grid/flex trzymające tekst dostają `min-w-0`; długie nieprzerwane wartości (payloady zdarzeń, e-maile, id, URL-e) łamią się (`break-words` / `overflow-wrap: anywhere`) albo są ucinane z tooltipem `title` — wybór per miejsce, opisany w raporcie.
- [ ] Nagłówek, pasek etapów, Next step / Deal / Internal z FA-1.32 bez zmian.

## Gotowe, gdy
- [ ] Kliknięcie zakładki nie wywołuje nawigacji: test jsdom — klik zmienia widoczny panel, a `router.replace`/`router.push` nie są wołane; pokazany jako czerwony na komponencie sprzed zmiany, potem zielony.
- [ ] Deep-link działa: render z `?tab=offer` otwiera Offer & payment (test).
- [ ] Overview z długim payloadem i długim e-mailem: brak poziomego overflow przy 1440 i 1024 px — zrzuty Playwright przed/po plus `document.documentElement.scrollWidth <= window.innerWidth` policzone na stronie i wklejone dla obu szerokości.
- [ ] Zrzut „after" paska zakładek (pigułki) na dwóch etapach.
- [ ] Brak nowych `as any` / `eslint-disable`, brak `.from(` poza warstwą danych, brak nowych zależności; `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone.

## Poza zakresem
- Przyspieszanie zapytań serwerowych strony (wiersz deferred z FA-1.31 zostaje).
- Zmiany logiki lub treści Next step / Deal / Internal; „Invalid Date"; kompozytor.
- Inne ekrany panelu.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Weryfikacja
```
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji
- 2026-09-26 tj: zgłoszone na prod po FA-1.32 (zrzut: Overview ucięty po prawej, zakładki wolne i słabo widoczne). Decyzja tj: zakładki jako pigułki jak w FA-1.15. Plik zadania zakłada agent, bo stage-1 jest chronione.
