This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environments

| Environment | Database | Who builds it | Purpose |
|---|---|---|---|
| **local** | Local Supabase stack (`127.0.0.1:54421`) | developer | feature work, tests, manual verification |
| **dev** (`fjordanglers-dev`) | Supabase project `fjordanglers-dev` (Free plan) | Vercel Preview | visual review, demos, safe test clicks |
| **prod** (`uwxrstbplaoxfghrchcy`) | Supabase project `fjordanglers-prod` | `main` branch on Vercel | live product |

**Vercel Preview** points at **dev**, not production. Previews build on `fix/*`, `feat/*` and `chore/*` branches; docs-only commits are skipped by the Ignored Build Step set inline in Vercel (same logic as `scripts/vercel-ignore-build.sh`, see docs/05 §11). Crons run only in production.

Preview uses Stripe test keys (`sk_test_…`) and `RESEND_DEV_FAKE=1`. Transactional emails (`src/lib/email.ts`) use a non-working placeholder `RESEND_API_KEY` on Preview — password reset and deposit-link emails fail silently on Preview (by design).

Seed accounts on dev: `admin@seed.test` (admin) and `angler@seed.test` (angler) — passwords in the comment at the top of `supabase/seed.sql`.

See `docs/05-agent-operations.md` §11 for how to recreate dev and what to do when Free plan sleeps the project.

## Local development against a local database

`.env.local` points at **production**, so a bare `pnpm dev` reads and writes production data. Put the local stack's URL and keys (from `supabase status`) in `.env.development.local` — gitignored, and Next.js loads it before `.env.local` in dev mode — and start the stack with the `-x` list from `docs/05-agent-operations.md` §9. Don't start the dev server from a shell that exported `.env.local` (`dev.sh` does): variables already in the process environment beat every `.env*` file.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Skipping builds for docs-only commits

`scripts/vercel-ignore-build.sh` checks the diff between a commit and its parent, and
exits `0` (build **skipped**) when every changed path falls under `docs/**`, `.claude/**`
or `*.md` — otherwise it exits `1` and the build proceeds. `vercel.json`'s `git.deploymentEnabled`
also turns off deployments entirely on `docs/*` branches, and on the unused
`staging`/`preview` branches; task branches (`fix/*`, `feat/*`, `chore/*`) deploy previews.

**For tj:** for the script to actually run, paste `bash scripts/vercel-ignore-build.sh`
into Vercel → Project Settings → Git → Ignored Build Step. The script sitting in the repo
does nothing on its own until that field is set.
