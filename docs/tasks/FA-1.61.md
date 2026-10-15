---
id: FA-1.61
title: Formularz zapytania — odpowiedź bez czekania na agenta AI (`after()`) + przewinięcie i focus na pierwsze błędne pole (v1 i v2)
stage: 1
status: review
difficulty: M
model: sonnet
model_approved: sonnet · effort high by tj 2026-10-15
effort: high
agent: fa-core
branch: fix/inquiry-submit-latency-and-errors
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.61 — Formularz zapytania: szybka odpowiedź + przewinięcie do błędu

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje kodu
- `src/app/api/inquiries/route.ts` — jedyna ścieżka tworzenia zapytania (FA-0.05); co dzieje się przed `return 201`
- `src/lib/ai/auto-send-guards.ts` — pułapka / powtórka / limit; kolejność decyzji zostaje bez zmian
- `src/components/inquiry/InquiryWidget.tsx` — formularz v1 (`handleSubmit`, `hasAttempted`, czerwone obramowania)
- `src/components/inquiry-wizard/inquiry-wizard.tsx` + `validateStep` — formularz v2 (3 kroki, `next()`, `submit()`)
- `docs/tasks/FA-1.60.md` — notatki z testu na prod 15.10 (źródło obu zgłoszeń, czasy odpowiedzi)
- dokumentacja Next 16: `after` z `next/server` (praca po wysłaniu odpowiedzi; na Vercelu przez `waitUntil`)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Klient po kliknięciu „Send” dostaje potwierdzenie w czasie zapisu do bazy, a nie po całej
obsłudze zapytania. Dziś (`route.ts`, `origin/main` 2159df5) `POST /api/inquiries` przed
`return 201` czeka kolejno na: zapis, 2 maile (`Promise.all`), `classifyInquiry` (LLM)
i `autoSendReply` (LLM + wysyłka). Na prod 15.10 zapytania bez pułapki odpowiadały
w 32 s i 15 s, z pułapką (pomija maile i AI) w 0,3 s. Drugie zgłoszenie: kliknięcie
„Send” z brakującym wymaganym polem nic widocznie nie robi — pole dostaje czerwone
obramowanie, ale strona do niego nie przewija (v1: 5× próba wysłania bez efektu w teście
15.10). Po zadaniu formularz przewija do pierwszego błędnego pola i ustawia na nim focus,
w v1 i v2.

## Zakres
- [x] Odczyt bieżącego stanu: `route.ts` od zapisu do `return`; zmierz czas odpowiedzi
      lokalnie dla zapytania zwykłego i z pułapką (log z czasami poszczególnych etapów)
- [x] D1 (decyzja tj przed implementacją — patrz „Bramki STOP”): które etapy idą do `after()`
- [x] Przeniesienie wybranych etapów do `after(async () => …)`; każdy etap nadal w osobnym
      `try/catch` z logiem jak dziś; kolejność `classifyInquiry` → `autoSendReply` zachowana
- [x] Komentarz o „unawaited promises dropped on Vercel” zaktualizowany: `after()` jest
      właśnie mechanizmem, który tego problemu nie ma
- [x] v1 (`InquiryWidget`): przy nieudanej walidacji `scrollIntoView({block:'center'})`
      + `focus()` na pierwszym błędnym polu w kolejności wyświetlania; `aria-invalid` na
      polach z błędem
- [x] v2 (`inquiry-wizard`): to samo przy `next()` i `submit()` z błędami bieżącego kroku
- [x] Respektuj `prefers-reduced-motion` (bez płynnego przewijania)

## Gotowe, gdy
- [x] Test trasy: odpowiedź 201 wraca, zanim zakończy się `classifyInquiry` (mock z
      opóźnieniem, np. 5 s) — czas odpowiedzi < 1 s w teście; **na czerwono**: przed zmianą
      ten sam test trwa ≥ 5 s / pada na limicie
