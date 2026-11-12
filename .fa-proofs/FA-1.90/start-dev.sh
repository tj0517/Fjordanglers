#!/usr/bin/env bash
# FA-1.90 — dev server on port 3001 for the before/after link counts and screenshots.
#   usage: .fa-proofs/FA-1.90/start-dev.sh <worktree dir>     (the 5550c79 checkout or the branch)
# Every variable is set in the process env, which beats every .env* file (@next/env fills only
# undefined keys), so the same environment serves "before" and "after" and nothing can reach prod:
#   Supabase   → the local stack (URL fixed; keys from `supabase status`, never printed)
#   e-mail     → RESEND_DEV_FAKE=1 and the placeholder RESEND_API_KEY from .env.test
#   AI         → AI_AUTO_REPLY_ENABLED=false, ANTHROPIC_API_KEY unset (optional in env.ts; no key, no call)
#   rate limit → UPSTASH_* empty (limiter off, no Redis call)
#   GTM        → NEXT_PUBLIC_GTM_ID empty; the Ads tag is blocked in the Playwright context
#   Stripe     → CI's placeholders (env.ts requires them; no page here calls Stripe)
# The Stripe/Resend placeholders are read from the committed .env.test (the values CI's
# `check` job builds with), so no key-shaped string lives in this script (gitleaks, `secrets` job).
set -eu
dir=${1:?worktree dir}
cd "$dir"
eval "$(supabase status -o env 2>/dev/null | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=')"
for k in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY RESEND_API_KEY; do
  v=$(grep -E "^${k}=" .env.test | head -1 | cut -d= -f2-)
  v=${v%\"}; v=${v#\"}
  [ -n "$v" ] || { echo "STOP: $k missing in .env.test" >&2; exit 1; }
  export "$k=$v"
done
unset ANTHROPIC_API_KEY
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export NEXT_PUBLIC_APP_URL=http://localhost:3001
export RESEND_DEV_FAKE=1
export EXPERIENCE_V2_ENABLED=true
export AI_AUTO_REPLY_ENABLED=false
export UPSTASH_REDIS_REST_URL=
export UPSTASH_REDIS_REST_TOKEN=
export RATE_LIMIT_SALT=
export NEXT_PUBLIC_GTM_ID=
export NODE_OPTIONS='--max-old-space-size=2048'
exec ./node_modules/.bin/next dev --turbo -p 3001
