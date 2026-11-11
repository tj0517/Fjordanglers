---
id: FA-1.85
title: Treść hubów w bazie + edytor w panelu — O-42 przechodzi na (b); konfiguracja w kodzie zostaje tylko dla slug/grupa/kraje
stage: 1
status: in_progress
difficulty: L
model: opus
model_approved: tj 2026-11-11
effort: high
agent: fa-core
branch: feat/fa-1.85-hub-content-table
pr:
depends_on: [FA-1.82, FA-1.84]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 7
owner: tj
---

# FA-1.85 — Treść hubów w bazie + edytor

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/02-data-model.md` + `docs/audit/rebuild-audit-db-aug-2026.md`
- `docs/05-agent-operations.md` §3
- `docs/04-open-questions.md` — O-42, O-43, O-44
- `docs/audit/seo-audit-2026-11.md` — F15, D2
- `docs/tasks/FA-1.82.md` — huby w kodzie (stan wyjściowy)
- `docs/tasks/FA-1.84.md` — edytor bloga (komponenty do ponownego użycia)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Po FA-1.82 tekst hubów (intro, sezon, gatunki, FAQ, meta, cytat) siedzi w `destinations.ts`, więc każda poprawka to PR. Po zadaniu treść redakcyjna hubów żyje w tabeli, a Krzysztof edytuje ją w `/admin/hubs` tym samym edytorem co blog; w kodzie zostaje tylko szkielet (slug, grupa, kraje). Strony hubów wyglądają identycznie przed i po przeniesieniu.

## Zakres
- [ ] Odczyt stanu: pola hubów w `destinations.ts`, czy tabela nie istnieje na prod (SELECT).
- [ ] Tabela treści hubów + RLS (anon i authenticated czytają; brak polityki zapisu — zapis przez akcję serwerową z service role po `requireAdmin()`, jak blog; decyzja tj 2026-11-11 nr 1) — STOP z SQL.
- [ ] Przeniesienie treści 6 hubów z kodu do tabeli (migracja danych) — STOP.
- [ ] Odczyt w `getDestinationHub()` z tabeli; `revalidateTag` po zapisie w panelu.
- [ ] `/admin/hubs`: lista + formularz z polami O-43/O-44.
- [ ] O-42 w `docs/04-open-questions.md` → „(b) od FA-1.85”.

## Gotowe, gdy
- [ ] Tabela i polityki na prod — odczyt wklejony; anon nie zapisuje (red proof).
- [ ] HTML 6 hubów (bez znaczników czasu) identyczny przed/po — diff wklejony.
- [ ] Edycja FAQ w panelu → zmiana widoczna na hubie po zapisie — wklejone.
- [ ] CI zielone — lista wklejona.

## Poza zakresem
- Strony regionów i rzek (D5: później).
- Nowe huby poza 6 istniejącymi.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- SQL migracji (tabela, RLS, dane) — pokaż i czekaj.
- Migracja na prod wyłącznie przez `migrate-prod` (tj); kolejność: PR migracyjny → merge → `migrate-prod` → odczyt → PR z kodem.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
for h in norway sweden finland iceland patagonia new-zealand; do curl -s localhost:3000/$h | sed 's/[0-9]\{13\}//g' > /tmp/$h.after; done
```

## Notatki z realizacji
- **2026-11-03, tj:** D2 — treść hubów w tabeli z edytorem; najpierw w kodzie (FA-1.82), tabela razem z edytorem bloga. O-42 wraca na (b).
- **2026-11-11, tj:** Decyzja 1 — zapis jak w blogu: w bazie brak polityki zapisu, zapis przez akcję serwerową z service role po `requireAdmin()`, jeden wiersz `audit_log` na każdy udany zapis. Decyzja 2 — model Opus · high, trudność traktowana jak L (zadanie przenosi dane na produkcję, `docs/05-agent-operations.md` §2). Decyzja 3 — `articles` zostaje w kodzie bez zmian do FA-1.90.
- **2026-11-11, tj:** Tabela `destination_hubs` — SQL zatwierdzony (kolumny, ograniczenia, RLS bez polityki zapisu, REVOKE/GRANT, trigger `updated_at`); pełny plik SQL wklejony w opisie PR migracyjnego, nie streszczenie. Limit opisu meta: **A — 160 w tabeli i w formularzu** (blog blokuje na 155, huby na 160: istniejące opisy Norwegii, Finlandii i Nowej Zelandii mają 160/158/159 znaków). Lokalnie `supabase migration up`, nie `db reset`; reset tylko po zatrzymaniu i zapytaniu tj.

