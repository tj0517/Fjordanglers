---
id: FA-M.06
title: Ponaglenie — flaga admina „przewodnik nie otworzył po 12 h (sezon) / 24 h” + przycisk WhatsApp do ręcznego ponaglenia
stage: M
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/fa-m.06-request-reminder
depends_on: [FA-M.05, FA-M.12]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 4
owner: tj
---

# FA-M.06 — Ponaglenie przewodnika

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-M.03.md`, `docs/tasks/FA-M.05.md`
- `vercel.json` (`crons`), `src/app/api/cron/offer-sla` — wzór crona
- `experience_pages.season_months`, `src/lib/season-months.ts` — miesiące sezonu
- `src/app/admin/inquiries/InquiriesClient.tsx` — filtry listy zapytań
- `docs/04-open-questions.md` O-53, O-55
- `docs/design/fa-m-guide-app/README.md` — makieta (tj 17.11): `Push.dc.html` — treść ponaglenia; WhatsApp tym samym tonem

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Przewodnicy w sezonie nie ignorują FA, tylko są zajęci — jedno przypomnienie skraca czas odpowiedzi. Jeśli przewodnik nie otworzy linku zlecenia w 12 h (w sezonie) albo 24 h (poza sezonem), admin widzi na liście zapytań i na karcie flagę „przewodnik nie otworzył” z przyciskiem WhatsApp (link `wa.me` z gotowym ponagleniem, wysyła tj ręcznie ze swojego telefonu); jeśli przewodnik ma włączony push (FA-M.12), dostaje też jedno automatyczne ponaglenie push. **2026-11-23 (tj, D2 a):** bez automatycznej wysyłki WhatsApp — FA nie ma WhatsApp Business API (FA-M.05, wariant A).

## Zakres
- [ ] Pierwszy commit, tylko docs: FA-M.12 → `done` (INDEX `done (PR #216)`, notatka akceptacji z `453194e`); ten plik przepisany wg decyzji tj 2026-11-25; wiersz w `docs/deferred-tasks.md` (automatyczne ponaglenie push).
- [ ] Odczyt stanu: kolumny i funkcje `guide_requests` (`sent_at`, `first_opened_at`, `answered_at`, `withdrawn_at`, `token_expires_at`, `reminded_at`), jak lista i karta ładują zlecenia, `season-months.ts`, budowanie wiadomości `wa.me` z FA-M.05. Stan bazy zapytaniem przez Supabase MCP.
- [ ] Reguła progu w jednej czystej funkcji z testami: daty zlecenia w miesiącu z `season_months` stron oferty przewodnika → 12 h; inaczej 24 h; brak danych → 24 h.
- [ ] Flaga liczona przy odczycie listy/karty (bez crona, bez zapisanej flagi): zlecenie niewycofane, bez odpowiedzi, nigdy nieotwarte, `sent_at + próg < teraz`, jeszcze bez ponaglenia. Zlecenie z ponagleniem pokazuje „ponaglono X h temu”.
- [ ] STOP — przed migracją: sygnatura funkcji, co sprawdza i czego odmawia, payload zdarzenia, granty; czekać na zgodę tj.
- [ ] Migracja: jedna funkcja admina ustawia `reminded_at` i emituje `guide.request_reminded` (actor admin, kanał whatsapp; payload request_id, guide_id — bez tokenu, linku i treści) w tej samej transakcji; odmawia dla zlecenia już ponaglonego, z odpowiedzią, otwartego albo wycofanego; EXECUTE tylko dla service_role.
- [ ] Server action (`requireAdmin()`), potem przycisk „Remind on WhatsApp” na karcie (i na liście, jeśli obecny układ listy pozwala bez przebudowy — inaczej tylko karta, i to zgłosić): zwraca link `wa.me` z treścią ponaglenia; treść odsyła przewodnika do linku z wcześniejszej wiadomości w tym samym czacie (linku nie da się odtworzyć) — bez nowego linku, bez rotacji tokenu.
- [ ] Filtr listy „guide hasn't opened” + flaga na wierszach.
- [ ] Testy ze sterowanym zegarem (bez żadnej prawdziwej wysyłki).
- [ ] STOP — przed merge: migracja trafia na prod tylko przez `deploy-db.yml` (migrate-prod), zatwierdza tj; potem odczyt grantów funkcji na prod przez Supabase MCP, wklejony.

## Gotowe, gdy
- [ ] Funkcja progu: w sezonie → 12 h, poza → 24 h, brak danych → 24 h — **jak sprawdzić:** test jednostkowy.
- [ ] Flaga pokazuje się dla zlecenia nigdy nieotwartego, bez odpowiedzi, niewycofanego, po progu; nie dla otwartego, z odpowiedzią, wycofanego ani jeszcze w progu — **jak sprawdzić:** test ze sterowanym zegarem.
- [ ] Jedno ponaglenie na zlecenie: pierwsze kliknięcie ustawia `reminded_at` i emituje dokładnie jedno `guide.request_reminded`; drugie jest odrzucone i niczego nie zmienia — pokazane na czerwono (bez zabezpieczenia zapisuje się drugie zdarzenie) — **jak sprawdzić:** test.
- [ ] Tylko admin może zapisać ponaglenie: sesja przewodnika/wędkarza wywołująca akcję dostaje odmowę; bezpośrednie EXECUTE przez `authenticated` się nie udaje — pokazane na czerwono — **jak sprawdzić:** test.
- [ ] Treść ponaglenia nie zawiera linku `/r/` ani tokenu — **jak sprawdzić:** test.
- [ ] Flaga na liście zapytań widoczna dla zlecenia po progu; filtr zwraca tylko takie — **jak sprawdzić:** zrzut + test filtra.
- [ ] `vercel.json` bez zmian — **jak sprawdzić:** `git diff main -- vercel.json` pusty.
- [ ] CI zielone na head commicie; po migrate-prod odczyt grantów wklejony.
- Jak pokazać wygasły link (po `token_expires_at`, nigdy nieotwarty) — decyzja tj, nie agenta.

## Poza zakresem
- Automatyczne ponaglenie push → `docs/deferred-tasks.md` (po FA-M.11 i pierwszych zgodach na push).
- Jakikolwiek cron, endpoint albo zmiana `vercel.json` → nie w tym zadaniu.
- Nowy link / rotacja tokenu w ponagleniu → nie w tym zadaniu.
- Drugie i kolejne ponaglenia, eskalacja do innego przewodnika → po MVP.
- Ponaglenie, gdy przewodnik otworzył, a nie odpowiedział → po MVP.
- Poprawki odłożone w FA-M.12 (tag Ads na /dashboard, `.from` w stronach dashboardu) → osobne zadania.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed napisaniem migracji → sygnatura, odmowy, payload, granty do akceptacji tj.
- Przed merge → migracja na prod tylko przez `deploy-db.yml`, odczyt grantów na prod.
- Żadnej prawdziwej wysyłki z dev/testów; żadnego otwierania `wa.me` na prawdziwy numer.

## Weryfikacja
```
pnpm test -- request-reminder season-threshold
git diff main -- vercel.json
git diff main -- src supabase | grep -n '^+.*\(eslint-disable\|as any\)'
```

## Notatki z realizacji
- **2026-11-10, tj (wf-plan):** 12 h w sezonie / 24 h poza; ponaglenie do przewodnika i flaga dla admina (O-53 → c).
- **2026-11-17, tj:** makieta zatwierdzona — `docs/design/fa-m-guide-app/` (kanwa claude.ai, prywatna tj). Układ i copy wg makiety, fonty i komponenty z aplikacji; przy sprzeczności z zakresem zadania wygrywa zadanie — zgłoś różnicę.
- **2026-11-17, tj:** O-55 → (a) crony Vercela (sub-daily wymaga planu Pro — tj potwierdza plan przed zmianą `vercel.json`); `blocked_by_questions` wyczyszczone.
- **2026-11-23, tj — D2 (a):** FA nie ma WhatsApp Business API (FA-M.05, wariant A). FA-M.06 = flaga admina „przewodnik nie otworzył po 12/24 h” + przycisk WhatsApp (`wa.me`) do ręcznego ponaglenia; ponaglenie push, jeśli przewodnik ma push (FA-M.12). `depends_on: [FA-M.05, FA-M.12]`. Punkty zakresu i kryteria o automatycznym WhatsAppie przez `sendMessage` / „fake WhatsApp” są nieaktualne — do przepisania przy starcie zadania (`/fa-task`).
- **2026-11-25, tj:** D1 (a) flag + manual wa.me button only, no cron, no push reminder — push reminder to deferred; D2 (a) clicking the button records reminded_at + guide.request_reminded in one transaction (migration).
- **2026-11-26, tj — STOP 1 (before the migration):** §1 approved with changes: `record_guide_request_reminder(p_request_id, p_admin_id)` reuses `guide_request_refusal(p_req, false)` (not_found > guide_removed > withdrawn), then already_answered → already_opened → already_reminded → wrong_channel → expired (expired last, so an answered request with an expired token still says already_answered). Reminders only for `channel = 'whatsapp'` (`wrong_channel`, no write; button hidden for email requests; email reminder → deferred). Red proofs: one test per refusal (reminded_at unchanged, 0 events added), `p_admin_id` NULL → 22004, two calls → `reminded` then `already_reminded` with exactly 1 event, ACL read after the migration. Types regenerated, `guide.request_reminded` in `src/lib/events/types.ts`. Rule reading confirmed: active `experience_guides` links (primary or backup), `season_months` merged, 12 h if any requested date is in a season month, only the inquiry's latest non-withdrawn request counts. Reminder text approved as proposed.
- **2026-11-26, tj — §2 option B (expired link):** after `token_expires_at <= now()`, unanswered and not withdrawn → flag "link expired — send a new request", no remind button, the label links to the existing send-request flow; the function refuses `expired`; a request reminded earlier shows "reminded X h ago" until expiry, then the expired label. One test for the state, one for the refusal.
