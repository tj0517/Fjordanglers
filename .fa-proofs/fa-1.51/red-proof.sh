#!/usr/bin/env bash
# FA-1.51 red proof: run the sync tests with each trigger disabled in turn.
# Local stack only (LOCAL_DB = LOCAL_PG of scripts/proofs/fa-1.12-ui-walk.spec.ts).
# The trigger is re-enabled on every exit path.
set -u
cd "$(dirname "$0")/../.."
LOCAL_DB='postgresql://postgres:postgres@127.0.0.1:54422/postgres'
OUT=.fa-proofs/fa-1.51

run() { # <table> <trigger> <log>
  local table="$1" trigger="$2" log="$3"
  trap 'psql "$LOCAL_DB" -q -c "ALTER TABLE public.'"$table"' ENABLE TRIGGER '"$trigger"'"' RETURN
  psql "$LOCAL_DB" -q -c "ALTER TABLE public.$table DISABLE TRIGGER $trigger"
  echo "== $trigger DISABLED ($table) ==" | tee "$log"
  psql "$LOCAL_DB" -t -A -c "select tgname||' enabled='||tgenabled::text from pg_trigger where tgname='$trigger'" | tee -a "$log"
  pnpm vitest run experience-guides-sync 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "^ *(✓|×|✗|FAIL)|Tests |Test Files|AssertionError|Error:" | tee -a "$log"
}

run experience_pages  trg_sync_guide_id   "$OUT/red-trg_sync_guide_id.log"
run experience_guides trg_sync_primary    "$OUT/red-trg_sync_primary.log"
run experience_pages  trg_sync_price_from "$OUT/red-trg_sync_price_from.log"

echo "== after: all triggers back on =="
psql "$LOCAL_DB" -t -A -c "select tgname||' enabled='||tgenabled::text from pg_trigger where tgname like 'trg_sync%' order by 1" | tee "$OUT/red-after-enabled.log"
