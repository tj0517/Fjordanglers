---
id: FA-1.31
title: Panel admina reaguje — stan ładowania przy nawigacji, „trwa” i blokada podwójnego kliknięcia na wszystkich akcjach
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/admin-pending-states
pr: 107
depends_on: [FA-1.29]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.31 — Panel admina reaguje

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje kodu i komponentów
- `src/app/admin/**` — trasy panelu (dziś żadna nie ma `loading.tsx`)
- `src/app/admin/inquiries/[id]/ThreadActionsPanel.tsx`, `MessageComposer.tsx` i pozostałe komponenty z akcjami
- `docs/deferred-tasks.md` — wiersz FA-1.18 „Panel admina — round 2 UX” (punkty o nawigacji i podwójnych kliknięciach)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś po kliknięciu w menu panelu długo nic się nie dzieje — brak paska postępu, kursor się nie zmienia — więc panel wygląda na zepsuty, choć tylko wolno się ładuje. Część akcji nie pokazuje, że trwa, i pozwala kliknąć drugi raz, co może wykonać zmianę podwójnie. Po zadaniu każde przejście między stronami panelu i każda akcja zmieniająca dane pokazuje, że trwa, a przycisk jest zablokowany do końca.

## Zakres
- [ ] Odczyt bieżącego stanu: lista tras `src/app/admin` i czy mają stan ładowania; czy nawigacja idzie przez `Link` (bez pełnego przeładowania); lista akcji zmieniających dane w komponentach panelu z informacją, czy mają stan „trwa” i blokadę — tabela w raporcie.
- [ ] Stan ładowania dla tras panelu (np. `loading.tsx` na segmentach) i widoczny wskaźnik przejścia przy nawigacji.
- [ ] Każda akcja zmieniająca dane: stan „trwa” + przycisk zablokowany do końca; formularze bez podwójnego wysłania.
- [ ] Jeśli któraś strona ładuje się wolno przez zapytania do bazy — nazwij ją w raporcie (bez optymalizacji).

## Gotowe, gdy
- [ ] Każdy segment tras panelu ma stan ładowania — `find src/app/admin -name loading.tsx` + tabela w raporcie.
- [ ] Przejście w menu pokazuje wskaźnik ładowania — **zrzut Playwright** w trakcie przejścia (albo trace).
- [ ] Tabela wszystkich akcji zmieniających dane w panelu: każda ma „trwa” i blokadę (nazwa komponentu + linia).
- [ ] Red proof: test komponentu — dwa szybkie kliknięcia na reprezentatywnej akcji wywołują akcję serwerową raz.
- [ ] Brak nowych `as any` i `eslint-disable`; `pnpm typecheck && pnpm lint && pnpm test run` zielone.

## Poza zakresem
- Wygląd karty, nagłówek, zakładki → FA-1.32
- Przycisk depozytu (zrobiony w FA-1.29)
- Optymalizacja zapytań wolnych stron → wiersz w deferred z nazwą strony
- Idempotencja po stronie serwera dla akcji bez pieniędzy → wiersz w deferred, jeśli wyjdzie potrzeba
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
find src/app/admin -name loading.tsx
pnpm typecheck && pnpm lint && pnpm test run
```

## Notatki z realizacji
- 2026-09-24 tj (wf-plan): zadanie z wiersza FA-1.18 w `docs/deferred-tasks.md`; runda 2 panelu rozdzielona na FA-1.31 (reakcja) i FA-1.32 (wygląd).
- 2026-09-25 tj (wf-task): red proof via jsdom + @testing-library/react as devDependencies, DOM environment scoped to component tests only (option A; alternatives were Playwright e2e and a DOM-less helper test). Run on the Mac, minimal setup.
- 2026-09-25 tj (preflight): obcy stack Supabase `hydra-arms` działa na Macu — nie zatrzymywać go; implementacja i testy jsdom bez bazy; przed fazą zrzutów STOP — tj sam zatrzyma hydra-arms i da znać. Nie startować stacku tego repo, gdy hydra-arms działa.
- 2026-09-25 tj (preflight): `.env.local` na Macu wskazuje na produkcję (`uwxrstbplaoxfghrchcy`) — plik zostaje nietknięty. Na tej maszynie NIGDY `pnpm build` / `pnpm start` / tryb produkcyjny ani skrypty ładujące `.env.local` (build robi CI; zastępuje regułę „build tylko przy zatrzymanym stacku”). Przy `pnpm dev` do zrzutów najpierw dowód, że aplikacja łączy się z 127.0.0.1/localhost (host z logu dev / requestów Playwright); inny host → natychmiastowy STOP.
- 2026-09-25 tj (wf-review): accepted. PR #107. Proven: 25/25 admin page dirs have loading.tsx; nav pending indicator + route skeleton (screenshots a1, a2); finances Save pending/disabled/aria-busy (screenshot b); red proof on the real FinancesClient component (two clicks → one call); no .from/as any/eslint-disable in diff; only jsdom 29.1.1 + @testing-library/react added (Node 20 in CI). 49 actions already disabled keep no extra ref-lock — accepted, server-side idempotency tracked in deferred.
