---
id: FA-1.08
title: Wycięcie martwego kodu — paczka 2: komponenty i trasy, lint do zera, `knip` i `lint` blokują w CI
stage: 1
status: done
difficulty: L
model: opus
model_approved: opus by tj 2026-09-20
effort: high
agent: fa-core
branch: chore/dead-code-2-components-routes
depends_on: [FA-1.07]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-1.08 — Martwy kod, paczka 2: komponenty, trasy, lint

## Kontekst — przeczytaj przed startem
- `docs/tasks/FA-1.07.md` — raport, `docs/proofs/FA-1.07-knip-after.txt` (wejście: lista
  pozycji `.tsx` / `src/components` zostawionych dla tej paczki), konfiguracja `knip.json`
- `docs/tasks/FA-1.06.md` — tabela c-* (m.in. c6 `onboarding-wizard.tsx`), „Zauważone poza
  zakresem" (`experience-location-map.tsx`)
- `docs/tasks/FA-1.12.md` — „buildera ofert z nawigacji": `ProposalTab` / `OfferBuilder` /
  `OfferBuilderModal` / `LocationPicker` na karcie zapytania vs nowe `offers` z opcjami; ustal
  grepem i odczytem `page.tsx` (~723), czy stary builder nadal jest renderowany
- `docs/deferred-tasks.md` — wiersze: FA-1.03 „`pnpm lint` jest czerwony na `main`" (40 błędów:
  `src/emails/*.tsx` `react/no-unescaped-entities`, `image-crop.tsx` ref-during-render,
  `whatsapp-bridge/poll-emails.mjs` parse error, nieużywane `eslint-disable`), FA-1.13 „40
  pre-existing ESLint errors in FA-1.07/1.08 code" (`GuideAttachmentTab`, `InquiriesFilters`,
  `OfferBuilder`, `page.tsx`), FA-0.13 `ExperiencePageWithOptions.tsx`, FA-0.14 `ExpCard`
  skopiowany zamiast wyekstrahowany
- `docs/tasks/FA-1.09.md` — `tripMap`/`slugMap`/`countryMap` w `InquiriesClient` /
  `InquiriesCalendar` **należą do 1.09** (zasilenie z helpera), nie do tej paczki — nie wycinaj
- `docs/adr/0001-agency-model-not-marketplace.md` — dashboard przewodnika bez Stripe i IBAN-ów
  (etap 7, §8 REBUILD_PLAN) — tu tylko komponenty osierocone przez FA-1.07 (D2 tamtego zadania)
- `.github/workflows/ci.yml` — joby `lint` (`continue-on-error: true`, komentarz ~91) i `knip`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Po tej paczce `pnpm knip` i `pnpm lint` zwracają zero i **blokują** PR — od tej pory martwy
kod i czerwony lint nie mają jak wrócić na `stage-1` ani `main`. Karta zapytania nie
renderuje dwóch równoległych mechanizmów ofert (stary builder + `offers` z FA-1.12), a
dashboard przewodnika nie importuje nieistniejących akcji Connect.

## Decyzje tj (19 IX 2026)

### D1 — lint do zera tutaj, potem blokuje
40 błędów wiszących od FA-1.03 domykamy w tej paczce: część znika z martwym kodem, resztę
naprawiamy ręcznie (apostrofy w mailach → `&apos;` lub `{"'"}`, `image-crop.tsx` ref w
renderze → `useRef` + efekt, `poll-emails.mjs` → naprawa składni albo wyłączenie katalogu
`whatsapp-bridge/` z lintu z uzasadnieniem, nieużywane `eslint-disable` → usunięcie).
Naprawa **nie zmienia zachowania**: maile renderują ten sam tekst (test snapshot lub `diff`
HTML przed/po dla jednego szablonu w raporcie). Po zerze: `continue-on-error` z jobu `lint`
i `knip` usunięte.

### D2 — stary builder ofert
Jeśli `ProposalTab`/`OfferBuilder*` nadal renderują się na karcie (odczyt `page.tsx`), a
FA-1.12 dostarczyło `offers` + `sendMessageFromThread` z oznaczeniem „przedstawia ofertę" —
stary builder wylatuje z nawigacji **i** z kodu w tej paczce (`ProposalTab.tsx`,
`OfferBuilder.tsx`, `OfferBuilderModal.tsx`, `LocationPicker.tsx`, `src/actions/offer-photos.ts`
jeśli osierocony, `/offers/[token]` zostaje — czyta `offers`?). **STOP przed usunięciem**: pokaż
tj, co dokładnie karta traci (zrzut ekranu lub lista sekcji), bo część pól buildera
(`offer_trip_plan`, `offer_what_to_bring`, `offer_schedule`, mapa) może nie mieć odpowiednika
w `offers` — wtedy builder zostaje do etapu 4 i wpis w `deferred-tasks.md`.

