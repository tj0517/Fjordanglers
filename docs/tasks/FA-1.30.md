---
id: FA-1.30
title: Wiadomość z linkiem depozytu — nazwa i opis wyprawy w Stripe; szkic od agenta AI, kwotę i link wstawia kod
stage: 1
status: review
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/deposit-message
pr: https://github.com/tj0517/Fjordanglers/pull/105
depends_on: [FA-1.29]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.30 — Wiadomość z linkiem depozytu

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje kodu i testów
- `src/actions/messages.ts` — `createPaymentLink` (nazwa produktu `Booking & Curation Fee — FjordAnglers`, szkic `Payment link: <url>`), `proposeDraft`
- `src/lib/ai/draft-reply.ts` — agent szkiców (FA-1.14, FA-1.21, FA-1.23)
- `src/app/admin/inquiries/[id]/MessageComposer.tsx` — kompozytor i szkice
- `docs/tasks/FA-1.29.md` — skąd biorą się kwota, waluta i aktywny link
- `docs/04-open-questions.md` — O-23 (rozstrzygnięte)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś klient na stronie płatności widzi stały napis „Booking & Curation Fee — FjordAnglers” bez nazwy wyprawy, a admin dostaje szkic wiadomości z samym linkiem. Po zadaniu strona płatności w Stripe pokazuje, za co klient płaci (wyprawa, termin, liczba osób), a po utworzeniu linku kompozytor otwiera szkic wiadomości do klienta napisany przez agenta AI w tonie wątku. Kwotę i link wstawia kod dosłownie — AI nie może ich zmienić ani pominąć.

## Decyzje tj (24 IX 2026, wf-plan)
- Treść wiadomości pisze **agent AI** (nie stały szablon).
- Zabezpieczenie (propozycja z wf-plan, zaakceptowana wraz z planem): kwota i URL linku wstawiane przez kod; szkic bez dokładnej kwoty i URL nie trafia do kompozytora.
- **O-23 = komunikat o błędzie:** gdy szkic nie przejdzie sprawdzenia albo AI jest niedostępne, admin widzi czytelny komunikat (co się nie udało) i pisze wiadomość sam; link i tak jest widoczny na karcie (FA-1.29). Bez stałego szablonu.

## Zakres
- [ ] Odczyt bieżącego stanu: jak `createPaymentLink` nazywa produkt i wstawia szkic; czy kompozytor pokazuje szkice ze statusem `draft`; jak `draftReply` buduje kontekst wątku.
- [ ] Nazwa produktu w Stripe: tytuł wyprawy, termin, liczba osób; opis: za co jest opłata. Dokładny tekst proponujesz w raporcie w sekcji „Needs a decision”.
- [ ] Szkic wiadomości przez agenta AI z miejscami na kwotę i link; kod podstawia dokładną kwotę (z walutą) i URL aktywnego linku, potem sprawdza, że oba są w tekście.
- [ ] Gdy walidacja nie przejdzie albo AI jest niedostępne — czytelny komunikat w kompozytorze, bez szkicu (O-23).
- [ ] Po utworzeniu linku kompozytor w „Conversation” otwiera się ze szkicem; admin edytuje i wysyła zwykłą ścieżką.

## Gotowe, gdy
- [x] Nazwa i opis produktu: test sprawdza `buildStripeProductName`/`buildStripeProductDescription` (wyprawa, termin, liczba osób); `products.create` wywołane z `name` + `description`; w trybie testowym Stripe strona płatności pokazuje nową nazwę — **zrzut**.
- [x] Szkic zawiera dokładną kwotę z walutą i URL aktywnego linku — test na wyjściu z zamockowanym modelem.
- [x] Red proof: model zwraca tekst bez linku albo ze zmienioną kwotą → szkic nie trafia do kompozytora, admin widzi komunikat o błędzie (test); to samo przy braku klucza AI.
- [x] Kompozytor po utworzeniu linku pokazuje szkic — **zrzut Playwright**.
- [x] `pnpm typecheck && pnpm lint && pnpm test run` zielone.

## Poza zakresem
- Logika linku (kwota, status, jeden aktywny link) → FA-1.29
- Automatyczne wysyłanie wiadomości z linkiem — szkic zawsze wysyła admin
- Zmiany w instrukcjach agenta w bazie (`agent_knowledge`) poza tym, co potrzebne do tej wiadomości
- Wygląd kompozytora → FA-1.32
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Stripe w trybie live — zakaz; wyłącznie tryb testowy.
- Zmiana wpisów wiedzy lub instrukcji agenta w bazie produkcyjnej — zakaz; propozycja w raporcie.

## Weryfikacja
```
pnpm test run src/actions src/lib/ai
pnpm typecheck && pnpm lint && pnpm test run
```

## Notatki z realizacji
- 2026-09-24 tj (wf-plan): zadanie z wiersza FA-1.18 w `docs/deferred-tasks.md`.
- 2026-09-25 tj (wf-task): D1 — description via a separately created Stripe product with name + description (price_data.product_data has no description field); D2 — AI draft only when a new link is created; the same-amount reuse branch creates no draft. D3 — Stripe evidence via Stripe CLI in test mode; the stripe MCP server is not configured.
- 2026-09-25 claude (implementation complete): 14 test files, 123 tests pass. Stripe CLI verification (test mode, prod_VKDoE5chuTkdzI): `"livemode": false`, `"name": "Your trip — 15–18 Jul 2026 · 2 people"`, `"description": "FjordAnglers booking & curation fee. The trip balance is paid directly to your guide after arrival."`. Playwright screenshots: Stripe page (.playwright-mcp/page-2026-09-25T13-42-05-753Z.png), composer pre-filled (.playwright-mcp/page-2026-09-25T13-41-24-676Z.png), offer card with link (.playwright-mcp/page-2026-09-25T13-41-03-044Z.png).
- 2026-09-25 tj (wf-review): Stripe product name `'<trip title> — <dates> · <N> people'` and description `'FjordAnglers booking & curation fee. The trip balance is paid directly to your guide after arrival.'` approved. Round 2 requested: 8 fixes (data-layer isolation, INSERT-only draft, exact-once placeholder + no-URL/no-amount validation, instructions in prompt, link-scoped pre-fill, dead prop removal, real trip title evidence, cast cleanup).
- 2026-09-25 claude (round 2 complete): All 8 fixes implemented (commit d0e16ef + docs). Stripe CLI evidence (test mode, prod_VKEjo2wMFjIneb): `"livemode": false`, `"name": "Arctic Char Fishing, Iceland — 10–13 Aug 2026 · 2 people"`. 44 test files, 397 tests green. Fix 1 proof: `git diff origin/stage-1...HEAD -- 'src/app/**' 'src/lib/ai/**' | grep -n '^+.*\.from('` → empty. Playwright screenshots: Stripe payment page (.playwright-mcp/fix7-stripe-real-trip-title.png), composer with draft (.playwright-mcp/fix7-composer-with-draft.png), composer error state (.playwright-mcp/fix6-composer-error-state.png).
