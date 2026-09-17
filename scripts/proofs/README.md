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

## Files

| File | Task | What it proves |
|---|---|---|
| `fa-1.03-walk.mts` | FA-1.03 | Status machine: `new → paid` through 6 transitions + Stripe webhook |
| `fa-1.12-walk.mts` | FA-1.12 | Messages thread: send to angler & guide, offer flow, payment, handed_over |
| `stubs/next-headers.mts` | all | Cookie jar + header store on globalThis |
| `stubs/next-cache.mts` | all | No-op `revalidatePath`, `revalidateTag`, `unstable_cache` |
| `tsconfig.proof.json` | all | Path aliases: `@/*` → `../src/*`; `next/headers` → stub |