- [x] Test trasy: po zakończeniu pracy z `after()` `classifyInquiry` i `autoSendReply` są
      wywołane dla zapytania zwykłego, a dla zapytania z pułapką / powtórki — nie (testy
      z FA-1.43 i auto-send-guards nadal zielone, bez zmiany oczekiwań)
- [x] Wyjątek w `classifyInquiry` wewnątrz `after()` jest zalogowany i nie zmienia odpowiedzi
      ani nie blokuje `autoSendReply` (zachowanie jak dziś) — test
- [x] v1: test komponentu — „Send” z pustym nazwiskiem → `scrollIntoView` i focus na polu
      nazwiska; pole ma `aria-invalid="true"`; **na czerwono** bez zmiany
- [x] v2: test komponentu — „Continue”/„Send” z błędem w kroku → focus na pierwszym błędnym
      polu kroku; **na czerwono** bez zmiany
- [x] Lokalnie (Playwright, 390 px i 1280 px): v1 i v2, pole wymagane puste na dole
      formularza, „Send” → pole w widoku i z focusem; zrzuty przed/po w `.fa-proofs/fa-1.61/`
- [x] Lokalnie: czas od „Send” do ekranu sukcesu dla zapytania zwykłego z
      `AI_AUTO_REPLY_ENABLED` — przed i po, liczby w raporcie
- [x] `pnpm typecheck`, `lint`, `test`, `knip` zielone

## Poza zakresem
- zmiana logiki pułapki, powtórek, limitu auto-send, treści maili, promptów agenta
- przenoszenie pracy do kolejki / crona / osobnej funkcji (to inny projekt)
- GA4 bez requestów na stronach eksperymentów, stary tag `AW-18008446689` z GTM,
  pingi Consent Mode przy `ad_storage=denied` — osobne wiersze w `docs/deferred-tasks.md`
- zmiany wyglądu formularzy poza obsługą błędu
- gtag / `trackSubmitLeadForm` i kolejność zdarzeń lejka z FA-1.60 (konwersja tylko po `res.ok` — zostaje)

Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- **STOP przed implementacją `after()`**: pokaż pomiar z pierwszego punktu zakresu i opcje D1
  z konsekwencjami — (a) do `after()` tylko `classifyInquiry` + `autoSendReply`, maile dalej
  przed odpowiedzią; (b) maile też do `after()`. Czekaj na wybór tj.
- Merge do `main` = deploy na prod (zmiana zachowania ścieżki zapytań klientów) — robi tj.
- Żadnych zapisów na prod; testy wyłącznie lokalnie.

## Weryfikacja
```
pnpm test -- src/app/api/inquiries src/components/inquiry src/components/inquiry-wizard
grep -n "after(" src/app/api/inquiries/route.ts        # ≥ 1
grep -n "await classifyInquiry" src/app/api/inquiries/route.ts   # tylko wewnątrz after()
grep -rn "scrollIntoView" src/components/inquiry src/components/inquiry-wizard   # v1 i v2
```

## Notatki z realizacji
- 2026-10-15 zadanie założone przez tj po teście prod FA-1.60 (dwa zgłoszenia: długie
  wysłanie; brak przewinięcia do brakującego pola w v1 i v2). Diagnoza z odczytu kodu
  `origin/main` 2159df5: `route.ts` czeka na `classifyInquiry` i `autoSendReply` przed
  `return 201`; czasy z prod 15.10: 32 s / 15 s bez pułapki, 0,3 s z pułapką.
