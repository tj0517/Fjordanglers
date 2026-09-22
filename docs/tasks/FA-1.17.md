---
id: FA-1.17
title: Treść i logika agenta, część 1 — graf działania, instrukcje, ton i Nowa Zelandia, wpisane przez panel; ocena na 3 wątkach
stage: 1
status: todo
difficulty: M
model: — (człowiek)
model_approved:
effort:
agent:
branch:
depends_on: [FA-1.21, FA-1.22, FA-1.23, FA-1.24]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h:
owner: tj
---

# FA-1.17 — Treść i logika agenta, część 1

## Kontekst — przeczytaj przed startem
- `/admin/knowledge` (FA-1.24) — tu wpisujesz treść
- `docs/tasks/FA-1.21.md` — co agent dostaje w nagłówku (adresat, kanał, status, przewodnik)
- `docs/01-architecture.md` §4 — statusy, na których opiera się graf
- Skill Cowork `fa-klient-korespondencja`; dokumenty projektu `guides/`, `guides/INDEX.md`
- Szkice z 21 IX w `Claude outputs/`: `client-correspondence.md` (ton), `new-zealand.md`, `josh-hart.md` — poprawić przy przepisywaniu: kraj jako „New Zealand”, przewodnik wybierany z listy, nie po nazwisku

## Cel
Instalacja (FA-1.14) i baza wiedzy (FA-1.21–1.24) działają, ale agent mówi zaślepką. Tu
powstaje to, jak agent postępuje: graf działania (co robi na każdym etapie rozmowy, o co
pyta i kiedy, kiedy proponuje ofertę, jak prowadzi follow-upy, jak pisze do przewodnika),
zapisany jako aktywne instrukcje, plus ton i Nowa Zelandia jako pierwszy kraj. Robi tj,
przez panel, na produkcji po wdrożeniu paczki z FA-1.21–1.24.

## Decyzje tj (22 IX)
- Instrukcje i wiedza żyją w bazie, edycja w panelu (O-20, opcja C).
- Ocena na produkcji po wdrożeniu: „zaproponuj” tworzy tylko wersję roboczą, nic nie wychodzi bez „Wyślij”.
- IS, NO i pozostali przewodnicy → FA-1.26.
- Stara logika rund → FA-1.25 (usunięta).

## Zakres
- [ ] Graf działania (dokument/diagram): etapy wg statusów §4 × adresat (klient / przewodnik) → co agent proponuje.
- [ ] Wpis `instructions`: graf przełożony na instrukcje dla modelu.
- [ ] Wpis `tone`: z `client-correspondence.md`.
- [ ] Wpis `destination` New Zealand; wpisy `guide`: Josh Hart, Dustin Haberner, Kristina Placko.
- [ ] Ocena na 3 prawdziwych zapytaniach na prod.

## Gotowe, gdy
- [ ] Na 3 zapytaniach na prod (nowe zapytanie od klienta, prośba o cenę do przewodnika, follow-up po ofercie) draft nie wymaga przepisywania od zera — ocena tj; w notatkach: id zapytań, id draftów, ocena i co poprawiono we wpisach.
- [ ] Draft do przewodnika jest pisany do przewodnika, a draft do klienta do klienta — widać w tych 3 draftach.
- [ ] `/admin/knowledge` sekcja „braki” nie pokazuje braku instrukcji, tonu ani New Zealand.

## Poza zakresem
- IS, NO, SE, FI i ich przewodnicy → FA-1.26.
- Zmiany w kodzie — jeśli potrzebne, osobne zadanie.
- Auto-wysyłka bez admina.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Wysłanie draftu z oceny do prawdziwego klienta lub przewodnika — tylko świadomie, jako normalna odpowiedź, nie jako test.
- Włączenie `AI_AUTO_REPLY_ENABLED=true` — STOP.

## Weryfikacja
- `/admin/knowledge` → sekcja „braki” (zrzut).
- Id 3 zapytań i draftów w notatkach.

## Notatki z realizacji
