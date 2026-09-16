---
id: FA-1.03
title: Maszyna stanów §4 + inquiry_events + transition() — statusy „na kogo czekamy"
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-core
branch: stage-1/state-machine-events
depends_on: [FA-1.01]
blocked_by_questions: [O-14]
touches_db: true
touches_prod: false
estimate_h: 10
owner: tj
---

# FA-1.03 — Maszyna stanów + rejestrator zdarzeń

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguła 5 (każda mutacja emituje zdarzenie)
- `docs/01-architecture.md` §3, §3a, §4 (po przepisaniu 16 IX) — kształt tabel, statusy, mapowanie legacy
- `docs/REBUILD_PLAN.md` załącznik C (po przepisaniu) — katalog typów, kanał, źródło
- `docs/REBUILD_PLAN.md` §8 Etap 1 — gałąź `stage-1`, jeden push
- `docs/03-conventions.md` — migracje, RLS, testy, „red proof"
- `docs/02-data-model.md` — docelowy schemat
- `src/actions/inquiries.ts` — dzisiejsze miejsca zmiany statusu: `sendDepositLink` (~311), `submitOfferAnswers` (~594), `acceptOffer` (~1511), `declineOffer` (~1556)
- `src/app/api/inquiries/route.ts` (~142), `src/app/api/webhooks/stripe-deposit/route.ts` (~99) — insert `pending`, update `deposit_paid`
- `src/app/admin/inquiries/[id]/StatusChanger.tsx`, `src/app/admin/inquiries/new/NewInquiryForm.tsx`, `src/app/admin/inquiries/unmatched/UnmatchedLinker.tsx` — UI ze statusami na sztywno
- `supabase/migrations/20260904165037_baseline_prod.sql` — `inquiries_advance_stage_reached`, constraint statusów

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Statusy mają mówić, na kogo czekamy, a nie w którym kroku liniowego procesu jesteśmy,
bo rozmowy z klientem i przewodnikiem toczą się równolegle i zapętlają. Po zadaniu
`inquiries.status` zmienia wyłącznie `transition()`, każda zmiana zostawia wiersz
w append-only `inquiry_events` z aktorem, kanałem i źródłem, a stare statusy są
zmapowane na nowe. Nic tego jeszcze nie czyta poza `StatusChanger`.

## Zakres
- [ ] Odczyt bieżącego stanu (wklej do raportu): `grep -rnE "status:\s*'" src/actions/inquiries.ts src/app/api src/app/admin/inquiries`; rozkład statusów na gałęzi podglądowej `SELECT status, count(*) FROM inquiries GROUP BY 1`; definicja constraintu statusów i triggera `inquiries_stage_must_advance` z `\d inquiries`.
- [ ] Migracja `inquiries_status_v2`: nowe wartości dopuszczone w constraint/enum obok legacy; `UPDATE` mapujący legacy → nowe wg §4.1 (w tej samej migracji, idempotentny); `DEFAULT 'new'`. Legacy wartości zostają dopuszczone (drop — etap 4).
- [ ] Migracja `add_inquiry_events`: tabela wg §3 (z `channel`, `source`, `message_id` nullable FK dodany w FA-1.12 — tu zwykła kolumna UUID NULL), trzy indeksy, RLS, polityki: `service_role` INSERT/SELECT, `authenticated` SELECT, brak UPDATE/DELETE dla wszystkich; `COMMENT ON TABLE`.
- [ ] `src/lib/events/types.ts` — enum z załącznika C; typy zarezerwowane z komentarzem `// stage N`.
- [ ] `src/lib/events/emit.ts` — `emitEvent(client, {...})`; przyjmuje klienta, żeby działać w tej samej transakcji/RPC co mutacja; odrzuca nieznany typ i brak `source`.
- [ ] `src/lib/inquiries/state.ts` — `STATUSES`, `ALLOWED_TRANSITIONS` (pętle qualifying↔waiting_guide↔offer_presented; ścisła ścieżka pieniędzy), `transition(client, id, to, { actor, reason, channel? })`: waliduje, update, przelicza `stage_reached`, emituje `status.changed` (+ `inquiry.lost` przy `lost`).
- [ ] Podmiana wszystkich miejsc z odczytu na `transition()`. Mapowanie akcji: `acceptOffer` → `awaiting_payment` (nie `in_negotiation`), `declineOffer` → `lost`, `sendDepositLink`/`submitOfferAnswers` → `awaiting_payment`, webhook Stripe i `UnmatchedLinker` → `paid`, `api/inquiries` → insert `new` + `inquiry.created`, `NewInquiryForm` → `new` lub `qualifying` (wybór w formularzu, nie na sztywno).
- [ ] `StatusChanger`: lista z `STATUSES`, przejścia niedozwolone wyszarzone; `lost` wymaga `lost_reason_code` (FA-0.16).
- [ ] Testy Vitest: odrzucenie `qualifying → paid`; dozwolone `offer_presented → waiting_guide`; każde `transition()` = dokładnie jedno `status.changed`; `emitEvent` odrzuca nieznany typ.

