---
id: FA-1.11
title: CI na PR do stage-1 i main — typecheck/lint/test/build, migracje aplikują się czysto, typy bez dryfu, stage-1 nie odstaje od main
stage: 1
status: review
difficulty: M
model: sonnet
model_approved:
effort: medium-high
agent: fa-core
branch: chore/ci
depends_on: [FA-1.01]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.11 — CI

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md` — „CI runs `supabase db diff` and fails on drift"
- `docs/REBUILD_PLAN.md` §8 Etap 1 — `stage-1`, hotfixy z `main` cherry-pickowane tego samego dnia
- `docs/tasks/FA-0.21.md` — `.env.test`, bezpiecznik w `src/tests/setup.ts`, `vitest.config.ts`
- `package.json` (skrypty), `supabase/config.toml` (porty lokalnego stacku)
- `docs/05-agent-operations.md` §5 — format raportu; CI ma dawać te same dowody, które agent wkleja ręcznie

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Repo nie ma żadnego CI (`.github/workflows` nie istnieje). Przy paczce `stage-1` na jeden
push najgroźniejsze są trzy rzeczy: migracja, która nie aplikuje się na czysto; plik typów
rozjechany ze schematem; i `stage-1`, do którego nie trafił hotfix z `main`. Po zadaniu
każdy PR do `stage-1` i `main` jest sprawdzany automatycznie w tych trzech punktach plus
typecheck/lint/test/build, a PR do `stage-1` jest blokowany, gdy `main` ma commity spoza niego.

## Zakres
- [ ] Odczyt stanu: `ls .github`; wersje node/pnpm z `package.json`/`.nvmrc`; czas `pnpm build` lokalnie; czy `supabase start` działa bez sekretów (powinien — klucze deterministyczne z FA-0.21).
- [ ] `.github/workflows/ci.yml`, na `pull_request` do `main` i `stage-1` oraz `push` do `stage-1`:
  - job `check`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (env z `.env.test` + placeholdery dla zmiennych wymaganych przez `src/lib/env.ts` — bez prawdziwych sekretów).
  - job `db`: `supabase start` (cache obrazów), `supabase db reset` (wszystkie migracje na czysto), `supabase db diff --local` → musi być pusty; `supabase gen types typescript --local > /tmp/types.ts` i `diff` z `src/lib/supabase/database.types.ts` → pusty; `pnpm test` przeciwko lokalnemu stackowi.
  - job `sync` (tylko PR do `stage-1`): `git merge-base --is-ancestor origin/main HEAD` — fail z czytelnym komunikatem „stage-1 nie zawiera main; zmerguj main do stage-1".
- [ ] Skrypt `supabase:types` w `package.json`: dodaj `supabase:types:local` (`--local`); istniejący (`--project-id`) zostaje do użycia po pushu.
- [ ] `docs/03-conventions.md`: krótka sekcja „CI" (co sprawdza, jak naprawić każdy z trzech failów).
- [ ] Branch protection na `stage-1` i `main` z wymaganymi checkami — instrukcja w raporcie (ustawia tj w GitHub; poza zasięgiem agenta).

## Gotowe, gdy
- [ ] PR testowy z celowo złą migracją (np. `ALTER TABLE nope ADD x int`) → job `db` czerwony — **na czerwono, link do runu w raporcie**.
- [ ] PR testowy z ręczną edycją `database.types.ts` → job `db` czerwony (diff typów) — **na czerwono**.
- [ ] PR testowy do `stage-1` z gałęzi bez najnowszego `main` → job `sync` czerwony — **na czerwono**.
- [ ] PR z czystą gałęzią → wszystkie joby zielone, link do runu w raporcie; czas całości < 15 min.
- [ ] Żaden sekret produkcyjny nie jest w workflow ani w secrets repo (raport: lista użytych secrets = pusta lub tylko lokalne).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone lokalnie.

## Poza zakresem
- Sprawdzanie dryfu wobec **produkcji** (`db diff --linked`) — wymaga hasła bazy w secrets; decyzja tj, osobne zadanie.
- Deploy z CI (Vercel robi to sam), `db push` z CI — nigdy w etapie 1.
- E2E Playwright w CI — później.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Dodanie jakiegokolwiek secretu do repo/GitHub: STOP, zapytaj.
- Zmiana ustawień branch protection: robi tj.

## Weryfikacja
```
act -l 2>/dev/null || echo "run via GitHub"
pnpm typecheck && pnpm lint && pnpm test && pnpm build
supabase db reset && supabase db diff --local
supabase gen types typescript --local | diff - src/lib/supabase/database.types.ts && echo TYPES-OK
```

## Notatki z realizacji

## Report — FA-1.11 CI: check / db / sync na PR do `stage-1` i `main`

### Rozbrojenie miny (przed jakimkolwiek CI)

Dwa pierwsze commity na `chore/ci`, zgodnie z poleceniem:

| commit | co |
|---|---|
| `5dc45076` | `git merge origin/main` — konflikt w 4 plikach, **STOP**, decyzja tj: „bierz HEAD we wszystkich czterech" |
| `6c3b7328` | `git revert 1505c7f3` — revert reverta, ten sam konflikt, ta sama reguła |

Konflikt (obie bramki STOP zgłoszone i rozstrzygnięte przez tj, 17 IX):

```
$ git diff --name-only --diff-filter=U
docs/deferred-tasks.md
docs/tasks/FA-1.03.md
docs/tasks/INDEX.md
docs/tasks/README.md
```

Każdy hunk miał ten sam kształt: `HEAD` ma treść, `origin/main` ją kasuje (bo to właśnie
robi revert). Żaden nie był dwustronną edycją.

**Dowody:**

```
$ ls src/lib/inquiries/state.ts src/lib/events/ \
     supabase/migrations/20260916201225_inquiries_status_v2.sql \
     supabase/migrations/20260916201226_add_inquiry_events.sql
