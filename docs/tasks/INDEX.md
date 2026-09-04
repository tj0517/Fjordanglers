# Tasks — board

Status legend: todo · in_progress · review · done · dropped · blocked. Edit this file in
the same PR that changes a task's status. Stage descriptions: `docs/REBUILD_PLAN.md` §8.

## Stage 0 — stop the bleeding (target: first week of September)

| id | title | diff | model | status | depends |
|---|---|---|---|---|---|
| FA-0.01 | Strona potwierdzenia po depozycie (`/inquiry-confirmed` → 404) | S | sonnet | review | — |
| FA-0.02 | Redirect zalogowanych `/login` → `/dashboard` zamiast `/account` | S | sonnet | review | — |
| FA-0.03 | Cron `sync-google-ads` odpowiada na GET | S | sonnet | review | — |
| FA-0.04 | `AI_AUTO_REPLY_ENABLED` jako enum, nie `coerce.boolean` | S | sonnet | review | — |
| FA-0.05 | Jedna ścieżka tworzenia zapytania — `source` + UTM; usunięcie `/plan-your-trip` | M | sonnet | todo | — |
| FA-0.06 | `requireAdmin()` we wszystkich mutujących akcjach | M | sonnet | todo | — |
| FA-0.07 | Naprawa migracji `20260815_fix_nz_species_casing.sql` (1 bajt) | S | sonnet | done | — |
| FA-0.08 | `pg_dump` produkcji + procedura backupu w README | S | sonnet | done | — |
| FA-0.09 | Sekrety poza `settings.local.json`, rotacja tokenu GitHub (O-11) | S | — (człowiek) | todo | — |
| FA-0.10 | Google Ads sync — martwy/zły token (cron 500 mimo naprawionego routingu) | S | sonnet | todo | — |

## Stage 1 — schema tells the truth + event log

| id | title | diff | model | status | depends |
|---|---|---|---|---|---|
| FA-1.01 | Baseline: `db pull` produkcji, archiwizacja 61 migracji, pogodzenie historii (`migration repair`) | L | opus | todo | FA-0.08 |
| FA-1.02 | `drop_marketplace_leftovers` (tabele bez danych do przeniesienia) | M | opus | todo | FA-1.01 |
| FA-1.03 | Rejestrator zdarzeń `inquiry_events` + `transition()` | L | opus | todo | FA-1.01 |
| FA-1.04 | `inquiries.qualified` z agenta + korekta ręczna + `unknown` dla starych | M | sonnet | todo | FA-1.01 |
| FA-1.05 | Backfill zdarzeń historycznych z `offer_sent_at` / `deposit_paid_at` | M | sonnet | todo | FA-1.03 |
| FA-1.06 | Regeneracja typów + usunięcie `as any` wynikających z braku typów | M | sonnet | todo | FA-1.01 |
| FA-1.07 | Wycięcie martwego kodu — paczka 1: actions + lib | M | sonnet | todo | FA-1.06 |
| FA-1.08 | Wycięcie martwego kodu — paczka 2: komponenty i trasy | M | sonnet | todo | FA-1.07 |
| FA-1.09 | Legacy edytor `experiences` poza nawigacją; gorące akcje na `experience_pages` | M | sonnet | todo | FA-1.06 |
| FA-1.10 | Tymczasowy przegląd tygodniowy w obecnym `/admin` (8 liczb, do wyrzucenia w etapie 6) | M | sonnet | todo | FA-1.04 |
| FA-1.11 | CI: `db diff` pusty + `gen types` + typecheck/lint/build | M | sonnet | todo | FA-1.01 |

## Stages 2–8

Tasks are written when the preceding stage reaches `review`. Stage outlines: `REBUILD_PLAN.md` §8.
Only FA-0.01, FA-0.05 and FA-1.03 are fully written so far — use them as the pattern for the rest.
