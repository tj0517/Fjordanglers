---
id: FA-M.02
title: Audyt panelu i kont przewodnika — co z `/dashboard`, rejestracji, logowania, resetu hasła i zaproszeń dziś działa
stage: M
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: docs/fa-m.02-guide-accounts-audit
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-M.02 — Audyt panelu i kont przewodnika

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/deferred-tasks.md` — wiersze FA-1.93: moduł kont do przebudowy, niezweryfikowany e-mail przy rejestracji + autolink po `invite_email`, publiczny odczyt `profiles`, martwe przekierowanie w callbacku, `.from('profiles')` w layoutach
- `docs/tasks/FA-1.93.md` — co już zmieniono w rolach (rola tylko z serwera)
- `src/app/dashboard/**`, `src/app/login`, `src/app/register`, `src/app/forgot-password`, `src/app/reset-password`, `src/app/auth/callback/route.ts`, `src/actions/auth.ts`, `src/actions/admin.ts` (`linkGuideAccount`, zaproszenia), `src/actions/dashboard.ts`, `src/actions/availability.ts`
- `src/lib/email.ts` — maile resetu hasła i potwierdzeń (uwaga: **nie czyta** `RESEND_DEV_FAKE`, project.md → security)
- Dokument „Aplikacja dla przewodników — zakres MVP”, funkcja 5 (konta) i 6 decyzji tj

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Decyzja tj z 10.11: cały obecny `/dashboard` przewodnika i system kont idą najpierw do audytu — czy w ogóle działają. Wynik rozstrzyga, czy FA-M.08 (konta) to naprawa, czy budowa od nowa, i co zostaje w nawigacji przewodnika. Zadanie **nie zmienia kodu**: produktem jest raport w repo, z którego tj podejmuje decyzję o zakresie FA-M.08.

## Zakres
- [ ] Odczyt kodu: lista tras `/dashboard/*`, akcji i komponentów, z czego korzystają (tabele, akcje), co jest martwe (`knip`, grep wywołań).
- [ ] Przejście w przeglądarce na lokalnym stacku (konta seeda): rejestracja przewodnika, zaproszenie przez admina + powiązanie (`linkGuideAccount`, autolink po `invite_email`), logowanie hasłem, logowanie linkiem, reset hasła, wylogowanie, każda strona `/dashboard/*` — wynik per krok: działa / błąd (komunikat) / martwe.
- [ ] Odczyt prod (supabase-prod MCP, tylko SELECT): ile przewodników ma `guides.user_id`, ilu ma `invite_email`, ilu logowało się w ostatnich 90 dniach (`auth.users.last_sign_in_at`), ile wierszy `guide_unavailable_dates` per przewodnik — liczby, bez maili.
- [ ] Raport `docs/audit/guide-accounts-audit-2026-11.md`: tabela tras/przepływów ze statusem, lista zależności od rzeczy przeznaczonych do usunięcia (Stripe Connect, `experiences` legacy itp.), ryzyka z deferred FA-1.93 potwierdzone/niepotwierdzone, **dwie–trzy opcje dla FA-M.08** (naprawa / przebudowa / hybryda) ze skutkami i szacunkiem S/M/L/XL.

## Gotowe, gdy
- [ ] Raport istnieje i ma tabelę każdego przepływu z listy zakresu ze statusem i dowodem (zrzut lub log) — **jak sprawdzić:** `ls docs/audit/guide-accounts-audit-2026-11.md`, przejrzenie tabeli.
- [ ] Każda trasa `/dashboard/*` z `find src/app/dashboard -name page.tsx` ma wiersz w raporcie — **jak sprawdzić:** porównanie liczby tras z liczbą wierszy (wklejone obie).
- [ ] Liczby z prod wklejone w raporcie z zapytaniami — **jak sprawdzić:** sekcja „Prod” raportu.
- [ ] Opcje dla FA-M.08 opisane skutkami (co przewodnik zobaczy, ryzyka, koszt) — **jak sprawdzić:** sekcja „Opcje” raportu.
- [ ] Diff gałęzi nie dotyka `src/` ani `supabase/` — **jak sprawdzić:** `git diff main...HEAD --stat`.

## Poza zakresem
- Jakakolwiek poprawka kodu kont lub panelu → FA-M.08 / FA-M.13.
- Zmiany w panelu admina → poza tym planem.
- Wysłanie prawdziwego maila (reset hasła, potwierdzenie): `src/lib/email.ts` wysyła mimo `RESEND_DEV_FAKE` — **przepływ resetu hasła testuj tylko do momentu wysyłki** albo z wyłączonym kluczem Resend w env testowym; jeśli się nie da, opisz i pomiń.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed każdym krokiem przeglądarki: `scripts/dev-preflight.sh` i potwierdzenie URL bazy 127.0.0.1/localhost (project.md → dev_server).
- Odczyt prod tylko SELECT; stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
find src/app/dashboard -name page.tsx | sort
git diff main...HEAD --stat
pnpm knip
```

## Notatki z realizacji
- **2026-11-10, tj (wf-plan):** cały aktualny dashboard i system kont do audytu, czy działa w ogóle; wynik decyduje o zakresie FA-M.08.