- 2026-10-15 faza A (pomiar lokalny, `next dev`, AI włączone, maile `RESEND_DEV_FAKE=1`, hosty Google zablokowane w Playwright; `src` bez zmian). Szczegóły i surowe dane: `.fa-proofs/fa-1.61/stage-timings-before.md`, `send-to-success-before.log`, `scroll-before.log`, zrzuty `before-*.png`.
  - Trasa v1, zwykłe zapytanie (n=5, ms min / mediana / max): `classifyInquiry` 1235 / 1295 / 1576, `autoSendReply` 4324 / 5084 / 6293, całość 5652 / 6361 / 7701. Z pułapką 27 / 28 / 51, powtórka 33 / 35 / 41. v2 (z `brief`, n=4): zwykłe 8678 / 9611 / 10830, pułapka 34, powtórka 38. Wszystko przed AI: ok. 25–60 ms. Czas realnych maili (render + Resend) niezmierzony — atrapa wraca przed renderem.
  - Przeglądarka „Send” → ekran sukcesu (n=3): v1 mediana 7,9 s, v2 10,4 s — prawie w całości czekanie na odpowiedź.
  - Przewinięcie „przed”: v1 — imię 0% widoczne (1280×720, 390×667, 390×844), focus na „Send”, brak `aria-invalid`; v2 krok 3 — 0% przy 1280×720 i 390×667 (390×844 bez reprodukcji), `aria-invalid` już jest; v2 krok 2 — pierwsza grupa 0% przy każdym rozmiarze, grupy (`fieldset` + `legend` + `input type="radio"`) bez `aria-invalid` / `aria-describedby`.
  - `after` (Next 16.1.6): callback po zamknięciu odpowiedzi; błąd w callbacku złapany i zalogowany; osobne `after()` biegną równolegle; poza zakresem żądania (vitest) `after()` rzuca synchronicznie; czas pracy w ramach `maxDuration` trasy (dokumentacja Next; w repo nieustawione → domyślny limit planu).
- 2026-10-15 decyzje tj (STOP 1):
  - D1 = (a): do `after()` tylko `classifyInquiry` + `autoSendReply`, w jednym callbacku, kolejno, każde w `try/catch`; maile zostają przed odpowiedzią. Wywołanie `after()` owinięte w `try/catch` z logiem.
  - D2.1 = (i): v2 krok 2 — przewinięcie do `fieldset` + focus na pierwszym radio grupy; `aria-invalid` + `aria-describedby` (na komunikat błędu) na `fieldset`.
  - D2.2: `continueFromInline` (S14 „Continue”) poza zakresem — bez zmian.
  - D2.3: v1 bez nowego tekstu błędu; tylko `aria-invalid`, przewinięcie, focus.
- 2026-10-15 raport (status `review`):

## Report — FA-1.61 Inquiry form: fast response + scroll to the error

### Done
1. **The 201 no longer waits for the AI agent (D1 = a).**
   - `classifyInquiry` and then `autoSendReply` run in one `after()` callback, one after the other, each in its own `try/catch` with the same log lines as before.
   - The run condition is unchanged: `AI_AUTO_REPLY_ENABLED && !isRepeat && !isSuspicious`. For trap, repeat or flag off, `after()` is never called.
   - The two e-mails are still awaited before the response.
   - The `after()` call is itself in a `try/catch` that logs `Could not schedule the AI work…`, so a saved inquiry never turns into a 500.
   - The file header and the comment about dropped promises on Vercel are updated.
   - Evidence: `route-after.test.ts` (9 tests), red `red-route-before-after.log`.
2. **Mocking `after` in the tests.**
   - `__tests__/after-queue.ts` replaces `after` with a queue that never runs callbacks on its own. `flushAfter()` runs them after `POST` has returned.
   - Test 2 ("the stand-in really defers") proves the callback runs only after the response. When the mock runs callbacks immediately, 3 tests fail (`red-after-mock-inline.log`).
   - Existing tests (`route.test.ts`, `rate-limit.test.ts`, `rate-limit-config.test.ts`) gain `await flushAfter()`, the mock and a queue reset. Their diff has 0 removed lines, so every expectation is byte-identical.
3. **v1 (`InquiryWidget`).**
   - On a failed Send: scroll (`scrollIntoView`) and focus on the first invalid field in display order (first name, last name, e-mail, trip length).
   - `aria-invalid` on the fields, under the same condition as the red border.
   - No new error text (D2.3).
