---
id: FA-0.01
title: Strona potwierdzenia po wpłacie depozytu (/inquiry-confirmed → 404)
stage: 0
status: in_progress
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

