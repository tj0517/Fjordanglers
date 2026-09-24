---
id: FA-1.18
title: Środowisko dev — projekt Supabase `fjordanglers-dev` z migracjami i seedem; Vercel Preview na dev, tylko klucze testowe i flagi fake
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: chore/dev-environment
depends_on: [FA-1.75]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 4
owner: tj
---

# FA-1.18 — Środowisko dev

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — sekcje „CI" i „Production verification"
- `docs/05-agent-operations.md` §3 (STOP), §7 (sekrety), §9 (lokalne środowisko), §10 (flagi fake: `RESEND_DEV_FAKE`)
- `docs/deferred-tasks.md` — wiersze FA-1.16 „Vercel Preview wskazuje na produkcyjną bazę" i „`pending_webhooks: 2`"; FA-1.12 „`.env.local` zawiera produkcyjny `RESEND_API_KEY`"
- `supabase/seed.sql` — 14 kont `@seed.test`, dane syntetyczne
- `src/lib/env.ts` — pełna lista zmiennych, które aplikacja wymaga (to ona wyznacza, co musi być w Preview)
- `scripts/agent-guard.sh` — blokuje **każde** `supabase db push` (także na dev) i `vercel env add|rm`; tych komend nie uruchamiasz, przygotowujesz je dla tj
- `supabase/.temp/project-ref` — repo jest zlinkowane z **produkcją**; tak ma zostać

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś Vercel Preview używa bazy produkcyjnej, więc każde testowe kliknięcie na preview jest
prawdziwym zapisem (FA-1.75 wyłącza preview do czasu tego zadania). Po zadaniu istnieje
osobny projekt Supabase `fjordanglers-dev` ze schematem z repo i syntetycznym seedem,
Preview wskazuje na niego, używa wyłącznie kluczy testowych Stripe i nie wysyła prawdziwych
maili. Preview wraca i znów służy do review wizualnego i dem — bez ryzyka dla produkcji.
Drabina środowisk: local → dev → prod (`core/environments.md` repo agent-workflow).

