# ADR-0002 — Monorepo with one data layer for web and admin

**Status:** accepted 2026-08-31

## Context
65 files call `.from()` directly; four different data-fetching styles coexist; admin pages
and public pages query the same tables with different ad-hoc selects; server actions have
no authorisation. The public site and the admin panel need the same definitions of
inquiry, booking, commission — and today they do not share a line of code.

## Decision
pnpm workspaces + Turborepo. `apps/web` (fjordanglers.com) and `apps/admin`
(admin.fjordanglers.com) both depend on `packages/core`, which owns every repository,
use-case, guard and metric definition, and on `packages/db`, which is the only package
that imports Supabase. ESLint enforces the boundaries.

Alternatives rejected: one Next.js app with route groups (cheaper, but the admin's
service-role usage and the public site's edge/caching needs pull in opposite
directions, and a separate admin domain makes the access allowlist trivial); Supabase
RPC/RLS as the whole API (puts business logic in SQL, hard to test).

## Consequences
- Stage 2 is pure plumbing with no user-visible change; it must still ship.
- Every table gets exactly one repository file. "Where is this used" becomes one grep.
- Two Vercel projects, two deploys, shared Supabase.
