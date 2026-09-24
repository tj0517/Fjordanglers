# Agent operations

How AI agents (Claude Code and Cowork) work in this repo. This is the contract between
the founders and the agents. Read it once per session.

## 1. The loop

```
docs/tasks/FA-x.yy.md ──▶ wf-task (Claude app, repo agent-workflow) builds a self-contained prompt
        │
        ▼
agent works on branch ──▶ report (format §5) ──▶ PR
        │
        ▼
wf-review (Claude app) ──▶ coverage table: proven / declared / uncovered
        │
        ▼
founder merges ──▶ task status → done in the task file + INDEX.md
```

Since 2026-09-22 prompts and reviews come from the shared `wf-*` skills (tj's
`agent-workflow` repo, project context `projects/fa/project.md`), the same for every
project. The prompt carries branch and status housekeeping itself — the agent does **not**
run `/fa-task`. `/fa-task`, `/fa-review` and `.claude/agents/fa-reviewer.md` stay in the
repo: the reviewer checklist (§5 of that file) is still read by every review.

One task = one branch = one PR. The agent never starts a second task in the same
session without being told to. The agent never pushes to `main` directly and never
merges a PR — merges are done by the founder (tj). Tasks are files in `docs/tasks/`; there is no other
backlog. Notion holds the business plan, not the engineering tasks.

**Sync rule:** Po każdym merge stage-1 → main natychmiast PR zwrotny main → stage-1
(bramka `sync` w CI wymaga, żeby stage-1 zawierał HEAD main — bez tego check jest
czerwony dla każdej gałęzi opartej na stage-1).

**Bramka martwego kodu i lintu:** `pnpm knip` i `pnpm lint` blokują PR od FA-1.08 —
oba kroki w `ci.yml` straciły `continue-on-error`, bo oba zeszły do zera. Nowy
nieużywany eksport, nowy błąd lintu i nieużywana dyrektywa `eslint-disable`
(skrypt `lint` ma `--report-unused-disable-directives`) czerwienią CI.

## 2. Models and effort

Default model is set in `.claude/settings.json`. Subagents override in their frontmatter.
Task files carry a `difficulty` and the recommended model; **the human decides per task**
whether to spend the bigger model, based on weekly usage.

| Difficulty | Typical task | Model | Effort | Approval |
|---|---|---|---|---|
| S | one file, one rule, no schema | Sonnet | low–medium | none |
| M | a feature slice, a migration with no data move | Sonnet | medium–high | none |
| L | cross-cutting refactor, migration with backfill, state machine | Opus | high | none (default for L) |
| XL | stage-4 schema refactor, monorepo extraction, anything touching production data irreversibly | Opus by default; **Fable only if tj approves for this task** | max | required — recorded in the task file as `model_approved: fable by tj <date>` |

Planning (`fa-architect`) and review (`fa-reviewer`) run on Opus regardless of the task's
implementation model; a wrong plan or a missed regression costs more than the tokens.
`fa-task` (Cowork) asks for consent before recommending Opus-max or Fable and says why.

## 3. STOP gates

The agent halts and asks before any of these, even if the task seems to imply it:

- any write to the production database (`uwxrstbplaoxfghrchcy`) — `db push`, `execute_sql`
  with anything but SELECT, `apply_migration`
- `migration repair`, editing or deleting an existing migration file, rewriting history
- dropping a table or column, deleting rows, deleting files
- changing secrets, tokens, env vars in Vercel, Supabase Auth settings, Stripe webhooks
- changing a function or enum referenced by an RLS policy (show the diff against the
  baseline first)
- anything listed under "Out of scope" in the task that turns out to block progress

A STOP is a message that names the action, the reason and the exact command, then waits.
`scripts/agent-guard.sh` (PreToolUse hook) additionally blocks the most dangerous shell
patterns unless `FA_ALLOW_PROD=1` is set for that command.

## 4. Reading before writing