## Zakres
- [ ] **Odczyt stanu (do raportu, bez wartości):** `vercel env ls preview` — same nazwy i zakresy; dla każdej zmiennej z `src/lib/env.ts` wskaż, czy w Preview istnieje. **Nie** używaj `vercel env pull` ani niczego, co wypisuje wartości. Które z nich wskazują na prod — potwierdza tj.
- [ ] **Odczyt stanu Stripe (tryb testowy):** lista endpointów webhooków trybu testowego (`stripe webhook_endpoints list` na kluczu testowym) — wyjaśnij drugiego odbiorcę z `pending_webhooks: 2` (wiersz FA-1.16).
- [ ] **tj:** utworzenie projektu `fjordanglers-dev` (plan Free, obecna organizacja, ten sam region co prod). Agent podaje checklistę kroków w dashboardzie.
- [ ] **tj:** migracje na dev jawnym adresem, **bez** `supabase link`: `supabase db push --db-url "$DEV_DB_URL"` (agent przygotowuje komendę; guard blokuje ją agentowi).
- [ ] **tj:** seed na dev: `psql "$DEV_DB_URL" -f supabase/seed.sql` (agent przygotowuje komendę).
- [ ] Ustawienia Auth na dev (site URL, dozwolone redirecty dla domen preview `*.vercel.app` projektu) — checklista dla tj, wartości w raporcie.
- [ ] **tj, każda zmiana osobno (STOP):** Vercel Preview → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` z projektu dev; Stripe: `STRIPE_SECRET_KEY` i `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` testowe, `STRIPE_WEBHOOK_SECRET` placeholder (D3: bez endpointu dla preview); `RESEND_DEV_FAKE=1`; pozostałe zmienne wskazujące na prod (WhatsApp, Google Ads, AI itd.) — lista z odczytu, decyzja tj dla każdej.
- [ ] `.mcp.json`: serwer `supabase-dev` (tylko odczyt) obok `supabase-prod` — przez `agent-workflow/bin/mcp-render.py fa` (render robi tj w repo workflow; agent nie edytuje `.mcp.json` ręcznie).
- [ ] `vercel.json`: usuń `"chore/*": false` z `git.deploymentEnabled` (decyzja tj 2026-09-24). Zacommituj, ale **nie pushuj** dopóki tj nie potwierdzi, że zmiany env są gotowe i Ignored Build Step jest przywrócony do reguły docs-only.
- [ ] **Dla mnie — Ignored Build Step:** przywróć regułę docs-only przed FA-1.75: `git diff --quiet HEAD^ HEAD -- . ':(exclude)docs/**' ':(exclude).claude/**' ':(exclude)*.md'`. Dopy-pushy tylko z docs nie będą budować; dodaj notatkę do docs/05.
- [ ] Zmienna `RESEND_API_KEY` na Preview: placeholder (nie-działający) — decyzja tj 2026-09-24: `src/lib/email.ts` ignoruje `RESEND_DEV_FAKE`; z placeholderem wysyłki transakcyjne padają przechwyconym błędem, ale flow zapytania i depozytu kończą się poprawnie.
- [ ] **tj:** zdjęcie Ignored Build Step z FA-1.75, gdy kryteria env są spełnione.
- [ ] Dokumentacja: `README.md` (sekcja o środowiskach: local / dev / prod i co wskazuje Preview), `docs/05-agent-operations.md` — nowy podrozdział „Środowisko dev" (jak odtworzyć dev, że Free usypia projekt po tygodniu bez ruchu i jak go wybudzić, że `db push` na dev robi człowiek do czasu FA-1.20, że Preview ma placeholder `RESEND_API_KEY` i password reset nie wysyła, że `chore/*` jest teraz na).
- [ ] Wiersze w `docs/deferred-tasks.md`: FA-1.16 „Preview → prod" i „`pending_webhooks: 2`" zamknięte z odsyłaczem do tego zadania.

## Gotowe, gdy
- [ ] Schemat dev = repo: `supabase migration list --db-url "$DEV_DB_URL"` → każda z migracji w `supabase/migrations` ma Local = Remote — **wklej wynik**.
- [ ] Seed na dev: `select count(*) from auth.users where email like '%@seed.test'` na dev = 2 **i** `select count(*) from inquiries where angler_email like '%@seed.test'` na dev = 14 — **wklej oba wyniki**.
- [ ] Na dev nie ma danych osobowych z prod: `select count(*) from auth.users where email not like '%@seed.test'` na dev = 0 — **wklej wynik**.
- [ ] Repo nadal zlinkowane z produkcją: `cat supabase/.temp/project-ref` przed i po zadaniu → ta sama wartość (pierwsze 4 znaki w raporcie).
- [ ] **Preview nie dotyka prod (dowód zachowania, nie konfiguracji):** na preview gałęzi `chore/dev-environment`, zalogowany jako `admin@seed.test`, utwórz zapytanie przez `/admin/inquiries/new` z adresem `preview-check-<RRRRMMDD>@example.com` (seed nie ma aktywnej strony wyprawy — formularz publiczny nie działa) → na dev `select count(*) from inquiries where angler_email = '<adres>'` = 1; na **prod** to samo zapytanie = 0 (SELECT przez supabase-prod MCP) — **wklej oba wyniki**.
- [ ] Stripe na preview testowy: link depozytu wygenerowany na preview dla zapytania z poprzedniego kryterium → URL zawiera `cs_test_` albo `plink_` z trybu testowego (dashboard Stripe, tryb testowy) — **wklej prefiks**.
- [ ] Maile na preview fake: odpowiedź z karty zapytania na preview → wiersz w `messages` na dev z fake `external_id`; w logach Resend (prod) brak wysyłki na adres testowy — **zrzut / zapytanie**.
- [ ] Lista zmiennych Preview po zmianie (`vercel env ls preview`, same nazwy) + tabela: zmienna → wskazuje na dev / test / fake / „świadomie prod, decyzja tj <data>".
- [ ] Drugi odbiorca webhooków testowych nazwany (URL endpointu, bez sekretu) i opisany w raporcie; jeśli celuje w `fjordanglers.com` lub `*.vercel.app` → decyzja tj w notatkach.
- [ ] Ignored Build Step zdjęty; nowy push gałęzi zadania tworzy preview „Ready".
- [ ] `pnpm typecheck && pnpm lint && pnpm test run` zielone (zmiany tylko w dokumentacji — CI na PR wystarczy).

## Poza zakresem
- Automatyczne docieranie migracji na dev w CI → FA-1.20
- Endpoint webhooka Stripe dla preview (D3: pętla płatności testowana lokalnie, jak w FA-1.16)
- Supabase Branching, baza per PR
- Kopiowanie jakichkolwiek danych z produkcji na dev — **zakazane** (dane osobowe nie opuszczają prod)
- Porządki w `.env.local` / `dev.sh` (produkcyjne klucze lokalnie) → wiersze FA-1.10 i FA-1.12 w deferred, O-11
- Tagowanie środowiska w Sentry, crony (Vercel uruchamia je tylko na produkcji)
- Zmiany w `supabase/config.toml` i w migracjach
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Utworzenie projektu Supabase, każda zmiana ustawień Auth na dev — robi tj.
- `supabase db push` na dev i seed na dev — komendy przygotowujesz, wykonuje tj (guard i tak je zablokuje).
- `supabase link` na cokolwiek — **zakaz**; zmiana linku sprawiłaby, że następny `db push` tj trafi w inny projekt, niż myśli.
- Każda zmiana zmiennych w Vercelu (dowolny zakres) — osobno, z wypisaniem nazwy i zakresu, bez wartości.
- Jakiekolwiek zapytanie do prod inne niż SELECT; stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.
- Zmiana endpointów Stripe (także testowych).

## Weryfikacja
```
supabase migration list --db-url "$DEV_DB_URL"
psql "$DEV_DB_URL" -c "select count(*) from auth.users where email like '%@seed.test'"
cat supabase/.temp/project-ref | cut -c1-4
vercel env ls preview
pnpm typecheck && pnpm lint && pnpm test run
```

## Notatki z realizacji
- 2026-09-22 tj: tworzymy dev (audyt agent-workflow, luka „brak środowiska dev”). Pierwsza wersja pliku: commit `5b05b3fd` na `docs/workflow-wf-skills`; ta wersja ją zastępuje (wf-plan 22 IX).
- 2026-09-22 tj (wf-plan): dev = osobny projekt Supabase na planie Free w obecnej organizacji (O-18 rozstrzygnięte przy planowaniu).
- 2026-09-22 tj (wf-plan): Stripe na preview tylko `sk_test`, bez endpointu webhooka dla preview (D3).
- 2026-09-22 tj (wf-plan): automatyczne migracje na dev w CI osobno, w FA-1.20 (D2).
- 2026-09-24 tj (wf-task): seed = 2 konta auth + 14 zapytań @seed.test (kryterium poprawione); preview-check przez /admin/inquiries/new jako admin@seed.test (seed nie ma strony wyprawy); na Preview RESEND_API_KEY = placeholder, bo src/lib/email.ts ignoruje RESEND_DEV_FAKE; usuwamy "chore/*" z git.deploymentEnabled w vercel.json, żeby gałąź zadania dostała preview.
- 2026-09-24 tj: dev = krqhfauhhjxwpuradwws, plan Free, osobna organizacja Supabase — replaces "Free w obecnej organizacji" (the prod org is on a paid plan, so a Free project there is not possible). Repo publiczne — zamierzone (tj), ryzyko zaakceptowane, odnotowane w agent-workflow project.md.
- 2026-09-24 tj: NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_META_PIXEL_ID, NEXT_PUBLIC_CLARITY_ID — usunąć z Preview (test traffic nie może docierać do Google Ads / Meta jako konwersje). App jest null-safe: wszystkie trzy użycia są guarded (cookie-banner.tsx:81,88; layout.tsx:153,156). Decyzja tj 2026-09-24.
- 2026-09-24 tj: AI_AUTO_REPLY_ENABLED = false dla Preview tylko (nowy wpis Preview-only po odznaczeniu shared Prod+Preview entry). Decyzja tj 2026-09-24.
- 2026-09-24 tj: env Preview wyczyszczone przez Vercel API — Preview unticked na każdym shared entry, Preview-only entries usunięte. Produkcja bez zmian (names diff before/after identyczny). Preview ma dokładnie 9 zmiennych: NEXT_PUBLIC_SUPABASE_URL (dev), NEXT_PUBLIC_SUPABASE_ANON_KEY (dev), SUPABASE_SERVICE_ROLE_KEY (dev), STRIPE_SECRET_KEY (test), NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (test), STRIPE_WEBHOOK_SECRET (placeholder), NEXT_PUBLIC_APP_URL (URL produkcji, świadomie — decyzja tj 2026-09-24), RESEND_API_KEY (placeholder), RESEND_DEV_FAKE (=1). Usunięte z Preview (decyzja tj 2026-09-24): analytics (GTM, Meta Pixel, Clarity), AI (ANTHROPIC_API_KEY, AI_AUTO_REPLY_ENABLED → defaults to false), WhatsApp, Google Ads, Resend inbound, FA_* emails (code defaults), GITHUB_TOKEN, PLATFORM_COMMISSION_RATE (code default 0.1).
- 2026-09-24 tj: Noticed — przed cleanup Preview miało prod NEXT_PUBLIC_SUPABASE_URL, ale brak ANON_KEY / SERVICE_ROLE_KEY — wcześniejsza tabela env była błędna.
- 2026-09-24 tj: IBS ustawiony inline (nie skrypt): `git diff --quiet HEAD^ HEAD -- . ':(exclude)docs/**' ':(exclude).claude/**' ':(exclude)*.md'`. Docs/05 §11 zaktualizowane.
- 2026-09-24 tj: Stripe sandbox — 2 endpointy testowe znalezione: captivating-radiance (thin payload, 15 events) i vercel (snapshot payload, 2 events), oba → https://fjordanglers-git-staging-….vercel.app (stary staging alias, staging disabled w vercel.json, 0% error rate). Oba DISABLED (nie deleted) przez tj 2026-09-24. URL zawierał bypass token — bypass token zregenerowany. Token nigdzie nie zapisywany — "bypass token (rotated)".
- 2026-09-24 agent: prod check cs_test_ — `select count(*) from inquiries where deposit_stripe_session_id like 'cs_test_%'` → 0. Brak danych testowych Stripe na produkcji.
- 2026-09-24 tj: Preview built and Ready — SHA 5d1a620. URL: https://fjordanglers-git-chore-dev-environment-tymon-jezionek.vercel.app. IBS na pierwsze pushnięcie nie zapisało się (skipped build); tj poprawił, redeployment potwierdził "Ready" (kryterium 10). Git-branch alias: fjordanglers-git-chore-dev-environment-tymon-jezionek.vercel.app.
- 2026-09-24 tj (kryterium 6): `deposit_amount` nie ma settera w UI — wykryte przy próbie kliknięcia „Utwórz link do depozytu" dla alice@seed.test. tj ustawił ręcznie: `UPDATE inquiries SET deposit_amount = 100 WHERE id = 'a1a1a1a1-…-a101'` na dev (tylko dev, dane syntetyczne). Klik × 2 na Preview: dwa wiersze w `messages` ze statusem `draft`, URL `https://buy.stripe.com/test_…` — tryb testowy Stripe potwierdzony. Zdarzenia: `payment.link_sent` × 2, `link_id: plink_1UJAyoCkrtMjTevhvsXgYTYY`, `plink_1UJAyYCkrtMjTevhGIw6pMhg`. Dwa kliknięcia = dwa linki — dowód braku idempotencji (część blokerów row-1). Uwaga: `createPaymentLink` nie wysyła maila — wstawia draft do `messages`, admin klei ręcznie; `src/lib/email.ts` nie jest w tej ścieżce. Brak settera `deposit_amount` = STAGE-1 RELEASE BLOCKER (wiersz FA-1.18 w `docs/deferred-tasks.md`). Decyzja tj 2026-09-24.
- 2026-09-24 tj (wf-review): accepted — PR #101; criteria 1–11 proven (migrations 20/20, seed 2+14, 0 prod rows, preview→dev 1/0, Stripe buy.stripe.com/test_ + plink, fake external_id, 9 Preview vars, 2 sandbox endpoints disabled, IBS inline + preview Ready, CI green). Deviation on crit. 6 (alice + payment link) accepted by tj.
