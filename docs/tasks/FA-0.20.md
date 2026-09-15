---
id: FA-0.20
title: Martwy status `pending_fa_review` — default kolumny łamie własny constraint tabeli
stage: 0
status: todo
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/inquiry-status-default
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 2
owner: tj
---

# FA-0.20 — `pending_fa_review` nie istnieje, a wciąż jest domyślną wartością

**Skąd to zadanie (odbiór FA-0.14, 15 IX 2026).** Odczyt produkcji:

```
select column_name, column_default, is_nullable from information_schema.columns
where table_name='inquiries' and column_name='status';
→ status | 'pending_fa_review'::text | NO
```

a `inquiries_status_check` dopuszcza wyłącznie `pending`, `in_negotiation`,
`waiting_for_guide_offer`, `offer_sent`, `waiting_for_deposit`, `deposit_sent`,
`deposit_paid`, `completed`, `lost`, `cancelled`. **Każdy `INSERT` bez jawnego `status`
pada na constraincie tej samej tabeli.** Kolumna jest `NOT NULL`, więc `NULL` nie ratuje.

**Przyczyna źródłowa.** `supabase/migrations_archive/20260708_inquiry_status_update.sql`
przemianowało `pending_fa_review` → `pending`: zmieniło wiersze (`UPDATE … WHERE status =
'pending_fa_review'`) i constraint, ale **nie ruszyło `DEFAULT`**. Baseline z 4 IX
(`20260904165037_baseline_prod.sql:1470`) utrwalił stary default. Trwa od lipca.

**Dwa żywe miejsca w kodzie używają martwej wartości:**
- `src/app/admin/inquiries/new/NewInquiryForm.tsx:22` — `{ value: 'pending_fa_review',
  label: 'Pending review' }` w `INITIAL_STATUSES`. Wybranie tej opcji przy ręcznym dodawaniu
  zapytania daje `INSERT` spoza constraintu, czyli **błąd zapisu w adminie**. Nie mina — niedziałający przycisk.
- `src/emails/inquiry-received-fa.tsx:70` — mail wewnętrzny wypisuje `Status: pending_fa_review`
  na sztywno, informując o statusie nieistniejącym od lipca.

**Decyzja tj (15 IX):** domyślną wartością ma być **`pending`** — spójnie z tym, co robi każda
ścieżka aplikacji i co zrobiła migracja lipcowa. Nie przywracamy `pending_fa_review` jako statusu;
etykieta „Pending review" w formularzu zostaje, zmienia się tylko wartość pod nią.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`; `docs/03-conventions.md`
- `docs/02-data-model.md` — model `inquiries` i statusy
- `docs/01-architecture.md` §3–4 — statusy i zdarzenia (FA-1.03 buduje na tej tabeli)
- `supabase/migrations_archive/20260708_inquiry_status_update.sql` — migracja, która zaczęła rozjazd
- `supabase/migrations/20260904165037_baseline_prod.sql:1470` — miejsce, gdzie default przetrwał
- `src/app/admin/inquiries/new/NewInquiryForm.tsx`, `src/emails/inquiry-received-fa.tsx`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Tabela `inquiries` przestaje sobie przeczyć: `INSERT` bez `status` przechodzi. Żadne miejsce
w kodzie nie odwołuje się do `pending_fa_review`.

## Zakres
- [ ] **Odczyt bieżącego stanu** (SELECT, produkcja): `column_default` dla `inquiries.status`,
      definicja `inquiries_status_check`, oraz `select status, count(*) from inquiries group by 1`
      — czy jakikolwiek wiersz ma dziś `pending_fa_review` (nie powinien; lipcowa migracja je przeniosła).
      Wynik wklej do raportu.
- [ ] **Migracja**: `alter table inquiries alter column status set default 'pending';`
      Nazwa wg wzorca `<timestamp>_inquiries_status_default.sql`. Nie dotykaj constraintu ani wierszy.
- [ ] **`NewInquiryForm.tsx`**: `pending_fa_review` → `pending` w `INITIAL_STATUSES`; etykieta
      „Pending review" bez zmian.
- [ ] **`inquiry-received-fa.tsx`**: status w mailu nie wpisany na sztywno — wstaw faktyczny status
      zapytania, jeśli komponent ma go w propsach; jeśli nie ma, użyj `pending` i **zgłoś to
      w raporcie** jako ograniczenie, nie dokładaj propsa na własną rękę.
- [ ] **Test regresyjny**: `INSERT` do `inquiries` bez `status` przechodzi i daje `pending`.
      Test ma być samowystarczalny — wstawia własny wiersz i sprząta po sobie w `afterAll`,
      bez polegania na danych w bazie testowej.
- [ ] **`grep -rn "pending_fa_review" src/`** → 0 trafień. W `supabase/migrations_archive/`
      zostaje (historia), w `baseline_prod.sql` też — **nie edytuj istniejących migracji**.

## Gotowe, gdy
- [ ] `select column_default from information_schema.columns where table_name='inquiries'
      and column_name='status'` → `'pending'::text`. Wynik w raporcie.
- [ ] Lokalnie: `insert into inquiries (…wymagane kolumny bez status…) returning status` → `pending`.
      Przed migracją ten sam `INSERT` musi paść na `inquiries_status_check` — **wklej oba wyniki,
      czerwony i zielony**. Bez czerwonego dowodu kryterium jest niespełnione.
- [ ] `grep -rn "pending_fa_review" src/` → 0 trafień.
- [ ] Formularz `/admin/inquiries/new` z opcją „Pending review" zapisuje zapytanie bez błędu —
      zrzut lub wynik `select id, status from inquiries order by created_at desc limit 1`.
- [ ] `supabase db diff` pusty po zaaplikowaniu migracji lokalnie.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych vs `main`.
      **Podaj liczbę testów** — na `main` jest ich 60; mniejsza liczba znaczy, że mierzysz podzbiór.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Zmiana `inquiries_status_check` — lista statusów zostaje, jaka jest.
- Przywracanie `pending_fa_review` jako statusu (decyzja tj: nie).
- Refaktor maili w `src/emails/` poza jedną linią statusu.
- Rejestrator zdarzeń i `transition()` — FA-1.03.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- **Zapis na produkcji** (`uwxrstbplaoxfghrchcy`): `db push`, `apply_migration`, jakikolwiek SQL
  inny niż SELECT — **STOP**, pokaż migrację i poczekaj na zgodę tj. Wykonuje tj.
- `migration repair`, edycja lub usunięcie istniejącego pliku migracji, zmiana historii — **STOP**.
- Jeśli odczyt pokaże wiersze ze statusem `pending_fa_review` w produkcji — **STOP**, nie migruj ich
  w locie; zgłoś liczbę i zaproponuj osobny `UPDATE` do decyzji tj.

**Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, z notatek ani z pliku typów.**

## Weryfikacja
```
# czerwony dowód PRZED migracją (lokalnie):
insert into inquiries (...) values (...);   # oczekiwane: naruszenie inquiries_status_check
# po migracji:
insert into inquiries (...) values (...) returning status;   # oczekiwane: pending
select column_default from information_schema.columns
  where table_name='inquiries' and column_name='status';
grep -rn "pending_fa_review" src/
supabase db diff
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji
