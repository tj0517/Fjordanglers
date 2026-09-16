---
id: FA-1.03
title: Rejestrator zdarzeń inquiry_events — zapis bez interfejsu
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: db/inquiry-events
depends_on: [FA-1.01]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 8
owner: tj
---

# FA-1.03 — Rejestrator zdarzeń `inquiry_events`

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguła 5 (każda mutacja emituje zdarzenie)
- `docs/01-architecture.md` §3–4 — kształt tabeli, aktorzy, `transition()`
- `docs/adr/0003-events-before-screens.md` — dlaczego teraz, bez UI
- `docs/REBUILD_PLAN.md` załącznik C — katalog typów zdarzeń i miejsca emisji
- `docs/03-conventions.md` — migracje, RLS, testy, „red proof"
- `src/actions/inquiries.ts` — 28 akcji; to tu jest większość miejsc emisji
- `src/app/api/webhooks/stripe-deposit/route.ts`, `email-inbound/route.ts`, `whatsapp/route.ts` — emisje systemowe
- `src/lib/ai/inquiry-agent.ts` — emisje agenta
- `src/app/admin/inquiries/[id]/StatusChanger.tsx` → `updateInquiryStatus` — jedyne ręczne przejście statusu

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
System zapisuje stany, nie zdarzenia, więc żadnej metryki czasu (czas do oferty, ręczne dotknięcia, zapytania per founder) nie da się policzyć — ani dziś, ani wstecz. Po zadaniu każda zmiana domenowa na zapytaniu zostawia wiersz w append-only `inquiry_events` z aktorem i czasem, a `inquiries.status` zmienia wyłącznie jedna funkcja `transition()`. Nic tego jeszcze nie czyta — chodzi o to, żeby historia narastała od dziś.

## Zakres
- [ ] Odczyt bieżącego stanu: `grep -rn "update({ status\|update({status\|status:" src/actions src/app/api src/lib/ai | grep -v test` — lista wszystkich miejsc zmieniających status; `\d inquiries` — potwierdź istnienie `stage_reached` i triggera `inquiries_advance_stage_reached`.
- [ ] Migracja `add_inquiry_events`: tabela wg `01-architecture.md` §3, trzy indeksy, RLS włączone, polityka: brak UPDATE/DELETE dla wszystkich ról poza `service_role` INSERT/SELECT; `COMMENT ON TABLE`.
- [ ] `src/lib/events/types.ts` — enum typów z załącznika C (na razie te, które mają dziś miejsce emisji; resztę dodać z komentarzem `// stage 4`).
- [ ] `src/lib/events/emit.ts` — `emitEvent(client, { inquiryId, type, actorKind, actorId?, fromStatus?, toStatus?, payload?, occurredAt? })`; przyjmuje klienta, żeby dało się wywołać w tej samej transakcji/RPC co mutacja.
- [ ] `src/lib/inquiries/state.ts` — `ALLOWED_TRANSITIONS` + `transition(client, inquiryId, to, { actor, reason })`: waliduje krawędź, update statusu, przelicza `stage_reached`, emituje `status.changed`. Trigger `inquiries_advance_stage_reached` zostaje na razie (usunięcie — etap 4).
- [ ] Podmiana wszystkich miejsc z odczytu na `transition()`; w `updateInquiryStatus` aktor = zalogowany admin (`actor_id` = uid).
- [ ] Emisje wg załącznika C w: `api/inquiries` (`inquiry.created`), `assignGuideToInquiry`/`assignGuideSilently`/`unassignGuide`, `respondToAssignment`, `saveGuideOfferResponse`, `saveOfferDraft`/`saveRichOffer`, `sendOfferEmail`, `acceptOffer`/`declineOffer`, `sendDepositLink`, webhook depozytu (`deposit.paid`), `sendMessageToAngler` (`message.sent`), webhooki inbound (`message.received`), agent (`agent.round_completed`, `inquiry.qualified_set` jeśli FA-1.04 już jest).
- [ ] Testy Vitest: `transition()` odrzuca niedozwoloną krawędź; `emitEvent` odrzuca nieznany typ; każde `transition()` produkuje dokładnie jedno zdarzenie.

## Gotowe, gdy
- [ ] `grep -rn "update({ status\|update({status" src --include=*.ts --include=*.tsx | grep -v state.ts` → 0 wyników.
- [ ] Przejście `pending → deposit_paid` bezpośrednio jest odrzucone przez `transition()` — **na czerwono w teście**.
- [ ] `UPDATE inquiry_events SET type='x' WHERE …` jako `authenticated` zwraca błąd polityki — **na czerwono, wynik w raporcie**.
- [ ] Ścieżka dev: utworzenie zapytania → przypisanie → oferta → accept → deposit (Stripe test) zostawia ≥ 6 zdarzeń w kolejności (SELECT w raporcie).
- [ ] `supabase db diff` pusty; typy zawierają `inquiry_events`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Jakikolwiek ekran czytający zdarzenia (oś czasu na karcie zapytania — etap 6).
- Widoki materializowane, `mv_inquiry_facts` — etap 5.
- Usunięcie triggera `stage_reached` — etap 4.
- Backfill historycznych zdarzeń z `offer_sent_at` / `deposit_paid_at` — osobne zadanie FA-1.05 (można zrobić, ale nie tu).
- Refaktor `inquiries.ts` na moduły — etap 2.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- `db push` na produkcję: STOP, pokaż migrację i `db diff`.
- Jeśli odczyt stanu pokaże, że `stage_reached` albo trigger wyglądają inaczej niż w migracji `20260716_inquiries_stage_reached.sql` — STOP, pokaż różnicę zanim cokolwiek napiszesz.

## Weryfikacja
```
grep -rn "update({ status\|update({status" src --include=*.ts --include=*.tsx | grep -v state.ts || echo OK
pnpm test -- state emit
supabase db diff
pnpm typecheck && pnpm lint && pnpm build
# SELECT type, actor_kind, occurred_at FROM inquiry_events WHERE inquiry_id='<dev id>' ORDER BY occurred_at;
```

## Notatki z realizacji

