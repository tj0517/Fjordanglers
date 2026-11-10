---
id: FA-M.13
title: Panel przewodnika — jego zlecenia ze statusem, podgląd tego, co FA widzi w jego kalendarzu, „Connect with your calendar” w koncie
stage: M
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-web
branch: feat/fa-m.13-guide-panel
depends_on: [FA-M.08, FA-M.03, FA-M.09, FA-M.10]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-M.13 — Panel przewodnika

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/audit/guide-accounts-audit-2026-11.md` (FA-M.02) — co zostaje z obecnego `/dashboard`
- `docs/tasks/FA-M.03.md`, `FA-M.08.md`, `FA-M.09.md`, `FA-M.10.md`
- `src/app/dashboard/**` — obecny panel

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Po zalogowaniu przewodnik widzi to, czego potrzebuje w MVP, i nic więcej: swoje zlecenia (nowe na górze, status, link do odpowiedzi), podgląd zajętych dni, które FA widzi z jego kalendarza (i z ręcznych blokad), oraz „Connect with your calendar” (ta sama strona co z podpisanego linku). Reszta obecnego panelu jest schowana z nawigacji zgodnie z decyzją tj po audycie.

## Zakres
- [ ] Odczyt stanu: raport FA-M.02 i decyzja tj o tym, co zostaje w nawigacji.
- [ ] Lista zleceń przewodnika (z warstwy danych FA-M.03), odpowiedź przez tę samą stronę co `/r/[token]` albo równoważny widok w koncie.
- [ ] Podgląd kalendarza: zajęte dni ze źródłem (kalendarz / ręczne), status i data ostatniej synchronizacji; ręczne blokady jak dziś.
- [ ] „Connect with your calendar” w koncie (Google / Apple, odłączenie).
- [ ] Nawigacja panelu ograniczona do: Zlecenia, Kalendarz, Ustawienia (powiadomienia z FA-M.08/M.12).
- [ ] Widok telefonu (390 px) jako podstawowy.

## Gotowe, gdy
- [ ] Przewodnik widzi tylko swoje zlecenia; inny → brak; pokazane na czerwono — **jak sprawdzić:** test dwoma kontami.
- [ ] Odpowiedź z panelu zapisuje się tak samo jak z linku (to samo zdarzenie) — **jak sprawdzić:** test.
- [ ] Podgląd kalendarza rozróżnia źródła i pokazuje datę synchronizacji — **jak sprawdzić:** zrzut + test komponentu.
- [ ] Nawigacja zawiera tylko pozycje z zakresu — **jak sprawdzić:** zrzut + grep linków w layoucie.
- [ ] Zrzuty 390 px: lista zleceń, kalendarz, connect — **jak sprawdzić:** ścieżki w PR.

## Poza zakresem
- Usuwanie kodu starych stron panelu → wg decyzji po audycie, osobny wiersz w deferred, jeśli nie mieści się tutaj.
- Edycja profilu, zdjęcia, rozliczenia, TODO → poza MVP (decyzja 4.11).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed krokiem przeglądarki: `scripts/dev-preflight.sh`, URL bazy 127.0.0.1/localhost.

## Weryfikacja
```
pnpm test -- guide-panel
find src/app/dashboard -name page.tsx | sort
```

## Notatki z realizacji
