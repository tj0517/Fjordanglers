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

## Report — FA-0.01 Strona potwierdzenia po wpłacie depozytu (uzupełniony dowodami)

### Done — z dowodami

**1. Brak referencji do starej trasy**
```
$ grep -rn "inquiry-confirmed" src || echo OK-no-references
OK-no-references
```

**2. Nowa funkcja odczytu — plik i sygnatura**

`src/actions/inquiries.ts:1638`:
```ts
export type InquiryConfirmation = {
  tripTitle: string
  anglerName: string
  depositAmountEur: number
  depositPaidAt: string | null
}

export async function getInquiryConfirmation(id: string): Promise<InquiryConfirmation | null> {
  const svc = createServiceClient()
  const { data: inquiry } = await (svc as any)
    .from('inquiries')
    .select('angler_name, deposit_amount, deposit_paid_at, trip_id')
    .eq('id', id)
    .single()

  if (inquiry == null) return null

  const { data: trip } = await svc
    .from('experiences')
    .select('title')
    .eq('id', inquiry.trip_id)
    .single()

  return {
    tripTitle:         trip?.title ?? 'Your trip',
    anglerName:        inquiry.angler_name,
    depositAmountEur:  Number(inquiry.deposit_amount ?? 0),
    depositPaidAt:     inquiry.deposit_paid_at ?? null,
  }
}
```
`select()` na `inquiries`: `angler_name, deposit_amount, deposit_paid_at, trip_id` — brak e-maila, telefonu, tokenu. Drugi `select()` na `experiences`: `title`.

Brak `.from()` w komponencie:
```
$ grep -rn "\.from(" src/app/inquiry/ || echo "OK-no-.from-in-src/app/inquiry"
OK-no-.from-in-src/app/inquiry
```

**3. Wariant niezapłacony — dowód testem vitest + zapytaniem z bazy testowej**

Test: `src/actions/getInquiryConfirmation.test.ts` (nowy plik), uruchomiony przeciw bazie testowej `xsilxmaiyyjgpxsalvet` (env z `.env.local`, nigdy niewypisywany):
```
$ pnpm test -- src/actions/getInquiryConfirmation.test.ts --run

stdout | getInquiryConfirmation > returns depositPaidAt: null for an unpaid inquiry
unpaid inquiry used: { id: 'b03421c1-8b01-4280-85ae-e0616db14611', deposit_paid_at: null }

 ✓ src/actions/getInquiryConfirmation.test.ts (2 tests) 1346ms
     ✓ returns depositPaidAt: null for an unpaid inquiry  1269ms
     ✓ returns null for a nonexistent inquiry id

 Test Files  2 passed (2)
      Tests  12 passed (12)
```
Użyte id zapytania z bazy testowej: `b03421c1-8b01-4280-85ae-e0616db14611`, odczytana wartość `deposit_paid_at`: `null`. Test wywołuje `getInquiryConfirmation(id)` bezpośrednio (tę samą funkcję, którą wywołuje strona) i asercjuje `result.depositPaidAt === null` — to właśnie ta wartość steruje gałęzią renderu w `page.tsx` (`isPaid = depositPaidAt != null`), więc test dowodzi wejścia w wariant „processing".

Drugi test dowodzi zachowania przy nieistniejącym id: `getInquiryConfirmation('00000000-0000-0000-0000-000000000000')` zwraca `null` — w `page.tsx` to `null` wywołuje `notFound()` (`src/app/inquiry/[id]/confirmed/page.tsx:31`), czyli standardowe 404 Next.js, nie błąd 500.

**4. `cancel_url` — nietknięte, potwierdzone diffem**
```
$ sed -n '291p;599p' src/actions/inquiries.ts
        cancel_url:  trip.slug != null ? `${baseUrl}/experiences/${trip.slug}` : baseUrl,
        cancel_url:  `${baseUrl}/offers/${token}`,
```
Obie linie identyczne jak przed zmianą (git diff na `inquiries.ts` nie dotyka `cancel_url`); żadna nie prowadzi na 404 — obie to istniejące, żywe trasy.

**5. Weryfikacja — pełne wyjście**
```
$ pnpm typecheck
> tsc --noEmit
(exit 0, brak błędów)

$ npx eslint "src/app/inquiry/[id]/confirmed/page.tsx" src/actions/inquiries.ts src/actions/getInquiryConfirmation.test.ts
0 errors (1 pre-existing warning w inquiries.ts, linia 1044, poza zakresem tego zadania)

# pnpm lint na całym repo: 62 pre-existing errors / 68 warnings w src/emails/*.tsx
# i whatsapp-bridge/poll-emails.mjs — żaden w plikach dotkniętych tym zadaniem;
# potwierdzone powyższym scoped eslint run.

$ pnpm build
...
├ ƒ /inquiry/[id]/confirmed
...
[exited with code 0]
```

**6. Gałąź wypchnięta**
```
$ git push -u origin fix/inquiry-confirmed-page
 * [new branch]      fix/inquiry-confirmed-page -> fix/inquiry-confirmed-page
```
Vercel preview powinien powstać automatycznie dla tej gałęzi — tj przeklika testowy depozyt (oferta → Checkout test mode → powrót na `/inquiry/{id}/confirmed`).

### Not done
- Pełny ręczny click-through Stripe Checkout (krok 6 wykonuje tj na Vercel preview).

### Noticed, not touched (→ docs/deferred-tasks.md)
- Nic nowego poza tym, co już wyłączono z zakresu (login redirect, webhook, route group).

### Needs a decision
- None.

### Files touched
- `src/actions/inquiries.ts`
- `src/app/inquiry/[id]/confirmed/page.tsx`
- `src/actions/getInquiryConfirmation.test.ts` (nowy test)
