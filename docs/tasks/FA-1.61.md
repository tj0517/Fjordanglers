---
id: FA-1.61
title: Formularz zapytania — odpowiedź bez czekania na agenta AI (`after()`) + przewinięcie i focus na pierwsze błędne pole (v1 i v2)
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
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
- [ ] Odczyt bieżącego stanu: `route.ts` od zapisu do `return`; zmierz czas odpowiedzi
      lokalnie dla zapytania zwykłego i z pułapką (log z czasami poszczególnych etapów)
- [ ] D1 (decyzja tj przed implementacją — patrz „Bramki STOP”): które etapy idą do `after()`
- [ ] Przeniesienie wybranych etapów do `after(async () => …)`; każdy etap nadal w osobnym
      `try/catch` z logiem jak dziś; kolejność `classifyInquiry` → `autoSendReply` zachowana
- [ ] Komentarz o „unawaited promises dropped on Vercel” zaktualizowany: `after()` jest
      właśnie mechanizmem, który tego problemu nie ma
- [ ] v1 (`InquiryWidget`): przy nieudanej walidacji `scrollIntoView({block:'center'})`
      + `focus()` na pierwszym błędnym polu w kolejności wyświetlania; `aria-invalid` na
      polach z błędem
- [ ] v2 (`inquiry-wizard`): to samo przy `next()` i `submit()` z błędami bieżącego kroku
- [ ] Respektuj `prefers-reduced-motion` (bez płynnego przewijania)

## Gotowe, gdy
- [ ] Test trasy: odpowiedź 201 wraca, zanim zakończy się `classifyInquiry` (mock z
      opóźnieniem, np. 5 s) — czas odpowiedzi < 1 s w teście; **na czerwono**: przed zmianą
      ten sam test trwa ≥ 5 s / pada na limicie
- [ ] Test trasy: po zakończeniu pracy z `after()` `classifyInquiry` i `autoSendReply` są
      wywołane dla zapytania zwykłego, a dla zapytania z pułapką / powtórki — nie (testy
      z FA-1.43 i auto-send-guards nadal zielone, bez zmiany oczekiwań)
- [ ] Wyjątek w `classifyInquiry` wewnątrz `after()` jest zalogowany i nie zmienia odpowiedzi
      ani nie blokuje `autoSendReply` (zachowanie jak dziś) — test
- [ ] v1: test komponentu — „Send” z pustym nazwiskiem → `scrollIntoView` i focus na polu
      nazwiska; pole ma `aria-invalid="true"`; **na czerwono** bez zmiany
- [ ] v2: test komponentu — „Continue”/„Send” z błędem w kroku → focus na pierwszym błędnym
      polu kroku; **na czerwono** bez zmiany
- [ ] Lokalnie (Playwright, 390 px i 1280 px): v1 i v2, pole wymagane puste na dole
      formularza, „Send” → pole w widoku i z focusem; zrzuty przed/po w `.fa-proofs/fa-1.61/`
- [ ] Lokalnie: czas od „Send” do ekranu sukcesu dla zapytania zwykłego z
      `AI_AUTO_REPLY_ENABLED` — przed i po, liczby w raporcie
- [ ] `pnpm typecheck`, `lint`, `test`, `knip` zielone

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
