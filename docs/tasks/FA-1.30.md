---
id: FA-1.30
title: Wiadomość z linkiem depozytu — nazwa i opis wyprawy w Stripe; szkic od agenta AI, kwotę i link wstawia kod
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/deposit-message
depends_on: [FA-1.29]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.30 — Wiadomość z linkiem depozytu

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje kodu i testów
- `src/actions/messages.ts` — `createPaymentLink` (nazwa produktu `Booking & Curation Fee — FjordAnglers`, szkic `Payment link: <url>`), `proposeDraft`
- `src/lib/ai/draft-reply.ts` — agent szkiców (FA-1.14, FA-1.21, FA-1.23)
- `src/app/admin/inquiries/[id]/MessageComposer.tsx` — kompozytor i szkice
- `docs/tasks/FA-1.29.md` — skąd biorą się kwota, waluta i aktywny link
- `docs/04-open-questions.md` — O-23 (rozstrzygnięte)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś klient na stronie płatności widzi stały napis „Booking & Curation Fee — FjordAnglers” bez nazwy wyprawy, a admin dostaje szkic wiadomości z samym linkiem. Po zadaniu strona płatności w Stripe pokazuje, za co klient płaci (wyprawa, termin, liczba osób), a po utworzeniu linku kompozytor otwiera szkic wiadomości do klienta napisany przez agenta AI w tonie wątku. Kwotę i link wstawia kod dosłownie — AI nie może ich zmienić ani pominąć.

## Decyzje tj (24 IX 2026, wf-plan)
- Treść wiadomości pisze **agent AI** (nie stały szablon).
- Zabezpieczenie (propozycja z wf-plan, zaakceptowana wraz z planem): kwota i URL linku wstawiane przez kod; szkic bez dokładnej kwoty i URL nie trafia do kompozytora.
- **O-23 = komunikat o błędzie:** gdy szkic nie przejdzie sprawdzenia albo AI jest niedostępne, admin widzi czytelny komunikat (co się nie udało) i pisze wiadomość sam; link i tak jest widoczny na karcie (FA-1.29). Bez stałego szablonu.

## Zakres
- [ ] Odczyt bieżącego stanu: jak `createPaymentLink` nazywa produkt i wstawia szkic; czy kompozytor pokazuje szkice ze statusem `draft`; jak `draftReply` buduje kontekst wątku.
- [ ] Nazwa produktu w Stripe: tytuł wyprawy, termin, liczba osób; opis: za co jest opłata. Dokładny tekst proponujesz w raporcie w sekcji „Needs a decision”.
- [ ] Szkic wiadomości przez agenta AI z miejscami na kwotę i link; kod podstawia dokładną kwotę (z walutą) i URL aktywnego linku, potem sprawdza, że oba są w tekście.
- [ ] Gdy walidacja nie przejdzie albo AI jest niedostępne — czytelny komunikat w kompozytorze, bez szkicu (O-23).
- [ ] Po utworzeniu linku kompozytor w „Conversation” otwiera się ze szkicem; admin edytuje i wysyła zwykłą ścieżką.

## Gotowe, gdy
- [ ] Nazwa i opis produktu: test sprawdza argumenty `prices.create`/`paymentLinks.create` (wyprawa, termin, liczba osób); w trybie testowym Stripe strona płatności pokazuje nową nazwę — **zrzut**.
- [ ] Szkic zawiera dokładną kwotę z walutą i URL aktywnego linku — test na wyjściu z zamockowanym modelem.
- [ ] Red proof: model zwraca tekst bez linku albo ze zmienioną kwotą → szkic nie trafia do kompozytora, admin widzi komunikat o błędzie (test); to samo przy braku klucza AI.
- [ ] Kompozytor po utworzeniu linku pokazuje szkic — **zrzut Playwright**.
- [ ] `pnpm typecheck && pnpm lint && pnpm test run` zielone.

## Poza zakresem
- Logika linku (kwota, status, jeden aktywny link) → FA-1.29
- Automatyczne wysyłanie wiadomości z linkiem — szkic zawsze wysyła admin
- Zmiany w instrukcjach agenta w bazie (`agent_knowledge`) poza tym, co potrzebne do tej wiadomości
- Wygląd kompozytora → FA-1.32
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Stripe w trybie live — zakaz; wyłącznie tryb testowy.
- Zmiana wpisów wiedzy lub instrukcji agenta w bazie produkcyjnej — zakaz; propozycja w raporcie.

## Weryfikacja
```
pnpm test run src/actions src/lib/ai
pnpm typecheck && pnpm lint && pnpm test run
```

## Notatki z realizacji
- 2026-09-24 tj (wf-plan): zadanie z wiersza FA-1.18 w `docs/deferred-tasks.md`.
