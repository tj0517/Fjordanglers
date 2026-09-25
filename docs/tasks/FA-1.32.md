---
id: FA-1.32
title: Wygląd karty zapytania — nagłówek, zakładki, „Offer & payment”; przycisk AI tylko gdy AI działa
stage: 1
status: review
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/inquiry-card-layout
depends_on: [FA-1.31]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-1.32 — Wygląd karty zapytania

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne; sekcja „Brand”
- `docs/03-conventions.md` — konwencje komponentów
- `docs/tasks/FA-1.15.md` — design system na shadcn/ui i karta wg etapów flow (runda 1)
- `src/app/admin/inquiries/[id]/` — `page.tsx`, `ThreadActionsPanel.tsx`, `MessageComposer.tsx`, zakładki
- `docs/deferred-tasks.md` — wiersz FA-1.18 „Panel admina — round 2 UX” (punkty o wyglądzie)
- **makieta karty zatwierdzona przez tj** (O-24 = tak) — link w „Notatkach z realizacji”; to ona wyznacza układ

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Karta zapytania po FA-1.15 nadal wygląda źle: górna część ma rozjechane elementy, menu zakładek wygląda słabo, w „Offer & payment” jest bałagan, a na etapie oczekiwania na płatność stoi pusta ramka „Thread actions”. Zakładki „Correspondence” i „Overview” są w porządku i zostają. Po zadaniu karta jest czytelna na każdym etapie flow, a przycisk AI („Zaproponuj”) pojawia się tylko wtedy, gdy AI jest dostępne.

## Zakres
- [ ] Odczyt bieżącego stanu: zrzuty karty na każdym etapie (new, qualifying, offer presented, awaiting payment, paid) przed zmianą.
- [ ] Nagłówek karty i menu zakładek — według zatwierdzonej makiety.
- [ ] „Offer & payment”: porządek; „Thread actions” nie renderuje się, gdy nie ma akcji.
- [ ] Przycisk „Zaproponuj” ukryty, gdy klucz AI nie jest ustawiony (flaga z serwera, nie z klienta).
- [ ] Neutralna podpowiedź w kompozytorze zamiast „Hi Jan, Thanks for your inquiry…”.
- [ ] „Correspondence” i „Overview” bez zmian wizualnych.

## Gotowe, gdy
- [ ] Zrzuty przed/po na każdym etapie flow — **Playwright**, ścieżki w raporcie.
- [ ] „Correspondence” i „Overview” — zrzuty przed/po bez różnic w układzie.
- [ ] „Thread actions” bez akcji nie renderuje się — test komponentu.
- [ ] Bez klucza AI przycisk „Zaproponuj” nie istnieje w DOM — test.
- [ ] Brak nowych `as any` i `eslint-disable`; `pnpm typecheck && pnpm lint && pnpm test run` zielone.
- [ ] Akceptacja wizualna tj w review.

## Poza zakresem
- Logika depozytu → FA-1.28, FA-1.29, FA-1.30
- Stany ładowania i blokady → FA-1.31
- Lista zapytań, `/admin/weekly` i inne ekrany panelu
- Uwagi „logiczne” tj po testach panelu — osobne zadania po zgłoszeniu
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Bez linku do zatwierdzonej makiety w „Notatkach z realizacji” — nie zaczynaj; zapytaj tj.
- Odstępstwo od makiety (np. komponent nie pasuje do danych) — pokaż zrzut i czekaj na akceptację.

## Weryfikacja
```
pnpm typecheck && pnpm lint && pnpm test run
```

## Notatki z realizacji
- 2026-09-24 tj (wf-plan): zadanie z wiersza FA-1.18 w `docs/deferred-tasks.md`; runda 2 panelu rozdzielona na FA-1.31 i FA-1.32. O-24 = tak: najpierw makieta karty, zatwierdzona przez tj.
- 2026-09-25 tj: makieta zatwierdzona — docs/design/fa-1.32/ (kanwa claude.ai, prywatna tj). Stały układ: README w tym folderze.
- 2026-09-25 tj (decyzje po implementacji): (1) Docker/OrbStack uruchomiony, hydra-arms zatrzymany — zrzuty „before" z czystego checkoutu origin/stage-1, „after" z gałęzi, per etap. (2) „View payment in Stripe" — opcja A: pominąć; opcja C (payment intent id zapisany w webhooku, link do płatności) → wiersz w deferred. (3) Paid bez wiadomości do przewodnika — opcja A: „Notify guide" wyłączony + podpowiedź. (4) Cztery etapy bez ekranu w makiecie (offer drafted, accepted bez kwoty, accepted bez linku, guide notified) — wersje z implementacji, akceptacja/korekta na zrzutach; wszystkie w zestawie before/after. (5) Restyling kompozytora — słusznie nie zrobiony; Conversation bez zmian wizualnych poza placeholderem i przyciskiem AI.