### D3 — nie ruszamy
`InquiriesClient`/`InquiriesCalendar` mapy (FA-1.09); `ExpCard` ekstrakcja (FA-0.14, zadanie S,
zrób tylko jeśli knip wymusza); dashboard przewodnika poza odcięciem od usuniętych akcji.

## Zakres
- [ ] **Inwentarz (do raportu):** `pnpm knip` na wejściu → `docs/proofs/FA-1.08-knip-before.txt`;
      `pnpm lint 2>&1 | tee docs/proofs/FA-1.08-lint-before.txt`; liczby w raporcie z podziałem
      „znika z martwym kodem / naprawa ręczna".
- [ ] Pliki z 0 importerami: `src/components/trips/experience-location-map.tsx`,
      `ExperiencePageWithOptions.tsx` (+ typ w `TripOptionsAccordion.tsx`), c6
      `onboarding-wizard.tsx` (jeśli FA-1.06 zostawiło), pozostałe z listy knip — usunięcie.
- [ ] Stary builder ofert — D2 (po STOP).
- [ ] `src/app/dashboard/account/*`: `StripeConnectButton`, `StripeSyncButton`,
      `BankAccountForm` — usunięcie komponentów i ich miejsca na stronie konta (strona zostaje,
      bez sekcji Stripe/IBAN). Formularz IBAN nie ma już zapisu (akcja usunięta w 1.07) —
      nie zostawiaj formularza, który nic nie robi.
- [ ] Trasy: strony w `src/app/**` bez linku z nawigacji, bez wpisu w `sitemap`, bez
      przekierowania i bez ruchu (jeśli GA4/Vercel Analytics dostępne — liczba odsłon 30 dni w
      raporcie; jeśli nie, lista i **STOP**). Dla każdej: usunięcie + `redirects` w
      `next.config` na najbliższą żywą trasę (301), wpis w `robots.ts` usunięty (wiersz audytu
      31 VIII o ghost routes `/account/`, `/book/`, `/invite/` — domknąć).
- [ ] Lint do zera — D1; `whatsapp-bridge/` decyzja w raporcie.
- [ ] `ci.yml`: `continue-on-error` usunięte z `lint` i `knip`; komentarz ~91 zaktualizowany.
- [ ] `docs/deferred-tasks.md`: wiersze FA-1.03 (lint), FA-1.13 (40 errors), FA-0.13
      (`ExperiencePageWithOptions`), FA-1.06 (martwy kod), audyt 31 VIII (`robots.ts`) — zamknięte.
- [ ] `docs/tasks/INDEX.md` — status; `docs/05-agent-operations.md` — jedna linia: „`pnpm knip`
      i `pnpm lint` blokują PR od FA-1.08".

## Gotowe, gdy
- [ ] `pnpm knip` → **0** pozycji (files, exports, types, dependencies). `-after.txt` w `docs/proofs/`.
- [ ] `pnpm lint` → **0 błędów** (ostrzeżenia: liczba w raporcie, nie gorzej niż przed).
- [ ] **Na czerwono:** PR testowy (lub commit na gałęzi) z jednym nieużywanym eksportem i jednym
      surowym apostrofem w JSX → oba joby CI czerwone; zrzut z Actions w raporcie; commit
      wycofany.
- [ ] Karta zapytania: jeden mechanizm ofert (zrzut ekranu w raporcie); `grep -rn "ProposalTab\|OfferBuilder" src` → 0 **albo** decyzja tj z D2 zacytowana w raporcie.
- [ ] `grep -rn "StripeConnect\|StripeSync\|BankAccountForm" src` → 0.
- [ ] Każda usunięta strona ma 301 w `next.config` — `curl -sI` lokalnie → `308/301` + `Location`, lista w raporcie.
- [ ] Jeden szablon maila: HTML wyrenderowany przed/po naprawie apostrofów identyczny (`diff` pusty) — w raporcie.
- [ ] `pnpm typecheck && pnpm test && pnpm build` zielone; `git diff --shortstat main` z przewagą usunięć.

