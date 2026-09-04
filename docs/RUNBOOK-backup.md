# Runbook — production database backup

Run this before anything that touches the schema at scale (Stage 1 table drops,
Stage 4 `inquiries` rewrite), and periodically otherwise. Takes ~10 minutes.

## 0. Before you start

Confirm the project ref by hand — do **not** trust `supabase/.temp/project-ref`,
it is local CLI link state and has been wrong before without anyone noticing.
Production is confirmed (tj, 2026-09-04): **`uwxrstbplaoxfghrchcy`**.
Get `SUPABASE_DB_PASSWORD` from the password manager — never from a file in this repo,
never from chat, never pasted into a script.

## 1. Run the backup

```bash
export SUPABASE_DB_PASSWORD="<from password manager>"
bash scripts/db-backup.sh uwxrstbplaoxfghrchcy
```

This writes to `backups/<YYYYMMDD-HHMM>/`: `schema.sql.gz`, `data.sql.gz`,
`auth-storage-data.sql.gz` (the `auth`/`storage` schemas — excluded from the plain
schema/data dump by default, see script header), `roles.sql.gz` (cluster role grants),
and a `SHA256SUMS` file with checksums for all four. `backups/` is gitignored — nothing
here is ever committed.

**Side effect:** running this leaves the Supabase CLI linked to whatever ref you passed
(`supabase link --project-ref <ref>` runs internally, overwriting
`supabase/.temp/project-ref`). That's the correct outcome — the ref file now points at
the project you actually backed up — but FA-1.01 (`supabase db pull --linked`) inherits
whatever is linked at the time it runs, so don't assume it's still stale after this.

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

Restore order matters — schema before data, `public` before `auth`/`storage`, roles
last (roles carry grants that reference objects created by the earlier steps):

1. Create the new project in the Supabase dashboard, note its ref.
2. `pnpm supabase link --project-ref <NEW_REF>` (CLI reads `SUPABASE_DB_PASSWORD`
   from the environment — do not pass `-p` on the command line, it ends up in `ps`.)
3. `gunzip -k backups/<timestamp>/*.sql.gz`
4. `psql "<new project db-url>" -f backups/<timestamp>/schema.sql`
5. `psql "<new project db-url>" -f backups/<timestamp>/data.sql`
6. `psql "<new project db-url>" -f backups/<timestamp>/auth-storage-data.sql`
7. `psql "<new project db-url>" -f backups/<timestamp>/roles.sql`
8. Run `scripts/db-baseline.sql` against the new project and diff against the source
   dump's row counts (step 3 of §3) — they must match exactly.

**Known risk, not confirmed as solved:** Supabase's own backup/restore guide
(`docs/guides/platform/migrating-within-supabase/backup-restore`) only documents
restoring *custom modifications* to the `auth`/`storage` schemas ("If you have
modified the `auth` and `storage` schemas in your old project, such as adding
triggers or Row Level Security (RLS) policies, you have to restore them separately")
— it does not document restoring core auth data (`auth.users`, `auth.identities`)
into a different project, and does not mention `instance_id` or identity-linking
behavior at all. I found no confirmed Supabase-documented procedure for this. Treat
step 6 above as **untested** until it's been run once against a throwaway project —
do that before Stage 4, not for the first time during a real incident.

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
