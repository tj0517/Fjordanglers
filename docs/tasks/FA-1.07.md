---
id: FA-1.07
title: Wycięcie martwego kodu — paczka 1: `knip` w repo, actions + lib + webhooki, resztki Stripe Connect
stage: 1
status: review
difficulty: M
model: sonnet
model_approved:
effort: medium-high
agent: fa-core
branch: chore/dead-code-1-actions-lib
depends_on: [FA-1.06, FA-1.12]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-1.07 — Martwy kod, paczka 1: actions, lib, webhooki

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguła 5 (każda mutacja emituje zdarzenie), reguła 8 (`as any`)
- `docs/03-conventions.md`; `docs/adr/0001-agency-model-not-marketplace.md` — produkt **nie ma**
  Stripe Connect ani marketplace'u
- `docs/tasks/FA-1.06.md` — sekcje „(a) plik martwy w całości / (b) plik żywy z martwym
  fragmentem", tabela c-*, oraz „Zauważone poza zakresem" (~323–330): lista kompilującego się
  martwego kodu zostawionego dla 1.07/1.08
- `docs/deferred-tasks.md` — wiersze: FA-1.06 „Kompilujący się martwy kod…", FA-1.12 „FA-1.07
  cleanup: orphaned `sendMessageToAngler`", FA-1.12 „Webhook `stripe-deposit` obsługa sesji
  `payment_link` → do FA-1.08" (to **nie** martwy kod — patrz Bramki STOP)
- `docs/tasks/FA-1.12.md` — co zastąpiło `sendOfferEmail` / `sendMessageToAngler` / builder ofert
  (`offers`, `sendMessageFromThread`); punkt „Usunięcie `LeadCommsLogger`, `ConversationImporter`,
  `sendOfferEmail`, buildera ofert z nawigacji (kod może zostać do FA-1.08)" — sprawdź, co
  faktycznie zostało w kodzie
- `docs/REBUILD_PLAN.md` załącznik C — „Usunięte z katalogu": `offer.created/updated/sent`
  (builder ofert i `sendOfferEmail` nie są używane)
- `src/actions/*.ts`, `src/lib/**`, `src/app/api/**` — zakres tej paczki
- `.github/workflows/ci.yml` — job `check`; job `lint` ma `continue-on-error: true`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Etap 2 rozbija `src/actions/inquiries.ts` (1600+ linii) na `packages/core`. Nie ma sensu
przenosić kodu, którego nikt nie woła. Po zadaniu repo ma narzędzie, które **mierzy** martwy kod
(`knip`), a warstwa actions/lib/webhooki nie zawiera funkcji bez wywołań, eksportów bez
importerów ani ścieżek Stripe Connect. Komponenty i trasy — FA-1.08.

## Decyzje tj (19 IX 2026)

### D1 — narzędzie
`knip` jako devDependency, `knip.json` z pluginem Next.js (entry: `src/app/**/{page,layout,
route}.tsx?`, `src/middleware.ts`/`proxy.ts`, `next.config.*`, `src/emails/**` jeśli renderowane
przez Resend, `whatsapp-bridge/**` osobno). Skrypt `pnpm knip`. W tym zadaniu job w CI jest
**informacyjny** (`continue-on-error: true`, wynik do summary); blokujący staje się w FA-1.08,
gdy licznik dojdzie do zera.

### D2 — Stripe Connect wylatuje tutaj
`src/actions/stripe-connect.ts`, gałąź `handleAccountUpdated` / `booking_fee` w
`src/app/api/stripe/webhook/route.ts` i wszystko, co tylko one importują. **UI** w
`src/app/dashboard/account/*` (`StripeConnectButton`, `StripeSyncButton`, `BankAccountForm`)
zostaje do FA-1.08 / etapu 7 — tu tylko odcinasz je od usuniętych akcji tak, żeby
`pnpm typecheck` przechodził (stub z komentarzem `// stage 7` albo usunięcie importu; wybór
uzasadnij w raporcie).

### D3 — podział 1.07 / 1.08
1.07 = wszystko poza `src/app/**/*.tsx` i `src/components/**`. Jeśli usunięcie akcji osieroca
komponent, komponent **zostaje** z `// TODO FA-1.08` i nadal się kompiluje; nie rozszerzaj
zakresu.

## Zakres
- [ ] **Inwentarz przed zmianami (do raportu):** `pnpm knip` po konfiguracji — pełne wyjście
      (unused files / exports / dependencies / types) jako plik `docs/proofs/FA-1.07-knip-before.txt`;
      liczby w raporcie. Dla każdej pozycji z zakresu 1.07 werdykt: usuwam / zostaje (dlaczego) /
      FA-1.08.
- [ ] `knip` + `knip.json` + skrypt `pnpm knip`; job `knip` w `ci.yml` (informacyjny, wynik do
      summary). Fałszywe alarmy (np. route handlery, `generateMetadata`, pliki maili) rozwiązane
      konfiguracją, nie `// knip-ignore` — chyba że uzasadnisz w raporcie.
- [ ] `src/actions/inquiries.ts`: usunięcie `sendMessageToAngler` (i przepięcie
      `InquiryActionPanel.tsx` na `sendMessageFromThread` **albo** usunięcie tego formularza z
      panelu — to jedyne dozwolone dotknięcie `.tsx` w tej paczce, bo bez niego reguła 5 jest
      łamana), `sendOfferEmail`, akcje buildera ofert bez wywołań (sprawdź knip, nie zgaduj);
      pozostałe funkcje bez importerów wg inwentarza.
