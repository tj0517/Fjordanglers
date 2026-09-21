---
id: FA-1.15
title: Panel admina czytelny — design system na shadcn/ui w barwach FA; lista zapytań, karta wg etapów flow, `/admin/weekly`
stage: 1
status: in_progress
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/admin-ui-system
depends_on: [FA-1.10, FA-1.12, FA-1.13, FA-1.14]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 16
owner: tj
---

# FA-1.15 — Panel admina przestaje być ścianą inline-style'i

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne (w szczególności 3: warstwa danych, 8: `as any`)
- `docs/03-conventions.md` — konwencje kodu
- `docs/REBUILD_PLAN.md` §6 — docelowy kształt panelu (etap 6); §6.8 — „ekrany operacyjne bez
  zmian koncepcyjnych" i **oś czasu zdarzeń na karcie zapytania**; §8 etap 2 (`packages/ui` —
  tokeny i preset Tailwind) i etap 3 (`apps/admin`) — wszystko, co tu powstaje, ma się
  przenieść `git mv` bez przepisywania
- `src/lib/inquiries/state.ts` — `STATUSES`, `STATUS_LABELS`, `STATUS_MEANINGS`, `transition()`
  (FA-1.03). **Jedyne** źródło listy statusów; stepper i zakładki czytają stąd, nie z własnej
  kopii
- `src/app/admin/inquiries/[id]/page.tsx` (780 linii, 58 × `style={{`) i pozostałe 20 plików
  w tym katalogu (razem 6 302 linie) — stan, który przerabiamy
- `src/app/admin/inquiries/[id]/InquiryDetailTabs.tsx` — dzisiejsze cztery zakładki
  (Contact / Guide Attachment / Trip Setup / Proposal) trzymane w `useState`, bez URL
- `src/app/admin/inquiries/InquiriesClient.tsx` (931 linii, 81 × `style={{`),
  `InquiriesCalendar.tsx` (684 linie, 42 ×), `InquiriesFilters.tsx`
- `src/components/admin/sidenav.tsx` (198 linii, 23 ×), `src/app/admin/layout.tsx`
- `src/app/globals.css` — dziś `@theme` ma tylko dwa fonty; kolory (`#F3EDE4`, `#0A2E4D`,
  `#E67E50`) są wklejone w JSX w 1 606 miejscach w 75 plikach admina