## Gotowe, gdy
- [ ] `grep -rnE "status:\s*'(new|qualifying|waiting_guide|offer_presented|awaiting_payment|paid|handed_over|completed|lost|cancelled|pending|in_negotiation|offer_sent|deposit_sent|deposit_paid)'" src/actions src/app/api src/lib --include=*.ts | grep -v state.ts | grep -v "\.test\."` → tylko insert w `src/lib/inquiries/create.ts` (status `new`). Wynik w raporcie.
- [ ] `qualifying → paid` odrzucone przez `transition()` — **na czerwono w teście**.
- [ ] `UPDATE inquiry_events SET type='x'` jako `authenticated` i jako `service_role` → błąd polityki — **na czerwono, wynik w raporcie**.
- [ ] Po migracji na gałęzi podglądowej: `SELECT status, count(*) FROM inquiries GROUP BY 1` nie zawiera żadnej wartości legacy. Wynik w raporcie.
- [ ] Na gałęzi podglądowej: `new → qualifying → waiting_guide → offer_presented → awaiting_payment → paid` przez akcje aplikacji zostawia 5 `status.changed` w kolejności (SELECT w raporcie).
- [ ] `supabase db diff` pusty wobec gałęzi podglądowej; typy z `gen types --local` zawierają `inquiry_events` i nowe statusy.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Tabela `messages`, wątek, wysyłka czegokolwiek — FA-1.12/1.13.
- Emisje `message.*`, `offer.*`, `payment.*`, `guide.*` — FA-1.12/1.13 (tu tylko typy).
- Backfill historycznych zdarzeń — FA-1.05.
- Usunięcie legacy wartości statusów i triggera `stage_reached` — etap 4.
- `db push` na produkcję — dopiero paczka `stage-1`.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Jakikolwiek zapis do `uwxrstbplaoxfghrchcy` (`db push`, `apply_migration`, SQL inne niż SELECT): STOP. Praca wyłącznie na gałęzi podglądowej Supabase.
- Zmiana constraintu/enuma `status` — pokaż diff wobec baseline'u PRZED napisaniem migracji; sprawdź, czy żadna polityka RLS ani funkcja go nie woła.
- Jeśli rozkład statusów z odczytu zawiera wartość spoza tabeli §4.1 — STOP, pokaż.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
grep -rnE "status:\s*'" src/actions src/app/api src/lib --include=*.ts | grep -v state.ts | grep -v "\.test\."
pnpm test -- state emit
supabase db diff
pnpm typecheck && pnpm lint && pnpm build
# SELECT status, count(*) FROM inquiries GROUP BY 1;
# SELECT type, from_status, to_status, actor_kind, source, occurred_at FROM inquiry_events WHERE inquiry_id='<id>' ORDER BY occurred_at;
```

## Notatki z realizacji
- 16 IX: przepisane po rozmowie z tj — poprzedni model zakładał proces, którego zespół nie wykonuje (zob. `docs/proposals/2026-09-16-stage-1-rewrite/README.md`).
