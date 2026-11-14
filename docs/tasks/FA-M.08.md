---
id: FA-M.08
title: Konta przewodników — logowanie, reset hasła, sesje, zaproszenie i powiązanie z rekordem przewodnika (zakres wg audytu FA-M.02)
stage: M
status: in_progress
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
- `src/lib/email.ts`, `src/lib/email-fake.ts` — maile kont; `sendEmail()` honoruje `RESEND_DEV_FAKE` od FA-1.58 (jedna zamaskowana linia logu, nic nie wysłane, link resetu nie trafia do logu)

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
(wersja z 2026-11-14 po decyzji tj o zakresie — Opcja C; zawężenia opisane w Notatkach)
- [ ] Link zaproszenia działa raz: drugie użycie i użycie po terminie → odmowa; pokazane na czerwono — **jak sprawdzić:** testy.
- [ ] Konto zarejestrowane na `invite_email` przewodnika **bez** linku zaproszenia nie zostaje powiązane z tym wierszem. Czerwone na obecnym kodzie przez ścieżkę, która dziś wiąże — autolink w `/auth/callback` (`auth-callback.test.ts`) — i zielone po zmianie. (Zmiana względem pierwotnej wersji: na obecnym kodzie rejestracja hasłem nigdy nie wiąże — audyt F5 — więc czerwony dowód musi celować w callback.)
- [ ] Samodzielna rejestracja nie tworzy przewodnika: rejestracja z rolą „guide” w danych kończy się kontem angler albo odmową, a użytkownik z rolą `guide` bez wiersza `guides` nie dostaje nowego wiersza przy wejściu na dashboard — oba czerwone na obecnym kodzie — **jak sprawdzić:** testy.
- [ ] Zalogowany przewodnik widzi tylko swoje dane; inny przewodnik → odmowa — **jak sprawdzić:** test dwoma kontami przewodników.
- [ ] Reset hasła: przejście albo test do udawanej wysyłki (`[email] RESEND_DEV_FAKE=1 — not sent`), plus test, że link odzyskiwania wygenerowany na lokalnym stacku ustawia nowe hasło i przewodnik się nim loguje. (Zawężone przez tj 2026-11-14: fake outbox nie istnieje i nie jest tu budowany.)
- [ ] Istniejące strony z tokenem działają zalogowanym i niezalogowanym: `/offers/[token]` i strona tokenu opinii. `/r/[token]` weryfikuje FA-M.04. (Zawężone przez tj 2026-11-14.)
- [ ] Usunięte strony zwracają 404, nawigacja przewodnika ma trzy pozycje — **jak sprawdzić:** test albo `curl` + zrzut ekranu.
- [ ] Nowa tabela ma RLS + polityki w tej samej migracji; zregenerowane typy w diffie.
- [ ] CI zielone na head commicie (`check`, `knip`, `db`, `secrets`); po `deploy-db.yml` polityki nowej tabeli z prod wklejone.

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
- **2026-11-14, tj (decyzja o zakresie po audycie FA-M.02):** Opcja C (hybryda). Zostaje: logowanie Supabase Auth, wylogowanie, reset hasła, `/dashboard/calendar`, lista zleceń + Accept/Decline na stronie zlecenia. Przebudowa: zaproszenie — jednorazowy link z terminem ważności, który wiąże wiersz `guides` po stronie serwera, bez wiązania po dopasowaniu adresu e-mail. Usunięte: rejestracja „z ulicy” jako przewodnik (wyłączona — każda samodzielna rejestracja tworzy anglera), auto-insert pustego wiersza `guides` w layoucie dashboardu, strony profilu / edycji profilu / zdjęć i formularz oferty na stronie zlecenia. Podpisane linki zleceń `/r/[token]` i rekord zlecenia → FA-M.03/M.04; brakujące zdarzenie `respondToAssignment` → FA-M.03/M.05.
- **2026-11-14, tj (kryteria):** zawężone — (1) czerwony dowód „konto na `invite_email` bez linku nie jest wiązane” celuje w autolink `/auth/callback`, bo rejestracja hasłem dziś nie wiąże (audyt F5); (2) reset hasła do udawanej wysyłki + test linku odzyskiwania na lokalnym stacku, bez budowy fake outboxa; (3) strony z tokenem: `/offers/[token]` i strona opinii, `/r/[token]` w FA-M.04. Dodane kryteria: 404 usuniętych stron + trzy pozycje nawigacji; RLS + polityki w tej samej migracji i typy w diffie. Kryteria w sekcji „Gotowe, gdy” zastąpione tą wersją.
