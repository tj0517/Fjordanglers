---
id: FA-M.12
title: PWA + web push — instalacja na ekranie telefonu, zgoda na powiadomienia, push przy nowym zleceniu otwiera stronę zlecenia
stage: M
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-web
branch: feat/fa-m.12-pwa-push
depends_on: [FA-M.08, FA-M.05, FA-M.11]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 8
owner: tj
---

# FA-M.12 — PWA i web push

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-M.08.md` — konta przewodników i ustawienia powiadomień
- `docs/tasks/FA-M.05.md` — wysyłka zlecenia (miejsce, w którym dochodzi push)
- `docs/tasks/FA-M.06.md` — ponaglenie (push może korzystać z tej samej reguły — poza zakresem tutaj)
- `src/app/layout.tsx`, `public/` — manifest i ikony
- Dokumentacja Next.js (context7): PWA / service worker w App Router; Web Push na iOS (16.4+, tylko po dodaniu do ekranu)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Przewodnik, który doda aplikację FA do ekranu telefonu i włączy powiadomienia w koncie, dostaje push przy nowym zleceniu; kliknięcie otwiera stronę zlecenia. WhatsApp zostaje kanałem gwarantowanym — push jest dodatkiem (na iOS działa tylko po instalacji na ekranie).

## Zakres
- [ ] Odczyt stanu: manifest/ikony, service worker (brak), konta z FA-M.08, miejsce wysyłki zlecenia z FA-M.05.
- [ ] Manifest (nazwa, ikony, `start_url` do panelu przewodnika), service worker obsługujący wyłącznie push i kliknięcie w powiadomienie (bez cache'owania stron — publiczne strony mają zostać jak są).
- [ ] Zachęta „dodaj do ekranu” + włączenie powiadomień w koncie przewodnika (instrukcja iOS / Android).
- [ ] Migracja: subskrypcje push per konto (wiele urządzeń), RLS w tej samej migracji (właściciel + serwer).
- [ ] Wysyłka push przy `guide.request_sent` (klucze VAPID z FA-M.11), usuwanie wygasłych subskrypcji (410), zdarzenie wysłania push.
- [ ] Testy (atrapa wysyłki push).

## Gotowe, gdy
- [ ] Przewodnik widzi i zapisuje tylko swoje subskrypcje; inny przewodnik → odmowa; pokazane na czerwono — **jak sprawdzić:** test dwoma kontami.
- [ ] Nowe zlecenie wysyła push na wszystkie subskrypcje przewodnika; wygasła subskrypcja (410) zostaje usunięta — **jak sprawdzić:** test z atrapą.
- [ ] Service worker nie przechwytuje żądań stron (brak handlera `fetch` albo pass-through) — **jak sprawdzić:** grep + test ładowania strony publicznej (200, bez zmian).
- [ ] Kliknięcie w powiadomienie otwiera `/r/[token]` — **jak sprawdzić:** test SW / przejście na Androidzie lub iPhonie (nagranie, potwierdza tj).
- [ ] Lighthouse / Chrome DevTools uznaje aplikację za instalowalną — **jak sprawdzić:** zrzut.
- [ ] CI zielone; po `migrate-prod` odczyt polityk wklejony.

## Poza zakresem
- Ponaglenie przez push → po MVP (FA-M.06 robi WhatsApp).
- Push do admina / klientów → poza MVP.
- Tryb offline, cache stron → poza MVP.
- Natywna aplikacja w sklepach → poza MVP (decyzja 10.11: PWA).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Klucze VAPID w env — wpisuje tj.
- Migracja: `db push` wyłącznie przez `deploy-db.yml` (zatwierdza tj).
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- push-subscriptions web-push
grep -n "addEventListener('fetch'" -r public src
```

## Notatki z realizacji
- **2026-11-10, tj:** forma aplikacji = PWA (bez sklepu).
