---
description: Walk a schema change safely — read current state, write the migration, diff, red-proof, types
argument-hint: <short description of the change>
---

Change requested: $ARGUMENTS

Delegate to `fa-db` and make it follow this sequence; do not skip a step because it
"obviously" passes.

1. **Current state by query.** For every table touched: columns, constraints, policies,
   indexes, triggers (`information_schema.columns`, `pg_constraint`, `pg_policy`,
   `pg_indexes`, `pg_trigger`). Paste the results. Compare with `supabase/migrations/`
   and `database.types.ts`; report any drift **before** writing anything.
2. **Backup gate.** If the change drops, renames or rewrites data: state the `pg_dump`
   command, and STOP until the human confirms a dump exists.
3. **Write the migration** with `supabase migration new <verb_object>`. One concern per
   file; DDL separate from backfill. New table ⇒ RLS + policy + COMMENT in the same file.
   Money = integer cents + currency. Lists = CHECK. Follow `docs/03-conventions.md`.
4. **Apply locally / on a Supabase branch only.** Never production in this command.
5. **`supabase db diff`** → must be empty. Paste it.
6. **Red proof** for every new constraint / policy / trigger: the exact statement that
   violates it and the error text. Paste it.
7. **Regenerate types** (`pnpm supabase:types`), show `git diff --stat` of the types
   file, run `pnpm typecheck`.
8. **Update docs** if the change alters the target model: `docs/02-data-model.md`
   (and `docs/REBUILD_PLAN.md` §5 if it is a plan change — say so, do not do it silently).
9. **Report**: migration file path, what it does, what it does not do, the diff result,
   the red proofs, and the exact STOP request if production apply is next.

Production apply (`db push` to `uwxrstbplaoxfghrchcy`) is never part of this command.
It is a separate, explicit human action after review.
