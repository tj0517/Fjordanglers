# scripts/proofs — acceptance-criterion proofs

End-to-end walks that prove acceptance criteria through the application's own
entry points (server actions and route handlers), never raw SQL.

## How it works

The proof scripts run via `tsx` against the local Supabase stack (port 54422).
They import Next.js server actions directly; the module-path aliases in
`tsconfig.proof.json` remap `next/headers` and `next/cache` to lightweight
stubs so cookie-based auth and cache revalidation work offline.

**Key subtlety — cookie/header sharing:**  
`next/headers` exports (`cookies()`, `headers()`) are normally bound to the
request context. In the proof environment we have no request context, so the
stubs maintain state on `globalThis`. Both the proof script and any server
action it imports resolve to the *same stub file* (Node's ESM cache), so the
cookie jar is shared and `requireAdmin()` sees the session the script set.

## Running a proof

```bash
# stack must be running
supabase start -x studio,imgproxy,mailpit,logflare,vector,edge-runtime,realtime,storage-api,postgres-meta

# run with explicit tsconfig (important — the paths alias is there)
npx tsx --tsconfig scripts/proofs/tsconfig.proof.json scripts/proofs/fa-1.03-walk.mts
npx tsx --tsconfig scripts/proofs/tsconfig.proof.json scripts/proofs/fa-1.12-walk.mts
```

## Safety fuse

Every walk checks `NEXT_PUBLIC_SUPABASE_URL` begins with `127.0.0.1` or
`localhost` and throws immediately if not — so accidentally running against
production is impossible.

## Running the Playwright UI walk (FA-1.12)

`fa-1.12-ui-walk.spec.ts` drives a real browser through the admin panel.
It requires a running **local** Supabase stack AND a dev server pointed at
that local stack.  Use the helper script which wires everything up:

```bash
# 1. Start local Supabase (light set, no Studio/Edge/Realtime)
supabase start -x studio,imgproxy,mailpit,logflare,vector,edge-runtime,\
               realtime,storage-api,postgres-meta

# 2. Run the full walk (starts pnpm dev with local env, runs Playwright, kills dev)
bash scripts/proofs/run-fa-1.12-ui-walk.sh

# Pass extra Playwright flags after --:
bash scripts/proofs/run-fa-1.12-ui-walk.sh --reporter=line
bash scripts/proofs/run-fa-1.12-ui-walk.sh --headed   # watch in browser
```

The script sets `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421` (and the
matching anon / service-role keys) before starting `pnpm dev`, so the dev
server talks to the local stack, not production.  A safety fuse in the spec
throws immediately if the URL is not `127.0.0.1` / `localhost`.

**Expected output (2026-09-18 baseline run — 22 s):**

```
── inquiry_events ─────────────────────────────────────────
  status.changed|app|app        ← new → waiting_guide
  status.changed|app|app        ← → offer_presented  (NOTE A)
  status.changed|app|app        ← → awaiting_payment (NOTE A)
  payment.received|stripe|webhook
  status.changed|stripe|webhook ← → paid (from deposit webhook)
  status.changed|app|app        ← → handed_over

 total events: 6
 final status: handed_over

 NOTE: full ≥10 event count requires markAsGuideOffer / markOfferPresented /
       markClientAccepted wired to UI (none exist yet). See NOTE A in spec.
       For 18-event walk: scripts/proofs/fa-1.12-walk.mts
```

The email-inbound step logs HTTP 401 (HMAC secret mismatch between local
`.env.local` Resend secret and the test value) — this is expected and the
test does not assert on that step's status.

## Files

| File | Task | What it proves |
|---|---|---|
| `fa-1.03-walk.mts` | FA-1.03 | Status machine: `new → paid` through 6 transitions + Stripe webhook |
| `fa-1.12-walk.mts` | FA-1.12 | Messages thread: send to angler & guide, offer flow, payment, handed_over |
| `fa-1.12-ui-walk.spec.ts` | FA-1.12 | Playwright browser walk: admin panel `new → handed_over` |
| `run-fa-1.12-ui-walk.sh` | FA-1.12 | Runner: starts local dev server + Playwright, kills dev server on exit |
| `stubs/next-headers.mts` | all | Cookie jar + header store on globalThis |
| `stubs/next-cache.mts` | all | No-op `revalidatePath`, `revalidateTag`, `unstable_cache` |
| `tsconfig.proof.json` | all | Path aliases: `@/*` → `../src/*`; `next/headers` → stub |
