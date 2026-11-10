---
id: FA-M.08
title: Konta przewodników — logowanie, reset hasła, sesje, zaproszenie i powiązanie z rekordem przewodnika (zakres wg audytu FA-M.02)
stage: M
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/fa-m.08-guide-accounts
depends_on: [FA-M.02]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 10
owner: tj
---

# FA-M.08 — Konta przewodników

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/audit/guide-accounts-audit-2026-11.md` (FA-M.02) i decyzja tj zapisana w Notatkach tego zadania — **zakres zadania wynika z niej**
- `docs/deferred-tasks.md` — wiersze FA-1.93 (bezpieczeństwo kont: niezweryfikowany e-mail + autolink po `invite_email`, publiczny odczyt `profiles`, przekierowanie po logowaniu)
- `docs/tasks/FA-1.93.md` — rola nadawana tylko przez serwer
- `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/actions/admin.ts` (`linkGuideAccount`), `src/app/dashboard/layout.tsx`, `src/lib/auth/guards.ts`
- `src/lib/email.ts` — maile kont (nie czyta `RESEND_DEV_FAKE`)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Przewodnik ma normalne konto: zaproszenie od FA, ustawienie hasła, logowanie, reset hasła, sesje i wylogowanie, konto powiązane z jego rekordem przewodnika. Konto jest bazą dla push (FA-M.12) i panelu ze zleceniami i kalendarzem (FA-M.13). Linki ze zleceń działają dalej bez logowania. Zakres (naprawa obecnego modułu czy budowa od nowa) wybiera tj po audycie FA-M.02 — **zadanie nie startuje bez tej decyzji w Notatkach**.

## Zakres
- [ ] Odczyt stanu: raport FA-M.02 i decyzja tj; odczyt prod (SELECT) powiązań `guides.user_id` / `invite_email`.
- [ ] Zaproszenie przewodnika z admina: link zaproszenia (jednorazowy, z terminem), ustawienie hasła, powiązanie z rekordem `guides` po stronie serwera — **bez** autolinku po samym adresie e-mail (ryzyko z deferred FA-1.93).
- [ ] Logowanie, reset hasła, wylogowanie, po zalogowaniu przewodnik ląduje w swoim panelu.
- [ ] Rejestracja „z ulicy” jako przewodnik — wyłączona lub zostawiona wg decyzji tj po audycie.
- [ ] Ustawienia powiadomień w koncie (pole na zgodę na push — używa FA-M.12).
- [ ] Testy z red proofami (lokalny stack, konta seeda), maile tylko przez fake.

## Gotowe, gdy
- [ ] Zaproszenie da się użyć raz; drugi raz i po terminie → odmowa; pokazane na czerwono — **jak sprawdzić:** testy.
- [ ] Konto zarejestrowane na adres z `invite_email` **bez** linku zaproszenia nie zostaje powiązane z przewodnikiem; pokazane na czerwono na obecnym kodzie — **jak sprawdzić:** test (scenariusz z deferred FA-1.93).
- [ ] Przewodnik po zalogowaniu widzi tylko swoje dane; inny przewodnik → odmowa — **jak sprawdzić:** test dwoma kontami seeda.
- [ ] Reset hasła działa end-to-end z fake mailem — **jak sprawdzić:** test / przejście, mail w fake outbox.
- [ ] Linki zleceń (`/r/[token]`) działają bez logowania i przy zalogowanym koncie — **jak sprawdzić:** test.
- [ ] CI zielone; po `migrate-prod` (jeśli jest migracja) odczyt polityk wklejony.

## Poza zakresem
- Push → FA-M.12. Panel ze zleceniami i kalendarzem → FA-M.13. „Connect with your calendar” → FA-M.09/M.10.
- Konta wędkarzy (angler) → osobno (deferred FA-1.93).
- Edycja profilu przewodnika, zdjęcia, rozliczenia, Stripe → poza MVP (decyzja 4.11).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Start dopiero po decyzji tj o zakresie (naprawa / przebudowa) zapisanej w Notatkach.
- Jeśli audyt wskaże przebudowę, która przekracza L — STOP i powrót do planu (możliwy podział na dwa zadania, XL wymaga zgody na model).
- Zmiana ustawień Auth w Supabase (szablony maili, redirect URL, czas sesji) — tylko po akceptacji tj; prod ustawia tj.
- Migracja: `db push` wyłącznie przez `deploy-db.yml` (zatwierdza tj).
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- guide-accounts auth-callback signUp
grep -n "invite_email" -r src
```

## Notatki z realizacji
- **2026-11-10, tj (wf-plan):** konta przewodników wchodzą w MVP na 1.12 (D1 → wszystkie 6 funkcji); zakres po audycie FA-M.02.
