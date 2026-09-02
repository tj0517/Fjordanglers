---
id: FA-0.08
title: pg_dump produkcji + runbook backupu (warunek wstępny etapu 1)
stage: 0
status: todo
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-db
branch: docs/backup-runbook
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 2
owner: tj
---

# FA-0.08 — Backup produkcji i runbook

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` reguła 1, `docs/05-agent-operations.md` §7 (sekrety)
- `docs/REBUILD_PLAN.md` §8 etap 0 pkt 9 i etap 1 — dlaczego bez dumpu nie ruszamy
- Supabase CLI: `supabase db dump --linked --data-only` / `--schema-only`, wymaga `SUPABASE_DB_PASSWORD` w env (agent **nie wypisuje** jego wartości; sprawdza `test -n`)
- Supabase → Database → Backups — czy plan projektu ma dzienne backupy i PITR

## Cel
Etap 1 kasuje ~12 tabel, etap 4 przepisuje `inquiries`. Przed tym musi istnieć pełny, zweryfikowany zrzut produkcji poza Supabase i jednostronicowa procedura „jak go zrobić i jak przywrócić", żeby drugi founder mógł to wykonać sam.

## Zakres
- [ ] Odczyt bieżącego stanu: status backupów w Supabase (dzienne? PITR?), rozmiar bazy (`pg_database_size`), lista tabel z liczbą wierszy (zapytanie A1 z `docs/REBUILD_PLAN.md` załącznik A) — w raporcie.
- [ ] `scripts/db-backup.sh`: `supabase db dump` schema + data do `backups/<YYYYMMDD-HHMM>/`, `gzip`, sha256; katalog `backups/` w `.gitignore`.
- [ ] `docs/RUNBOOK-backup.md`: jak zrobić dump, gdzie go składować (poza repo i poza laptopem — decyzja tj: który storage), jak przywrócić na nowy projekt Supabase, jak zweryfikować (liczba wierszy per tabela przed/po).
- [ ] Jednorazowe wykonanie dumpu przez tj (nie agenta — hasło do bazy) według runbooka; agent weryfikuje plik: rozmiar > 0, `pg_restore --list` / `head` zawiera `CREATE TABLE inquiries`.
- [ ] Wynik A1 zapisany jako `docs/audit/db-row-counts-<data>.md` — to jest baseline do porównania po etapie 1.

## Gotowe, gdy
- [ ] Plik dumpu istnieje poza repo, ma sumę kontrolną w raporcie i zawiera wszystkie tabele z A1 (porównanie listy).
- [ ] `docs/RUNBOOK-backup.md` przeszedł próbę: drugi founder wykonał procedurę z runbooka bez pytań (potwierdzenie tj).
- [ ] `backups/` w `.gitignore`; `git status` nie pokazuje dumpu.
- [ ] Row counts zapisane w `docs/audit/`.

## Poza zakresem
- Automatyzacja backupów cronem — osobne zadanie po etapie 1, jeśli plan Supabase nie ma PITR.
- Przywracanie na środowisko testowe (to jest część etapu 4).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Odczyt produkcji tylko SELECT i `db dump`. Żadnych zapisów.
- Agent nigdy nie wypisuje `SUPABASE_DB_PASSWORD` ani connection stringa z hasłem.

## Weryfikacja
```
test -n "$SUPABASE_DB_PASSWORD" && echo set || echo MISSING
ls -la backups/ 2>/dev/null; git check-ignore backups/ && echo ignored
```

## Notatki z realizacji

