# Runbook — production database backup

Run this before anything that touches the schema at scale (Stage 1 table drops,
Stage 4 `inquiries` rewrite), and periodically otherwise. Takes ~10 minutes.

## 0. Before you start

Confirm the project ref by hand — do **not** trust `supabase/.temp/project-ref`,
it is local CLI link state and has been wrong before without anyone noticing.
Production is documented in `CLAUDE.md` / `NEXT_PUBLIC_SUPABASE_URL` as `<PROJECT_REF>`.
Get `SUPABASE_DB_PASSWORD` from the password manager — never from a file in this repo,
never from chat, never pasted into a script.

## 1. Run the backup

```bash
export SUPABASE_DB_PASSWORD="<from password manager>"
bash scripts/db-backup.sh <PROJECT_REF>
```

This writes `backups/<YYYYMMDD-HHMM>/schema.sql.gz`, `data.sql.gz`, and a `SHA256SUMS`
file with checksums for both. `backups/` is gitignored — nothing here is ever committed.

## 2. Where to store the dump

`TODO(tj): storage` — the dump must be copied off this machine before it's a real
backup. Not decided yet; see the FA-0.08 report for three options with a recommendation.
Until this is decided, keep the `backups/<timestamp>/` folder and don't delete it.

## 3. Verify the dump

```bash
cd backups/<timestamp>
sha256sum -c SHA256SUMS                              # both files must say OK
zcat schema.sql.gz | grep -c "CREATE TABLE"           # should roughly match table count
zcat schema.sql.gz | grep "CREATE TABLE public.inquiries"   # must find exactly one line
```

Then re-run `scripts/db-baseline.sql` (paste into Supabase SQL Editor) and compare
row counts against the last saved `docs/audit/db-row-counts-*.md` — they should match
what was in the database at dump time, not drift by more than ongoing traffic explains.

## 4. Restore to a new Supabase project

1. Create the new project in the Supabase dashboard, note its ref.
2. `pnpm supabase link --project-ref <NEW_REF> -p <NEW_PASSWORD>`
3. `gunzip -k backups/<timestamp>/schema.sql.gz backups/<timestamp>/data.sql.gz`
4. `psql "<new project db-url>" -f backups/<timestamp>/schema.sql`
5. `psql "<new project db-url>" -f backups/<timestamp>/data.sql`
6. Run `scripts/db-baseline.sql` against the new project and diff against the source
   dump's row counts (step 3) — they must match exactly.

## 5. If the dump breaks midway

`scripts/db-backup.sh` writes into a fresh timestamped `backups/<YYYYMMDD-HHMM>/`
directory each run, so a partial run never overwrites a good prior backup. If it
fails partway through:

1. Delete the partial timestamped folder (`rm -r backups/<that-timestamp>/` — this is
   a local, gitignored file, not a repo file, so this is not the "no rm" rule from
   the task's STOP gates).
2. Check `SUPABASE_DB_PASSWORD` is still exported (it does not persist across shells).
3. Re-run `scripts/db-backup.sh <PROJECT_REF>` — it starts clean, no partial-state
   handling needed since nothing from the failed run is reused.