The first checklist item of every task is "read the current state of X". For the
database that means a query now, not the types file, not the migration folder, not memory.
For code it means opening the file, not recalling it. A report that says "the table has
columns A, B, C" without a query output is a *declared* claim, not a *proven* one, and
`fa-review` will mark it so.

## 5. Report format

Every task ends with this, pasted into the PR description:

```
## Report — FA-x.yy <task name>

### Done
- <item> — evidence: <command + output excerpt / query result / test name>

### Not done
- <item> — why

### Noticed, not touched (→ docs/deferred-tasks.md)
- <thing> — where — why it matters

### Needs a decision
- <question> — options — my recommendation

### Verification
<paste of the verification commands and their output, including the red case for any new guard>
```

"Done" without evidence is "declared". The reviewer's whole job is telling those apart.

### Uczciwość zapisu

Dokumentacja zapisuje tylko to, co się wydarzyło. Nie wpisuj zgody, której nie dostałeś
w tej rozmowie — otwarty STOP zapisuj jako otwarty. Nie przypisuj narzędziu weryfikacji,
której nie wykonuje (`db diff` porównuje bazę z migracjami, nie z plikiem typów; zielone CI
nie dowodzi, że funkcja działa; wiersz wstawiony psql-em nie dowodzi zachowania aplikacji).
Jeśli dowodu nie ma — napisz „niezweryfikowane", nie uzasadnienie.

Obie pomyłki brzmią wiarygodnie i obie przechodzą przez review, jeśli nikt nie sprawdzi
źródła — dlatego są tu wymienione osobno, a nie jako przypis do „Done vs declared".

## 6. Scope discipline

Things noticed on the way — a bug next door, a dead file, a nicer abstraction — go to
`docs/deferred-tasks.md` with file path and one line of why, and nowhere else. Fixing
them in the current PR is the single most common way an agent PR becomes unreviewable.

Exception: if the noticed thing makes the task's acceptance criteria unachievable, stop
and say so; do not silently widen the scope.

## 7. Secrets

The agent never prints an env value, key or token, even to "check it is set" — check
with `test -n "$VAR"`. Service-role keys do not belong in local env files (O-11). If a
tool output contains a secret, the agent does not repeat it in the report.

### MCP servers (`.mcp.json`, committed — no secrets inside)

The agent's MCP servers are pinned to this repo in `.mcp.json` (generated from tj's
`agent-workflow/projects/fa/project.md`). Values live only in your shell (`~/.zshrc`):

- `GITHUB_TOKEN` — fine-grained PAT, this repo only (server `github`)
- `STRIPE_RESTRICTED_KEY` — Stripe **restricted key, Read only** (server `stripe`); never `sk_live`
- Supabase (`supabase-prod`, read-only) uses OAuth: in Claude Code run `/mcp` → Authenticate once.

Check: `bash ~/Documents/agent-workflow/bin/mcp-doctor.sh fa`.

## 8. Subagents

| Agent | Use when | Model |
|---|---|---|
| `fa-architect` | a task needs a plan before code: sequencing, file list, risks, split into sub-tasks | Opus |
| `fa-db` | migrations, RLS, backfills, types regeneration, `db diff` | Sonnet (Opus for L/XL) |
| `fa-core` | repositories, use-cases, guards, state machine, events, metrics catalogue | Sonnet (Opus for L/XL) |
| `fa-admin` | admin screens, views → UI, charts, weekly review | Sonnet |
| `fa-web` | public site, guide portal, token pages, webhooks' HTTP layer | Sonnet |
| `fa-reviewer` | after a task: acceptance-criteria coverage, red proofs, DB claims by query | Opus |

Subagents are invoked by the slash commands or explicitly; each one's file says what it
must read first and what it must never do.

**Exception — inventory + execution in one session.** When a task has a Phase A
(inventory / classification, ending in a STOP) and a Phase B (executing the accepted
list) and both run in the same session, the agent that built the classification also
implements it. Handing a per-file classification table to a subagent costs more context
than it saves and loses the evidence gathered in Phase A. `fa-core` / `fa-web` / `fa-admin`
are for tasks that start from a written spec, not from a table the agent just produced.
(Rule since FA-1.06, 2026-09-05.)

