---
id: FA-M.07
title: Brief dla przewodnika — nocleg i licencje/permity (IS) w briefie, edycja briefu na karcie zapytania
stage: M
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-admin
branch: feat/fa-m.07-guide-brief
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-M.07 — Brief dla przewodnika

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `src/lib/inquiries/brief.ts`, `src/lib/inquiries/brief.test.ts` — schemat briefu (FA-1.55): daty, dni, wędkarze/niewędkarze, poziom, priorytet, kondycja, brodzenie
- `docs/tasks/FA-1.55.md` — skąd się wziął brief
- `src/app/admin/inquiries/[id]/page.tsx` — karta zapytania
- `src/lib/ai/*` — gdzie agent czyta kontekst zapytania
- `claude/ankieta-przewodnicy-wyniki-2026-11-02.md` (Projekt) — brief to problem nr 1 przewodników (2× 4–5, 2× 3); u Islandczyków licencje/permity

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
„Za mało informacji o kliencie” to najwyżej oceniony problem w ankiecie. FA zbiera brief, a przewodnik dostaje go w zleceniu (FA-M.04). Dziś brief ma daty, osoby, poziom i kondycję, ale nie ma noclegu ani licencji/permitów (kluczowe na Islandii), a admin nie może go uzupełnić po rozmowie z klientem. Po zadaniu brief ma te pola, admin edytuje go na karcie, a agent i strona zlecenia czytają go z jednego miejsca.

## Zakres
- [ ] Odczyt stanu: schemat briefu, gdzie brief się zapisuje (formularz v2), gdzie jest czytany (agent, karta), czy karta pozwala go edytować.
- [ ] Rozszerzenie schematu (pola opcjonalne, wstecznie zgodne): nocleg (FA / klient / brak potrzeby + uwagi), licencje/permity (kto kupuje, uwagi), uwagi FA dla przewodnika.
- [ ] Edycja briefu na karcie zapytania (walidacja tym samym schematem), zdarzenie przy zmianie (np. `inquiry.brief_updated`).
- [ ] `briefSummaryLines` obejmuje nowe pola (strona zlecenia i agent).
- [ ] Testy.

## Gotowe, gdy
- [ ] Stare briefy (bez nowych pól) przechodzą walidację — **jak sprawdzić:** test na briefie z FA-1.55.
- [ ] Nieprawidłowa wartość nowego pola odrzucona; pokazane na czerwono — **jak sprawdzić:** test schematu.
- [ ] Edycja na karcie zapisuje brief i emituje zdarzenie — **jak sprawdzić:** test akcji + odczyt `inquiry_events`.
- [ ] `briefSummaryLines` zwraca linie z noclegiem i permitami — **jak sprawdzić:** test.
- [ ] Zrzut karty z edycją briefu — **jak sprawdzić:** ścieżka w opisie PR.

## Poza zakresem
- Zmiana formularza zapytania dla klienta (nowe pytania do klienta) → po MVP.
- Strona zlecenia → FA-M.04 (czyta `briefSummaryLines`).
- Zmiana kolumn bazy — brief jest w `inquiries.brief` (jsonb); jeśli agent uzna, że potrzebna migracja, STOP i pytanie.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (bez migracji; potrzeba migracji = STOP i pytanie do tj)

## Weryfikacja
```
pnpm test -- brief
grep -n "briefSummaryLines" -r src | head
```

## Notatki z realizacji
