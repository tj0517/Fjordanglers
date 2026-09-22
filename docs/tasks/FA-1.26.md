---
id: FA-1.26
title: Treść i logika agenta, część 2 — Islandia, Norwegia i wszyscy aktywni przewodnicy (wpis albo świadome „pomijam”)
stage: 1
status: todo
difficulty: M
model: — (człowiek)
model_approved:
effort:
agent:
branch:
depends_on: [FA-1.17]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h:
owner: tj
---

# FA-1.26 — Treść i logika agenta, część 2

## Kontekst — przeczytaj przed startem
- `/admin/knowledge` (FA-1.24), sekcja „braki”
- `guides/INDEX.md` (dokument projektu) — 16 aktywnych/backupowych przewodników (stan 15 IX): IS 4, NO 3, SE 3, FI 3, NZ 3
- `docs/tasks/FA-1.17.md` — graf i ton, na których opierają się te wpisy

## Cel
Po FA-1.17 agent zna Nową Zelandię. Tu dochodzą Islandia i Norwegia oraz wpisy dla
wszystkich aktywnych przewodników, żeby „zaproponuj” przy każdym bieżącym zapytaniu miało
wiedzę o kraju i przewodniku.

## Zakres
- [ ] Wpisy `destination`: Iceland, Norway (reguły z `guides/INDEX.md` §„Reguły przy wycenie”).
- [ ] Wpisy `guide` dla aktywnych przewodników IS i NO.
- [ ] Decyzja per przewodnik SE i FI: wpis albo „pomijam” z powodem.

## Gotowe, gdy
- [ ] Każdy przewodnik z sekcji „Aktywni i backup” `guides/INDEX.md` ma wpis albo linię „pomijam — powód” w notatkach.
- [ ] Sekcja „braki” w panelu nie pokazuje Iceland ani Norway.
- [ ] Jeden draft na zapytaniu IS i jeden NO na prod bez przepisywania od zera — ocena tj, id w notatkach.

## Poza zakresem
- Destynacje SE, FI, AR, CL — jeśli potrzebne, osobne zadanie.
- Zmiany w kodzie.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Włączenie `AI_AUTO_REPLY_ENABLED=true` — STOP.

## Weryfikacja
- Lista przewodników z INDEX ↔ wpisy w panelu (zrzut sekcji „braki”).

## Notatki z realizacji