- [ ] `src/actions/stripe-connect.ts` + gałęzie Connect w `api/stripe/webhook` — D2.
- [ ] `src/actions/messages.ts` — jeśli po FA-1.12 zostały tam tylko funkcje starego loggera
      (`LeadCommsLogger`) — usunięcie; jeśli coś żyje, zostaje z uzasadnieniem.
- [ ] `src/lib/**`: eksporty bez importerów wg knip (m.in. `CACHE_TAG_EXPERIENCES` — **uwaga**:
      wpis FA-0.12 w `deferred-tasks.md` mówi, że tag ma za mało wywołań, nie za dużo — jeśli
      knip go zgłasza, to sygnał do dodania `revalidateTag`, nie do usunięcia; zgłoś, nie usuwaj),
      `field-encryption.ts` (nigdy nie wołane — wpis audytu 31 VIII; usuń, IBAN spada w etapie 4).
- [ ] `src/types/index.ts`: `IcelandicFormConfig`, `INQUIRY_PRESET_FIELDS`, `InquiryCustomField`,
      `Difficulty`, `LocationSpot` — usunięcie, jeśli knip potwierdza 0 użyć.
- [ ] `src/app/api/**`: route handlery bez wywołań z aplikacji, cronów (`vercel.json`) ani
      zewnętrznych webhooków (lista w raporcie: dla każdej trasy „kto ją woła"). Trasa, której
      wołającego nie da się ustalić → **zostaje**, wpis do `deferred-tasks.md`.
- [ ] Zależności z `package.json` zgłoszone przez knip jako nieużywane — usunięcie
      (`pnpm remove`), z listą w raporcie.
- [ ] Wiersze w `docs/deferred-tasks.md` zamknięte (`~~…~~ — FA-1.07`) albo przepisane na
      FA-1.08.

## Gotowe, gdy
- [ ] `docs/proofs/FA-1.07-knip-before.txt` i `-after.txt` w repo; liczba pozycji w kategoriach
      *unused exports* i *unused files* dla `src/actions`, `src/lib`, `src/app/api`, `src/types`
      → **0** (komponenty/trasy `.tsx` mogą zostać — liczba w raporcie jako wejście do FA-1.08).
- [ ] `grep -rn "stripe-connect\|handleAccountUpdated\|booking_fee" src` → 0 poza
      `src/app/dashboard/account/*` (D2).
- [ ] `grep -rn "sendMessageToAngler\|sendOfferEmail" src` → 0.
- [ ] **Na czerwono:** przywrócenie jednego usuniętego eksportu (np. `git stash` fragmentu) →
      `pnpm knip` zgłasza go ponownie i job w CI pokazuje to w summary. Zrzut w raporcie.
- [ ] Każda usunięta trasa API ma w raporcie linijkę „kto ją wołał: nikt — dowód: grep w src,
      `vercel.json`, dashboard Stripe/Resend/Meta".
- [ ] Job `knip` w CI zielony (informacyjny), summary zawiera licznik.
- [ ] `pnpm typecheck && pnpm test && pnpm build` zielone; `pnpm lint` — liczba błędów
      **mniejsza** niż na `main` (część pada razem z martwym kodem; podaj przed/po).
- [ ] Diff PR-a to głównie usunięcia: `git diff --shortstat main` z przewagą `deletions` — w raporcie.

## Poza zakresem
- Komponenty, strony, `src/components/**`, dashboard przewodnika (Stripe/IBAN UI) — FA-1.08 /
  etap 7.
- Lint do zera i blokujący job lint — FA-1.08.
- Obsługa sesji `payment_link` w webhooku `stripe-deposit` (wpis FA-1.12) — to **zmiana
  funkcjonalna**, nie czyszczenie; osobne zadanie, zgłoś jeśli w trakcie okaże się pilna.
- Rozbicie `inquiries.ts` na moduły — etap 2.
- Usuwanie `as any` — osobne zadanie z `deferred-tasks.md`.
- Martwe tabele w bazie (`guide_images`, `guide_submissions`, `audit_log`) — etap 4; tu tylko
  kod, który je czytał, jeśli sam jest martwy.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Kod, który knip uznaje za martwy, ale ma wywołanie **spoza repo** (webhook Stripe/Resend/
  Meta, cron Vercel, `whatsapp-bridge`) — STOP, pokaż listę, zanim usuniesz cokolwiek z `api/`.
- Jeśli usunięcie wymaga zmiany w więcej niż jednym `.tsx` (poza `InquiryActionPanel.tsx`) —
  STOP: to zakres 1.08.
- Jeśli knip zgłasza > 150 pozycji — STOP, pokaż podział na kategorie i zaproponuj podział
  paczki, zanim zaczniesz kasować.
- Zero zmian w `supabase/`. Zero zapisów na produkcji.

## Weryfikacja
```
pnpm knip                                   # 0 w actions/lib/api/types
grep -rn "stripe-connect\|handleAccountUpdated\|booking_fee\|sendMessageToAngler\|sendOfferEmail" src
pnpm typecheck && pnpm test && pnpm build
pnpm lint 2>&1 | tail -3                    # liczba błędów vs main
git diff --shortstat main
```

## Notatki z realizacji

## Report — FA-1.07 Wycięcie martwego kodu — paczka 1: `knip`, actions + lib + webhooki, resztki Stripe Connect

**Gałąź:** `chore/dead-code-1-actions-lib` (z `origin/stage-1` `0b8f8d7`; lokalny `stage-1` był nieaktualny) · **PR:** `--base stage-1` (decyzja tj 20 IX) · Sonnet 5, effort medium-high, M.

**Merge:** w trakcie pracy `origin/stage-1` przesunął się o FA-1.10 (PR #69, `71bddf9`); zmergowałem go do gałęzi (jedyny konflikt: `docs/deferred-tasks.md`, oba końce dopisywały wiersze — zostawiłem oba). Po merge'u: knip **identyczny** z `-after.txt` (kod FA-1.10 nie wniósł żadnej pozycji), typecheck 0, lint 35 błędów, testy i build zielone.

**Wynik w jednej linii:** knip 126 → 26 pozycji, zależności 9 → 0, `git diff --shortstat origin/stage-1` (stan na `0e1f317`, przed dopisaniem tej sekcji CI): **74 files changed, +1285 / −9357** (z tego `src`: **+26 / −8568**; lockfile + config + CI: +727 / −782; reszta to dokumenty i dowody). W `src/lib`, `src/app/api`, `src/types` **0 nieużywanych plików i 0 nieużywanych eksportów**. W `src/actions` zostaje 3 eksporty + 2 typy (kryterium dosłowne **niespełnione**, powody w „Not done").

### Done

**1. `knip` w repo.** `knip@6.37.0` (devDependency), `knip.json`, skrypt `pnpm knip`, job `knip` w `ci.yml` (`continue-on-error: true` na kroku, licznik do summary i do logu). Fałszywe alarmy rozwiązane konfiguracją, bez `// knip-ignore`: `database.types.ts` w `ignore`, `psql` w `ignoreBinaries`, `src/**/*.css` w `project` (bez tego knip nie widział `@import "tailwindcss"` i zgłaszał `tailwindcss`). Trasy, `proxy.ts`, `instrumentation.ts`, pliki `sentry.*` łapie wtyczka Next. `src/emails/**` nigdy nie było w `entry` (sprawdzone: `grep emails knip.json` → 0). — dowód: `docs/proofs/FA-1.07-knip-before.txt`, `-after.txt`.

**2. Rundy do punktu stałego** (`pnpm knip`, licznik = suma pozycji ze wszystkich kategorii):

| Runda | Co | pliki | zależności | eksporty | typy | dup. | razem |
|---|---|---|---|---|---|---|---|
| 0 | przed (`FA-1.07-knip-before.txt`) | 38 | 9 | 45 | 33 | 1 | **126** |
| 1 | Stripe Connect, `InquiryActionPanel.tsx`, 5 akcji z `inquiries.ts` | 29 | 9 | 40 | 30 | 1 | 109 |
| 2 | 22 martwe pliki z dowodem | 7 | 9 | 40 | 30 | 1 | 87 |
| 3 | `fbq.ts`, `experience-location-map.tsx` | 5 | 9 | 40 | 30 | 1 | 85 |
| 4 | eksporty w `actions`/`lib`/`types` + 9 `send*Email` | 15 | 9 | 13 | 7 | 1 | 45 |
| 5 | 10 osieroconych szablonów maili | 5 | 9 | 13 | 7 | 1 | 35 |
| 6 | 9 zależności (`pnpm remove`) | 5 | 0 | 13 | 7 | 1 | 26 |
| 7 | `sendInquiryMessageAnglerEmail` (ostatni wołający: `sendMessageToAngler`) + jego szablon | 5 | 0 | 13 | 7 | 1 | **26** (punkt stały, `-after.txt`) |

**3. Werdykty dla pozycji z zakresu 1.07** (72 pozycji: pliki 9, eksporty 35, typy 28):

| Werdykt | Pozycje |
|---|---|
| **usuwam** — pliki | `actions/stripe-connect.ts`, `lib/stripe/connect.ts`, `lib/stripe/webhooks.ts`, `lib/field-encryption.ts`, `lib/utils.ts`, `lib/periods.ts`, `lib/experience-helpers.ts`, `lib/fbq.ts`, `app/admin/ads/campaigns.ts`, `lib/supabase/index.ts` (barrel, po wycięciu typów jedyny importer `types/index.ts` już go nie potrzebował) |
| **usuwam** — funkcje/stałe | `getCampaignDefs`, `getGuidePhotos`, `saveRichOffer`, `saveOffer`, `sendMessageToAngler`, `logLeadMessage`, `bulkLogLeadMessages`, `sendGuideWelcomeEmail`, `sendEmailVerificationEmail`, `sendBookingConfirmedEmail`, `sendInquiryRequestEmails`, `sendBookingDeclinedEmail`, `sendOfferSentEmail`, `sendOfferAcceptedEmail`, `sendOfferDeclinedEmail`, `sendInquiryOfferAnglerEmail`, `sendInquiryMessageAnglerEmail`, `COUNTRY_FLAG`, `COUNTRY_OPTIONS`, `COUNTRY_CODE`, `getCountryFlag`, `FISH_FILTER`, `FISH_IMG_BY_PAGE_SLUG`, `trackQualifyLead`, `trackPurchase`, `TERMINAL_STATUSES`, `isTerminal`, `matchInquiryByPhone` |
| **usuwam** — typy | `INQUIRY_PRESET_FIELDS`, `InquiryPresetFieldDef`, `InquiryFieldStatus`, `IcelandicFormConfig`, `InquiryCustomField`, `Difficulty`, `PaymentMethod`, `Profile`, `Guide`, `GuideStatus`, `PricingModel`, `UserRole`, `ActionResult` (`types/index.ts`), `GuidePhotoRow`, `InquiryRequestEmailParams`, `FishSpecies`, `LocationEntry` |
| **zostaje, tylko zdjęty `export`** (symbol używany wewnątrz pliku) | `normalisePhone` (woła go `matchInboundPhone` — nie da się usunąć, prośba tj o usunięcie wykonana w części „eksport"), `getImageUrl`, `gtagEvent`, `REGION_GROUPS` (→ literał typu `RegionGroup`), `OfferOptionInput` (`messages.ts`), `SubmissionResult`, `InquirySource`, `GuideImageRow` |
| **zostaje — decyzja tj** | `deleteAccount` (`auth.ts`): bez wołającego i bez UI; zachowane jako wyjątek udokumentowany w FA-0.06 §196 |
| **FA-1.08 (łańcuch przez martwy `.tsx`, który zostaje)** | `createGuideProfile`, `CreateGuideProfileData` (importer `guide-onboarding.tsx`), `createGuideSubmission`, `SubmissionPayload` (importer `GuideSubmissionForm.tsx`) |
| **korekta listy z FA-1.06** | `LocationSpot` zostaje (importują `ExperiencePageForm.tsx`, `location-picker-map.tsx`, `actions/experience-pages.ts`); `CACHE_TAG_EXPERIENCES` zostaje (`dashboard.ts` + 5 użyć w `queries.ts`) — knip go nie zgłasza |

Poza zakresem 1.07, ale w inwentarzu (`.tsx`): patrz punkt 4 (usunięte) i „Not done" (residuum).

**4. Usunięte pliki `.tsx` (24 + 11 `emails`, jedna linia dowodu na plik w `docs/proofs/FA-1.07-tsx-evidence.txt`).** Reguła: grep na każdy eksportowany identyfikator poza plikiem = 0, grep specifiera po stringu (`['"/]basename['"]`) = 0, plik nie jest wejściem Next. Runda po rundzie, bo część plików miała importera w innym martwym pliku (np. `StripeConnectButton` ← `PayoutSettingsCard`, `experience-location-map` ← `-client`, `fbq.ts` ← `fb-event.tsx`).
- `dashboard/account`: `BankAccountForm`, `HideListingToggle`, `PayoutSettingsCard`, `StripeConnectButton`, `StripeSyncButton`
- `admin/inquiries`: `InquiryActionPanel`, `SendDepositButton`, `InquiriesFilters`
- `trips`: `filters`, `filters-modal`, `search-bar`, `sort-select`; `components/trips`: `accommodation-gallery`, `experience-location-map`, `experience-location-map-client`, `species-card`
- `components/home`: `hero-search-bar`, `hero-search`, `hero-video-cta`, `home-faq`, `parallax-layer`, `search-widget`; `components/analytics`: `fb-event`, `ga-event`
- **Szablony maili usunięte** (nic ich nie renderuje: `render(` występuje wyłącznie w `sendEmail` w `lib/email.ts`, a funkcje, które je składały, usunięto; wracają z historii gita): `booking-confirmed-angler`, `booking-declined-angler`, `email-verification`, `guide-welcome`, `inquiry-message-angler`, `inquiry-offer-angler`, `inquiry-request-angler`, `inquiry-request-guide`, `offer-accepted-guide`, `offer-declined-guide`, `offer-sent-angler`.
- Żadnego żywego `.tsx` nie edytowałem. `git diff --name-status origin/stage-1 -- '*.tsx'` → wyłącznie `D`.

**5. Stripe Connect (D2).** `stripe-connect.ts` i pięć plików UI usunięte w całości, bez stuba (decyzja tj 20 IX; `account/page.tsx` ich nie renderował, `PayoutSettingsCard` miał 0 importerów). `grep -rn "stripe-connect\|handleAccountUpdated\|booking_fee" src` → **0** (bez wyjątku `dashboard/account`, bo nic tam nie zostało). `booking_fee` było 0 już na wejściu.

**6. `api/stripe/webhook` — trasa nietknięta poza wycięciem Connectu.** Zostaje z pustym potwierdzeniem: weryfikacja podpisu jak dziś (`STRIPE_WEBHOOK_SECRET`, potem `STRIPE_CONNECT_WEBHOOK_SECRET ?? STRIPE_WEBHOOK_SECRET`), po niej 200, nic więcej. Powód (dashboard Stripe, 20 IX 2026, sprawdzone przez tj): endpoint `brilliant-glow` → `/api/webhooks/stripe` **Active**, 15 zdarzeń, „Events from: Connected accounts", error rate 0% — usunięcie trasy dałoby 404 na żywym endpoincie. `STRIPE_CONNECT_WEBHOOK_SECRET` zostaje w `env.ts`. Nagłówek pliku tłumaczy, dlaczego pusta i czym jest warunkowana likwidacja; wiersz w `deferred-tasks.md` (→ etap 7). Konfiguracji Stripe nie ruszałem.

**7. `sendMessageToAngler` / `sendOfferEmail`.** `grep -rn "sendMessageToAngler" src` → **0**. `InquiryActionPanel.tsx` usunięty w całości (0 importerów; `page.tsx` renderuje `ThreadActionsPanel`). `sendOfferEmail` **zostaje** z komentarzem `// TODO FA-1.08 — jedyny wołający: OfferBuilder.tsx (żywy)`; `OfferBuilder`, `OfferBuilderModal`, `ProposalTab` nietknięte (`OfferBuilderModal` ma 0 importerów, zostawiony świadomie). Pytanie otwarte w `deferred-tasks.md`. Przy usuwaniu `saveRichOffer` przywróciłem prywatny helper `resolveOfferGuide`, który mieszkał w jego bloku i jest używany przez `getOfferByToken` i `sendOfferEmail` (typecheck złapał to od razu).

**8. `messages.ts` — nic do zrobienia.** Odczyt: zero `LeadCommsLogger` / `ConversationImporter`; wszystkie eksporty mają importerów (knip nie zgłasza żadnego z nich; jedyna pozycja z tego pliku, `OfferOptionInput`, to typ bez importerów poza plikiem — zdjąłem `export`).

**9. Osierocone komponenty po usunięciu `InquiryActionPanel`.** Nie edytowałem `.tsx` (komentarz `// TODO FA-1.08` w żywym/martwym pliku to edycja `.tsx`, sprzeczna z bramką). Lista poniżej w „Not done"/deferred.

**10. `src/app/api/**` — kto woła każdą z 8 tras** (żadnej nie usunąłem; knip nie zgłasza żadnej jako martwej):

| Trasa | Kto woła | Dowód |
|---|---|---|
| `cron/offer-sla` | Vercel cron `0 5 * * *` | `vercel.json:8` |
| `cron/sync-google-ads` | Vercel cron `0 6 * * *` | `vercel.json:4` |
| `events` | przeglądarka: `sendBeacon` / `fetch` z `src/lib/web-events.ts:31,36` | `grep -rn "api/events" src` |
| `inquiries` | `InquiryWidget.tsx:330` `fetch('/api/inquiries')` | `grep -rn "api/inquiries" src` |
| `stripe/webhook` | Stripe, endpoint `brilliant-glow` (Active, live) | dashboard Stripe wg tj, 20 IX |
| `webhooks/stripe-deposit` | Stripe (zewnętrznie) | w repo tylko testy; **w dashboardzie nie ma endpointu na tę ścieżkę** wg tj → wiersz w `deferred-tasks.md` |
| `webhooks/email-inbound` | Resend inbound (zewnętrznie) | w repo tylko testy; dashboardu Resend nie widziałem — trasa zostaje |
| `webhooks/whatsapp` | Meta Cloud API (zewnętrznie; integracja zablokowana po stronie Meta, FA-1.13) | w repo tylko testy + `docs/ops/whatsapp-e2e-checklist.md` |

`whatsapp-bridge/` nie woła żadnej trasy FA: `grep` po `index.mjs` — pisze bezpośrednio do Supabase (`createClient`) i ma własny lokalny serwer HTTP.

**11. Zależności** (`pnpm remove`, wszystkie z zerem importów w `src`/`scripts`/configach — `grep -rnE "from '<pkg>'"` → 0): `@hookform/resolvers`, `@stripe/stripe-js`, `class-variance-authority`, `clsx`, `cmdk`, `react-hook-form`, `resend`, `tailwind-merge`, `@vitejs/plugin-react`. `resend` (npm) nie jest używany — maile idą przez `fetch('https://api.resend.com/emails')`. Zostawiony martwy selektor CSS `[cmdk-item]` w `globals.css` → wiersz dla FA-1.08.

**12. Lockfile.** `pnpm install --frozen-lockfile` na **czystym checkoucie** commita `b366b6e`, **pnpm 10.30.3** (`PNPM_VERSION` z `ci.yml`): exit 0, `git status` pusty po instalacji, `lockfileVersion: '9.0'` bez zmian — wklejone wyjście: `docs/proofs/FA-1.07-lockfile-proof.txt`. Rozbicie diffu względem `origin/stage-1` (zbiory `nazwa@wersja` z sekcji `packages:`): +60 pakietów (poddrzewo knipa), −48 (poddrzewo usuniętych zależności, w tym `svix`, `postal-mime`, `uuid`, `@radix-ui/*`). **Uczciwie: jedna nazwa zmieniła wersję** — `yaml` 2.9.0 → 2.9.1, i doszedł `jiti@2.7.0` obok 2.6.1. To tranzytywne, opcjonalne peery `vite`/`vitest`/`eslint`, które pnpm wyrównał do nowszej instancji wprowadzonej przez knipa; żaden pakiet z `package.json` (poza dodanym knipem i usuniętymi) nie zmienił wersji. Testy i typecheck przechodzą na drzewie z tymi wersjami (lokalny `node_modules` z tego lockfile).

**13. `pnpm-workspace.yaml`.** `git diff origin/stage-1 -- pnpm-workspace.yaml` → **pusty**. Plik istnieje od `7ac8786` (initial commit). Diff, który widziałeś w Fazie A, nie był „dopisaniem pliku przez pnpm 12", tylko zmianą w drzewie roboczym po `pnpm install` — pnpm 12 dopisuje blok `allowBuilds` z placeholderami (+7 linii) i za każdym razem robiłem `git checkout -- pnpm-workspace.yaml`. To znany objaw z wiersza FA-1.09 w `deferred-tasks.md` (pnpm 12.4.2, `ERR_PNPM_IGNORED_BUILDS`). Nie trafił do żadnego commita.

**14. Wiersze w `docs/deferred-tasks.md`.** Zamknięte (`~~…~~ — FA-1.07`): FA-1.12 `sendMessageToAngler`; FA-1.06 „Kompilujący się martwy kod" (z korektą: `LocationSpot` i `CACHE_TAG_EXPERIENCES` żywe). Dopisane: FA-1.13 lint 40 → 35; `sendOfferEmail` (pytanie otwarte); `api/stripe/webhook` (treść od tj); `platform-webhook` (Disabled) → `/api/webhooks/stripe`; brak endpointu na `/api/webhooks/stripe-deposit` (oba: właściciel tj, do weryfikacji w dashboardzie, nie diagnozowane); `deleteAccount` (sformułowanie od tj); residuum → FA-1.08; środowisko lokalne (WSL).

**15. Na czerwono.** Przywrócone `TERMINAL_STATUSES` + `isTerminal` w `state.ts` (niezacommitowane) → `pnpm knip` exit 1, „Unused exports (13)" → **(15)**, oba symbole wymienione z `state.ts:72:14` i `:74:17`; krok summary z `ci.yml` odpalony lokalnie na tym wyjściu: „Pozycji łącznie: 28" (zielony stan: 26). Po `git checkout` pliku: 0 trafień `state.ts`, licznik wrócił do 26. — `docs/proofs/FA-1.07-knip-red.txt`. **Czerwony przebieg w samym CI:** patrz sekcja CI niżej.

**16. Lint.** `pnpm lint`: **40 → 35 błędów** (117 → 111 problemów; baseline `origin/main` zmierzony: 40 błędów / 117 problemów, `stage-1` + FA-1.10: to samo). Pięć błędów było w usuniętych plikach (`InquiriesFilters.tsx`, `trips/filters-modal.tsx` — `setState` w efekcie; `emails/email-verification.tsx`, `emails/guide-welcome.tsx` ×2 — `no-unescaped-entities`). **Pliki dotknięte PR-em** (16, wszystkie `.ts`): `actions/{ads,guide-photos,inquiries,messages,submissions}.ts`, `app/api/stripe/webhook/route.ts`, `lib/{countries,email,fish,gtag,image,inquiry-matcher}.ts`, `lib/inquiries/{create,state}.ts`, `lib/supabase/queries.ts`, `types/index.ts` → `eslint` **0 błędów, 0 ostrzeżeń**. (W trakcie wyszły 4 ostrzeżenia o osieroconych importach i stałych po moich usunięciach — `listActiveCampaignDefs`, `sendInquiryMessageAnglerEmail`, `COUNTRY_CODE`, `REGION_GROUPS` — naprawione w tym PR-ze.) Sufit ≤ 40 spełniony z zapasem; nowa liczba: **35** (zmierzona ponownie po merge'u stage-1: bez zmiany).

**17. `pnpm typecheck && pnpm test run && pnpm build`.**
- `typecheck`: czysto (0 błędów).
- `test run`: **25 plików, 251 testów, wszystkie zielone** (po merge'u `origin/stage-1` z FA-1.10; przed nim: 22 / 191), przeciw odchudzonemu stackowi z §9 (`db`, `kong`, `rest`, `auth`; CLI `npx supabase@2.75.0`, bo lokalny `node_modules/supabase/bin` nie istnieje — patrz deferred). Stack zatrzymany i sprawdzony (`docker ps --filter label=…project=fjordanglers` → 0) **przed** buildem.
- `build`: lokalnie z env z commitowanego `.env.test` (jak CI, bez sekretów), stack zatrzymany, po merge'u: `next build` **exit 0**, `✓ Compiled successfully in 38.3s`. Job `check` w CI to drugie potwierdzenie (patrz niżej).

**18. `git diff --shortstat origin/stage-1`:** w `src`: 61 plików, **+26 / −8568**; `package.json` + `pnpm-lock.yaml` + `knip.json` + `.github`: +727 / −782 (poddrzewo knipa vs poddrzewo 9 usuniętych zależności); razem z dokumentami i dowodami: patrz `Verification`.

### Not done
- **Kryterium „0 w `src/actions`" dosłownie — niespełnione.** Zostaje 3 eksporty + 2 typy: `deleteAccount` (decyzja tj), `createGuideProfile`+`CreateGuideProfileData`, `createGuideSubmission`+`SubmissionPayload`. Dwa ostatnie zestawy mają jedynego importera w martwym `.tsx`, który regułą dowodową zatrzymałem (niżej). `src/lib`, `src/app/api`, `src/types`: **0 plików, 0 eksportów, 0 typów**.
- **Pięć plików `.tsx` z 0 importerów zostaje.** Reguła: `grep` po nazwie komponentu ma dać 0 poza plikiem — a w czterech przypadkach jedyne trafienia to **komentarze w żywych `.tsx`**, których nie wolno mi edytować: `AssignGuidePanel.tsx` (komentarz `admin/inquiries/[id]/page.tsx:157`), `dashboard/guide-onboarding.tsx` (`dashboard/layout.tsx:13`), `guide/GuideSubmissionForm.tsx` (`admin/submissions/page.tsx:8`), `trips/ExperiencePageWithOptions.tsx` (`TripOptionsAccordion.tsx:15`). Piąty, `OfferBuilderModal.tsx`, zostaje świadomie.
- **Residuum knipa w `.tsx`** (do FA-1.08, każda pozycja z powodem): `NoGuideContactCard`, `TripOptionsAccordion`, `CropPreview`, typy `TripDetails`, `GuideFormDefaults`, `GuideEditData`, `OptionTabConfig`, `HelpItem` — **żywe pliki, nieużywany `export`; usunięcie = edycja żywego `.tsx`**; `emails/_shared.tsx` `body`, `header`, `container`, `summaryRow`, `summaryRowLast`, `footerSmall` oraz `emails/inquiry-agent-email.tsx` duplikat named+`default` — j.w.
- Nie usuwałem żadnej trasy `api/`, nic w `supabase/`, nic w konfiguracji Stripe/Vercel/sekretach.

### Noticed, not touched (→ `docs/deferred-tasks.md`, 7 nowych wierszy `FA-1.07`)
- `sendOfferEmail` / builder ofert: pytanie otwarte (żywa ścieżka; decyzja produktowa).
- `api/stripe/webhook` pusta, trzymana dla `brilliant-glow` (→ etap 7).
- Stripe: `platform-webhook` (Disabled) → nieistniejąca `/api/webhooks/stripe`; brak endpointu na `/api/webhooks/stripe-deposit` — **jedyną ścieżkę zapisu `deposit_paid_at`** (właściciel: tj).
- `deleteAccount`: bez wołającego i bez UI.
- Residuum knipa dla FA-1.08 (lista wyżej) + martwy selektor `[cmdk-item]` w `globals.css`.
- Środowisko (WSL): brak binarki `supabase` w `node_modules` (skrypty budowania ignorowane), `pnpm` 12 (`minimumReleaseAge`, przepisuje lockfile), `.next/types` z innej gałęzi psuje `pnpm typecheck`; `docs/05-agent-operations.md` §9 opisuje macOS/OrbStack.

### Needs a decision
1. **Cztery pliki `.tsx` zatrzymane komentarzami** (`AssignGuidePanel`, `guide-onboarding`, `GuideSubmissionForm`, `ExperiencePageWithOptions`): 0 importerów, jedyne trafienia to komentarze w żywych `.tsx`. Opcje: **(A, rekomendacja)** zezwolić na usunięcie wprost — wtedy `createGuideProfile`, `CreateGuideProfileData`, `createGuideSubmission`, `SubmissionPayload` też lecą, a `src/actions` schodzi do jednej pozycji (`deleteAccount`); komentarze w żywych plikach zostają jako historyczne wzmianki (`layout.tsx`, `page.tsx`, `TripOptionsAccordion.tsx`) i trafią do sprzątania w 1.08. **(B)** zostawić do 1.08 (stan dzisiejszy).
2. **`deleteAccount` a kryterium „0".** Zostaje z Twojej decyzji, więc knip będzie go zgłaszał. Opcje: **(A, rekomendacja)** przyjąć 1 pozycję residuum i przed przestawieniem `knip` na blokujący w 1.08 zdecydować, jak ją wyłączyć (config `ignore` nie działa na pojedynczy eksport; został tag JSDoc `@public` — to komentarz, więc wbrew Twojej regule „konfiguracja, nie komentarz"); **(B)** wyjątek `@public` już teraz.
3. **`yaml` 2.9.0 → 2.9.1 i `jiti@2.7.0` w lockfile** (tranzytywne peery, skutek dodania knipa — punkt 12). Opcje: **(A, rekomendacja)** zostawić (frozen-lockfile, typecheck, testy, build zielone), **(B)** wymusić starsze wersje przez `pnpm.overrides` (dokłada konfigurację, którą trzeba utrzymywać).
4. **`normalisePhone`:** prośba o usunięcie wykonana częściowo — funkcja jest używana wewnątrz `inquiry-matcher.ts` (`matchInboundPhone`), więc zdjąłem tylko `export`. Potwierdź, że o to chodziło.
5. **`app/admin/ads/campaigns.ts`** (`.ts`, sam typ `Platform`) usunąłem na podstawie precyzyjnego grepa importu (`admin/ads/campaigns`, `./campaigns` → 0), bo skryptowy grep po basename trafiał w inny moduł (`@/lib/ads/campaigns`). Reguła „dowód na każdy plik" była sformułowana dla `.tsx` — jeśli miała objąć i `.ts`, plik wraca z historii.
6. **`docs/tasks/INDEX.md`:** w commicie `075ba9b` (krok „status in_progress" z `/fa-task`) zmieniłem wiersz FA-1.07 na `in_progress`, zanim dostałem polecenie, żeby INDEX zostawić Tobie. Nie ruszałem go więcej. Do cofnięcia, jeśli wolisz.

**Proponowany diff `docs/tasks/FA-1.08.md` i `INDEX.md` (do Twojej decyzji, niczego nie zmieniałem):**

```diff
# docs/tasks/FA-1.08.md
 ## Zakres
-- [ ] Pliki z 0 importerów: `src/components/trips/experience-location-map.tsx`,
-      `ExperiencePageWithOptions.tsx` (+ typ w `TripOptionsAccordion.tsx`), c6
-      `onboarding-wizard.tsx` (jeśli FA-1.06 zostawiło), pozostałe z listy knip — usunięcie.
+- [ ] Residuum knipa z `docs/proofs/FA-1.07-knip-after.txt` (5 plików, 13 eksportów, 7 typów,
+      1 duplikat) — po decyzji tj (FA-1.07 „Needs a decision" 1–2): `AssignGuidePanel`,
+      `guide-onboarding`, `GuideSubmissionForm`, `ExperiencePageWithOptions` (+ `createGuideProfile`,
+      `createGuideSubmission`), nieużywane eksporty w żywych `.tsx` i `emails/_shared.tsx`.
-- [ ] `src/app/dashboard/account/*`: `StripeConnectButton`, `StripeSyncButton`,
-      `BankAccountForm` — usunięcie komponentów i ich miejsca na stronie konta ...
+- [x] ~~`dashboard/account/*` Stripe/IBAN~~ — usunięte w FA-1.07 (strona konta bez sekcji Stripe/IBAN).
+- [ ] Martwy selektor `[cmdk-item]` w `src/app/globals.css` (dep `cmdk` usunięta w FA-1.07).
 ## Gotowe, gdy
-- [ ] `grep -rn "StripeConnect\|StripeSync\|BankAccountForm" src` → 0.
+- [x] `grep … StripeConnect|StripeSync|BankAccountForm` → 0 (spełnione w FA-1.07).
-- [ ] `pnpm lint` → 0 błędów
+- [ ] `pnpm lint` → 0 błędów (start: 35, nie 40; z tego `emails/*` ×?, `whatsapp-bridge/poll-emails.mjs`, …)
-- `git diff --shortstat main`
+- `git diff --shortstat stage-1`
+ D2 (stary builder ofert) zależy od odpowiedzi na wiersz `sendOfferEmail` w `deferred-tasks.md`.
# difficulty: bez zmian (M) — zakres kurczy się (mniej plików), ale D2 i lint do zera zostają.
```

```diff
# docs/tasks/INDEX.md
-| FA-1.07 | … | M | sonnet | in_progress | FA-1.06, FA-1.12 |
+| FA-1.07 | … | M | sonnet | review | FA-1.06, FA-1.12 |
```

### CI (Actions)
- **Zielony:** commit `14a88c6`, run [35508107857](https://github.com/tj0517/Fjordanglers/actions/runs/35508107857) — `check` pass (2m17s), `db` pass (4m17s), `knip (informacyjny)` pass (27s; sam krok `knip` kończy się exit 1 i jest wyłapany przez `continue-on-error`), `sync` pass. Blok summary z licznikiem odczytany z logu jobu (krok drukuje go `tee`-em także do logu): „**Pozycji łącznie: 26**" + cztery kategorie (5 / 13 / 7 / 1).
- **Czerwony:** commit-dowód `1a7835e` (przywrócone `TERMINAL_STATUSES` + `isTerminal`), run [35508337351](https://github.com/tj0517/Fjordanglers/actions/runs/35508337351) — log jobu `knip` wymienia `state.ts:72:14` i `state.ts:74:17`, „Unused exports (15)", „**Pozycji łącznie: 28**"; job nadal `success` (informacyjny z założenia, blokujący dopiero w FA-1.08). Commit wycofany `0e1f317`: `git diff --quiet 14a88c6 HEAD -- src` → identyczne. Dwa dodatkowe commity (dowód + revert) zostają w historii PR-a.

### Verification
```
$ grep -rn "sendMessageToAngler" src | wc -l                               → 0
$ grep -rn "stripe-connect\|handleAccountUpdated\|booking_fee" src | wc -l → 0
$ grep -rn "field-encryption" src | wc -l                                   → 0
$ grep -rn "sendOfferEmail" src   → inquiries.ts:1187 (nagłówek), :1194 (definicja + TODO FA-1.08), OfferBuilder.tsx:24,338
$ pnpm typecheck                                                            → czysto
$ pnpm test run                       → Test Files 25 passed (25) · Tests 251 passed (251)   [po merge'u stage-1]
$ next build (env z .env.test)        → exit 0, ✓ Compiled successfully in 38.3s
$ pnpm lint                           → 111 problems (35 errors, 76 warnings)   [przed: 117 / 40 / 77]
$ pnpm exec eslint <16 dotkniętych plików>                                  → 0 errors, 0 warnings
$ pnpm knip                           → Unused files (5) · exports (13) · exported types (7) · Duplicate exports (1)   [przed: 38 / 45 / 33 / 1, deps 9]
$ pnpm install --frozen-lockfile (pnpm 10.30.3, czysty checkout b366b6e)    → exit 0, git status pusty
```
Dowody w repo: `docs/proofs/FA-1.07-knip-{before,after,red}.txt`, `FA-1.07-tsx-evidence.txt`, `FA-1.07-lockfile-proof.txt`.

