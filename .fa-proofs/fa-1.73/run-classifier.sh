#!/usr/bin/env bash
# Qualifier old-vs-new label. No database is used (stubbed); the Supabase values only satisfy the env schema.
# Recreates ./old/ (main's extract-trip + inquiry-agent, the OLD "Experience requested" label) from origin/main.
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ -n "${ANTHROPIC_ENV_FILE:-}" ]]; then set -a; . "$ANTHROPIC_ENV_FILE"; set +a; fi
mkdir -p .fa-proofs/fa-1.73/old
git show origin/main:src/lib/ai/extract-trip.ts > .fa-proofs/fa-1.73/old/extract-trip.ts
git show origin/main:src/lib/ai/inquiry-agent.ts | sed "s#'@/lib/ai/extract-trip'#'./extract-trip'#" > .fa-proofs/fa-1.73/old/inquiry-agent.ts
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x
export STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy
export RESEND_API_KEY=re_dummy NEXT_PUBLIC_APP_URL=http://localhost:3000 RESEND_DEV_FAKE=1
exec node node_modules/vitest/vitest.mjs run --config .fa-proofs/fa-1.73/vitest.classifier.config.mts
