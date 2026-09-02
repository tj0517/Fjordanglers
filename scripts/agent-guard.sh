#!/usr/bin/env bash
# PreToolUse hook for Claude Code (matcher: Bash).
# Blocks shell commands that could damage production or history unless FA_ALLOW_PROD=1
# is set for that specific invocation. Exit 2 = block with message; exit 0 = allow.
set -euo pipefail
input="$(cat)"
cmd="$(printf '%s' "$input" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || true)"
[ -z "$cmd" ] && exit 0
if [ "${FA_ALLOW_PROD:-0}" = "1" ]; then exit 0; fi
patterns=(
  'supabase db push'
  'supabase db reset'
  'supabase migration repair'
  'supabase migration squash'
  'db push --linked'
  'uwxrstbplaoxfghrchcy.*(DROP|DELETE|TRUNCATE|ALTER)'
  '(DROP|TRUNCATE) (TABLE|SCHEMA)'
  'git push .*--force'
  'git push .*-f( |$)'
  'git reset --hard origin'
  'rm -rf (supabase/migrations|packages/db)'
  'vercel env (rm|add)'
  'stripe .* --live'
)
for p in "${patterns[@]}"; do
  if printf '%s' "$cmd" | grep -Eiq "$p"; then
    echo "BLOCKED by scripts/agent-guard.sh — matches '$p'." >&2
    echo "This is a STOP gate (docs/05-agent-operations.md §3). Ask the human; if approved, rerun with FA_ALLOW_PROD=1 prefixed to this single command." >&2
    exit 2
  fi
done
exit 0