## Poza zakresem
- `InquiriesClient`/`InquiriesCalendar` puste mapy — FA-1.09.
- Odchudzenie dashboardu przewodnika do czterech ekranów — etap 7.
- Usunięcie kolumn `offer_*` / `guides.iban` z bazy — etap 4.
- Obsługa `payment_link` w webhooku `stripe-deposit` — osobne zadanie (patrz FA-1.07).
- Rozbicie `experiences/[slug]` (1617 linii) — etap 7.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- D2 — przed usunięciem buildera ofert: lista tego, co karta traci, decyzja tj.
- Strona bez linku, ale z ruchem albo z nieustalonym ruchem — STOP, nie usuwaj.
- Jeśli naprawa lintu wymaga zmiany zachowania (nie tylko składni) — STOP, pokaż.
- Zero zmian w `supabase/`. Zero zapisów na produkcji.

## Weryfikacja
```
pnpm knip
pnpm lint
grep -rn "ProposalTab\|OfferBuilder\|StripeConnect\|StripeSync\|BankAccountForm\|experience-location-map\|ExperiencePageWithOptions" src
pnpm typecheck && pnpm test && pnpm build
git diff --shortstat main
# CI: joby lint i knip bez continue-on-error, czerwone na commicie-dowodzie
```

## Notatki z realizacji

### Wykonanie — 20 IX 2026, PR #73 (gałąź `chore/dead-code-2-components-routes`)

**Pełny raport jest w opisie PR-a: https://github.com/tj0517/Fjordanglers/pull/73**

Skrót:
- `pnpm knip` → **0** · `pnpm lint` → **0 błędów / 66 ostrzeżeń** (wejście 35 / 75) ·
  `typecheck`, `test` (260/260), `build` zielone.
- Bramki: `continue-on-error` zdjęte z kroków `lint` i `knip`; dowód na czerwono —
  zielony [run 35522580463] → czerwony [run 35522844531] (`knip` + `check`) →
  zielony po wycofaniu [run 35523248174].
- **D2 rozstrzygnięte przez tj 20 IX: builder ofert usunięty mimo braku odpowiedników
  w `offers`.** Skutek: `inquiries.offer_*` nie ma już pisarza, `/offers/[token]`
  zostaje, ale nowych linków nie da się wygenerować do etapu 4 — wpis w
  `deferred-tasks.md`.
- **D1 rozszerzone:** zero obejmuje wszystkie 22 błędy `react-hooks` (nie 21 — taki
  jest faktyczny odczyt). Bez degradacji reguł, bez nowych `eslint-disable`;
  istniejący `disable` przy `Date.now()` też zniknął, bo `src/lib/availability-window.ts`
  przeniósł odczyt zegara do warstwy danych (wiersz 113 `deferred-tasks.md` zamknięty).
- Trasy: **nic nie usunięte.** Ghost routes z audytu 31 VIII już nie istniały;
  czterej kandydaci bez linku z nawigacji (`guide-intake`, `inquiry/[id]/confirmed`,
  `offers/[token]`, `reviews/[token]`) mają żywych producentów linków — tabela w PR.
- **Nie wykonane:** ręczny przebieg UI czterech ścieżek — wymaga `pnpm dev`, a
  `.env.local` trzyma produkcyjny klucz Resend. Lista kroków do przeklikania jest w PR.
