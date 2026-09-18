#!/usr/bin/env bash
# FA-1.12 Playwright UI walk — runner script
#
# Starts pnpm dev with LOCAL Supabase credentials (not production),
# runs the Playwright spec, then kills the dev server.
#
# Prerequisites:
#   supabase start -x studio,imgproxy,mailpit,logflare,vector,edge-runtime,\
#                     realtime,storage-api,postgres-meta
#
# Usage:
#   bash scripts/proofs/run-fa-1.12-ui-walk.sh

set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"

# ── Local Supabase credentials (same for every `supabase start`) ──────────────
LOCAL_URL="http://127.0.0.1:54421"
LOCAL_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
LOCAL_SRK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

# Stripe webhook secret — the same value is used when signing in the spec and
# when verifying in the dev server.
STRIPE_WH="whsec_test_local_fa112"

# RESEND_INBOUND_SECRET is intentionally NOT set here.
# The dev server picks it up from .env.local, and the spec also reads it from
# .env.local (see readEnvLocal() in the spec).  This guarantees they match
# without us needing to copy the secret into the run script.
#
# RESEND_DEV_FAKE=1 makes the emailAdapter skip the Resend API, so new
# sendMessage calls (messages.ts / emailAdapter path) create DB rows and emit
# message.sent without hitting the real Resend service.

echo "==> Starting pnpm dev (local Supabase, port 3000) …"

NEXT_PUBLIC_SUPABASE_URL="$LOCAL_URL" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$LOCAL_ANON" \
SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SRK" \
STRIPE_WEBHOOK_SECRET="$STRIPE_WH" \
STRIPE_WEBHOOK_SECRET_DEPOSIT="$STRIPE_WH" \
RESEND_DEV_FAKE="1" \
  pnpm dev &

DEV_PID=$!
trap "echo '==> Killing dev server (PID $DEV_PID)'; kill $DEV_PID 2>/dev/null" EXIT

echo "==> Waiting for dev server on port 3000 …"
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || true)
  if [[ "$code" == "200" || "$code" == "307" ]]; then
    echo "==> Dev server ready (HTTP $code)"
    break
  fi
  sleep 2
done

echo "==> Running Playwright spec …"

NEXT_PUBLIC_SUPABASE_URL="$LOCAL_URL" \
SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SRK" \
STRIPE_WEBHOOK_SECRET="$STRIPE_WH" \
  npx playwright test scripts/proofs/fa-1.12-ui-walk.spec.ts "$@"