src/lib/inquiries/state.ts
supabase/migrations/20260916201225_inquiries_status_v2.sql
supabase/migrations/20260916201226_add_inquiry_events.sql
src/lib/events/:  emit.test.ts  emit.ts  types.ts

$ git merge-base --is-ancestor origin/main HEAD ; echo $?
0

$ pnpm test run
Test Files  11 passed (11)
      Tests  89 passed (89)
```

**Dodatkowy dowód, mocniejszy niż wymagany:** `main` nie niósł **żadnej** własnej treści —
`git log --oneline 1f4dc01d..7d95296d` jest puste, czyli `7d95296d` (tip `main` sprzed
merge'a #47) jest **przodkiem** `1f4dc01d`, a nie równoległą linią. Jedyne własne commity
`main` to merge #47 i jego revert. Wobec tego poprawnym stanem końcowym jest „drzewo
identyczne ze `stage-1`, `main` jako przodek" — i tak jest:

```
$ git diff --stat 577793d1 HEAD -- . ; echo "exit=$?"
exit=0        # brak wyjścia = drzewa identyczne
```

`docs/REBUILD_PLAN.md` §8 Etap 1: notatka o minie usunięta, zastąpiona jedną linią
wskazującą commit `6c3b7328` (commit `da8e1e54`).

### Done

- **`.github/workflows/ci.yml`** — trzy joby, `pull_request` do `main` i `stage-1`
  plus `push` do `stage-1`. Nazwy do wpisania w ruleset: **`check`**, **`db`**, **`sync`**.
  - `check` — `pnpm install --frozen-lockfile`, typecheck, lint, build. Blokujące:
    typecheck i build. Lint z `continue-on-error: true` i wynikiem w summary
    (decyzja tj; uzasadnienie w „Needs a decision" niżej).
  - `db` — `supabase start` (bez zbędnych kontenerów) → `supabase db reset` →
    `supabase db diff --local` pusty → `gen types typescript --local` + `diff`
    z `src/lib/supabase/database.types.ts` → `pnpm test run`. Tylko na PR (decyzja tj).
  - `sync` — tylko PR do `stage-1`; dwa sprawdzenia z osobnymi komunikatami.
- **`.nvmrc`** = `20` (decyzja tj; brak `engines` w `package.json`, lokalnie `v20.20.0`,
  `@types/node: ^20`, Next 16 wymaga ≥20.9). CI pinuje też `pnpm@10.30.3`
  i Supabase CLI `2.75.0` — te same wersje, co na maszynie zespołu.
- **`package.json`** — dodany `supabase:types:local` (`--local`, generator kanoniczny).
  Przy okazji **naprawiony destrukcyjny `>`** w obu skryptach (deferred FA-0.05 wskazywał
  FA-1.11 jako właściciela: „ten sam skrypt idzie do CI"): generacja do `$TMPDIR`, `mv`
  po sukcesie, guard `${SUPABASE_PROJECT_ID:?…}`. Czerwony dowód niżej.
- **`docs/03-conventions.md`** — sekcja „CI": co sprawdza każdy job, nazwy checków do
  branch protection, trzy sposoby na czerwony `db` i naprawa każdego z nich, dlaczego
  lint nie jest bramką.
- **`docs/deferred-tasks.md`** — nowy wpis (niżej).

### Weryfikacja — cztery przebiegi

Wszystkie cztery na **finalnym** `ci.yml` (gałęzie dowodowe zaktualizowane po poprawce
`sync`, żeby dowód dotyczył tego, co wchodzi do repo, a nie wersji roboczej).

| # | co | run | `check` | `db` | `sync` |
|---|---|---|---|---|---|
| 1 | czysta gałąź (`chore/ci`), PR #48 | [35197219267](https://github.com/tj0517/Fjordanglers/actions/runs/35197219267) | ✅ | ✅ | ✅ |
| 2 | celowo zła migracja, PR #49 | [35196695941](https://github.com/tj0517/Fjordanglers/actions/runs/35196695941) | ✅ | ❌ | ✅ |
| 3 | ręczna edycja `database.types.ts`, PR #50 | [35196698746](https://github.com/tj0517/Fjordanglers/actions/runs/35196698746) | ✅ | ❌ | ✅ |
| 4 | gałąź bez najnowszego `main`, PR #51 | [35196708598](https://github.com/tj0517/Fjordanglers/actions/runs/35196708598) | ✅ | ✅ | ❌ |

Każdy czerwony przebieg jest czerwony **dokładnie w jednym jobie** — reszta zielona, więc
dowód izoluje sprawdzenie, a nie łapie efektu ubocznego.

**Kryterium 1 — zła migracja** (`ALTER TABLE nope ADD COLUMN x int`):

```
Applying migration 20260916201226_add_inquiry_events.sql...
Applying migration 20260917120000_deliberately_broken.sql...
ERROR: relation "nope" does not exist (SQLSTATE 42P01)
-- FA-1.11 red proof. Deliberately broken: table "nope" does not exist.
ALTER TABLE nope ADD COLUMN x int
##[error]Process completed with exit code 1.
```

Uwaga co do uczciwości zapisu: pada **`supabase start`**, nie `db reset` — migracje
aplikują się już przy starcie stacku, więc zła migracja zatrzymuje job o jeden krok
wcześniej, niż zakładało brzmienie kryterium. Skutek ten sam (job czerwony, komunikat
wskazuje plik i błąd Postgresa), ale krok w logu nazywa się inaczej.

**Kryterium 2 — dryf typów** (ręcznie dopisany komentarz i zmyślona tabela):

```
##[error]src/lib/supabase/database.types.ts odstaje od schematu — uruchom pnpm supabase:types:local
+// FA-1.11 red proof: hand-edited, drifted from the schema on purpose.
 export type Json =
