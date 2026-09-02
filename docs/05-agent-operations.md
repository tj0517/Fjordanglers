# Agent operations

How AI agents (Claude Code and Cowork) work in this repo. This is the contract between
the founders and the agents. Read it once per session.

## 1. The loop

```
docs/tasks/FA-x.yy.md ──▶ /fa-task (Claude Code) or fa-task (Cowork) builds the prompt
        │
        ▼
agent works on branch ──▶ report (format §5) ──▶ PR
        │
        ▼
/fa-review or fa-review (Cowork) ──▶ coverage table: proven / declared / uncovered
        │
        ▼
founder merges ──▶ task status → done in the task file + INDEX.md
```

One task = one branch = one PR. The agent never starts a second task in the same
session without being told to. Tasks are files in `docs/tasks/`; there is no other
backlog. Notion holds the business plan, not the engineering tasks.

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
