# Tasks — board

Status legend: todo · in_progress · review · done · dropped · blocked. Edit this file in
the same PR that changes a task's status. Stage descriptions: `docs/REBUILD_PLAN.md` §8.

## Stage 0 — stop the bleeding (target: first week of September)

| id | title | diff | model | status | depends |
|---|---|---|---|---|---|
| FA-0.01 | Strona potwierdzenia po depozycie (`/inquiry-confirmed` → 404) | S | sonnet | done | — |
| FA-0.02 | Redirect zalogowanych `/login` → `/dashboard` zamiast `/account` | S | sonnet | done | — |
| FA-0.03 | Cron `sync-google-ads` odpowiada na GET | S | sonnet | done | — |
| FA-0.04 | `AI_AUTO_REPLY_ENABLED` jako enum, nie `coerce.boolean` | S | sonnet | done | — |
| FA-0.05 | Jedna ścieżka tworzenia zapytania — `source` + UTM; usunięcie `/plan-your-trip` | M | sonnet | done | FA-1.06 |
| FA-0.06 | `requireAdmin()` we wszystkich mutujących akcjach | M | sonnet | done | — |
| FA-0.07 | Naprawa migracji `20260815_fix_nz_species_casing.sql` (1 bajt) | S | sonnet | done | — |
| FA-0.08 | `pg_dump` produkcji + procedura backupu w README | S | sonnet | done | — |
| FA-0.09 | Sekrety poza `settings.local.json`, rotacja tokenu GitHub (O-11) | S | — (człowiek) | done | — |
| FA-0.10 | Google Ads sync — martwy/zły token (cron 500 mimo naprawionego routingu) | S | sonnet | done | — |
| FA-0.11 | Cena mówi prawdę — jeden `formatPrice` z `currency` strony i jednostką ceny (audyt lejka 5 IX) | S | sonnet | done | — |
| FA-0.12 | Strona mówi o swoim regionie — stopka, `/trips` per kraj, cross-sell po kraju, tytuł bez podwójnego sufiksu | M | sonnet | done | — |
| FA-0.13 | `estimateLeadValue(location)` — wartość konwersji per destynacja | S | sonnet | done | FA-0.12 |
| FA-0.14 | Strony hub destynacji — `/patagonia`, `/iceland`, `/new-zealand` na jednej trasie dynamicznej | M | sonnet | done | FA-0.11, FA-0.12 |
| FA-0.15 | Własna telemetria lejka bez cookies — `web_events` + widok `web_funnel_daily` (wyciągnięte z etapu 5) | M | sonnet | done | — |
| FA-0.16 | SLA 48 h — data w auto-mailu, licznik i alarm w adminie, `lost_reason_code` jako lista | M | sonnet | done | — |
| FA-0.17 | Copy przestaje obiecywać wyłącznie Skandynawię | M | sonnet | done | FA-0.12 |
| FA-0.18 | `inquiries.trip_country` faktycznie zapisywane — dziś nic go nie ustawia | S | sonnet | done | — |
| FA-0.19 | Hub prowizji ustawia `external_offer_sent` — licznik SLA bez fałszywych pozytywów | S | sonnet | done | FA-0.16 |
| FA-0.20 | Martwy status `pending_fa_review` — default kolumny łamie własny constraint tabeli | S | sonnet | done | — |
| FA-0.21 | Testy integracyjne piszą do produkcji — `.env.test` i bezpiecznik w `vitest.config.ts` | S | sonnet | done | — |

## Stage 1 — one place for the conversation + schema tells the truth

Branch `stage-1`, Supabase preview branch, **one `db push` at the end** — `REBUILD_PLAN.md` §8 Etap 1.

| id | title | diff | model | status | depends |
|---|---|---|---|---|---|
| FA-1.01 | Baseline: `db pull` produkcji, archiwizacja 61 migracji, pogodzenie historii (`migration repair`) | L | opus | done | FA-0.08 |
| FA-1.02 | `drop_marketplace_leftovers` — schemat `archive` + martwe tabele `public` bez danych | M | opus | review | FA-1.01 |
| FA-1.03 | Maszyna stanów §4 + `inquiry_events` + `transition()` — statusy „na kogo czekamy" (przepisane 16 IX) | L | opus | done | FA-1.01 |
| FA-1.04 | `inquiries.qualified` z agenta + korekta ręczna + `unknown` dla starych (emituje `inquiry.qualified_set`) | M | sonnet | todo | FA-1.03 |
| FA-1.05 | Backfill zdarzeń historycznych z `offer_sent_at` / `deposit_paid_at` — *plik do napisania po FA-1.12* | M | sonnet | todo | FA-1.03 |
| FA-1.06 | Typy mówią prawdę — regeneracja z baseline + usunięcie zapytań do tabel w `archive`. Raport rozbity na dwa PR-y: #11 (kod + raport) i `docs/fa-1.06-tail` (uzupełnienie D4, checklista po deployu, `FA-1.09.md`, reguła §8) — `fa-review` czyta oba | L | opus | done | FA-1.01 |
| FA-1.07 | Wycięcie martwego kodu — paczka 1: actions + lib — *plik do napisania po FA-1.12* | M | sonnet | todo | FA-1.06 |
| FA-1.08 | Wycięcie martwego kodu — paczka 2: komponenty i trasy — *plik do napisania po FA-1.12* | M | sonnet | todo | FA-1.07 |
| FA-1.09 | Legacy edytor `experiences` poza nawigacją; gorące akcje na `experience_pages` | M | sonnet | todo | FA-1.06 |
| FA-1.10 | Tymczasowy przegląd tygodniowy w obecnym `/admin` (8 liczb, do wyrzucenia w etapie 6) — *plik do napisania po FA-1.12* | M | sonnet | todo | FA-1.04 |
| FA-1.11 | CI: typecheck/lint/test/build, migracje na czysto, typy bez dryfu, `stage-1` zawiera `main` | M | sonnet | done | FA-1.01 |
| FA-1.12 | `messages` — jeden wątek na zapytanie; e-mail w obie strony z karty; `offers` z opcjami; link Stripe z aplikacji | L | opus | todo | FA-1.03 |
| FA-1.13 | WhatsApp w obie strony (Meta Cloud API, szablony 24 h) + adapter Instagram bez kluczy | L | opus | todo | FA-1.12 |
| FA-1.14 | Agent w wątku — propozycja odpowiedzi z bazy wiedzy; auto-wysyłka off | L | opus | todo | FA-1.12 |

## Stages 2–8

Tasks are written when the preceding stage reaches `review`. Stage outlines: `REBUILD_PLAN.md` §8.
Stage-1 files written: FA-1.01–1.04, 1.06, 1.09, 1.11–1.14. FA-1.05, 1.07, 1.08, 1.10 are written once FA-1.12 is in review (their content depends on `messages` and on what 1.12 removes).
