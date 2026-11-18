---
id: FA-M.10
title: Kalendarz przewodnika, część 2 — „Connect with Google”: logowanie Google, odczyt zajętości, przechowywanie i odświeżanie dostępu
stage: M
status: in_progress
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
- `docs/design/fa-m-guide-app/README.md` — makieta (tj 17.11): `Connect.dc.html` — przycisk Google

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
- [ ] Synchronizacja z atrapą listy wydarzeń (zakres `calendar.events.freebusy`) daje oczekiwane zajęte dni — godzinowe zajęte bloki i wydarzenia całodniowe — **jak sprawdzić:** test. *(Zmiana 2026-11-18, tj STOP 1: sam free/busy Google pomija całodniowe oznaczone jako „Available” — domyślne w Google — więc nie spełnia reguły FA-M.09 „całodniowe = zajęte”.)*
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
- **2026-11-17, tj:** makieta zatwierdzona — `docs/design/fa-m-guide-app/` (kanwa claude.ai, prywatna tj). Układ i copy wg makiety, fonty i komponenty z aplikacji; przy sprzeczności z zakresem zadania wygrywa zadanie — zgłoś różnicę.
- **2026-11-18, tj (wf-task):** klient OAuth Google skonfigurowany, jego zmienne są w lokalnym env i w Vercelu (część Google z FA-M.11) — FA-M.10 startuje, FA-M.11 zostaje `todo`. Podział z FA-M.13: FA-M.10 = start OAuth z obu wejść (podpisany link i sesja przewodnika) + akcja odłączenia (po stronie serwera, z testami), przycisk tylko na stronie „Connect”; przyciski w panelu konta → FA-M.13.
- **2026-11-18, tj (STOP 1):**
  - Zakres → **B** `calendar.events.freebusy`. Pobierane wyłącznie początek, koniec, flaga całodniowe i zajęty/wolny (transparency) — nigdy tytuły, opisy, uczestnicy, miejsca; parametr `fields`, w PR pokazać, że żadne inne pole nie jest czytane ani zapisywane. Reguła jak Apple (FA-M.09): całodniowe = zajęte, także „Available”; godzinowe „Available” pomijane. Kryterium „atrapa free/busy” → „atrapa listy wydarzeń w tym zakresie” (zmienione wyżej). Jeśli przejście na żywo pokaże, że zakres nie zwraca całodniowych lub ich flagi — STOP, wrócić z A vs C.
  - Szyfrowanie tokenu → **(a)** koperta i `CALENDAR_LINK_KEY` z FA-M.09 z osobną etykietą celu; red test: szyfrogram Apple nie odszyfruje się jako token Google i odwrotnie. Token na wierszu `guide_calendar_connections`.
  - Powrót po połączeniu z podpisanego linku → **(a)** `/connect-calendar/done?status=connected|denied|error`, bez danych przewodnika. Wejście z sesji wraca na `/dashboard/calendar?google=…`. Callback przekierowuje tylko na te dwie stałe ścieżki.
  - Odłączenie wywołuje też revoke w Google: **tak**; nieudany revoke nie blokuje lokalnego odłączenia, log bez tokenu.
  - Bez nowej zależności — zwykłe wywołania HTTPS.
  - Przywrócona notatka FA-M.09 z `f2d6444` zostaje (decyzja tj z 17.11).
  - Fakty: URI przekierowań zarejestrowane w Google: `http://localhost:3000/api/calendar/google/callback`, `https://www.fjordanglers.com/api/calendar/google/callback`. Wygaśnięcie tokenów po 7 dniach w trybie Testing — znane; przed podłączeniem przewodników tj przełącza na In production (FA-M.11); w PR jako znany limit, nie bloker.
- **2026-11-18, tj (STOP 3, migracja):** diff względem `20261120000000` zatwierdzony — nowa migracja `20261121000000_google_calendar_connect.sql`, tabela `guide_calendar_oauth_states` i cztery funkcje; zachowania: (1) token czyszczony przy `invalid_grant`, (3) cron pomija wiersze `disconnected`, (4) nazwy audytu `CONNECT` / `DISCONNECT` / `SYNC_DISCONNECTED` / `SYNC_FAILED` / `SYNC_RECOVERED` (tj sprawdził: kod na `main` tylko wstawia do `audit_log`, nic go nie czyta), (5) trzeci stan w adminie.
  - Zmiana zachowania (2) → (a): revoke w Google unieważnia cały grant konta i projektu, nie jeden token. Revoke przy **odłączeniu** i gdy **Apple zastępuje Google** (best effort); przy zamianie **Google → Google** token nadpisany, **bez** revoke. Testy: Google → Google bez wywołania revoke, Google → Apple z wywołaniem. Znany limit do PR: przewodnik, który przełączy się na inne konto Google, zostawia na starym koncie uśpiony grant, dopóki sam go nie usunie.
  - Dodatkowo: red test — zalogowany przewodnik B wywołuje odłączenie kalendarza przewodnika A → odmowa, nic się nie zmienia (funkcja tylko dla service_role, więc sprawdzenie własności jest w aplikacji). Wiersz w `docs/deferred-tasks.md`: wygasłe/zużyte wiersze `guide_calendar_oauth_states` nigdy nie są sprzątane.
  - Fakty (nazwy zmiennych klienta, status publikacji, kategoria zakresu) — w wiadomości tj nadal szablonowe `<NAME>` / `<…>`; dopytane.
