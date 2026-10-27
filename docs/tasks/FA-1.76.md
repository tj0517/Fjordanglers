---
id: FA-1.76
title: Etapy oferty bez zbędnych blokad — pominięcie „presented”, cofanie kroków i zmiana zaakceptowanej pozycji, „Notify guide” / „Contacts exchanged” bez wiadomości, przywrócenie zapytania z lost
stage: 1
status: in_progress
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/fa-1.76-offer-stage-gates
depends_on: [FA-1.74]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 7
owner: tj
---

# FA-1.76 — Etapy oferty: mniej blokad, kroki da się cofnąć

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-1.74.md` — edycja oferty (ten task idzie po nim: ta sama karta)
- `src/lib/inquiries/state.ts` — `ALLOWED_TRANSITIONS`, `transition()` (czyści `lost_reason*` przy wyjściu z lost), komentarz o ścieżce pieniędzy
- `src/lib/inquiries/state.test.ts`
- `src/app/admin/inquiries/[id]/NextStepCard.tsx` — wybór etapu (`stage`) i warunki przycisków
- `src/app/admin/inquiries/[id]/StatusChanger.tsx` — ręczna zmiana statusu (czyta `canTransition`)
- `src/actions/messages.ts` — `markOfferPresented`, `markClientAccepted`, `markClientDeclined`, `markGuideNotifiedPaid`, `markContactsExchanged`, `createPaymentLink` (dezaktywacja linku)
- `src/actions/inquiries.ts` — `updateInquiryStatus`
- `docs/01-architecture.md` §3–4 + `docs/REBUILD_PLAN.md` załącznik C — statusy i zdarzenia

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Karta „Next step” prowadzi dziś sztywno: „Mark as presented” wymaga wysłanej wiadomości do klienta, „Client accepted” dopiero po „presented”, zaakceptowanej pozycji nie da się zmienić, „Notify guide” i „Contacts exchanged” wymagają wiadomości do guida w wątku, a lost jest końcem — nawet ręczna zmiana statusu go nie cofnie. W praktyce część kroków dzieje się poza aplikacją, a klienci wracają po czasie. Po zadaniu admin może pominąć „presented”, cofnąć krok, zmienić wybraną pozycję, zamknąć kroki z guidem bez wiadomości w wątku i przywrócić zapytanie z lost. Nienaruszone zostaje jedno: **„Paid” tylko po potwierdzeniu wpłaty ze Stripe** (`paid` wyłącznie z `awaiting_payment`).

## Decyzje tj (2026-10-27)
- D2.2 **Pominięcie „Mark as presented”**: w etapie `present` są od razu przyciski „Client accepted” przy każdej pozycji; „presented” zapisuje się po drodze (zdarzenie `offer.presented` bez wiadomości + przejście statusu zapytania do `offer_presented`). „Mark as presented” nie wymaga już wiadomości do klienta.
- D2.3 **Cofanie kroków**: `accepted → presented` (zmiana zaakceptowanej pozycji — „Change accepted option”), `presented → draft` („Back to draft”).
- D2.4 **„Notify guide” i „Contacts exchanged” bez wiadomości do guida w wątku** (wiadomość opcjonalna — gdy jest, nadal się podpina).
- D2+ / D5 (a) **Przywrócenie z lost**: admin wybiera status, do którego wraca zapytanie: `qualifying`, `waiting_guide` albo `offer_presented`. `cancelled` zostaje końcowy. Ścieżka do `awaiting_payment` / `paid` z lost — zamknięta.
- D2.5 (zaakceptowane przez tj 2026-10-27): **cofnięcie akceptacji przy aktywnym linku depozytu** — panel pyta o potwierdzenie i wyłącza link w Stripe (jak dziś przy zmianie kwoty), zapytanie wraca z `awaiting_payment` do `offer_presented`; dzięki temu klient nie zapłaci za wycofaną pozycję.

## Zakres
- [ ] Odczyt stanu: `ALLOWED_TRANSITIONS`, `transition()` (co dzieje się z `lost_reason*`, jakie zdarzenie emituje), wybór `stage` w karcie, warunki `disabled` przycisków, `StatusChanger`; sprawdzić w migracjach, czy baza ma własny strażnik przejść statusu (trigger) — wkleić wynik grepa.
- [ ] `state.ts`: `lost → qualifying | waiting_guide | offer_presented`; reszta tabeli bez zmian; komentarz nad tabelą zaktualizowany (lost przestaje być końcowy, money path bez zmian).
- [ ] Pominięcie „presented” i „Mark as presented” bez wiadomości (D2.2).
- [ ] Cofanie: „Back to draft” w etapie `decision`, „Change accepted option” w etapie `deposit` (zdejmuje `is_accepted`, oferta → `presented`); przy aktywnym linku — potwierdzenie, wyłączenie linku, przejście `awaiting_payment → offer_presented`. Nowe typy zdarzeń dla cofnięć (np. `offer.reverted` z `from`/`to`) w `src/lib/events/types.ts`.
- [ ] „Notify guide” / „Contacts exchanged” bez wiadomości (D2.4); etap `contacts` dostępny także bez wiadomości do guida.
- [ ] Przywrócenie z lost w karcie: przy zapytaniu `lost` karta pokazuje „Restore inquiry” z wyborem trzech statusów; ręczny `StatusChanger` pozwala na to samo (z tabeli przejść). Odrzucona oferta (`declined`) po przywróceniu: karta pokazuje ją z „Reopen offer” (→ `draft`) albo „New offer” (stara → `superseded`, nowa przez formularz z FA-1.74).
- [ ] Testy: `state.test.ts` (nowe przejścia z lost + zakazane), akcje (pominięcie presented, cofnięcia, cofnięcie przy aktywnym linku na mocku Stripe, notify/contacts bez wiadomości, przywrócenie), karta (etapy po zmianach).

## Gotowe, gdy
- [ ] Z oferty `draft` jednym kliknięciem „Client accepted” → oferta `accepted`, zapytanie `offer_presented`, zdarzenia `offer.presented` i `offer.accepted` — test akcji z odczytem bazy.
- [ ] Cofnięcia `accepted → presented` i `presented → draft` działają i każde emituje zdarzenie; cofnięcie akceptacji przy aktywnym linku wyłącza link (wywołanie Stripe na mocku) i przenosi zapytanie do `offer_presented` — testy.
- [ ] „Notify guide” i „Contacts exchanged” działają bez wiadomości do guida — testy akcji i karty.
- [ ] Zapytanie `lost` wraca do każdego z trzech statusów, a `lost_reason_code` / `lost_reason` są wyczyszczone — test; **red proof**: `lost → awaiting_payment`, `lost → paid`, `cancelled → qualifying`, `offer_presented → paid` odrzucone — wklejone wyniki testów na celowo złych przejściach.
- [ ] Zrzuty (desktop): etap `present` z „Client accepted”, „Change accepted option” z potwierdzeniem, karta lost z „Restore inquiry”.
- [ ] CI zielone na head PR (`check`, `knip`, `db`, `secrets`) — lista wklejona.

## Poza zakresem
- Edycja treści oferty — FA-1.74; nazwa i opis payment linku — FA-1.77.
- Wykresy i metryki lejka (FA-1.35–1.39) przy zapytaniach przywróconych z lost — jeśli liczą je źle, wpis do `docs/deferred-tasks.md`, nie poprawka.
- Przywracanie z `cancelled`, ręczne ustawianie `paid`, cofanie po `paid`.
- Zwrot pieniędzy / zmiany w webhooku Stripe.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zmiana reguły `paid` / `awaiting_payment` w `ALLOWED_TRANSITIONS` — STOP (poza decyzją tj).
- Jakakolwiek migracja (np. jeśli odczyt pokaże strażnika przejść w bazie) — STOP przed napisaniem, z diffem względem baseline.
- Wywołania Stripe w testach i dowodach tylko na mocku albo `sk_test`.

## Weryfikacja
```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Notatki z realizacji
- **2026-10-27, tj:** serwer MCP stripe nie działa (`CONNECTION_CLOSED` — brak `STRIPE_RESTRICTED_KEY` w środowisku Claude Code) — dla FA-1.76 opcjonalny; praca na mocku Stripe, odnotowane w „Not done” raportu.
- **2026-10-27, wykonanie:** dev server do zrzutów uruchomiony metodą zaakceptowaną w FA-1.74 (preflight = A): odłączony worktree bez `.env.local`, env tylko z `supabase status -o env` + atrapy Stripe + `RESEND_DEV_FAKE=1`; kontenery Seaclouds zatrzymane przed startem stosu.