- **Jawna zmiana zachowania (jedyna w tej paczce, która kasuje widoczny element UI):**
  w `GuideAttachmentTab.tsx` razem ze stanem `done` zniknęła plakietka
  „✓ Assigned" / „✓ Linked", pokazywana na karcie przewodnika w oknie między sukcesem
  akcji przypisania a odświeżeniem karty przez rodzica. Usunięta, bo jej gałąź renderuje
  się wyłącznie przy `!isAssigned`, a `setDone(true)` i `onAssigned()` (czyli
  `setAssignedGuideId`) trafiają do tego samego batcha Reacta — okno nigdy się nie
  otwierało. `lastMode` **został**, bo napędza napisy przycisków („Assign & notify" /
  „Link silently" i ich stany `…`) oraz plakietkę w gałęzi `isAssigned`.
  Decyzja tj (20 IX): plakietki **nie przywracamy w tym PR** — wraca najwcześniej przy
  przebudowie karty zapytania (etap 7), jeśli w ogóle.
- **Status `review` do czasu przebiegu UI przez tj — jedyne niepokryte kryterium.**

### Regresja złapana przy przebiegu UI (tj, 20 IX 2026)

**Co było zepsute.** Przeniesienie `activeTab` ze stanu na wartość liczoną z hasha URL-a
(naprawa `react-hooks/set-state-in-effect` w `ExperienceTabLayout.tsx`) wprowadziło
regresję: `switchTab` brał hash z dwuelementowej tablicy `TAB_HASHES =
['day-trip','multi-day']`, więc dla `idx >= 3` hash wychodził `undefined`,
`replaceState` czyścił hash, `tabFromHash('')` zwracał 0 i widok wracał na Overview —
klik w trzecią i dalszą zakładkę wyglądał na martwy. Przed tą paczką `switchTab` wołał
`setActiveTab(idx)` niezależnie od hasha, a dwuelementowy słownik ograniczał wyłącznie
adres URL.

**Kogo dotyczyło.** Wypraw z **trzema i więcej** opcjami. Z 1–2 opcjami działało dalej.
tj ma w obrocie oferty z pięcioma opcjami, więc to nie był przypadek teoretyczny.

**Dlaczego CI tego nie złapał.** Mapowanie zakładka ↔ hash siedziało w środku komponentu
klienckiego, a repo nie ma renderu w testach (brak `jsdom`/`@testing-library`, patrz punkt
o nieprzeprowadzonym przebiegu UI wyżej). `typecheck`, `lint`, `knip` i `build` są na to
ślepe: kod jest poprawny typologicznie i kompiluje się bez zastrzeżeń. Złapał to dopiero
człowiek klikający po stronie z pięcioma opcjami.

**Co zrobiliśmy** (decyzja tj: rozszerzyć słownik hashy, nie cofać pliku):
- `src/lib/experience-tabs.ts` — `hashForTab(idx)` i `tabFromHash(hash, optionCount)`
  jako czyste funkcje bez importów Reacta. Zakładki 1 i 2 **zachowują** historyczne
  `day-trip` i `multi-day` (adresy mogły trafić do maili i do indeksu), każda dalsza
  dostaje `option-N`. `tabFromHash` kontroluje zakres: wynik nigdy nie przekracza
  `optionCount`, a nieznany, pusty albo zniekształcony hash (`option-0`, `option-abc`,
  `option-03`, `option-99` przy pięciu opcjach) daje 0.
- `ExperienceTabLayout.tsx` — lokalne `TAB_HASHES` i lokalne `tabFromHash` usunięte,
  `switchTab` liczy hash przez `hashForTab`. Reszta pliku (`useSyncExternalStore`,
  `TAB_HASH_CHANGED`, reset przewijania) bez zmian — mechanizm był dobry, zły był słownik.
- `src/lib/__tests__/experienceTabs.test.ts` — 13 testów bez renderu: round-trip dla 1, 2,
  3 i 5 opcji, zakres, śmieci. **Dowód na czerwono:** ten sam test puszczony przeciw
  mapowaniu sprzed naprawy pada na trzech przypadkach (`option-N`, round-trip dla 3 i dla
  5 opcji) i przechodzi dla 1 i 2 opcji — czyli dokładnie na granicy błędu.
  Pełny wynik: `docs/proofs/FA-1.08-tabs-red.txt`.

Odrzucone świadomie: jednolite `#tab-N` (psuje istniejące `#day-trip`), slugi z etykiet
(etykieta się zmienia, adres gnije, możliwe kolizje), cofnięcie pliku do stanu ze
`stage-1` (wraca błąd lintu).

Dowody: `docs/proofs/FA-1.08-knip-before.txt`, `-knip-after.txt`,
`-lint-before.txt`, `-lint-after.txt`, `-email-render-diff.txt`, `-ci-red.txt`,
`-tabs-red.txt`.

### Zamknięcie — 20 IX 2026

Ręczny przebieg UI wykonany **przez tj** 20 IX 2026 — pięć ścieżek, w tym zakładki na
wyprawie z pięcioma opcjami po naprawie regresji opisanej wyżej: `#option-4` wpisane
w pasek adresu trafia we właściwą zakładkę, a `#day-trip` na wyprawie dwuopcyjnej działa
jak przed paczką. To było jedyne niepokryte kryterium (agent nie mógł go wykonać:
`pnpm dev` wymagałby `.env.local` z produkcyjnym kluczem Resend, MCP `playwright` w tej
sesji nie wstał, a repo nie ma `jsdom` ani `@testing-library`).

**Wszystkie kryteria „Gotowe, gdy" udowodnione.** Status `review` → `done`; to samo
w `docs/tasks/INDEX.md`.

Dowody: `docs/proofs/FA-1.08-knip-before.txt`, `-knip-after.txt`, `-lint-before.txt`,
`-lint-after.txt`, `-email-render-diff.txt`, `-ci-red.txt`, `-tabs-red.txt`.
