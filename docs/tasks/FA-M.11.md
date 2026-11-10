---
id: FA-M.11
title: Zgłoszenia zewnętrzne (robi tj) — szablon WhatsApp z linkiem w Meta, klient OAuth Google + ekran zgody i wniosek o weryfikację, klucze push
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
Trzy rzeczy zależą od zatwierdzeń poza kodem i mają czas oczekiwania, więc startują od razu, równolegle z kodem: szablon WhatsApp z linkiem (Meta), klient OAuth Google z ekranem zgody i wnioskiem o weryfikację zakresu kalendarza (do ~10 dni), klucze VAPID do push.

## Zakres
- [ ] Meta WhatsApp Manager: nowy szablon (kategoria Utility, angielski) z treścią zlecenia i przyciskiem/zmienną URL do `https://www.fjordanglers.com/r/{{1}}` (dokładną ścieżkę potwierdza FA-M.04); nazwa szablonu → do env (FA-M.05).
- [ ] Google Cloud Console: projekt, ekran zgody (nazwa, logo, domena `fjordanglers.com`, polityka prywatności), klient OAuth (redirect URI z FA-M.10), zakres kalendarza wybrany w FA-M.10; status publikacji „In production” (przed weryfikacją: ekran ostrzegawczy i limit kont), wniosek o weryfikację zakresu.
- [ ] Polityka prywatności na stronie: dopisek o odczycie zajętości kalendarza przewodnika (wymóg Google).
- [ ] Klucze VAPID do web push → env (FA-M.12).
- [ ] Wpisanie zmiennych w Vercelu (prod) po merge odpowiednich zadań.

## Gotowe, gdy
- [ ] Szablon WhatsApp zatwierdzony — **jak sprawdzić:** status „Approved” w WhatsApp Manager (zrzut w Notatkach).
- [ ] Klient OAuth istnieje, wniosek o weryfikację złożony — **jak sprawdzić:** data złożenia w Notatkach.
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