## 9. Lokalne środowisko (8 GB RAM)

Maszyna tj ma 8 GB RAM, a OrbStack dostaje z tego 4 GB (`memory_mib: 4096`, limit działa —
`docker info` pokazuje 3,89 GiB). Cztery, nie trzy, bo na tej maszynie stoją **dwa** stacki
Supabase — FjordAnglers i drugi projekt — a trzy gigabajty na oba oznaczały wypychanie
kontenerów na swap. Skutek uboczny: macOS i wszystko poza Dockerem dzielą pozostałe ~4 GB,
więc reguła „build tylko przy zatrzymanym stacku FA" **zostaje bez zmian** — podniesienie
limitu VM zabrało pamięć hostowi, a to host wykonuje build. Build Next.js i pełny stack
Supabase nadal nie mieszczą się w tym budżecie równocześnie: OrbStack padł z tego powodu
dwa razy w dwa dni (16–17 IX). Poniższe reguły są warunkiem, nie sugestią.

**Stack startuje wyłącznie odchudzony.**

```
supabase start -x studio,imgproxy,mailpit,logflare,vector,edge-runtime,realtime,storage-api,postgres-meta
```

Pełnego `supabase start` nie używamy. Zostają **cztery** kontenery (`db`, `kong`, `rest`,
`auth`) zamiast jedenastu. Jeśli któraś z wyłączonych usług okaże się potrzebna — błąd przy
starcie albo w teście — usuń ją z listy **tutaj**, w tym pliku, i w raporcie napisz dlaczego.
Lista ma jedno miejsce prawdy.

**Zadanie dotykające zdjęć albo Storage startuje stack bez `storage-api` na liście `-x`.**
Dziś żaden test z `pnpm test run` nie wychodzi do Storage (`authorization.test.ts` importuje
`guide-photos` / `offer-photos` / `review-media`, ale mockuje `@/lib/supabase/server`
i sprawdza wyłącznie odmowę autoryzacji), więc domyślnie `storage-api` jest wyłączony —
to najcięższy kontener w stacku (235 MiB). `postgres-meta` CLI podnosi sam na chwilę,
kiedy potrzebuje go `gen types --local`.

**`pnpm build` lokalnie tylko przy zatrzymanym stacku.**

```
supabase stop  →  pnpm build  →  supabase start -x …
```

Domyślnie build weryfikuje CI (job `check`); w raporcie wystarczy link do zielonego runu
zamiast lokalnego outputu buildu. Uwaga na dwie rzeczy, które łatwo pomylić: `--max-old-space-size=2048`
siedzi w skrypcie **`dev`**, nie w `build` — `next build` nie ma żadnego pułapu sterty,
więc rośnie, dopóki system pozwala. Zmierzony szczyt RSS procesu głównego przy
zatrzymanym stacku: 1,44 GiB (plus workery generujące strony statyczne, które `time -l`
liczy osobno).

**Przed każdą komendą na stacku sprawdź, czy Docker żyje.**

```
perl -e 'alarm 10; exec @ARGV' -- docker ps --format '{{.Names}}' | head -3
```

Na tej maszynie **nie ma `timeout` ani `gtimeout`** (brak coreutils), więc `timeout 10 docker ps`
nie zadziała — stąd wariant z perlem, który jest wszędzie na macOS. Pusty wynik albo
zawieszenie = OrbStack leży → `orb restart`, odczekaj, ponów **raz**. Drugi raz nie działa
→ STOP, zgłoś tj. Nie diagnozuj kodu, dopóki środowisko nie żyje.

**Test integracyjny z `fetch failed` albo timeoutem na `127.0.0.1:54421` to najpierw
problem środowiska**, a dopiero potem błąd kodu. Kolejność: sprawdź Dockera (wyżej),
potem `supabase status`, dopiero potem czytaj test. 17 IX `inquiryStatusDefault.test.ts`
przekroczył 5 s i wyglądał jak regresja — w rzeczywistości wisiał sam `docker ps`.

