---
id: FA-1.24
title: Panel wiedzy agenta — /admin/knowledge: lista, edycja z podglądem, wyłączanie wpisu, odnośnik z karty przewodnika
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/admin-knowledge
depends_on: [FA-1.22, FA-1.15]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-1.24 — Panel wiedzy agenta

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.22.md` — tabela, rodzaje wpisów, reguły
- `docs/tasks/FA-1.15.md` — design system panelu (shadcn/ui w barwach FA), wzorce list i kart
- `src/lib/auth/guards.ts` — `requireAdmin()`
- `src/app/admin/guides/[id]/page.tsx` — karta przewodnika (odnośnik do jego wpisu)
- `src/lib/countries.ts` — lista krajów do filtra i formularza

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Tj i wspólnik poprawiają wiedzę agenta bez gita: widzą, co agent wie o każdym kraju i
przewodniku, zmieniają treść i wyłączają nieaktualne wpisy. Zmiana działa od następnego
„zaproponuj”. Panel pokazuje też, czego brakuje: aktywny przewodnik bez wpisu, kraj bez
wpisu, brak aktywnych instrukcji.

## Zakres
- [ ] Odczyt stanu: komponenty z FA-1.15, nawigacja panelu, strona przewodnika.
- [ ] `/admin/knowledge`: lista pogrupowana według rodzaju i kraju; filtr kraju; kolumny tytuł, przewodnik, aktywny, kto i kiedy zmienił.
- [ ] Formularz tworzenia i edycji: rodzaj, kraj (lista z `COUNTRIES`), przewodnik (lista z `guides`), tytuł, treść markdown z podglądem, aktywny.
- [ ] Akcje serwerowe z `requireAdmin()`; `updated_by` z sesji; błędy reguł bazy pokazane po ludzku („ten kraj ma już …”, „drugie aktywne instrukcje”).
- [ ] Sekcja „braki”: przewodnicy bez wpisu, kraje z `COUNTRIES` bez wpisu `destination`, brak aktywnych instrukcji.
- [ ] Karta przewodnika: odnośnik „wiedza agenta” (do wpisu albo do utworzenia wpisu dla tego przewodnika).
- [ ] Pozycja w nawigacji panelu.

## Gotowe, gdy
- [ ] Test: każda akcja zapisu woła `requireAdmin()` — nie-admin → `UnauthorizedError` (wpis w `src/actions/__tests__/authorization.test.ts`), **pokazany na czerwono** (tymczasowo usunięty guard → test pada).
- [ ] Test: zapis ustawia `updated_by` na użytkownika z sesji.
- [ ] Lokalnie (Playwright, dowody w `.playwright-mcp`): utworzenie wpisu kraju, edycja, wyłączenie; próba drugich aktywnych instrukcji → komunikat po ludzku, nie surowy błąd SQL; sekcja „braki” pokazuje przewodnika z seedu bez wpisu.
- [ ] Po edycji wpisu tonu w panelu „zaproponuj” na zapytaniu z seedu daje draft z nową treścią (SQL draftu w raporcie).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone; `pnpm knip` czysty.

## Poza zakresem
- Historia zmian wpisów (decyzja O-22).
- Pola stawek (O-21, etap 4).
- Podgląd „co agent dostanie dla zapytania X” na karcie zapytania — jeśli potrzebny, osobne zadanie.
- Zmiany loadera → FA-1.23.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis na produkcji: STOP (Vercel Preview = baza prod).
- Nowa migracja lub edycja istniejącej: STOP.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- authorization knowledge
pnpm typecheck && pnpm lint && pnpm knip
# Playwright: ścieżka z „Gotowe, gdy” pkt 3, zrzuty w .playwright-mcp
```

## Notatki z realizacji
