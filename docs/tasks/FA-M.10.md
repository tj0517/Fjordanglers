---
id: FA-M.10
title: Kalendarz przewodnika, część 2 — „Connect with Google”: logowanie Google, odczyt zajętości, przechowywanie i odświeżanie dostępu
stage: M
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/fa-m.10-google-calendar
depends_on: [FA-M.09, FA-M.11]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 8
owner: tj
---

# FA-M.10 — Connect with Google

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`, `docs/02-data-model.md`
- `docs/tasks/FA-M.09.md` — podłączenie kalendarza, synchronizacja, strona „Connect”
- Dokumentacja Google Calendar API (context7): free/busy, zakresy OAuth, tokeny odświeżania
- [Google — weryfikacja wrażliwych zakresów](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- `docs/tasks/FA-M.11.md` — klient OAuth i ekran zgody konfiguruje tj

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
6 z 7 przewodników w ankiecie ma kalendarz Google/Apple. Przycisk „Connect with Google” na stronie z FA-M.09 prowadzi przez logowanie Google i zgodę na **odczyt zajętości** (najwęższy zakres, który ją daje), a synchronizacja z FA-M.09 pobiera zajętość z API Google zamiast z linku. Przewodnik może odłączyć kalendarz; po odebraniu zgody w Google FA przestaje synchronizować i pokazuje status.

## Zakres
- [ ] Odczyt stanu: FA-M.09 (schemat podłączeń, synchronizacja), konfiguracja klienta OAuth z FA-M.11 (nazwy zmiennych env od tj).
- [ ] Wybór zakresu: agent porównuje zakres free/busy i odczytu wydarzeń w dokumentacji Google i proponuje najwęższy (decyzja tj w Notatkach przed implementacją).
- [ ] Przepływ OAuth (start z podpisanego linku lub z konta): `state` chroniony przed podmianą, powrót do strony „Connect” ze statusem.
- [ ] Przechowywanie tokenu odświeżania **wyłącznie po stronie serwera** (miejsce i ewentualne szyfrowanie proponuje agent → akceptacja tj), odświeżanie dostępu, obsługa odebrania zgody.
- [ ] Synchronizacja Google → te same zajęte dni ze źródłem `calendar`.
- [ ] Odłączenie kalendarza przez przewodnika (usuwa token i blokady ze źródła `calendar`).
- [ ] Testy z atrapą API Google (bez prawdziwych wywołań w CI).

## Gotowe, gdy
- [ ] Token odświeżania nie jest czytelny dla `anon`/`authenticated`; pokazane na czerwono — **jak sprawdzić:** test sesją seeda + odczyt polityk na prod.
- [ ] Podmieniony / brakujący `state` w powrocie OAuth → odmowa; pokazane na czerwono — **jak sprawdzić:** test.
- [ ] Synchronizacja z atrapą free/busy daje oczekiwane zajęte dni — **jak sprawdzić:** test.
- [ ] Odebrana zgoda (`invalid_grant`) → status „disconnected”, blokady zostają do odłączenia, admin widzi status — **jak sprawdzić:** test.
- [ ] Odłączenie usuwa token i blokady ze źródła `calendar`, ręczne zostają — **jak sprawdzić:** test.
- [ ] Przejście na koncie testowym Google tj (aplikacja w trybie przed weryfikacją) — **jak sprawdzić:** zrzuty / nagranie w PR, potwierdza tj.

## Poza zakresem
- Weryfikacja aplikacji w Google, ekran zgody, domena → FA-M.11 (tj).
- Zapis do kalendarza Google → poza MVP.
- Logowanie do konta FA przez Google → poza MVP (tylko dostęp do kalendarza).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed implementacją — wybór zakresu OAuth i miejsca przechowywania tokenu do akceptacji tj.
- Nowe sekrety env (client id/secret) — wpisuje tj w Vercelu; agent podaje nazwy.
- Migracja: `db push` wyłącznie przez `deploy-db.yml` (zatwierdza tj).
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- google-calendar calendar-sync
grep -rn "refresh_token" src | grep -v test
```

## Notatki z realizacji
- **2026-11-10, Claude (wf-plan):** Google traktuje odczyt kalendarza jako zakres wrażliwy — do weryfikacji (do ~10 dni) ekran ostrzegawczy i limit kont; dla ~15 przewodników wystarczy, wniosek składa tj w FA-M.11.