**Nie uruchamiaj równolegle dwóch rzeczy ciężkich pamięciowo** — build, Playwright, drugi
stack Supabase. Drugi stack to nie teoria: 17 IX obok FjordAnglers chodził komplet
jedenastu kontenerów innego projektu, razem 22 kontenery w jednym VM.

**`supabase stop` musi zostać sprawdzony, nie uwierzony.** Do 17 IX kontenery lokalnego
stacku nosiły etykietę projektu wziętą ze **starego** źródła — `supabase/.temp/project-ref`,
tak jak robiło starsze CLI — a nie z `project_id` w `config.toml`. CLI 2.75 szuka po
`project_id`, więc `supabase stop` nie znajdywał niczego, wypisywał „Stopped supabase local
development setup." i **zostawiał cały stack działający**. To jest najbardziej prawdopodobna
przyczyna obu awarii OrbStacka: build startował przy stacku, o którym wszyscy myśleli, że
jest zatrzymany.

Naprawione **przez przestawienie kontenerów**, nie przez zmianę `project_id`: stack
zatrzymany i wystartowany od nowa, więc CLI utworzyło go pod nazwą z `config.toml`
(`supabase_db_fjordanglers` itd.). `project_id` zostaje `fjordanglers` — ref produkcji nie
jest nazwą niczego lokalnego (decyzja tj, 17 IX). Od tej zmiany `stop`, `start`,
`db diff --local` i `gen types --local` działają bez żadnego obejścia. Mimo to po
`supabase stop` warto rzucić okiem:

```
docker ps --filter label=com.supabase.cli.project=fjordanglers -q | wc -l    # ma być 0
```

Uwaga przy takich sprawdzeniach: `grep` w powłoce agenta bywa funkcją opakowującą
narzędzie, które **pomija pliki ignorowane przez git**, więc „brak trafień" potrafi być
fałszywy. Do audytu używaj `/usr/bin/grep`.

## 10. Lokalne dema i dowody działania (.fa-proofs/)

**Dema nigdy przez prawdziwego dostawcę. Decyzja tj (21 IX).**

Każdy skrypt w `.fa-proofs/` musi:
1. Przerywać na starcie, gdy wymagana flaga fake nie jest ustawiona.
2. Uruchamiać się wyłącznie z odpowiednią flagą fake w env procesu.

**Reguły per kanał:**

| Kanał   | Wymagana flaga         | Co sprawdza adapter               |
|---------|------------------------|-----------------------------------|
| Email   | `RESEND_DEV_FAKE=1`    | `channels/email.ts` — zwraca fake `externalId`, bez API call do Resend |
| WhatsApp | `WA_DEV_FAKE=1`       | (gdy zostanie dodany adapter WA)  |

Skrypty startują z guardem:
```typescript
if (process.env.RESEND_DEV_FAKE !== '1') {
  console.error('STOP: set RESEND_DEV_FAKE=1 before running this proof script')
  process.exit(1)
}
```

**Dlaczego:** Klucz `re_…` w `.env.local` to prawdziwy klucz Resend. Bez flagi każdy
skrypt dowodowy wysyła do prawdziwego API — tak stało się w rundzie 2 FA-1.14, gdzie
wiadomość trafiła na `piotr@example.invalid` przez prawdziwe konto Resend.

Bramka STOP dla agenta: **jakakolwiek wysyłka z `.fa-proofs/` bez odpowiedniej flagi fake
→ STOP** (tak samo jak zapis na prod).

## 11. Środowisko dev (`fjordanglers-dev`)

Projekt Supabase `fjordanglers-dev` (plan Free, ta sama organizacja co prod) jest
odizolowaną bazą dla Vercel Preview. Preview wskazuje na dev, nie na produkcję —
wszystkie kliknięcia testowe są bezpieczne.