- `docs/brand/05-brand-identity-and-metrics.md` — paleta i typografia marki
- `docs/tasks/FA-1.10.md` — `/admin/weekly` (D1: komentarz „TEMPORARY — delete, don't refactor");
  patrz **Uwaga o O-17** niżej
- `docs/tasks/FA-1.12.md`, `FA-1.13.md`, `FA-1.14.md` — wątek, WhatsApp/IG, agent w wątku:
  to są komponenty, które w tej karcie mają swoje miejsce
- `docs/deferred-tasks.md` — wiersze FA-1.06 o martwych komponentach i pustych mapach
- `package.json` — Tailwind v4 (`@tailwindcss/postcss`, **bez** `tailwind.config.js`),
  React 19.2, Next 16.1, `cva` + `clsx` + `tailwind-merge` + `lucide-react` + `cmdk` już są

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Panel admina ma się czytać jak narzędzie pracy, a nie jak strona marketingowa z doklejonymi
tabelami. Powstaje jeden zestaw komponentów (shadcn/ui na Radiksie, tokeny w barwach FA) i na
nim stają trzy ekrany, na których siedzi się codziennie: lista zapytań, karta zapytania i
`/admin/weekly`. Karta przestaje być jedną ścianą paneli — dostaje stepper ze statusem z
maszyny stanów i pięć zakładek odpowiadających etapom flow, a domyślna zakładka wynika ze
statusu, więc wchodząc w zapytanie widzisz to, na co ono czeka. Zero zmian w bazie i w logice
biznesowej: to samo zachowanie, inna powierzchnia.

## Decyzje tj (20 IX 2026)

### D1 — biblioteka: shadcn/ui, tokeny w barwach FA
Radix + Tailwind v4, komponenty kopiowane do repo (`src/components/ui/`), nie zależność npm.
Tokeny (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, …)
wyprowadzone z palety marki, nie z domyślnego neutralnego motywu shadcn.

Ograniczenie kontrastu, bo panel jest gęsty: `#E67E50` **nie** jest tłem pod biały tekst
(≈ 2,9 : 1, poniżej AA). Akcent działa jako obramowanie, podkreślenie aktywnego elementu,
ikona i stan `:focus-visible`. Przycisk główny: granat `#0A2E4D` + biały tekst. Powierzchnia
robocza jaśniejsza niż `#F3EDE4` (tabele na białych kartach), żeby wiersze dało się czytać.
Każda para tekst/tło z tokenów przechodzi AA — sprawdzane skryptem, nie okiem (patrz Zakres).

### D2 — zakres ekranów: `/admin/inquiries`, `/admin/inquiries/[id]`, `/admin/weekly`
Plus powłoka: `layout.tsx` i sidenav. Reszta admina (`/guides`, `/experiences`, `/forms`,
`/submissions`, `/pipeline`, `/ads`, `/finances`, `/unmatched`) zostaje bez zmian — migruje przy
etapie 3, a ekrany analityczne etap 6 i tak pisze od zera wg §6. Nie ruszamy ich „przy okazji".

### D3 — karta zapytania: stepper + pięć zakładek wg etapów flow
Stepper u góry karty, wprost z `STATUSES`: `new → qualifying → waiting_guide → offer_presented
→ awaiting_payment → paid → handed_over` (`completed` jako domknięcie; `lost` / `cancelled`
jako stan terminalny zamiast paska). Pod każdym krokiem — `STATUS_MEANINGS`, czyli „na kogo
czekamy".

| Zakładka | Co w środku (dzisiejsze komponenty) |
|---|---|
| Przegląd | nagłówek zapytania, `StatusChanger`, `QualifiedChanger`, `NextActionEditor`, `AgentToggle`, oś czasu z `inquiry_events` (§6.8), dane kontaktowe |
| Rozmowa | wątek z FA-1.12 + kanały z FA-1.13, `MessageComposer`, `ThreadActionsPanel`, propozycja agenta z FA-1.14 |
| Brief | `TripSetupTab`, `RequestedDatesEditor`, `LocationPicker` |
| Przewodnik | `GuideAttachmentTab`, `AssignGuidePanel` |
| Oferta i płatność | `ProposalTab`, `OfferBuilder`, `SendDepositButton`, `InternalDealTracker`, `ExternalOfferToggle`, `ReviewLinkGenerator` |

Domyślna zakładka ze statusu: `new`/`qualifying` → Rozmowa; `waiting_guide` → Przewodnik;
`offer_presented`/`awaiting_payment` → Oferta i płatność; `paid`/`handed_over`/`completed`/
`lost`/`cancelled` → Przegląd. Kropka na zakładce, która czeka na ruch (ten sam status).
Zakładka w URL (`?tab=`), żeby dało się linkować i żeby `router.refresh()` po akcji nie
wyrzucał z powrotem na pierwszą.

### D4 — kolejność: po FA-1.14
`depends_on: [FA-1.12, FA-1.13, FA-1.14]` — WhatsApp i agent dokładają elementy do karty;
przebudowa po nich to jeden przebieg zamiast dwóch. `/admin/weekly` (FA-1.10) też musi już
istnieć, bo to zadanie go tylko ubiera.

### D5 — gdzie mieszkają komponenty
`src/components/ui/` (tam, gdzie dziś `country-flag.tsx`, `field-tooltip.tsx` itd.) — jeden
katalog, który w etapie 2 idzie `git mv` do `packages/ui`. Tokeny w `src/app/globals.css`
w bloku `@theme` + `:root`, bez drugiego pliku konfiguracyjnego Tailwinda (v4 go nie ma).

### D6 — równoległość z FA-1.07 / FA-1.08
FA-1.07 wolno dotykać wszystkiego **poza** `src/app/**/*.tsx` i `src/components/**` (jej D3),
a FA-1.15 pracuje wyłącznie w tych dwóch miejscach — więc oba PR-y mogą stać otwarte naraz na
`stage-1`. Dwa punkty styku:

1. **`InquiryActionPanel.tsx`** — FA-1.07 ma w zakresie jedyne dozwolone dotknięcie `.tsx`:
   przepięcie `sendMessageToAngler` → `sendMessageFromThread` albo usunięcie tego formularza.
   Ten plik należy do FA-1.07 do czasu jej merge'a; FA-1.15 bierze go **po** rebase na aktualny
   `stage-1` i nie zmienia jego logiki (reguła z Bramek STOP).
2. **`knip` blokujący** wchodzi dopiero w FA-1.08. FA-1.15 świadomie zostawia osierocone
   komponenty (wpis w `deferred-tasks.md`), więc ma wejść **przed** FA-1.08 albo FA-1.08 musi
   być rebase'owane na FA-1.15 — inaczej nowe sieroty wywalą blokujący job.

Kolejność bez kolizji: FA-1.07 → (FA-1.13, FA-1.14) → FA-1.15 → FA-1.08.

> **Uwaga o O-17 (do decyzji tj, nie blokuje).** FA-1.10 zakłada, że `/admin/weekly` jest
> tymczasowy i ginie w etapie 6 („delete, don't refactor"). tj przy zlecaniu tego zadania
> uznał, że ekran raczej zostaje. Jeśli zostaje — komentarz nagłówkowy z FA-1.10 D1 i
> `REBUILD_PLAN` §9 przestają być prawdziwe, a §6.1 opisuje docelowy kształt tego samego
> ekranu. Ubranie go w gotowe komponenty to tak czy owak ~1 h, więc zadanie na tę odpowiedź
> nie czeka; **zmianę statusu ekranu w FA-1.10 i w planie wpisuje człowiek**, nie agent.

## Zakres
- [ ] **Odczyt bieżącego stanu (do raportu):**
      ```
      grep -ro "style={{" src/app/admin src/components/admin | wc -l     # oczekiwane ~1606
      grep -rl "style={{" src/app/admin src/components/admin | wc -l     # ~75 plików
      grep -rn "#0A2E4D\|#E67E50\|#F3EDE4" src/app/admin src/components/admin | wc -l
      wc -l src/app/admin/inquiries/[id]/*.tsx src/app/admin/inquiries/*.tsx
      ```
      oraz zrzuty ekranu „przed" (lokalny stack + seed): lista, karta w trzech różnych
      statusach, `/admin/weekly`.
- [ ] **Sprawdź wersje, nie zakładaj:** shadcn/ui + Tailwind v4 + React 19 + Next 16 —
      `npx shadcn@latest init` z `pnpm`. Jeśli instalator chce `tailwind.config.js` albo
      wymusza inną wersję Reacta/Radiksa — **STOP**, pokaż wyjście, nie obchodź `--force`
      ani `--legacy-peer-deps` bez decyzji.
- [ ] Tokeny w `src/app/globals.css`: paleta admina wyprowadzona z barw FA (D1), tryb jasny;
      `components.json` w repo; `cn()` w `src/lib/utils.ts` (jeśli jeszcze go nie ma —
      sprawdź, nie duplikuj).
- [ ] Skrypt/test kontrastu: `src/lib/ui/contrast.test.ts` — liczy WCAG dla każdej pary
      `foreground`/`background` z tokenów i wymaga ≥ 4,5 : 1 dla tekstu, ≥ 3 : 1 dla obramowań
      i ikon. Lista par w jednym miejscu, nie rozproszona.
- [ ] Prymitywy (dokładnie tyle, ile zużywają trzy ekrany; nie generuj całego katalogu
      shadcn): `button`, `input`, `textarea`, `select`, `label`, `badge`, `card`, `tabs`,
      `table`, `dialog`, `sheet`, `dropdown-menu`, `tooltip`, `separator`, `skeleton`,
      `toast`/`sonner`. `cmdk` już jest — użyj go w `command`, nie dokładaj drugiej biblioteki.
- [ ] `StatusStepper` (`src/components/admin/inquiry/StatusStepper.tsx`) czytający `STATUSES`,
      `STATUS_LABELS`, `STATUS_MEANINGS` z `src/lib/inquiries/state.ts`. Zero własnej listy
      statusów. Terminalne (`lost`, `cancelled`) renderowane jako stan, nie krok.
- [ ] `defaultTabForStatus(status)` — czysta funkcja, `Record<InquiryStatus, TabId>`
      (wyczerpujący, żeby nowy status łamał `tsc`), test na wszystkich 10 statusach.
- [ ] `InquiryDetailTabs` przepisane na `Tabs` z zakładkami z D3 + `?tab=` w URL
      (`useSearchParams` + `router.replace`, bez przeładowania). Zawartość zakładek to
      **przeniesione** dzisiejsze komponenty — logika, akcje i propsy bez zmian.
- [ ] Oś czasu zdarzeń w zakładce Przegląd: `inquiry_events` dla tego zapytania, jedno
      zapytanie w server componencie, typ zdarzenia + aktor + czas (§6.8). Bez filtrów.
- [ ] Lista `/admin/inquiries` na `Table` + `Badge` (status z `STATUS_LABELS`) + filtry na
      `Select`/`Input`; kalendarz zostaje funkcjonalnie taki sam, przechodzi na tokeny.
- [ ] `layout.tsx` + `sidenav.tsx` na tokenach i prymitywach (sidenav: `Tooltip` przy zwiniętym
      stanie, aktywny element akcentem wg D1).
- [ ] `/admin/weekly` — te same kafelki i liczby co z FA-1.10, przełożone na `Card` + `Table`;
      **żadna liczba ani formuła nie zmienia się** (zrzut przed/po obok siebie w raporcie).
- [ ] Komponenty, które po przebudowie zostają bez importera (kandydaci z §6.8:
      `InquiryActionPanel`, `OfferBuilderModal`, `InquiriesFilters`) — **nie kasuj**, dopisz je
      do `docs/deferred-tasks.md` z adnotacją „FA-1.15: bez importera, do usunięcia w FA-1.08".

## Gotowe, gdy
- [ ] `grep -ro "style={{" src/app/admin/inquiries src/components/admin/sidenav.tsx src/app/admin/layout.tsx src/app/admin/weekly | wc -l` → **0**; łączna liczba w `src/app/admin` spadła o ≥ 700 (liczby przed/po w raporcie).
- [ ] `grep -rn "#0A2E4D\|#E67E50\|#F3EDE4" src/app/admin/inquiries src/app/admin/weekly src/components/admin/sidenav.tsx` → **0 trafień**; te kolory występują wyłącznie w `globals.css`.
- [ ] Zrzuty „przed/po" trzech ekranów (lista, karta w statusie `waiting_guide` i `awaiting_payment`, weekly) w raporcie.
- [ ] Karta: stepper pokazuje bieżący status i „na kogo czekamy"; wejście na `/admin/inquiries/<id>` bez `?tab=` otwiera zakładkę wg D3 — udowodnione dla trzech różnych statusów z seeda.
- [ ] `?tab=oferta` otwiera tę zakładkę; po akcji serwerowej (`router.refresh()`) zakładka się nie zmienia — pokazane zrzutem lub testem.
- [ ] **Na czerwono:** test `defaultTabForStatus` — dopisanie statusu do `STATUSES` bez uzupełnienia mapy wywala `pnpm typecheck` (pokaż wyjście `tsc` na celowo złej wersji).
- [ ] **Na czerwono:** test kontrastu pada po podmianie tokenu `--primary-foreground` na `#E67E50` (pokaż czerwone wyjście, potem przywróć).
- [ ] **Na czerwono:** `StatusStepper` nie ma własnej listy statusów — usunięcie jednego wpisu z `STATUS_LABELS` wywala typecheck/test steppera, a nie renderuje pustego kroku.
- [ ] Liczby na `/admin/weekly` identyczne przed i po (8 wartości z tego samego seeda, zestawione w raporcie).
- [ ] Zero zmian w `src/actions/**`, `src/lib/inquiries/state.ts`, `supabase/**` — `git diff --stat` w raporcie to potwierdza (wyjątek: nowe pliki `src/lib/ui/*`).
- [ ] Żadna strona serwerowa nie staje się `'use client'` — lista plików z nowym `'use client'` w raporcie, każdy z uzasadnieniem.
- [ ] `pnpm typecheck` 0, `pnpm test -- --run` zielone (i o ≥ 3 testy więcej), `pnpm build` przechodzi, `pnpm lint` nie gorzej niż `stage-1`.
- [ ] Klawiatura: Tab przechodzi przez zakładki, `Esc` zamyka dialog, `:focus-visible` widoczny na każdym kontrolnym elemencie — zrzut z widocznym focusem w raporcie.
- [ ] `docs/deferred-tasks.md` uzupełnione o komponenty bez importera.

## Poza zakresem
- Jakakolwiek zmiana logiki biznesowej, akcji serwerowych, statusów i formuł — to jest zadanie
  o powierzchni.
- Pozostałe ekrany admina (`/guides`, `/experiences`, `/forms`, `/submissions`, `/unmatched`,
  `/pipeline`, `/ads`, `/finances`) — etap 3 i 6.
- Strona publiczna i portal przewodnika — etap 7 (`@fa/ui`).
- `packages/ui`, monorepo, `apps/admin` — etapy 2 i 3; tu tylko układamy pliki tak, żeby
  przeniesienie było `git mv`.
- Usuwanie martwych komponentów — FA-1.07/1.08.
- Tryb ciemny, wykresy z §6.1, selektor tygodnia, wirtualizacja tabel — nie teraz.
- Zmiana statusu `/admin/weekly` z „tymczasowy" na „docelowy" w FA-1.10 i w planie — O-17,
  decyzja tj.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- `touches_db: false` — żadnych migracji, żadnych zapytań pisemnych. Jeśli układ wymaga nowej
  kolumny albo widoku: STOP, to znak, że zakres się rozjechał.
- Instalator shadcn chcący `tailwind.config.js`, innej wersji Reacta albo `--force` — STOP.
- Jeśli przeniesienie komponentu do zakładki wymaga zmiany jego propsów lub akcji — STOP, pokaż
  różnicę; „przy okazji" refaktor logiki jest tu zabroniony.
- Jeśli którakolwiek liczba na `/admin/weekly` zmieni się po przebudowie — STOP.

## Weryfikacja
```
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
grep -ro "style={{" src/app/admin | wc -l
grep -rn "#0A2E4D\|#E67E50\|#F3EDE4" src/app/admin src/components/admin | wc -l
grep -rn "'use client'" src/app/admin | sort > /tmp/after.txt   # diff z listą sprzed zmian
supabase db reset && pnpm dev
# /admin/inquiries, /admin/inquiries/<id> (3 statusy), /admin/weekly — zrzuty przed/po
```

## Notatki z realizacji
