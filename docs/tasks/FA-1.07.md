---
id: FA-1.07
title: Wycięcie martwego kodu — paczka 1: `knip` w repo, actions + lib + webhooki, resztki Stripe Connect
stage: 1
status: in_progress
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
