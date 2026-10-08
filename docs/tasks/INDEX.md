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
| FA-0.22 | Build nie zależy od Google Fonts — Fraunces + DM Sans self-hosted przez `next/font/local` | S | sonnet | done | — |

## Stage 1 — one place for the conversation + schema tells the truth

Branch `stage-1`, Supabase preview branch, **one `db push` at the end** — `REBUILD_PLAN.md` §8 Etap 1.

| id | title | diff | model | status | depends |
|---|---|---|---|---|---|
| FA-1.01 | Baseline: `db pull` produkcji, archiwizacja 61 migracji, pogodzenie historii (`migration repair`) | L | opus | done | FA-0.08 |
| FA-1.02 | `drop_marketplace_leftovers` — schemat `archive` + martwe tabele `public` bez danych | M | opus | done | FA-1.01 |
| FA-1.03 | Maszyna stanów §4 + `inquiry_events` + `transition()` — statusy „na kogo czekamy" (przepisane 16 IX) | L | opus | done | FA-1.01 |
| FA-1.04 | `inquiries.qualified` z agenta + korekta ręczna + `unknown` dla starych (emituje `inquiry.qualified_set`) | M | sonnet | done | FA-1.03 |
| FA-1.05 | Backfill zdarzeń historycznych do `inquiry_events` — tylko ze źródeł, które audyt prod pokaże jako wiarygodne (`messages`, `deposit_paid_at`, `created_at`; `offer_sent_at` warunkowo) | L | opus | done | FA-1.03, FA-1.12 |
| FA-1.06 | Typy mówią prawdę — regeneracja z baseline + usunięcie zapytań do tabel w `archive`. Raport rozbity na dwa PR-y: #11 (kod + raport) i `docs/fa-1.06-tail` (uzupełnienie D4, checklista po deployu, `FA-1.09.md`, reguła §8) — `fa-review` czyta oba | L | opus | done | FA-1.01 |
| FA-1.07 | Wycięcie martwego kodu — paczka 1: `knip` w repo, actions + lib + webhooki, resztki Stripe Connect | M | sonnet | done | FA-1.06, FA-1.12 |
| FA-1.08 | Wycięcie martwego kodu — paczka 2: komponenty i trasy, lint do zera, `knip`+`lint` blokują w CI (trudność podniesiona do L po decyzji o pełnym zerze lintu; model Opus zatwierdzony przez tj 20 IX) | L | opus | done | FA-1.07 |
| FA-1.09 | Gorące akcje na `experience_pages` — tytuł, slug, kraj, cena i przewodnik wyprawy z `experience_page_id`, fallback `trip_id` (zawężone 5 IX: legacy edytor usunięty w FA-1.06); fallback depozytu `sendDepositLink` tylko EUR | M | sonnet | done | FA-1.06 |
| FA-1.10 | Tymczasowy przegląd tygodniowy `/admin/weekly` (8 liczb, do wyrzucenia w etapie 6); domyka kryteria 1 i 4 FA-1.04 | M | sonnet | done | FA-1.04, FA-1.05 |
| FA-1.11 | CI: typecheck/lint/test/build, migracje na czysto, typy bez dryfu, `stage-1` zawiera `main` | M | sonnet | done | FA-1.01 |
| FA-1.12 | `messages` — jeden wątek na zapytanie; e-mail w obie strony z karty; `offers` z opcjami; link Stripe z aplikacji | L | opus | done | FA-1.03 |
| FA-1.13 | WhatsApp w obie strony (Meta Cloud API, szablony 24 h) + adapter Instagram bez kluczy | L | opus | blocked | FA-1.12 |
| FA-1.14 | Agent w wątku — instalacja: „zaproponuj” w kompozytorze, loader `docs/knowledge/`, prompt-zaślepka, auto-wysyłka off (zawężone 21 IX: treść i logika → FA-1.17) | M | sonnet | done | FA-1.12 |
| FA-1.15 | Panel admina czytelny — design system na shadcn/ui w barwach FA; lista zapytań, karta wg etapów flow, `/admin/weekly` | L | opus | done | FA-1.10, FA-1.12, FA-1.13 (kod w stage-1; kryterium E2E czeka na O-16), FA-1.14 |
| FA-1.16 | Domknięcie pętli depozytu — endpoint webhooka w Stripe, sesje `payment_link`, atomowa idempotencja | M | sonnet | done | FA-1.12 |
| FA-1.17 | Treść agenta cz. 1 — graf, instrukcje, ton, NZ przez panel; ocena na 3 wątkach na prod (przepisane 22 IX: wiedza w bazie) | M | — (człowiek) | done | FA-1.21, FA-1.22, FA-1.23, FA-1.24 |
| FA-1.21 | Agent wie, do kogo i na jakim etapie pisze — adresat, kanał, status w prompcie; strony wątku podpisane | M | sonnet | done | FA-1.14 |
| FA-1.22 | Baza wiedzy agenta w bazie — tabela `agent_knowledge`, reguły, RLS tylko admin | L | opus | done | FA-1.14 |
| FA-1.23 | Agent czyta wiedzę i instrukcje z bazy; `docs/knowledge/` znika | M | sonnet | done | FA-1.21, FA-1.22 |
| FA-1.24 | Panel `/admin/knowledge` — lista, edycja, wyłączanie, braki, odnośnik z karty przewodnika | M | sonnet | done | FA-1.22, FA-1.15, FA-1.23 |
| FA-1.25 | Stary agent bez rund — tylko klasyfikacja; bez `AgentToggle` | M | sonnet | done | FA-1.14 |
| FA-1.26 | Treść agenta cz. 2 — IS, NO, wszyscy aktywni przewodnicy | M | — (człowiek) | done | FA-1.17 |
| FA-1.27 | Hybrydowa auto-wysyłka do klienta — sędzia ≥ 0.9, stany „nigdy auto”, tylko e-mail | L | opus | done | FA-1.23, FA-1.25 |
| FA-1.28 | Kwota depozytu w danych — grosze + waluta opcji + kurs do EUR zamrożony; pole kwoty na karcie z podpowiedzią 20% (bloker: ścieżka depozytu zepsuta na prod od 19 IX) | L | opus | done | — |
| FA-1.29 | Link depozytu działa — „czeka na płatność” dopiero po linku, jeden aktywny link, link widoczny na karcie, pętla 4242 lokalnie | L | opus | done | FA-1.28 |
| FA-1.30 | Wiadomość z linkiem depozytu — nazwa i opis wyprawy w Stripe; szkic od agenta AI, kwotę i link wstawia kod | M | sonnet | done | FA-1.29 |
| FA-1.31 | Panel admina reaguje — stan ładowania przy nawigacji, „trwa” i blokada podwójnego kliknięcia na wszystkich akcjach | M | sonnet | done | FA-1.29 |
| FA-1.32 | Wygląd karty zapytania — nagłówek, zakładki, „Offer & payment”; przycisk AI tylko gdy AI działa | L | opus | done | FA-1.31 + makieta (O-24) |
| FA-1.33 | Karta zapytania — zakładki natychmiast i jako pigułki; Overview nie wychodzi poza ekran | S | sonnet | done | FA-1.32 |
| FA-1.34 | Agent pisze pierwszą odpowiedź na zapytanie z formularza — pusty wątek nie blokuje „Zaproponuj” | S | sonnet | done | — |
| FA-1.35 | Jedna definicja faktów dla wykresów — booking = `deposit_paid_at`, prowizja z helpera; `/admin/finances` bez statusów sprzed FA-1.03, `/admin/pipeline` na helperze | M | sonnet | done (PR #116) | — |
| FA-1.36 | Lista braków w danych — `/admin/data-gaps` (wpłata bez daty/kwoty, oferta bez daty, przegrana bez kodu) | S | sonnet | done | FA-1.35 |
| FA-1.37 | „Zapisz wpłatę z przeszłości” na karcie — data, grosze, waluta, kurs z dnia wpłaty; status od razu `paid`/`completed`; zdarzenia `backfill` (O-25) | L | opus | done (PR #115) | — |
| FA-1.38 | Daty z przeszłości — wpływ zapytania, wysłanie oferty, przegrana; data w ręcznym zapytaniu | M | sonnet | done (PR #117) | FA-1.37 |
| FA-1.39 | Uzupełnienie historii na prod wg `/admin/data-gaps`; sumy vs Stripe/księgowość; robi tj | M | — (człowiek) | todo | FA-1.35, FA-1.36, FA-1.37, FA-1.38 |
| FA-1.40 | Auto-wysyłka odpowiada na pierwsze zapytanie z formularza — draft z treści formularza, sędzia widzi formularz, porażka zostawia zdarzenie | S | sonnet | done | — |
| FA-1.41 | Limit żądań `POST /api/inquiries` — per IP i per e-mail (Upstash), odrzucone żądanie bez zapisu, AI i maili | M | sonnet | done (PR #122) | — |
| FA-1.42 | Kontrola kosztów auto-odpowiedzi — powtórki z tego samego e-maila bez AI i maili do klienta; dzienny sufit auto-wysyłek | M | sonnet | done | FA-1.40 |
| FA-1.43 | Formularz — honeypot i minimalny czas; podejrzane zapytanie zapisane, ale bez AI i maili | S | sonnet | done | FA-1.42 |
| FA-1.44 | Bateria testów sędziego — rozkład ocen, przypadki brzegowe, wrogi tekst formularza | M | sonnet | todo | FA-1.40, FA-1.47 |
| FA-1.45 | Włączenie auto-odpowiedzi — lista kontrolna: dev, pierwsza wysyłka na własny adres, flaga na prod, monitoring, wyłączenie; robi tj | S | — (człowiek) | todo | FA-1.41, FA-1.42, FA-1.43, FA-1.44 |
| FA-1.46 | Auto-wysyłka odpowiada na zapytanie z formularza bez tekstu klienta — dane formularza jako wejście, sędzia widzi ten sam blok | S | sonnet | done | FA-1.40 |
 FA-1.47 | Sędzia auto-wysyłki dostaje wiedzę, z której powstał szkic — ceny i zasady jako źródło prawdy | M | sonnet | done | FA-1.40 |
| FA-1.49 | Maile wychodzące ze skrzynki Zoho trafiają do wątku zapytania — kopia na adres inbound, rozpoznana jako wiadomość człowieka | M | sonnet | review | FA-1.40 |
| FA-1.48 | Auto-wysyłka prowadzi wątek tylko do przejęcia przez człowieka — po ręcznej odpowiedzi agent milczy | M | sonnet | done | FA-1.40, FA-1.49 |
| FA-1.50 | EXPAND — oferta zamiast przewodnika w schemacie: `experience_guides`, `experience_prices`, aliasy slugów, pola treści, `inquiries.brief`; backfill; nic nie usuwa | L | opus | done | — |
| FA-1.51 | SYNC — triggery `guide_id` ↔ `experience_guides`, `price_from` ↔ centy; testy w obie strony z red proofem | M | sonnet | review | FA-1.50 |
| FA-1.52 | Dwa szablony na `/experiences/[slug]` — `_v1/` bez zmian, router po fladze × `page_version`, `?preview=v2` dla admina, 301 z aliasów | M | sonnet | done | FA-1.50 |
| FA-1.53 | Szablon v2 S0–S2 — hero, chipy, 3 linie redukcji ryzyka, sticky widget z kalkulatorem Razem / Depozyt / Saldo; `getExperienceV2()` | L | opus | done | FA-1.52 |
| FA-1.54 | Szablon v2 S3–S9 — w skrócie, w cenie / poza ceną, dla kogo / nie, przebieg dnia, przewodnicy, 4 kroki, cena i depozyt | M | sonnet | done | FA-1.53 |
| FA-1.55 | Szablon v2 S10–S14 + formularz 3-krokowy → `inquiries` + `brief`; recenzje z linkiem, mapa, sezon, FAQ | L | opus | done | FA-1.54 |
| FA-1.56 | Admin — zakładka v2: przewodnicy (wielu), tryb, cennik, pola treści, `page_version`, aliasy slugów | L | opus | done | FA-1.50 |
| FA-1.57 | Pilot v2 — jedna strona NZ na `page_version=2` (prod), 14 dni pomiaru v1 vs v2; robi tj | S | — (człowiek) | todo | FA-1.51, FA-1.53, FA-1.54, FA-1.55, FA-1.56, FA-1.59 |
| FA-1.58 | Flaga `RESEND_DEV_FAKE` na każdej wysyłce maili (`sendEmail()`, cron `offer-sla`) + odmowa startu na prod z flagą; `docs/05` §10 | S | sonnet | done | — |
| FA-1.59 | Recenzje v2 — zgoda na publikację, `experience_id` przy tworzeniu linku, backfill na prod, S10 tylko ze zgodą | L | opus | done | — |
| FA-1.18 | Środowisko dev — projekt Supabase `fjordanglers-dev` (Free) z migracjami i seedem; Vercel Preview na dev, tylko `sk_test` i flagi fake | M | sonnet | done | FA-1.75 |
| FA-1.19 | Skan sekretów w CI — gitleaks (wersja + sha256) jako bramka na PR; jednorazowy skan całej historii | S | sonnet | done | — |
| FA-1.20 | CI dociera migracje na dev po merge do `stage-1` — pierwszy sekret w CI, w GitHub Environment `dev` | M | sonnet | todo | FA-1.18 |
| FA-1.75 | Preview wyłączone do czasu dev — Ignored Build Step w Vercelu (tymczasowe, zdejmuje FA-1.18); robi tj | S | — (człowiek) | done | — |
## Stages 2–8

Tasks are written when the preceding stage reaches `review`. Stage outlines: `REBUILD_PLAN.md` §8.
Stage-1 files written: FA-1.01–1.16 (complete). FA-1.05, 1.07, 1.08, 1.10 written 19 IX 2026 after FA-1.12 landed.
FA-1.15 (UI panelu admina) dopisane 20 IX 2026 — decyzje tj D1–D5 w pliku zadania; otwarte O-17.
FA-1.16 (domknięcie pętli depozytu) dopisane 20 IX 2026 — decyzje tj D1–D3 w pliku zadania.
FA-1.21–1.26 dopisane 22 IX 2026 (/wf-plan fa 17): wiedza agenta w bazie (decyzja tj, opcja C), O-18–O-22 rozstrzygnięte. FA-1.20 zajęte w innym wątku.
FA-1.18, FA-1.19 dopisane 22 IX 2026 — luki z audytu agent-workflow (środowisko dev, skan sekretów); rozpisane ponownie przez wf-plan tego samego dnia (+ FA-1.20, FA-1.75), decyzje tj D1–D4 w plikach zadań.
FA-1.27 dopisane 22 IX 2026 (/wf-plan) — hybryda auto-wysyłki, decyzje tj D1–D5 w pliku zadania; plik trafił na stage-1 23 IX razem z archiwum `AGENT_RULES`.
FA-1.28–1.32 dopisane 24 IX 2026 (wf-plan) z wierszy FA-1.18 w `docs/deferred-tasks.md`; decyzje tj w plikach zadań. Ścieżka krytyczna przed wydaniem paczki `stage-1`: FA-1.28 → FA-1.29.
FA-1.35–1.39 dopisane 27 IX 2026 (/wf-plan fa „wykresy pokazują prawdę”) — decyzje tj: D1 każdy rekord osobno, D3 pełny zakres; O-25 rozstrzygnięte. Od 27 IX bazą PR-ów jest `main` (`stage-1` zamknięty po FA-1.34). Ścieżka krytyczna: FA-1.37 → FA-1.38 → merge do `main` → FA-1.39.
FA-1.40 dopisane 1 X 2026 (/wf-plan fa „fixing this”) — luka FA-1.34: auto-wysyłka nie obsługiwała pustego wątku; decyzje tj D1 (auto-wysyłka), D2 (formularz z zapytania).
FA-1.41–1.45 dopisane 2 X 2026 (/wf-plan fa „ochrona formularza przed włączeniem auto-odpowiedzi”) — luka: `POST /api/inquiries` bez limitu i ochrony przed botami, a po FA-1.40 każde żądanie uruchamia AI i maile. Decyzje tj: O-26 Upstash, O-27 honeypot + czas, O-28 zapis zawsze + pominięcie AI i maili dla powtórek, O-29 fail-open, O-30 sufit 5 auto-wysyłek dziennie na start; pakiet pełny. Ścieżka krytyczna: FA-1.41 ∥ FA-1.42 → FA-1.43; FA-1.44 równolegle → FA-1.45.
FA-1.50–1.57 dopisane 5 X 2026 (/wf-plan fa „strona ofertowa = oferta, nie przewodnik”, `docs/proposals/2026-10-05-experience-offer-centric.md`) — expand → sync → switch → pilot; CONTRACT (drop + rename) odłożony do etapu 4 (`docs/deferred-tasks.md`). Decyzje tj: O-31 cena całkowita, O-32 nadpisanie do ~15%, O-33 warianty = osobna strona, O-34 wszyscy przypięci przewodnicy, O-35 zwrot depozytu globalny FA + pogoda per oferta, O-36 SLA per oferta; `brief` już w EXPAND; numeracja ciągła (etapy 2–3 odłożone). Ścieżka krytyczna: FA-1.50 → FA-1.52 → FA-1.53 → FA-1.54 → FA-1.55 → FA-1.57; FA-1.51 ∥ FA-1.56 po FA-1.50.
FA-1.58–1.59 dopisane 8 X 2026 (/wf-plan fa po review FA-1.55) — incydent z mailami mimo flagi fake i puste S10 bez zgody. Decyzje tj: O-37 (a), O-38 (a), D1 (a) blokada flagi na prod, D2 FA-1.57 zależy też od FA-1.51 i FA-1.59. Ścieżka krytyczna do pilota: FA-1.59 → FA-1.57; FA-1.58 pierwsze (zdejmuje zakaz spacerów po formularzu).
