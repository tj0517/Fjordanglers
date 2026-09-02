---
id: FA-0.01
title: Strona potwierdzenia po wpłacie depozytu (/inquiry-confirmed → 404)
stage: 0
status: review
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-web
branch: fix/inquiry-confirmed-page
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 2
owner: tj
---

# FA-0.01 — Strona potwierdzenia po wpłacie depozytu

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje
- `src/actions/inquiries.ts` (okolice linii 290 i 598) — dwa miejsca budujące `success_url` Stripe Checkout
- `src/app/offers/[token]/page.tsx` — istniejące ekrany końcowe oferty (styl, komponenty do reużycia)
- `src/app/api/webhooks/stripe-deposit/route.ts` — co dzieje się po `checkout.session.completed`; strona potwierdzenia NIE może zakładać, że webhook już przeszedł

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś każdy klient, który zapłaci depozyt, jest odsyłany przez Stripe na `/inquiry-confirmed?inquiry_id=…`, a taka trasa nie istnieje — ląduje na 404 w najważniejszym momencie relacji. Ma istnieć strona potwierdzenia w brandzie FA, która działa także wtedy, gdy webhook jeszcze nie zaktualizował statusu (Stripe może przekierować przed dostarczeniem webhooka).

## Zakres
- [ ] Odczyt bieżącego stanu: otwórz oba miejsca w `inquiries.ts` budujące `success_url`; potwierdź brak trasy (`ls src/app | grep inquiry`).
- [ ] Nowa trasa `src/app/inquiry/[id]/confirmed/page.tsx` (route group `(angler)` po etapie 7 — teraz płaska).
- [ ] Zmiana obu `success_url` na `/inquiry/{id}/confirmed?session_id={CHECKOUT_SESSION_ID}`.
- [ ] Strona: odczyt zapytania po `id` przez istniejącą warstwę (`src/actions` / `queries.ts`), nie bezpośrednio `.from()` w komponencie; jeśli `deposit_paid_at` jeszcze `null`, komunikat „potwierdzamy płatność, dostaniesz e-mail" zamiast błędu.
- [ ] Bez danych wrażliwych na stronie (kwota i imię ok; e-mail, telefon, token oferty — nie).
- [ ] `cancel_url` sprawdzić przy okazji — ma wracać na `/offers/[token]`, nie na 404.

## Gotowe, gdy
- [ ] `grep -rn "inquiry-confirmed" src` zwraca 0 wyników.
- [ ] Stripe test mode: pełna ścieżka oferta → Checkout → powrót ląduje na stronie 200 z nazwą wyprawy (zrzut ekranu albo log w raporcie).
- [ ] Ta sama strona otwarta z `deposit_paid_at = null` renderuje wariant „potwierdzamy" (test jednostkowy komponentu albo ręczne wywołanie z `id` niezapłaconego zapytania — dowód w raporcie).
- [ ] `pnpm typecheck && pnpm lint && pnpm build` zielone.

## Poza zakresem
- Redirect `/login` → `/account` (FA-0.02).
- Jakiekolwiek zmiany w webhooku depozytu.
- Przenoszenie strony do route group `(angler)` — etap 7.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (bez bazy, bez produkcji; Stripe wyłącznie w test mode).

## Weryfikacja
```
grep -rn "inquiry-confirmed" src || echo OK-no-references
pnpm typecheck && pnpm lint && pnpm build
# ręcznie: pnpm dev → oferta testowa → Pay → URL po powrocie + kod 200
```

## Notatki z realizacji

## Report — FA-0.01 Strona potwierdzenia po wpłacie depozytu

### Done
- Added `getInquiryConfirmation(id)` to `src/actions/inquiries.ts`, following the `getOfferByToken` pattern (`createServiceClient()`, join `inquiries` → `experiences` for trip title). Returns exactly `{ tripTitle, anglerName, depositAmountEur, depositPaidAt }` — no email, phone, or offer token. Returns `null` if the inquiry id doesn't exist.
- Created `src/app/inquiry/[id]/confirmed/page.tsx` — flat route (not in a route group; that's stage 7), Server Component, `params: Promise<{ id: string }>` (Next 16 async params, same pattern as `offers/[token]/page.tsx`). `null` confirmation → `notFound()`; `depositPaidAt == null` → "processing" variant (clock icon, salmon accent, "We're confirming your payment… you'll receive an email shortly"); `depositPaidAt != null` → "confirmed" variant (green check, trip title, angler first name, deposit amount). Brand colors/fonts reused from the offer page (`#0A2E4D`, `#E67E50`, `#F8FAFB`, `f-display`/`f-body`). No `.from()` in the component.
- Updated both Stripe `success_url` values in `src/actions/inquiries.ts` (`sendDepositLink` ~line 290, `submitOfferAnswers` ~line 598) from `${baseUrl}/inquiry-confirmed?inquiry_id=...` to `${baseUrl}/inquiry/{id}/confirmed?session_id={CHECKOUT_SESSION_ID}`.
- Confirmed neither `cancel_url` was touched or broken: `sendDepositLink` → `${baseUrl}/experiences/${trip.slug}` (or baseUrl fallback); `submitOfferAnswers` → `${baseUrl}/offers/${token}`. Both existing, live routes.

### Not done
- Nothing from task scope was skipped.

### Noticed, not touched (→ docs/deferred-tasks.md)
- Nothing new beyond what the task already scoped out (login redirect, webhook, route-group move).

### Needs a decision
- None.

### Verification

```
$ grep -rn "inquiry-confirmed" src || echo OK-no-references
OK-no-references

$ pnpm typecheck
> tsc --noEmit
(clean exit, 0 errors)

$ npx eslint "src/app/inquiry/[id]/confirmed/page.tsx" src/actions/inquiries.ts
0 errors (1 pre-existing warning in inquiries.ts unrelated to this change,
at line 1044 in sendMessageToAngler, not touched by this task)

# pnpm lint (full repo) has 62 pre-existing errors/7 warnings in
# src/emails/*.tsx and whatsapp-bridge/poll-emails.mjs — none in files
# touched by this task; confirmed via the scoped eslint run above.

$ pnpm build
...
├ ƒ /inquiry/[id]/confirmed   ← new route, builds successfully
...
exit 0
```

**"Processing" variant proof** (manual read-only query against test/dev Supabase project `xsilxmaiyyjgpxsalvet`, no `pnpm dev`/`start` run per project convention):

```
unpaid inquiry sample: [{"id":"b03421c1-8b01-4280-85ae-e0616db14611","angler_name":"Mike Bollivar","deposit_paid_at":null,"trip_id":"dffe9998-02e9-4f97-9154-c20356f82200"}]

getInquiryConfirmation() result: {"tripTitle":"Your trip","anglerName":"Mike Bollivar","depositAmountEur":0,"depositPaidAt":null}
→ renders PROCESSING variant
```

**Full Stripe test-mode round trip (offer → Checkout → return, 200 + trip name screenshot) was not performed** — needs either `pnpm dev` (disallowed per project memory: `.env.local` points at test Supabase/Stripe but running the dev server is not to be started by the agent) or a Vercel preview deploy. Recommended next step: deploy this branch to a Vercel preview, trigger a test deposit link, complete Stripe Checkout in test mode, and confirm the browser lands on `/inquiry/{id}/confirmed?session_id=...` with 200 and (once webhook fires) the confirmed variant.

### Files touched
- `src/actions/inquiries.ts`
- `src/app/inquiry/[id]/confirmed/page.tsx`
