---
id: FA-M.11
title: Zgłoszenia zewnętrzne (robi tj) — klucze VAPID do push + env (szablon Mety odpada, część Google zrobiona)
stage: M
status: todo
difficulty: S
model: —
model_approved:
effort:
agent: — (człowiek)
branch:
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: true
estimate_h: 2
owner: tj
---

# FA-M.11 — Zgłoszenia zewnętrzne (tj)

## Kontekst — przeczytaj przed startem
- `docs/tasks/FA-M.05.md` — szablon WhatsApp ze zmienną URL
- `docs/tasks/FA-M.10.md` — Google Calendar OAuth
- `docs/tasks/FA-M.12.md` — web push (klucze VAPID)
- [Google — weryfikacja wrażliwych zakresów](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)

## Cel
Od 2026-11-23 zostały tylko klucze VAPID do web push i ich wpisanie do env (FA-M.12). Szablon Mety odpada (FA nie ma WhatsApp Business API — FA-M.05 wariant A); część Google (klient OAuth, ekran zgody, wniosek o weryfikację) jest zrobiona.

## Zakres
- [x] ~~Meta WhatsApp Manager: nowy szablon (kategoria Utility, angielski) z treścią zlecenia i przyciskiem/zmienną URL do `https://www.fjordanglers.com/r/{{1}}` (dokładną ścieżkę potwierdza FA-M.04); nazwa szablonu → do env (FA-M.05).~~ — odpada 2026-11-23 (tj): brak WhatsApp Business API.
- [x] Google Cloud Console: projekt, ekran zgody (nazwa, logo, domena `fjordanglers.com`, polityka prywatności), klient OAuth (redirect URI z FA-M.10), zakres kalendarza wybrany w FA-M.10; status publikacji „In production” (przed weryfikacją: ekran ostrzegawczy i limit kont), wniosek o weryfikację zakresu.
- [x] Polityka prywatności na stronie: dopisek o odczycie zajętości kalendarza przewodnika (wymóg Google).
- [ ] Klucze VAPID do web push → env (FA-M.12).
- [ ] Wpisanie zmiennych w Vercelu (prod) po merge odpowiednich zadań.

## Gotowe, gdy
- [x] ~~Szablon WhatsApp zatwierdzony — **jak sprawdzić:** status „Approved” w WhatsApp Manager (zrzut w Notatkach).~~ — odpada 2026-11-23 (tj).
- [x] Klient OAuth istnieje, wniosek o weryfikację złożony — **jak sprawdzić:** data złożenia w Notatkach.
- [ ] Zmienne env wpisane w Vercelu — **jak sprawdzić:** lista nazw (bez wartości) w Notatkach.

## Poza zakresem
- Kod → FA-M.05, FA-M.10, FA-M.12.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zmiany sekretów i env na prod robi wyłącznie tj.

## Weryfikacja
Zrzuty / daty w Notatkach.

## Notatki z realizacji
- **2026-11-10, tj (wf-plan):** O-51 → (a) szablon Mety z linkiem; kalendarz Google przez logowanie (przycisk „Connect with Google”).
- **2026-11-23, tj:** zakres zawężony do kluczy VAPID + env (FA-M.12). Szablon Mety odpada — FA nie ma WhatsApp Business API, zlecenia idą z osobistego WhatsAppa przez `wa.me` (FA-M.05 wariant A, O-51 → c). Część Google zrobiona (wg tj; daty złożenia wniosku nie ma w tym pliku — do dopisania przez tj).