4. **v2 (`inquiry-wizard`).**
   - The same in `next()` and `submit()`. Step 2 (D2.1): scroll to the `fieldset` and focus its first radio. The `fieldset` gets `aria-invalid` plus `aria-describedby` pointing at the error text.
   - The lookup is limited to the overlay body, so the S14 inline copy is never picked.
   - `continueFromInline` is unchanged (D2.2).
   - With `prefers-reduced-motion`, the scroll is `'auto'` (no smooth scrolling).
   - A shared helper lives in `src/components/inquiry/scroll-to-field.ts`.
   - Evidence: `InquiryWidget.test.tsx` (new, 7 tests), `inquiry-wizard.test.tsx` (+9), red `red-v1-scroll-focus.log` (6 failing), `red-v2-scroll-focus.log` (7 failing).

### Acceptance criteria, with evidence
- **[x] 201 before `classifyInquiry`, with the mock taking 5 s.**
  - The response returns in < 1 s.
  - Red on the original route: `Test timed out in 5000ms` (`red-route-before-after.log`).
- **[x] After the after-work completes, classify and auto-send are called for a normal inquiry and not for trap or repeat.**
  - `route-after.test.ts`, 4 rows: trap, too fast, repeat, flag off.
  - The FA-1.42 and FA-1.43 tests in `route.test.ts` are green with unchanged expectations.
- **[x] A throw in `classifyInquiry` inside `after()` is logged, does not change the response and does not block `autoSendReply`.** Test "classifyInquiry throws inside after()".
- **[x] v1: Send with an empty last name.**
  - `scrollIntoView` is called on the last-name input, focus lands on it, and it has `aria-invalid="true"`.
  - Red: `expected [] to deeply equal [ <input …> ]`.
- **[x] v2: Continue/Send with a step error → focus on the first invalid field of the step.**
  - Covered for step 3 and step 2.
  - Red: `expected <h2 tabindex="-1" …> to be <select …>`.
- **[x] Playwright, 390 and 1280 px.** `scroll-compare.md`, `before-*.png` / `after-*.png`:

| scenario | 1280×720 | 390×667 | 390×844 |
|---|---|---|---|
| v1, first name | 0% → 100%, focus on the field, `aria-invalid` none → true | 0% → 100% | 0% → 100% |
| v2 step 3, first name | 0% → 100%, focus on the field | 0% → 100% | 100% → 100% (no repro before) |
| v2 step 2, first group | 0% → 100%, focus on the first radio, `aria-invalid` none → true | 0% → **83%** (group is 597 px in a 498 px area — the maximum possible) | 0% → 100% |

- **[x] Local Send → success screen, `AI_AUTO_REPLY_ENABLED` on** (`send-to-success-before.log` / `-after.log`, n=3):
  - **v1:** median **7888 ms → 169 ms**.
  - **v2:** median **10429 ms → 127 ms**.
- **[x] `typecheck`, `lint`, `test`, `knip` green.** Details under Verification.

**Response time of the bare `POST` (ms, min/med/max)** (`stage-timings-before.md` / `-after.md`):

| body / case | before | after |
|---|---|---|
| v1 normal, AI on (n=5) | 5669 / 6378 / 7731 | **44 / 55 / 73** |
| v2 normal, AI on (n=4) | 8692 / 9629 / 10843 | **45 / 46 / 50** |
| v1 trap / repeat | 48 / 49 (med) | 42 / 48 (med) |
| v2 trap / repeat | 49 / 53 (med) | 44 / 52 (med) |

**The AI work still runs after the response** (`after-work-proof.log`, local DB, SELECT only):
- Every normal run got `agent.auto_send_decided` 6.7–18.1 s after the 201, and a draft in `messages`. v2 runs also got `inquiry.qualified_set`.
- Trap and repeat (18 runs): exactly one `auto_send_decided` with the trap or repeat reason, 0 `qualified_set`, 0 `messages`.
- The dev-server logs show 0 `Agent error`, `Auto-send error`, `Could not schedule` and `after()` errors.