**Drabina środowisk:** local → dev → prod.

### Odtworzenie środowiska dev

Jeśli projekt dev zostanie usunięty lub uśpiony:

1. Utwórz nowy projekt `fjordanglers-dev` w Supabase Dashboard (plan Free, ta sama
   organizacja, ten sam region co prod `uwxrstbplaoxfghrchcy`).
2. Wejdź w Settings → Database → Connection string → **Session pooler** (port 5432) → skopiuj URL.
   Zapisz do `~/.config/fa/dev.env` (poza repo, `chmod 600`):
   ```
   DEV_DB_URL=postgresql://...
   ```
   W każdej komendzie używaj: `set -a; . ~/.config/fa/dev.env; set +a; <command>`.
   Nigdy nie echuj, nie commituj, nie pisz nigdzie indziej.
3. Zastosuj migracje bez zmiany linku repo (pełna forma z env-file):
   ```
   set -a; . ~/.config/fa/dev.env; set +a
   supabase db push --db-url "$DEV_DB_URL"
   ```
   (guard blokuje to polecenie agentowi — robi człowiek)
4. Zaaplikuj seed:
   ```
   set -a; . ~/.config/fa/dev.env; set +a
   psql "$DEV_DB_URL" -f supabase/seed.sql
   ```
5. W Supabase Dashboard → Authentication → URL Configuration ustaw:
   - Site URL: główny alias Preview projektu Vercel (`https://<project>.vercel.app`)
   - Allowed Redirect URLs — **zawęzione do tego projektu** (nie `*.vercel.app` — zbyt szerokie):
     ```
     https://fjordanglers-*-tymon-jezionek.vercel.app/**
     https://fjordanglers-git-*-tymon-jezionek.vercel.app/**
     ```
     (scope `tymon-jezionek`, projekt `fjordanglers` — z `vercel ls`, 24 IX 2026)
6. W Vercel zaktualizuj zmienne Preview (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) na nowy projekt.

**Plan Free usypia projekt po ~1 tygodniu bez ruchu.** Aby obudzić: wejdź na
`app.supabase.com`, kliknij projekt, Restore. Kilka sekund i jest gotowy.

**`db push` na dev** robi człowiek (nie CI) do czasu FA-1.20, który to automatyzuje.
Agent przygotowuje komendę i czeka na potwierdzenie — guard ją blokuje.

### Zmienne Preview po FA-1.18

Klucz | Wartość
`NEXT_PUBLIC_SUPABASE_URL` | dev projekt
`NEXT_PUBLIC_SUPABASE_ANON_KEY` | dev projekt
`SUPABASE_SERVICE_ROLE_KEY` | dev projekt (server-only!)
`STRIPE_SECRET_KEY` | `sk_test_…` (test mode)
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` (test mode)
`STRIPE_WEBHOOK_SECRET` | placeholder (brak endpointu Stripe dla Preview — D3)
`RESEND_DEV_FAKE` | `1` (kanał email.ts omija Resend)
`RESEND_API_KEY` | placeholder (nie-działający) — `src/lib/email.ts` ignoruje
`RESEND_DEV_FAKE`; wysyłki transakcyjne (confirmation, deposit-link, password-reset)
padają przechwyconym błędem na Preview. Reset hasła nie wysyła na Preview.

Pozostałe zmienne — decyzje tj z FA-1.18 (data + co zrobić przy każdej).

### Gałęzie `chore/*` i buildy Preview

Od FA-1.18 `chore/*` jest usunięte z `git.deploymentEnabled` w `vercel.json`.
Gałęzie `chore/*` dostają Preview tak samo jak `fix/*` i `feat/*`.
Gałęzie, które wciąż nie dostają Preview: `docs/*`, `staging`, `preview`.
Commity docs-only (tylko `docs/**`, `.claude/**`, `*.md`) nie budują Preview — Ignored
Build Step wykrywa to i zwraca `exit 0` (`scripts/vercel-ignore-build.sh`).