+      fa_1_11_drift_probe: {
```

**Kryterium 3 — gałąź bez `main`** (wycięta z `1f4dc01d`):

```
##[error]stage-1 nie zawiera main i ten PR tego nie naprawia; zmerguj main do stage-1
  commity na main, których nie miałby stage-1 po tym merge'u:
1505c7f Revert "Merge pull request #47 …"
51a1883 Merge pull request #47 …
##[error]gałąź PR została wycięta przed ostatnim main; zmerguj main (albo stage-1) do gałęzi
```

**Kryterium 4 — czysta gałąź, wszystko zielone** (run 35197219267):

```
sync:   07:58:35 -> 07:58:42   (7 s)
check:  07:58:37 -> 08:00:49   (2 min 12 s)
db:     07:58:35 -> 08:03:41   (5 min 06 s)
```

Najdłuższy przebieg: **5 min 06 s** (joby idą równolegle) — limit 15 min z zapasem 3×.

```
db diff --local: pusty
typy zgodne ze schematem
Test Files  11 passed (11)
      Tests  89 passed (89)
✓ Compiled successfully in 32.7s
```

**Kryterium 5 — zero sekretów.**

```
$ gh secret list   -> 0 wierszy
$ gh variable list -> 0 wierszy
$ grep -n "secrets\." .github/workflows/ci.yml
14:# … `secrets.*` nie występuje w tym pliku ani razu —      (komentarz)
72:            echo 'Źródło: commitowany `.env.test`. Zero `secrets.*`.'   (tekst do summary)
```

Oba trafienia to proza, nie interpolacja. Jedyne wartości env w CI to osiem zmiennych
z commitowanego `.env.test` — lista wypisana przez sam pipeline do logu i do summary
(run 35197219267, job `check`):

```
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
RESEND_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SUPABASE_SERVICE_ROLE_KEY
```

Supabase to klucze lokalnego stacku (deterministyczne, identyczne u każdego), Stripe
i Resend to placeholdery z FA-0.21. `check` kopiuje `.env.test` na `.env.local`, bo
`next build` czyta `.env.local`; artefakt buildu nigdzie nie jedzie — deploy robi Vercel
z własnym env. Job `db` nie wstrzykuje nic: `src/tests/setup.ts` sam ładuje `.env.test`
razem z bezpiecznikiem „tylko 127.0.0.1" z FA-0.21.

**Kryterium 6 — lokalnie.**

| komenda | wynik |
|---|---|
| `pnpm typecheck` | 0 błędów |
| `pnpm build` | exit 0, 49/49 stron, 278,8 s |
| `pnpm test run` | 89 passed (09:23) — **później niewykonalne lokalnie, patrz „Not done"** |
| `pnpm lint` przed (`stage-1`) | `✖ 106 problems (40 errors, 66 warnings)` |
| `pnpm lint` po (`chore/ci`) | `✖ 106 problems (40 errors, 66 warnings)` |

Lint bez zmiany, co do błędu i co do ostrzeżenia — PR nie dotyka żadnego pliku,
który ESLint sprawdza. (W CI ten sam lint daje `40 errors, 62 warnings`; różnica
w ostrzeżeniach bierze się z czystego katalogu roboczego runnera, liczba **błędów**
jest identyczna.)

**Czerwony dowód dla naprawionego `supabase:types`** (deferred FA-0.05 — skrypt zerował
plik typów, gdy komenda padła):

```
$ env -u SUPABASE_PROJECT_ID pnpm supabase:types
sh: SUPABASE_PROJECT_ID: SUPABASE_PROJECT_ID is not set
 ELIFECYCLE  Command failed.

$ git status --short src/lib/supabase/database.types.ts
(pusto)
$ wc -l < src/lib/supabase/database.types.ts
3965
```

Plik nietknięty. Przed poprawką ta sama sytuacja zostawiała w repo pusty plik typów.

**Supabase CLI a nazwy kontenerów (deferred FA-1.03) — w Actions problemu nie ma.**
`supabase/.temp/` jest w `.gitignore`, więc runner nie ma pliku `project-ref` i CLI bierze
nazwy kontenerów z `config.toml` `project_id` — spójnie z tym, co sam wystartował. Żadnej
podmiany `project_id` w workflow nie ma i nie była potrzebna; dowodem jest zielony job `db`
(`supabase start`, `db reset`, `db diff --local`, `gen types --local` — wszystko przeszło).
Wersja CLI przypięta na `2.75.0`, tę samą ma zespół lokalnie. Lokalnie pułapka nadal jest
i nadal wymaga decyzji tj z tamtego wpisu.

### Not done

- **`pnpm test run` lokalnie na końcu sesji** — 1 failed / 86 passed / 2 skipped,
  `inquiryStatusDefault.test.ts` przekracza 5 s w oczekiwaniu na lokalny stack. Przyczyna
  jest poza repo: Docker na tej maszynie przestał odpowiadać (`docker ps` nie wrócił
  w 120 s). Ten sam commit ma w CI `89 passed`, a o 09:23 tej samej sesji miał `89 passed`
  także lokalnie. Nie ruszam Dockera — to maszyna tj, nie zakres zadania.
- **Branch protection / ruleset** — robi tj. Do wymaganych checków wpisać dokładnie:
  **`check`**, **`db`**, **`sync`**. `db` i `sync` mają `if:` na poziomie joba, więc na
  zdarzeniach, których nie dotyczą, raportują się jako *skipped* (GitHub liczy skipped
  jako spełniony wymagany check) — nie znikają, więc PR nigdy nie utknie w oczekiwaniu.

### Noticed, not touched (→ `docs/deferred-tasks.md`)

- **Nieśledzony katalog `HEAD/` w korzeniu repo** — kopia `docs/brand/` (`01-brand-overview.md`
  … `voice-of-customer.md`, `.DS_Store`, xlsx). Praktyczny skutek: `git diff <rev> HEAD`
  przestaje działać (`ambiguous argument 'HEAD': both revision and filename`) i wymaga `--`.
  Bliźniak wpisu „`docs/01-05` duplicated in `head/`" z audytu 2026-08-31. Wpis dodany.

### Needs a decision

Wszystkie pięć zostało przedstawionych tj w trakcie zadania i rozstrzygniętych — zapisuję
je tu z konsekwencjami, bo zmieniają zachowanie pipeline'u:

1. **Konflikt merge'a** → „bierz HEAD we wszystkich czterech". Zastosowane też do drugiego
   konfliktu (przy `git revert`), bo to ta sama reguła; pliki przywrócone byte-exact
   z `577793d1`.
2. **Node 20**, nie 22 — zgodnie z lokalnym `v20.20.0`. Dodany `.nvmrc`.
3. **`supabase start -x <zbędne>`**, bez cache'owania obrazów docker. Wyłączone:
   `gotrue, realtime, storage-api, imgproxy, mailpit, postgres-meta, studio, edge-runtime,
   logflare, vector, supavisor`. Job `db` mieści się w 5 min bez żadnego cache.
   (`postgres-meta` i tak podnosi się na chwilę przy `gen types` — CLI robi to sam.)
4. **`db` tylko na PR**, nie na pushu do `stage-1`.
5. **Semantyka `sync`** — zmiana wobec pierwszej implementacji, po tym jak pipeline sam
   pokazał w niej błąd. Pierwsze sprawdzenie porównywało `origin/main` z `origin/<base>`
   i przez to **blokowało PR, który wciąga `main` do `stage-1`** — czyli jedyny PR, który
   ten warunek usuwa (run [35195209532](https://github.com/tj0517/Fjordanglers/actions/runs/35195209532),
   `sync` czerwony na czystej gałęzi). Teraz pyta o `HEAD` merge refa: „czym `stage-1`
   stanie się po tym merge'u" — dokładnie `git merge-base --is-ancestor origin/main HEAD`
   z pliku zadania. Zagrożenie nadal złapane: gałąź wycięta ze starego `stage-1` daje merge
   bez `main` → czerwone.

Nierozstrzygnięte, do decyzji przy odbiorze:

- **`db diff --local` po `db reset` jest bliski tautologii** — baza właśnie powstała z tych
  migracji, więc krok łapie realnie tylko migrację zostawiającą schemat inny, niż opisuje.
  Twardym dowodem na złą migrację jest `db reset` / `supabase start`. Zostawiam, bo tak brzmi
  zadanie i `docs/03-conventions.md`, ale opisałem to wprost w sekcji „CI", żeby nikt nie
  przypisał temu krokowi ochrony, której nie daje. Realny dryf wobec **produkcji** łapie
  dopiero `db diff --linked` — świadomie poza zakresem.
- **Drugie sprawdzenie w `sync` jest silniejsze niż pierwsze**: jeśli gałąź PR zawiera
  `main`, to merge też go zawiera, więc pierwsze nie zapali się nigdy samo. Zostaje, bo ma
  lepszy komunikat dla przypadku „`stage-1` nie wchłonął hotfixa" i bo jest literalnie tym,
  czego wymaga plik zadania. Jeśli uznasz to za zbędne, do wycięcia jednym `if`-em.
- **Lint jako bramka** — dziś `continue-on-error`. Po zamknięciu wpisu deferred „lint
  czerwony na `main`" (40 błędów w `src/emails/*.tsx` i `whatsapp-bridge/poll-emails.mjs`)
  wystarczy usunąć `continue-on-error` ze stepu `lint`; instrukcja jest w `docs/03-conventions.md`.

### Sprzątanie

Trzy PR-y dowodowe zamknięte bez merge'a, gałęzie usunięte zdalnie i lokalnie:

```
$ gh pr list --json number,headRefName
#48 chore/ci   (jedyny otwarty)
$ git ls-remote --heads origin 'refs/heads/test/*' | wc -l
0
```

---

## Aneks — reguły pracy z lokalnym stackiem na maszynie 8 GB (zadanie dodatkowe, 17 IX)

> **Zapis stanu z wcześniejszej rundy tego samego dnia — trzy jego ustalenia zostały
> potem odwrócone przez tj.** `project_id` **nie** zmienia się na ref produkcji
> (rozjazd nazw naprawiony przestawieniem kontenerów); lista `-x` dostaje jeszcze
> `storage-api` i `postgres-meta`; OrbStack dostaje 4 GB, nie 3 GB. Obowiązuje
> **Aneks 2** niżej i `docs/05-agent-operations.md` §9. Aneks zostawiony, bo opisuje
> diagnozę, która doprowadziła do tamtych decyzji.

### Done

- **`docs/05-agent-operations.md` §9 „Lokalne środowisko (8 GB RAM)"** — pięć reguł
  z zadania plus szósta, która wyszła przy weryfikacji (patrz niżej).
- **`CLAUDE.md` reguła 11** — jedna linia odsyłająca do §9.
- **`supabase/config.toml`** — `project_id = "uwxrstbplaoxfghrchcy"` (decyzja tj).
- **`docs/deferred-tasks.md`** — wpis „OrbStack pada przy build + stack na 8 GB" dodany
  i od razu zamknięty tą sekcją, z datą; wpis FA-1.03 o nazwach kontenerów zamknięty.
- CI po tych zmianach nadal zielone: run
  [35200834576](https://github.com/tj0517/Fjordanglers/actions/runs/35200834576) (`c7240028`).

### Punkt 1 — limit pamięci OrbStacka: nic do zrobienia, już ustawiony

```
$ orb config show | grep -E '^(memory_mib|cpu):'
cpu: 8
memory_mib: 3072
```

I limit **działa**, nie tylko siedzi w konfiguracji:

```
$ docker info --format '{{.MemTotal}} / {{.NCPU}} CPU'
3125583872 / 8 CPU          # 3 125 583 872 B = 2,91 GiB ≈ 3072 MiB
$ sysctl -n hw.memsize      # host: 8,0 GB
```

`orb config set memory_mib 3072` nie było potrzebne i restartu OrbStacka nie robiłem —
nie ma czego zmieniać. To zarazem podważa pierwotną diagnozę: skoro limit był ustawiony
przez cały czas, samo 3 GB nie tłumaczy dwóch awarii. Prawdziwa przyczyna niżej.

### Przyczyna awarii — `supabase stop` był cichym no-opem

To jest najważniejsze ustalenie tego zadania i nie było w jego opisie.

```
$ supabase stop
Stopping containers...
Stopped supabase local development setup.          <- komunikat o sukcesie

$ docker ps --format '{{.Names}}' | grep -c uwxrstbplaoxfghrchcy
11                                                  <- i 11 dzialajacych kontenerow
```

Dlaczego:

```
$ docker inspect supabase_db_uwxrstbplaoxfghrchcy \
    --format '{{index .Config.Labels "com.supabase.cli.project"}}'
uwxrstbplaoxfghrchcy         <- etykieta dzialajacych kontenerow (stare CLI, z .temp/project-ref)
$ grep '^project_id' supabase/config.toml
project_id = "fjordanglers"  <- czego szukalo CLI 2.75
```

CLI szukało projektu `fjordanglers`, trafiło na jeden osierocony wolumen
(`supabase_edge_runtime_fjordanglers`), uznało robotę za zrobioną i wyszło z kodem 0.
Skutek praktyczny: **reguła „zatrzymaj stack przed buildem" była niewykonalna** — kto ją
stosował, dostawał potwierdzenie i budował przy komplecie kontenerów. To wyjaśnia obie
awarie znacznie lepiej niż sam limit 3 GB.

Po zmianie `project_id` (decyzja tj):

```
$ supabase stop
Stopped supabase local development setup.
$ docker ps --format '{{.Names}}' | grep -c uwxrstbplaoxfghrchcy
0                            <- naprawde zatrzymany
$ docker ps --format '{{.Names}}' | grep -c Seaclouds
11                           <- drugi projekt nietkniety
```

Przy okazji zamyka to wpis deferred FA-1.03 o nazwach kontenerów: `db diff --local`
i `gen types --local` działają teraz bez podmiany `project_id`, po raz pierwszy od 16 IX.

### Punkt 3 — weryfikacja listy `-x`

`supabase stop` → `supabase start -x studio,imgproxy,mailpit,logflare,vector,edge-runtime,realtime`
(start **30,6 s**) → cztery sprawdzenia:

| krok | wynik |
|---|---|
| `pnpm test run` | `Test Files 11 passed (11)` · `Tests 89 passed (89)` |
| `supabase db diff --local` | `No schema changes found` |
| `supabase gen types typescript --local` + `diff` | brak różnic |
| `pnpm supabase:types:local` (nowy skrypt) | plik odtworzony identycznie, `git status` pusty |

Żadna z wyłączonych usług nie okazała się potrzebna — lista przechodzi bez zmian.
Stack zszedł z **11 kontenerów do 6** (`db`, `kong`, `rest`, `auth`, `storage`, `pg_meta`).

### Punkt 2 — jedna reguła dopisana ponad listę z zadania

Do §9 doszła szósta reguła: **„`supabase stop` sprawdzamy, nie wierzymy mu"** z gotowym
`grep -c`. Powód powyżej: instrukcja, która polega na komendzie zgłaszającej fałszywy
sukces, jest gorsza niż jej brak.

### Poprawki faktograficzne wobec treści zadania

Dwie rzeczy w opisie zadania nie zgadzały się ze stanem maszyny; w dokumentacji jest wersja
sprawdzona:

1. **`--max-old-space-size=2048` jest w skrypcie `dev`, nie w `build`.** `"build": "next build"`
   nie ma żadnego `NODE_OPTIONS`, czyli build **nie ma pułapu sterty** i rośnie, dopóki
   system pozwala. To czyni regułę „build tylko przy zatrzymanym stacku" ważniejszą,
   nie mniej ważną. Zmierzony szczyt RSS procesu głównego przy zatrzymanym stacku:
   **1 550 254 080 B = 1,44 GiB** (`/usr/bin/time -l`), plus workery generujące strony
   statyczne, których `time -l` nie wlicza.
2. **Na tej maszynie nie ma `timeout` ani `gtimeout`** (brak coreutils w brew), więc
   `timeout 10 docker ps` kończy się `command not found`. Decyzja tj: przenośny
   `perl -e 'alarm 10; exec @ARGV' -- docker ps …`. Sprawdzony na żywo na zawieszonym
   Dockerze i na działającym.

### Noticed, not touched

- **Drugi pełny stack Supabase na tej samej maszynie.** Obok FjordAnglers chodzi komplet
  jedenastu kontenerów projektu `Seaclouds_management_system`; 17 IX było ich razem 22
  w jednym 3 GB VM. Największe pozycje z obu stacków to `analytics`/logflare (238 i 206 MiB)
  oraz `realtime` (172 i 108 MiB). Reguła „nie dwie ciężkie rzeczy naraz" to obejmuje, ale
  wyłączenie tamtego stacku jest poza moim zakresem — to inny projekt. Nie ruszałem go
  i po `supabase stop` sprawdziłem, że nadal ma swoje 11 kontenerów.
- **Dwie usługi spoza listy `-x` są największe w odchudzonym stacku:** `storage-api`
  (235 MiB) i `pg_meta` (100 MiB) — razem 60% pamięci pozostałych sześciu kontenerów.
  W CI wyłączam obie i `db` przechodzi (`gen types` sam podnosi `pg_meta` na chwilę).
  Nie dopisuję ich do listy lokalnej samodzielnie, bo lista jest z zadania — do decyzji.

### Needs a decision

- **Czy dopisać `storage-api` i `postgres-meta` do lokalnej listy `-x`?** Zysk ~335 MiB
  z ~555 MiB, czyli stack schodzi do czterech kontenerów. Ryzyko: test dotykający Storage
  padnie, a `gen types --local` będzie za każdym razem podnosić `pg_meta` (kilka sekund
  narzutu). Dziś żaden test nie używa Storage. Rekomendacja: dopisać, bo 335 MiB na 3 GB
  VM to nie jest drobiazg — ale to zmiana listy, którą podałeś, więc nie robię jej sam.
- **`project_id` jest teraz równy refowi produkcji** (`uwxrstbplaoxfghrchcy`). Działa
  i niczego nie łączy z produkcją — to tylko nazwa lokalnych kontenerów — ale czyta się
  mylnie. Jeśli przeszkadza, alternatywą jest przestawienie kontenerów na nazwę
  `fjordanglers` kosztem skasowania lokalnej bazy (opcja B z pytania).

---

## Aneks 2 — decyzje tj z 17 IX, wykonane i zweryfikowane

Trzy decyzje odwracają albo rozszerzają ustalenia Aneksu 1. Poniżej każda z dowodem.

### 1. `project_id` zostaje `fjordanglers`

Rozjazd nazw naprawiony **przestawieniem kontenerów**, nie wpisaniem refu produkcji jako
nazwy lokalnej: `supabase stop` (przy starej etykiecie, więc zadziałał) → powrót
`config.toml` do wersji ze `stage-1` → `supabase start -x …`, który utworzył stack pod
nazwą z `config.toml`. Lokalna baza powstała od zera, migracje zaaplikowały się przy starcie.

```
$ git diff origin/stage-1 -- supabase/config.toml
(pusto — plik identyczny ze stage-1)

$ git diff origin/stage-1..HEAD --stat -- supabase/config.toml
(pusto — project_id nietkniety w calym PR)

$ docker ps --format '{{.Names}}' --filter label=com.supabase.cli.project=fjordanglers
supabase_auth_fjordanglers
supabase_db_fjordanglers
supabase_kong_fjordanglers
supabase_rest_fjordanglers
```

Historia gałęzi zawiera commit `00b792b3`, który tę zmianę wprowadzał, i `b01626c6`, który
ją cofa — netto zero, ale eksperyment zostaje widoczny.

**Ref produkcji jako nazwa czegoś lokalnego — audyt.** Uwaga metodologiczna: `grep`
w powłoce agenta jest funkcją opakowującą narzędzie, które **pomija pliki ignorowane przez
git**, więc pierwszy przebieg pokazał fałszywe „brak trafień". Wynik z `/usr/bin/grep`:

```
$ /usr/bin/grep -rn uwxrstbplaoxfghrchcy supabase/ .github/
supabase/.temp/project-ref:1:uwxrstbplaoxfghrchcy
supabase/.temp/pooler-url:1:postgresql://postgres.uwxrstbplaoxfghrchcy@aws-1-…
```

| trafienie | uzasadnienie |
|---|---|
| `supabase/.temp/project-ref` | ref **zdalnego** projektu, do którego repo jest zlinkowane — pisze go CLI, `supabase/.temp/` jest w `.gitignore`, nie jest to nazwa niczego lokalnego |
| `supabase/.temp/pooler-url` | j.w., adres poolera produkcji zapisany przez CLI; gitignorowany |
| `.github/` | zero trafień — workflow nie zna refu produkcji |

W `docs/` ref występuje jeszcze trzy razy i każde jest poprawne: `05-agent-operations.md:47`
(bramka STOP „any write to the production database"), `deferred-tasks.md:47` i `:59`
(historyczny opis, oba wpisy przekreślone i zamknięte). Poprawiłem natomiast **własny**
tekst z poprzedniej rundy, który opisywał odrzucony wariant jako obowiązujący: §9
i zamknięcie wpisu deferred FA-1.03.

**Osierocone zasoby — wypisane, nie usunięte.** Kontenerów zero (`supabase stop` je usuwa).
Wolumeny:

```
supabase_db_uwxrstbplaoxfghrchcy            164,9 MB   <- stara lokalna baza
supabase_edge_runtime_uwxrstbplaoxfghrchcy   46,8 MB
supabase_storage_uwxrstbplaoxfghrchcy            0 B
```

Razem ~212 MB. Nie kasuję — czekam na zgodę tj (dane lokalne, ale usunięcie nieodwracalne).
Dla porównania aktywny `supabase_db_fjordanglers` ma 98,8 MB.

### 2. Lista `-x` rozszerzona o `storage-api` i `postgres-meta`

Nazwy dokładnie takie, jak przyjmuje CLI 2.75 (`supabase start --help`: `gotrue, realtime,
storage-api, imgproxy, kong, mailpit, postgrest, postgres-meta, studio, edge-runtime,
logflare, vector, supavisor`).

**Bramka STOP — sprawdzona, warunek niespełniony.** `/usr/bin/grep -rn "\.storage\b\|storage\.from" src`
daje 16 trafień w `guide-photos.ts`, `offer-photos.ts`, `review-media.ts` i pięciu
komponentach. Z jedenastu plików testowych uruchamianych przez `pnpm test run` tylko
`authorization.test.ts` importuje którykolwiek z tych modułów — i mockuje cały
`@/lib/supabase/server` (`createClient` i `createServiceClient` to `vi.fn()`), a każda
asercja to `rejects.toBeInstanceOf(UnauthorizedError)`. Testowana ścieżka to **odmowa
autoryzacji przed dotknięciem Storage**, nie upload. Żaden test nie wychodzi do storage-api,
więc warunek „kod używa Storage w ścieżkach testowanych" nie jest spełniony. Dowód
empiryczny — pełny zielony przebieg przy wyłączonym `storage-api` — niżej.

```
supabase start -x studio,imgproxy,mailpit,logflare,vector,edge-runtime,realtime,storage-api,postgres-meta
```

| krok | wynik |
|---|---|
| `supabase stop` + `docker ps --filter label=…=fjordanglers -q \| wc -l` | `0` — stop zweryfikowany, nie uwierzony |
| `supabase start -x …` | `Started supabase local development setup.`, 29,7 s |
| kontenery | **4** (`db`, `kong`, `rest`, `auth`) zamiast 11 |
| `pnpm test run` | `Test Files 11 passed (11)` · `Tests 89 passed (89)` |
| `supabase db diff --local` | `No schema changes found` |
| `supabase gen types typescript --local` + `diff` | brak różnic |
| Seaclouds | 11 kontenerów, nietknięty przed i po |

Dokumentacja: lista w `docs/05-agent-operations.md` §9 zaktualizowana, dopisana linia
„zadanie dotykające zdjęć albo Storage startuje stack bez `storage-api` na liście `-x`".

### 3. OrbStack 4 GB — było już ustawione

```
$ orb config show | /usr/bin/grep -E '^(memory_mib|cpu):'
cpu: 8
memory_mib: 4096
$ docker info --format '{{.MemTotal}}'
4180443136            # 3,89 GiB — limit zastosowany, nie tylko zapisany
```

Spis etykiet przed planowanym restartem:

```
$ docker ps --filter label=com.supabase.cli.project \
      --format '{{.Label "com.supabase.cli.project"}}' | sort | uniq -c
  11 Seaclouds_management_system
   6 uwxrstbplaoxfghrchcy
```

`orb config set memory_mib 4096` **nie było potrzebne** — wartość już obowiązywała i oba
stacki działały, więc restartu OrbStacka nie robiłem. Tym samym ryzyko „Seaclouds nie wstanie
po restarcie" nie zaistniało; Seaclouds ma 11 kontenerów przez cały czas trwania zadania,
sprawdzane po każdym `supabase stop` i `start`. To drugi raz w tym zadaniu, kiedy zleconą
zmianę konfiguracji zastałem już wykonaną (pierwszy: `memory_mib: 3072`).

Dokumentacja: §9 mówi teraz 4 GB z uzasadnieniem (dwa stacki Supabase na jednej maszynie)
i z jawnym zastrzeżeniem, że host ma przez to ~4 GB, więc reguła „build tylko przy
zatrzymanym stacku FA" zostaje bez zmian — podniesienie limitu VM zabrało pamięć hostowi,
a build wykonuje host.

### CI po tych zmianach

Zielone: [35203329439](https://github.com/tj0517/Fjordanglers/actions/runs/35203329439)
(`b01626c6`), joby `check`, `db`, `sync`.

### Needs a decision

- **Usunąć trzy osierocone wolumeny `*_uwxrstbplaoxfghrchcy` (~212 MB)?** To stara lokalna
  baza sprzed przestawienia kontenerów. Nieodwracalne, ale wyłącznie lokalne — produkcji
  nie dotyczy. Rekomendacja: usunąć, bo nic już ich nie montuje, a nazwa myli
  (`docker volume rm` na tych trzech). Czekam na „tak".

---

## Załącznik — `.github/workflows/ci.yml` (stan finalny)

```yaml
# FjordAnglers CI — FA-1.11
#
# Trzy rzeczy, które przy paczce `stage-1` na jeden push są najgroźniejsze, i job,
# który każdą z nich łapie:
#
#   1. migracja, która nie aplikuje się na czysto   -> job `db`   (`supabase db reset`)
#   2. plik typów rozjechany ze schematem           -> job `db`   (`gen types --local` + diff)
#   3. `stage-1`, do którego nie trafił hotfix      -> job `sync` (`merge-base --is-ancestor`)
#
# Plus `check`: typecheck / lint / test / build.
#
# ŻADEN SEKRET. Wszystkie wartości env pochodzą z commitowanego `.env.test`
# (klucze lokalnego stacku Supabase są deterministyczne i identyczne u każdego,
# Stripe/Resend to placeholdery). `secrets.*` nie występuje w tym pliku ani razu —
# jedyny token to `GITHUB_TOKEN`, który Actions wstrzykuje samo i którego tu nie używamy.

name: CI

on:
  pull_request:
    branches: [main, stage-1]
  push:
    branches: [stage-1]

# Jeden przebieg na PR — kolejny push anuluje poprzedni.
concurrency:
  group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '10.30.3'
  # Ta sama wersja, na której pracuje zespół lokalnie. Nie podnosić bez sprawdzenia
  # `gen types` — zdalny i lokalny generator dają różny szkielet pliku (deferred FA-0.05).
  SUPABASE_CLI_VERSION: '2.75.0'

jobs:
  # ───────────────────────────────────────────────────────────────────────────
  # check — typecheck, lint, test, build
  # ───────────────────────────────────────────────────────────────────────────
  check:
    name: check
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # `next build` czyta `.env.local`. W CI nie ma sekretów, więc podstawiamy
      # commitowany `.env.test` — build ma dostać komplet zmiennych wymaganych
      # przez `src/lib/env.ts`, a nie prawdziwe klucze. Artefakt buildu nigdzie
      # nie jedzie: deploy robi Vercel z własnym env.
      - name: env for build (from committed .env.test — no secrets)
        run: |
          cp .env.test .env.local
          # Nazwy, nigdy wartości — i do logu, i do summary, żeby lista dała się
          # sprawdzić z przebiegu, a nie tylko z ekranu.
          names=$(grep -oE '^[A-Z0-9_]+' .env.test | sort)
          echo "zmienne z .env.test użyte w CI:"
          echo "$names"
          {
            echo '### Zmienne env użyte w CI'
            echo ''
            echo 'Źródło: commitowany `.env.test`. Zero `secrets.*`.'
            echo ''
            echo '```'
            echo "$names"
            echo '```'
          } >> "$GITHUB_STEP_SUMMARY"

      - name: typecheck
        run: pnpm typecheck

      # Lint NIE jest bramką, świadomie i tymczasowo: na `main` jest 40 błędów
      # w plikach spoza jakiegokolwiek bieżącego zadania (`src/emails/*.tsx`,
      # `whatsapp-bridge/poll-emails.mjs`) — patrz docs/deferred-tasks.md, wpis FA-1.03.
      # Bramka postawiona dziś byłaby czerwona zawsze i niczego by nie chroniła.
      # Po zamknięciu tamtego wpisu: usunąć `continue-on-error` i zwykły `run: pnpm lint`.
      - name: lint (nie blokuje — deferred „lint czerwony na main")
        id: lint
        continue-on-error: true
        run: pnpm lint 2>&1 | tee lint.out

      - name: lint — wynik do summary
        if: always()
        run: |
          {
            echo '### Lint (nie jest bramką)'
            echo ''
            echo '```'
            tail -n 5 lint.out 2>/dev/null || echo 'brak wyjścia'
            echo '```'
          } >> "$GITHUB_STEP_SUMMARY"

      - name: build
        run: pnpm build

  # ───────────────────────────────────────────────────────────────────────────
  # db — migracje aplikują się na czysto, typy bez dryfu, testy na świeżym stacku
  #
  # Tylko na PR: do `stage-1` i do `main` wchodzi się wyłącznie przez PR (ruleset),
  # więc ten sam przebieg na pushu byłby powtórką tego samego drzewa.
  # ───────────────────────────────────────────────────────────────────────────
  db:
    name: db
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - uses: supabase/setup-cli@v1
        with:
          version: ${{ env.SUPABASE_CLI_VERSION }}

      # Startujemy tylko to, czego dotykają testy: postgres + kong (API 54421) + postgrest.
      # Reszta kontenerów to kilka minut pobierania obrazów za nic.
      - name: supabase start
        run: |
          supabase start \
            -x gotrue,realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor

      # ── FAIL 1: migracja, która nie aplikuje się na czysto ────────────────
      - name: db reset — wszystkie migracje na pustej bazie
        run: supabase db reset

      # ── db diff: baza zgodna z katalogiem migracji ────────────────────────
      # Uwaga na uczciwość zapisu: tuż po `db reset` to jest prawie tautologia —
      # baza POWSTAŁA z tych migracji. Ten krok łapie realnie tylko migrację,
      # która po zastosowaniu zostawia schemat inny niż opisuje (np. DDL zależny
      # od czasu albo od stanu). Twardym dowodem na złą migrację jest krok wyżej.
      - name: db diff --local musi być pusty
        run: |
          set -euo pipefail
          supabase db diff --local > db-diff.out
          if [ -s db-diff.out ]; then
            echo "::error::supabase db diff --local nie jest pusty — schemat bazy odstaje od migracji"
            cat db-diff.out
            exit 1
          fi
          echo "db diff --local: pusty"

      # ── FAIL 2: plik typów rozjechany ze schematem ────────────────────────
      # Generator kanoniczny to `--local` (deferred FA-0.05: `--project-id` daje
      # inny szkielet pliku przy identycznym schemacie). Do pliku tymczasowego,
      # nigdy przekierowaniem na plik w repo — `>` obcina cel zanim komenda ruszy.
      - name: typy bez dryfu
        run: |
          set -euo pipefail
          supabase gen types typescript --local > "$RUNNER_TEMP/types.ts"
          if ! diff -u "$RUNNER_TEMP/types.ts" src/lib/supabase/database.types.ts > types.diff; then
            echo "::error::src/lib/supabase/database.types.ts odstaje od schematu — uruchom pnpm supabase:types:local"
            cat types.diff
            exit 1
          fi
          echo "typy zgodne ze schematem"

      # ── testy przeciwko świeżemu stackowi ─────────────────────────────────
      # Env bierze się z commitowanego `.env.test` — ładuje go `src/tests/setup.ts`,
      # razem z bezpiecznikiem „tylko 127.0.0.1" z FA-0.21. Workflow nic tu nie wstrzykuje.
      - name: pnpm test
        run: pnpm test run

  # ───────────────────────────────────────────────────────────────────────────
  # sync — FAIL 3: `main` wypada z gałęzi docelowej albo z gałęzi PR
  #
  # Dwa sprawdzenia, bo chronią przed dwiema różnymi rzeczami:
  #   (a) po zmergowaniu tego PR `stage-1` **nadal** nie zawierałby `main` —
  #       czyli hotfix z produkcji wypada z paczki etapu 1
  #   (b) gałąź PR wycięta przed tym hotfixem — autor pracuje na starym drzewie
  #
  # (a) pyta o wynik merge'a, nie o stan bazy: inaczej check blokowałby dokładnie
  # ten PR, który wciąga `main` do `stage-1` — a więc jedyną rzecz, która go naprawia
  # (zdarzyło się na PR #48; decyzja tj, 17 IX). `actions/checkout` na zdarzeniu
  # `pull_request` daje w HEAD merge commit: gałąź PR wmergowaną w bazę.
  # ───────────────────────────────────────────────────────────────────────────
  sync:
    name: sync
    if: github.event_name == 'pull_request' && github.base_ref == 'stage-1'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: main musi być przodkiem stage-1 i gałęzi PR
        env:
          BASE_REF: ${{ github.base_ref }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          set -uo pipefail
          git fetch --no-tags origin main "$BASE_REF"
          fail=0

          # (a) wynik merge'a — czym stanie się stage-1, gdy ten PR wejdzie
          if git merge-base --is-ancestor origin/main HEAD; then
            echo "ok: origin/main będzie przodkiem $BASE_REF po zmergowaniu tego PR"
          else
            fail=1
            echo "::error::$BASE_REF nie zawiera main i ten PR tego nie naprawia; zmerguj main do $BASE_REF"
            echo "  commity na main, których nie miałby $BASE_REF po tym merge'u:"
            git log --oneline "HEAD..origin/main"
          fi

          if git merge-base --is-ancestor origin/main "$HEAD_SHA"; then
            echo "ok: origin/main jest przodkiem gałęzi PR"
          else
            fail=1
            echo "::error::gałąź PR została wycięta przed ostatnim main; zmerguj main (albo $BASE_REF) do gałęzi"
            echo "  commity na main, których nie ma w gałęzi PR:"
            git log --oneline "$HEAD_SHA..origin/main"
          fi

          exit "$fail"
```