### Not done
- Nothing tested on prod (no prod writes, as required). The behaviour on Vercel (`waitUntil`, the `maxDuration` limit) is not verified; that needs a function log after the deploy.
- The real e-mail time (Resend render + call) is not measured: locally the e-mail stage goes through `RESEND_DEV_FAKE` (≈1 ms).
- Locally, every normal run stops at the destination gate ("no active destination knowledge entry for country: New Zealand"). The judge and the send never ran, so the "before" times and the after-work times are lower bounds. The structural result (201 independent of the AI) does not depend on this.

### Noticed, not touched (→ docs/deferred-tasks.md)
- `route.ts` queries `experience_pages` with `.from` itself (rule 3); this predates the task.
- The mock in `rate-limit.test.ts` has no `.neq`, so the repeat lookup in that test always fails open.
- `maxDuration` is not set for the route. The after-work shares the plan's default limit.
- Stale comments in `email.ts:133-134` ("fire-and-forget").
- The `Promise.all` e-mail problem was already in deferred (FA-1.43 row). I did not add a duplicate; I added a note to that row instead.

### Needs a decision
- **`block: 'start'` instead of `'center'` for groups taller than their scroll area.** This deviates from the task's `scrollIntoView({block:'center'})`. A five-option group on a phone is taller than the visible area, and centring crops the legend (the question).
  - **(a) Keep `'start'`.** The question is visible and the group is 83% visible, the maximum possible. Recommended.
  - **(b) Pure `'center'`.** Delete `blockFor()` in `scroll-to-field.ts`; the legend gets cropped.
  - Test: "oversize group gives 'start'".
- **(info)** On a `fieldset`, `aria-invalid` is not formally supported ARIA (the role is group). It was chosen in D2.1, and some screen readers may ignore it. `aria-describedby` works. The S14 inline copy of step 1 also gains these attributes, but no scroll or focus — D2.2 holds.
- **(info)** `FIELD_ORDER` in `wizard-state.ts` must be updated when a new required question is added to a v2 step.

### Verification
```
pnpm exec tsc --noEmit                → exit 0 (full-tsc.log)
pnpm exec eslint .                    → 0 errors, 99 warnings (= origin/main 99; 0 in changed files beyond the 2 already in InquiryWidget.tsx on main)
pnpm exec knip                        → exit 0, clean (full-knip.log)
pnpm exec vitest run (local stack up) → Test Files 90 passed (90) · Tests 1088 passed (1088) (full-test.log)
pnpm exec next build (stack stopped, 0 FA containers) → ✓ Compiled successfully, exit 0 (full-build.log)
grep -n "after(" src/app/api/inquiries/route.ts                    → comments + one call `after(async () => …)` (line 346)
grep -n "await classifyInquiry" src/app/api/inquiries/route.ts     → line 348, only inside after()
grep -rn "scrollIntoView" src/components/inquiry src/components/inquiry-wizard → scroll-to-field.ts (used by v1 and v2)
```

### Uczciwość zapisu
- Implementation was delegated: route to `fa-core` (Sonnet), forms to `fa-web` (Sonnet), measurements to `fa-core`. I reviewed both diffs and committed them.
- Local runs called the real Anthropic API (key from `.env.local`). E-mails went through `RESEND_DEV_FAKE=1`. Playwright aborted the Google hosts, so no local conversion reached Ads.
- The local DB holds `fa161-*` / `fa161a-*@example.invalid` test inquiries. They are local only.
- Two decisions made by agents were not in the brief and were left in the code for tj to decide: `block:'start'` for oversized groups (above), and `aria-invalid`/`aria-describedby` on the S14 inline groups as attributes only.
- One lint warning from my own proof script (`after-timings-run.mjs`, an unused variable) was fixed before the count, so lint equals `main`.
