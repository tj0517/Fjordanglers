---
id: FA-M.12
title: PWA + web push — instalacja na ekranie telefonu, zgoda na powiadomienia, push przy nowym zleceniu otwiera stronę zlecenia
stage: M
status: done
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-web
branch: feat/fa-m.12-pwa-push
pr: 216
depends_on: [FA-M.08]
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
- `docs/design/fa-m-guide-app/README.md` — makieta (tj 17.11): `Push.dc.html` (treść push), `Done.dc.html` (zachęta „dodaj do ekranu”), `Settings.dc.html` (przełącznik push, instrukcja iOS/Android)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Przewodnik, który doda aplikację FA do ekranu telefonu i włączy powiadomienia w koncie, dostaje push przy nowym zleceniu; kliknięcie otwiera stronę zlecenia. WhatsApp, wysyłany ręcznie przez FA, zostaje kanałem podstawowym — push jest dodatkiem (na iOS działa tylko po instalacji na ekranie).

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
- **2026-11-17, tj:** makieta zatwierdzona — `docs/design/fa-m-guide-app/` (kanwa claude.ai, prywatna tj). Układ i copy wg makiety, fonty i komponenty z aplikacji; przy sprzeczności z zakresem zadania wygrywa zadanie — zgłoś różnicę.
- **2026-11-23, tj — D3 (a):** FA-M.12 idzie równolegle z FA-M.05; zależy tylko od FA-M.08 i FA-M.11 (klucze VAPID). „WhatsApp jest kanałem gwarantowanym” → „WhatsApp, wysyłany ręcznie przez FA” (FA-M.05 wariant A: brak WhatsApp Business API, link `wa.me` z osobistego telefonu tj).
- **2026-11-25, tj:** FA-M.12 is built and proven locally on test VAPID keys; FA-M.11 (prod keys + Vercel env) is needed only to turn push on in production — dependency removed.
- **2026-11-25, tj — decisions (STOP 1 + STOP 2):**
  - D1a (A): a push subscription belongs to the login (`user_id` → auth.users ON DELETE CASCADE); a push for a guide goes to every subscription of `guides.user_id`. Unlinking / deleting the login silences its phones.
  - D1b (A): guides only READ their own rows (RLS); every write is server-side (action after `requireGuide()` + zod host allowlist, through a DB function). No direct INSERT/UPDATE/DELETE for anon / authenticated. `endpoint` UNIQUE; the same device subscribing under another login moves to that login.
  - D2 (A): turning push on / off writes one `audit_log` row in the same transaction (FA-M.09 precedent); no endpoint or keys in it.
  - D3 (A): `guide.request_push_sent` (actor system, source app, channel app; payload request_id, guide_id, sent, failed, removed) only when push was attempted (keys present and ≥ 1 subscription). Keys missing → one log line, no event.
  - D4 (A): `web-push@3.6.7` pinned + `@types/web-push@3.6.4` (dev). 4.0.0 (2026-11-06, ESM-only, no types) not taken.
  - Manifest only on `/dashboard` and `/r/[token]` (public pages byte-identical). Push sent after the response — the report shows how it survives on Vercel (function not cut off before the push goes out), covered by a test.
  - Env names `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` approved.
  - Mockup differences accepted: notification text without level/method (WhatsApp wording, FA-M.05); Settings without the "You" section (FA-M.13).
- **2026-11-25, tj — installability:** confirmed by tj 2026-11-25 by viewing — Chrome on tj's Mac (ssh tunnel to the local dev server, Google hosts blocked in DevTools) showed the "Install app" dialog for FjordAnglers (localhost:3000) with the manifest name and icon, and the install icon in the address bar. The screenshot stays with tj (no file in `.playwright-mcp`). The automated CDP check (`Page.getInstallabilityErrors`) was not used as proof: in headless Chromium it returned `[]` for the real manifest and for five broken ones alike.
- **2026-11-25, tj:** the Google Ads tag `AW-18171634204` loading on logged-in `/dashboard` pages (also from localhost) → `docs/deferred-tasks.md` under FA-M.12, not fixed here.
- **2026-11-25, tj:** Accepted by tj 2026-11-25 after review; prod policies read after migrate-prod; installability confirmed by tj by viewing; real-phone push and the remaining toggle states pending FA-M.11 (deferred).
