---
id: FA-1.58
title: Flaga `RESEND_DEV_FAKE` obejmuje każdą wysyłkę maili (`sendEmail()`, cron `offer-sla`) + odmowa startu na produkcji z ustawioną flagą; `docs/05` §10 zgodny z kodem
stage: 1
status: review
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/resend-dev-fake-everywhere
pr: 139
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 3
owner: tj
---

# FA-1.58 — Flaga fake na każdej ścieżce wysyłki maili

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/05-agent-operations.md` §10 — reguła „dema nigdy przez prawdziwego dostawcę”; dziś opisuje tylko `channels/email.ts`
- `src/lib/channels/email.ts` (l. ~60) — jedyne miejsce, które dziś czyta `RESEND_DEV_FAKE`; wzorzec zachowania
- `src/lib/email.ts` — `sendEmail()` (l. ~50–90) woła Resend bezpośrednio; używają go: `src/actions/auth.ts` (reset hasła), `src/actions/inquiries.ts`, `src/app/api/inquiries/route.ts`, `src/app/api/webhooks/stripe-deposit/route.ts`
- `src/app/api/cron/offer-sla/route.ts` (l. ~118) — drugi bezpośredni `fetch('https://api.resend.com/emails')`
- `src/app/api/webhooks/email-inbound/route.ts` — wywołania Resend tylko do **odczytu** maili przychodzących; nie zmieniamy, ale potwierdź odczytem
- `src/lib/env.ts` — walidacja zmiennych przy starcie
- `docs/deferred-tasks.md` — wiersz FA-1.55 o luce `RESEND_DEV_FAKE`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś `RESEND_DEV_FAKE=1` wycisza tylko kanał auto-wysyłki, a potwierdzenia formularza, reset hasła, maile o depozycie i dzienny raport SLA idą przez prawdziwy Resend mimo flagi (incydent FA-1.55: 2 prawdziwe maile podczas spaceru). Po tym zadaniu każda ścieżka wysyłki pyta jedną funkcję, czy wolno wysłać naprawdę; z flagą zwraca udawany wynik bez kontaktu z Resend. Odwrotny błąd też jest zamknięty: flaga ustawiona na produkcji zatrzymuje start aplikacji, zamiast po cichu wyłączyć maile klientom (decyzja tj D1, 2026-10-08).

## Zakres
- [ ] Odczyt stanu: `git grep -n "api.resend.com" -- src ':!*test*'` — lista wszystkich miejsc; dla każdego: wysyła czy czyta
- [ ] Jedna funkcja (np. `isEmailSendFaked()` / `fakeEmailSend()` w `src/lib/email-fake.ts` albo w `src/lib/channels/email.ts`) używana przez **każdą** ścieżkę wysyłki: `sendEmail()` w `src/lib/email.ts`, cron `offer-sla`, istniejący adapter `channels/email.ts`
- [ ] Z flagą: brak wywołania `fetch` do Resend; log bez danych osobowych (typ maila + skrót odbiorcy albo id, nie pełny adres ani treść); wynik w kształcie, którego oczekują wołający
- [ ] Produkcja: gdy `VERCEL_ENV=production` (albo inny jednoznaczny znacznik prod — ustal odczytem, którego repo używa) i `RESEND_DEV_FAKE=1` → `src/lib/env.ts` odrzuca konfigurację z czytelnym błędem
- [ ] `docs/05-agent-operations.md` §10: tabela kanałów mówi, że flaga obejmuje wszystkie ścieżki wysyłki, i wymienia funkcję; zdanie o blokadzie na prod
- [ ] Wiersz FA-1.55 w `docs/deferred-tasks.md` oznaczony jako zamknięty przez FA-1.58

## Gotowe, gdy
- [ ] Test na **każdą** ścieżkę wysyłki (`sendEmail()` przez co najmniej `sendInquiryReceivedAnglerEmail` i `sendPasswordResetEmail`, cron `offer-sla`, `channels/email.ts`): z flagą `fetch` do Resend nie jest wołany — red proof: test czerwony, gdy sprawdzenie flagi zostanie usunięte z danej ścieżki
- [ ] Ten sam test bez flagi: `fetch` do `https://api.resend.com/emails` wołany raz z oczekiwanym ciałem (zachowanie produkcyjne nietknięte)
- [ ] Red proof blokady prod: `VERCEL_ENV=production` + `RESEND_DEV_FAKE=1` → walidacja env rzuca błąd z nazwą zmiennej; bez flagi przechodzi — oba wyniki wklejone
- [ ] `git grep -n "fetch('https://api.resend.com/emails'" -- src ':!*test*'` — każde trafienie wysyłające jest za sprawdzeniem flagi (lista z numerami linii w raporcie)
- [ ] `docs/05` §10 zmieniony w tym PR (diff w raporcie)
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone lokalnie **i** checki CI (`check`, `knip`, `db`, `secrets`) zielone na PR

## Poza zakresem
- Zmiana treści, szablonów albo odbiorców maili
- Przeniesienie wszystkich maili na adapter `channels/email.ts` (ujednolicenie wysyłki) → osobne zadanie, jeśli tj zechce; zgłoś do deferred
- Odczyty Resend w `email-inbound` (nie wysyłają)
- Fake dla WhatsApp / Claude API
- Zmiany w Vercel env (konfiguracja produkcji) — tylko kod
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (bez bazy, bez prod). Uwaga: `sendEmail()` to żywa ścieżka maili transakcyjnych — zmiana zachowania **bez** flagi to STOP i pytanie do tj.

## Weryfikacja
```
git grep -n "api.resend.com" -- src ':!*test*'
pnpm exec vitest run email offer-sla channels env
VERCEL_ENV=production RESEND_DEV_FAKE=1 pnpm exec vitest run env   # red proof blokady
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji
- 2026-10-08 tj (/wf-plan): D1 — flaga fake ustawiona na produkcji ma zatrzymać start aplikacji (opcja a). Zadanie wynika z incydentu FA-1.55 (2 prawdziwe maile przez `src/lib/email.ts` mimo flagi).
