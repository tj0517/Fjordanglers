#!/usr/bin/env bash
# Dumps a Supabase Postgres project's schema, public data, auth/storage data, and
# cluster roles — gzips all four, and writes a SHA256SUMS file alongside them.
#
# `supabase db dump` excludes Supabase-managed schemas by default: "The ignored
# schemas include auth, storage, and those created by extensions."
# (https://supabase.com/docs/reference/cli/supabase-db-dump). A plain schema+data
# dump therefore has no auth.users, no auth.identities, and no role grants — restoring
# from it alone leaves no one able to log in and RLS policies with nothing to match
# against. Hence the extra --schema auth,storage and --role-only passes below.
#
# The project ref is a REQUIRED argument or PROJECT_REF env var — this script
# deliberately does NOT use `supabase db dump --linked` on its own. supabase/.temp/project-ref
# is local CLI link state, not a source of truth for which project this is, and it
# has been known to point at the wrong project for months without anyone noticing
# (see docs/RUNBOOK-backup.md). An explicit ref forces whoever runs this to look
# up the right one instead of trusting a stale link file.
#
# Requires SUPABASE_DB_PASSWORD in the environment (never printed, never logged,
# never passed as a CLI flag — that would put it in argv, visible to any `ps` on
# this machine; the Supabase CLI reads SUPABASE_DB_PASSWORD from the environment
# on its own).
#
# NOTE: `supabase link` below overwrites supabase/.temp/project-ref with the ref
# you pass here. That's the intended effect (it's what makes the ref correct
# again) but it means the CLI is left linked to whatever you passed — see
# docs/RUNBOOK-backup.md.
#
# Usage: scripts/db-backup.sh <PROJECT_REF>
#    or: PROJECT_REF=<ref> scripts/db-backup.sh
set -euo pipefail

REF="${1:-${PROJECT_REF:-}}"

if [ -z "$REF" ]; then
  echo "ERROR: project ref is required — pass it as \$1 or set PROJECT_REF." >&2
  echo "This is deliberate: supabase/.temp/project-ref is local link state, not" >&2
  echo "confirmed prod. Look up the correct ref before running this script." >&2
  exit 1
fi

if [ -n "${SUPABASE_DB_PASSWORD:-}" ]; then
  echo "SUPABASE_DB_PASSWORD: set"
else
  echo "SUPABASE_DB_PASSWORD: MISSING" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M)"
OUT_DIR="backups/${STAMP}"
mkdir -p "$OUT_DIR"

echo "Dumping project ${REF} → ${OUT_DIR}/"

# Explicit link to the given ref — never --linked on its own, which would trust
# whatever supabase/.temp/project-ref happens to hold (see header comment above).
pnpm supabase link --project-ref "$REF"

# No --schema-only flag exists in the Supabase CLI: `db dump` with no data flag
# IS the schema-only dump (it excludes auth/storage/extension schemas by default).
pnpm supabase db dump --linked \
  -f "${OUT_DIR}/schema.sql"

pnpm supabase db dump --linked \
  --data-only -f "${OUT_DIR}/data.sql"

# Supabase-managed schemas, excluded from the two dumps above by default.
pnpm supabase db dump --linked \
  --schema auth,storage --data-only -f "${OUT_DIR}/auth-storage-data.sql"

# Cluster roles (grants) — RLS-relevant, not included in any schema dump.
pnpm supabase db dump --linked \
  --role-only -f "${OUT_DIR}/roles.sql"

gzip "${OUT_DIR}/schema.sql" "${OUT_DIR}/data.sql" "${OUT_DIR}/auth-storage-data.sql" "${OUT_DIR}/roles.sql"

(cd "$OUT_DIR" && sha256sum schema.sql.gz data.sql.gz auth-storage-data.sql.gz roles.sql.gz > SHA256SUMS)

echo "Done. Contents of ${OUT_DIR}:"
ls -la "$OUT_DIR"
