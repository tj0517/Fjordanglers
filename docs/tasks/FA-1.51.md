---
id: FA-1.51
title: SYNC — stary `guide_id` i nowe `experience_guides` mówią to samo: triggery w obie strony, `price_from` ↔ centy; testy z red proofem
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: db/experience-guides-sync
depends_on: [FA-1.50]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 4
owner: tj
---

# FA-1.51 — SYNC: dwa zapisy, jeden stan

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/proposals/2026-10-05-experience-offer-centric.md` §7 krok 2 — dokładny szkic obu triggerów
- `docs/tasks/FA-1.50.md` — co już jest w schemacie
- `src/actions/experience-pages.ts` — stary admin zapisuje `guide_id` i `price_from`; to są ścieżki, które trigger ma obsłużyć
- `src/lib/supabase/database.types.ts` — po FA-1.50
- `src/actions/__tests__/` — wzór testów integracyjnych na lokalnym stacku

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Do końca pilotażu stary admin pisze `experience_pages.guide_id` i `price_from`, a nowy admin (FA-1.56) pisze `experience_guides` i `price_from_cents`. Oba zapisy mają prowadzić do tego samego stanu, żeby stara strona zawsze pokazywała przewodnika `primary`, a nowa — pełną listę. Triggery są tymczasowe: spadają w CONTRACT (etap 4).

## Zakres
- [ ] Odczyt bieżącego stanu: `ls supabase/migrations | tail -3`; `grep -n "guide_id\|price_from" src/actions/experience-pages.ts`; na prod (odczyt, wklej): `SELECT count(*) FROM experience_guides`
- [ ] Migracja z dwiema funkcjami i triggerami wg propozycji §7 krok 2: `BEFORE UPDATE ON experience_pages` (zmiana `guide_id` → `primary` w `experience_guides`, poprzedni `primary` → `paused`; zmiana `price_from` → `price_from_cents`) oraz `AFTER INSERT OR UPDATE OR DELETE ON experience_guides` (aktualny `primary active` → `experience_pages.guide_id`)
- [ ] Zabezpieczenie przed pętlą: trigger na `experience_guides` ustawia `guide_id` tylko gdy różny od bieżącego; trigger na `experience_pages` nie odpala się, gdy zmiana przyszła z drugiego triggera (`pg_trigger_depth()` albo flaga sesyjna)
- [ ] Testy integracyjne na lokalnym stacku: (a) UPDATE `guide_id` → nowy wiersz `primary`, stary `paused`; (b) INSERT `primary` w `experience_guides` → `guide_id` zmieniony; (c) DELETE `primary` → `guide_id` NULL; (d) UPDATE `price_from` → `price_from_cents` = ×100
- [ ] Komentarz `COMMENT ON TRIGGER … IS 'temporary until stage-4 CONTRACT (docs/proposals/2026-10-05…)'`

## Gotowe, gdy
- [ ] Cztery testy (a)–(d) zielone; każdy **czerwony przy wyłączonym triggerze** (`ALTER TABLE … DISABLE TRIGGER`) — oba przebiegi wklejone
- [ ] Red proof pętli: UPDATE `guide_id` na stronie z dwoma przewodnikami kończy się jednym wierszem `primary active` i bez błędu rekursji — `SELECT count(*) FROM experience_guides WHERE experience_id=… AND role='primary' AND status='active'` = 1
- [ ] `pg_get_triggerdef` obu triggerów wklejone w raporcie; `COMMENT` widoczny w `obj_description`
- [ ] Stary admin: zapis przewodnika przez `src/actions/experience-pages.ts` (bez zmiany kodu) kończy się spójnym `experience_guides` — test lub wklejony odczyt
- [ ] `pnpm typecheck && pnpm lint && pnpm test run && pnpm knip` zielone; CI `db` zielony

## Poza zakresem
- Nowy admin v2 → FA-1.56
- Synchronizacja `boat_*`/`rod_setup` do `guides` → etap 4
- Usunięcie triggerów → CONTRACT (etap 4)
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- przed `supabase db push` na prod — pokaż treść migracji i `supabase migration list`; czekaj na akceptację
- przed merge do `main` — migracja na prod zastosowana
- stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów

## Weryfikacja
```
pnpm test -- experience-guides-sync
psql "$LOCAL_DB" -c "ALTER TABLE experience_pages DISABLE TRIGGER trg_sync_guide_id" && pnpm test -- experience-guides-sync   # czerwony
psql "$LOCAL_DB" -c "SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname LIKE 'trg_sync%'"
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji
