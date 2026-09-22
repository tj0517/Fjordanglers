---
id: FA-1.21
title: Agent wie, do kogo i na jakim etapie pisze — adresat, kanał i status w prompcie, strony wątku podpisane poprawnie
stage: 1
status: in_progress
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/agent-draft-context
depends_on: [FA-1.14]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.21 — Agent wie, do kogo i na jakim etapie pisze

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `src/lib/ai/draft-reply.ts` — `draftReply`: dziś pobiera `messages` bez `counterpart`, a do promptu przekazuje tylko wiedzę i wątek
- `src/lib/ai/draft-reply-prompt.ts` — `buildDraftPrompt(knowledge, conversation)`
- `src/lib/ai/extract-trip.ts` — `assembleConversation`: każda wiadomość przychodząca jest podpisana „Angler”, każda wychodząca „FA”
- `src/lib/ai/inquiry-agent.ts` — drugi użytkownik `assembleConversation` (klasyfikacja)
- `docs/01-architecture.md` §4 — statusy zapytania („na kogo czekamy”)
- `docs/02-data-model.md` — `messages.counterpart`, `messages.counterpart_id`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś model nie wie, czy draft ma iść do klienta, czy do przewodnika, jakim kanałem i na jakim
etapie jest zapytanie. Odpowiedź przewodnika widzi jako słowa klienta. Przez to draft do
przewodnika bywa pisany do klienta, a cena przewodnika brana jest za wypowiedź klienta. Po
zadaniu prompt zaczyna się od stałego nagłówka: adresat, kanał, status zapytania, przypisany
przewodnik. W wątku każda wiadomość jest podpisana stroną (klient / przewodnik / FA). To
warunek, żeby graf działania z FA-1.17 w ogóle mógł rozróżniać etapy.

## Zakres
- [ ] Odczyt stanu: `draftReply`, `buildDraftPrompt`, `assembleConversation` i oba ich wywołania.
- [ ] `draftReply` pobiera `messages.counterpart` oraz `inquiries.status`.
- [ ] `assembleConversation`: podpis strony z `counterpart` (Angler / Guide <imię> / FA → angler / FA → guide). Pole opcjonalne, żeby klasyfikacja w `inquiry-agent.ts` działała bez zmian w zachowaniu.
- [ ] `buildDraftPrompt` przyjmuje obiekt kontekstu `{ counterpart, channel, status, guideName }` i składa blok `=== DRAFT CONTEXT ===` przed wiedzą.
- [ ] Testy (niżej).

## Gotowe, gdy
- [ ] Test: wątek z wiadomością przychodzącą od przewodnika → w złożonym prompcie jest podpisana jako przewodnik, nie „Angler” — **pokazany na czerwono** na dzisiejszym `assembleConversation`.
- [ ] Test: `buildDraftPrompt` z `counterpart='guide'`, `channel='whatsapp'`, `status=<dowolny z §4>` → blok kontekstu zawiera te trzy wartości i imię przewodnika.
- [ ] Test: klasyfikacja w `inquiry-agent` dostaje wątek bez zmian w zachowaniu (istniejące testy round1/round2 zielone bez edycji asercji).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` zielone; `pnpm knip` bez nowych znalezisk.

## Poza zakresem
- Źródło wiedzy i instrukcji (baza) → FA-1.22 / FA-1.23. Tekst `STUB_PROMPT` zostaje.
- Los logiki rund → FA-1.25.
- Zmiana modelu (`claude-sonnet-4-6`) i `max_tokens`.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (bez bazy i produkcji).

## Weryfikacja
```
pnpm test -- draft-reply extract-trip inquiry-agent
pnpm typecheck && pnpm lint && pnpm knip
```

## Notatki z realizacji
