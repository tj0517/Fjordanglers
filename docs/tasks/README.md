# Tasks

Jedno zadanie = jeden plik = jedna gałąź = jeden PR. Pliki są źródłem prawdy; Notion
(projekt „Fjordanglers – Platform / Tech") linkuje do `INDEX.md`, nie odwrotnie.

## Nazewnictwo

`FA-<etap>.<nn>.md`, np. `FA-0.03.md`, `FA-1.03.md`. Etapy wg `docs/REBUILD_PLAN.md` §8
(0–8). Numer w etapie nadaje się rosnąco i nigdy nie zmienia — jeśli zadanie wypada,
dostaje status `dropped`, plik zostaje.

## Frontmatter

```yaml
id: FA-1.03
title: Rejestrator zdarzeń inquiry_events (zapis bez UI)
stage: 1
status: todo            # todo | in_progress | review | done | dropped | blocked
difficulty: L           # S | M | L | XL  → docs/05-agent-operations.md §2
model: opus             # rekomendacja; XL z fable wymaga model_approved
model_approved:         # np. "fable by tj 2026-09-03" — tylko dla XL
effort: high            # low | medium | high | max
agent: fa-core          # główny subagent
branch: db/inquiry-events
depends_on: [FA-1.01]   # id zadań, które muszą być done
blocked_by_questions: [] # numery O-xx z docs/04-open-questions.md
touches_db: true        # włącza bramki STOP i wymóg odczytu stanu
touches_prod: false     # true = zapis na produkcji w zakresie → STOP obowiązkowy
estimate_h: 6
owner: tj
```

## Sekcje (w tej kolejności, wszystkie obowiązkowe)

1. **Kontekst — przeczytaj przed startem** — lista ścieżek z jednym zdaniem „po co".
   Zawsze `CLAUDE.md` i `docs/03-conventions.md`; przy schemacie `docs/02-data-model.md`
   i audyt bazy; przy architekturze `docs/01-architecture.md`; przy niepewnym zakresie
   `docs/04-open-questions.md`.
2. **Cel** — 3–5 zdań: co ma być inaczej, gdy zadanie jest skończone, i po co.
3. **Zakres** — checklista. Pierwszy punkt zawsze: bieżący odczyt stanu, którego zadanie
   dotyczy (kod: otwórz pliki; baza: zapytanie).
4. **Gotowe, gdy** — kryteria akceptacji, każde sprawdzalne komendą, zapytaniem albo
   testem. Bez „działa poprawnie". Każdy nowy mechanizm kontrolny ma kryterium
   „pokazany na czerwono".
5. **Poza zakresem** — konkretnie, co kusi i należy do innego zadania. Kończy się
   zdaniem: „jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj".
6. **Bramki STOP** — wypisane, jeśli `touches_db` albo `touches_prod`; inaczej „brak".
7. **Weryfikacja** — komendy i oczekiwane wyniki, do wklejenia w raport.
8. **Notatki z realizacji** — puste na starcie; agent i reviewer dopisują.

Szablon: `_template.md`. Tablica: `INDEX.md`.

## Cykl życia

`todo` → (`/fa-task` składa prompt) → `in_progress` → (PR + raport) → `review` →
(`/fa-review`: wszystkie kryteria *udowodnione*) → `done`. Status zmienia człowiek
w pliku, w tym samym PR co kod (agent może zaproponować zmianę, nie robi jej sam).
`blocked` zawsze z powodem w notatkach.
