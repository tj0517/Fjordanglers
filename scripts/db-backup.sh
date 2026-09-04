#!/usr/bin/env bash
# Dumps a Supabase Postgres project's schema and data separately, gzips both,
# and writes a SHA256SUMS file alongside them.
#
# The project ref is a REQUIRED argument or PROJECT_REF env var — this script
# deliberately does NOT use `supabase db dump --linked`. supabase/.temp/project-ref
# is local CLI link state, not a source of truth for which project this is, and it
# has been known to point at the wrong project for months without anyone noticing
# (see docs/RUNBOOK-backup.md). An explicit ref forces whoever runs this to look
# up the right one instead of trusting a stale link file.
#
# Requires SUPABASE_DB_PASSWORD in the environment (never printed, never logged).
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
pnpm supabase link --project-ref "$REF" -p "$SUPABASE_DB_PASSWORD"

pnpm supabase db dump --linked -p "$SUPABASE_DB_PASSWORD" \
  --schema-only -f "${OUT_DIR}/schema.sql"

pnpm supabase db dump --linked -p "$SUPABASE_DB_PASSWORD" \
  --data-only -f "${OUT_DIR}/data.sql"

gzip "${OUT_DIR}/schema.sql" "${OUT_DIR}/data.sql"

(cd "$OUT_DIR" && sha256sum schema.sql.gz data.sql.gz > SHA256SUMS)

echo "Done. Contents of ${OUT_DIR}:"
ls -la "$OUT_DIR"
