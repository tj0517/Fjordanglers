---
id: FA-M.15
title: Reset hasła, który naprawdę wysyła maila i przeżywa drugie kliknięcie; wysyłki maili, które nie znikają na Vercelu
stage: M
status: review
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: feat/fa-m.15-reset-and-email-sends
pr: 220
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-M.15 — Reset hasła i wysyłki maili na Vercelu

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`, `docs/05-agent-operations.md`
- `src/actions/auth.ts` (`resetPassword`), `src/app/auth/reset/route.ts`, `src/app/reset-password/page.tsx`,
  `src/app/forgot-password/page.tsx`, `src/components/auth/forgot-password-form.tsx`
- `src/lib/email.ts`, `src/lib/email-fake.ts`, `src/lib/email.test.ts`
- `src/app/api/webhooks/stripe-deposit/route.ts`
- `src/app/api/inquiries/route.ts` ok. linie 295–335 — istniejący, poprawny wzorzec: wysyłki z `await` + komentarz dlaczego
- `src/actions/__tests__/guide-accounts.test.ts` — istniejące asercje `/auth/reset`

## Dowody z produkcji (2026-11-27, odczyt tj)
- Logi Supabase Auth: 3× `/admin/generate_link` (recovery) 200 o 10:14:18, 11:46:52, 11:47:53 UTC; Resend dostał tylko maila z 11:46.
- Log Vercela: `[auth/resetPassword] Email send error: TypeError: fetch failed` — przyczyna `ECONNRESET`,
  „Client network socket disconnected before secure TLS connection was established”, host `api.resend.com`.
- Przyczyna w kodzie: `resetPassword` odpala `sendPasswordResetEmail(...).catch(...)` bez `await` i zwraca wynik;
  na Vercelu funkcja zamarza, a żądanie w locie zostaje ubite.
- Drugi błąd: 11:47:24 `/verify` 200 (logowanie), 11:47:38 `/verify` 403 `otp_expired` dla tego samego linku →
  `GET /auth/reset` zużywa token przy każdym wejściu (odświeżenie, podwójne żądanie, skanery linków), użytkownik widzi „invalid or expired”.

## Zakres
1. `resetPassword`: `await` na wysyłce. Gdy wysyłka ostatecznie się nie uda — neutralny błąd w formularzu
   („We couldn't send the email right now. Please try again in a minute.”); nigdy nie zdradza, czy konto istnieje
   (nieznany email nadal zwraca sukces, jak dziś).
2. Wspólny retry w `sendEmail` (`src/lib/email.ts`): do 3 prób z krótkim backoffem, tylko przy błędach sieci
   (`fetch failed`, ECONNRESET, ETIMEDOUT i podobne) oraz HTTP 429/5xx; nigdy przy 4xx innym niż 429.
   Nagłówek `Idempotency-Key`, ta sama wartość we wszystkich próbach jednej logicznej wysyłki, żeby retry nie
   dostarczył dwa razy. Zachowanie `RESEND_DEV_FAKE` bez zmian.
3. Link resetu nie zużywa tokenu przy GET:
   - `GET /auth/reset?token_hash=…&type=recovery` pokazuje stronę lądowania (branding FA jak na `/reset-password`)
     z jednym przyciskiem „Set new password”; przy GET nic nie jest weryfikowane.
   - Przycisk wysyła formularz (POST / server action) i dopiero wtedy woła `verifyOtp({ token_hash, type: 'recovery' })`,
     potem `/reset-password`.
   - Gdy weryfikacja się nie uda, ale użytkownik ma już ważną sesję z tego przepływu — od razu `/reset-password` zamiast błędu.
   - Naprawdę nieważny/wygasły: `/forgot-password` z istniejącym komunikatem plus wyraźna droga do nowego linku.
   - Zapasowa ścieżka PKCE `code` działa jak dziś.
4. Webhook depozytu Stripe (`stripe-deposit/route.ts`): mail do wędkarza (`sendDepositConfirmedAnglerEmail`) i do
   przewodnika (`sendBookingConfirmedGuideEmail`) WYŁĄCZONE jedną nazwaną stałą w tym pliku (domyślnie off, komentarz:
   disabled by tj 2026-11-27 until post-deposit flow is designed). Mail do FA (`sendDepositConfirmedFaEmail`) zostaje
   i jest z `await` (bez fire-and-forget), błędy logowane, webhook nadal zwraca 2xx, gdy płatność jest zapisana.

## Gotowe, gdy
- [ ] `resetPassword` czeka na wysyłkę; red proof: test, w którym wysyłka się odrzuca, pokazuje neutralny błąd w formularzu
      (pada na obecnym `main`, gdzie zwraca sukces).
- [ ] Nieznany email nadal zwraca sukces i nic nie wysyła — test.
- [ ] Retry w `sendEmail`: fake fetch rzuca ECONNRESET raz, potem 200 → dokładnie jedna udana wysyłka, dwa wywołania
      fetch, ten sam `Idempotency-Key` w obu — test; 400 → bez retry — test; 503 ×3 → rzuca po 3 — test.
- [ ] `GET /auth/reset` z `token_hash` nie woła `verifyOtp` — test (red proof: pada na obecnym `main`).
- [ ] Dwa GET tego samego linku, potem przycisk → formularz hasła, nie błąd — test albo spacer Playwright na lokalnym
      stacku ze zrzutami w `.playwright-mcp/FA-M.15/`.
- [ ] Zużyty/wygasły token bez sesji → `/forgot-password` z komunikatem i drogą „send a new link” — test.
- [ ] Webhook Stripe: maile do wędkarza i przewodnika nie idą, mail do FA idzie i jest awaited — test z fake'iem maili.
- [ ] Żadnego innego `send…Email(...)` bez `await` w `src` poza `after()`:
      `grep -rnE "send[A-Za-z]*Email\(" src --include=*.ts | grep -v "await\|return\|after(\|__tests__\|export\|function"`
      — wynik wklejony; jedyne dozwolone trafienie to `sendDepositLink` w `src/actions/inquiries.ts` (patrz Poza zakresem).
- [ ] Pełny suite, tsc, eslint, knip zielone; CI zielone.

## Poza zakresem
- `sendDepositLink` w `src/actions/inquiries.ts` — bez wywołań (martwy kod); wpis w `docs/deferred-tasks.md`, nie ruszać.
- Retry dla odpowiedzi do klientów w `src/lib/channels/email.ts` i pozostałych bezpośrednich wywołań Resend
  (cron/offer-sla, webhooks/email-inbound) — wpis w `docs/deferred-tasks.md`.
- Śledzenie kliknięć w Resend (ustawienie konta/domeny — tj).
- Poprawki panelu przewodnika (FA-M.14), logowanie Google.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Decyzje tj (2026-11-27)
- Zakres: reset + retry we wspólnym `sendEmail` + strona lądowania z przyciskiem; maile po depozycie do wędkarza/przewodnika wyłączone.
- Nic więcej agent nie rozstrzyga sam. Każdy nowy wybór → stop i pytanie w formacie: co to / co zyskujemy teraz /
  co daje później / ryzyka / koszt / odwracalność / rekomendacja.

## Bramki STOP
- Każda zmiana ustawień Supabase Auth, listy dozwolonych redirect URL albo szablonów maili → stop, robi tj.
- Każda zmiana bazy → stop (żadna nie jest przewidziana; `touches_db: false`).
- Nigdy prawdziwy mail z lokalnych uruchomień: `RESEND_DEV_FAKE=1` na spacer. Nigdy nie czytać `.env*`.
- Stan bazy tylko z bieżącego odczytu, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- --run email auth reset stripe-deposit guide-accounts
pnpm exec tsc --noEmit && pnpm lint && pnpm knip
grep -rnE "send[A-Za-z]*Email\(" src --include=*.ts | grep -v "await\|return\|after(\|__tests__\|export\|function"
```

## Notatki z realizacji
