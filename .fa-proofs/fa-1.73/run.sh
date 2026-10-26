#!/usr/bin/env bash
# FA-1.73 proof runner. Supabase values come from the LOCAL stack (`supabase status`), never from .env.local.
# Stripe / Resend values are dummies (the env schema requires them; nothing here calls those services).
# The Anthropic key is taken from the caller's environment, or from ANTHROPIC_ENV_FILE (a file that holds
# only an ANTHROPIC_API_KEY=... line). It is never printed.
#   gate (prints the URL, writes nothing):  .fa-proofs/fa-1.73/run.sh
#   real run:   PROOF_URL_APPROVED=http://127.0.0.1:54421 .fa-proofs/fa-1.73/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ -n "${ANTHROPIC_ENV_FILE:-}" ]]; then set -a; . "$ANTHROPIC_ENV_FILE"; set +a; fi
eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy
export RESEND_API_KEY=re_dummy NEXT_PUBLIC_APP_URL=http://localhost:3000 RESEND_DEV_FAKE=1
if [[ -z "${ANTHROPIC_API_KEY:-}" && "${PROOF_URL_APPROVED:-}" != "" ]]; then echo "ANTHROPIC_API_KEY not set" >&2; exit 1; fi
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-unset}"
exec node node_modules/vitest/vitest.mjs run --config .fa-proofs/fa-1.73/vitest.config.mts
