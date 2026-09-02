# ADR-0004 — Money as integer cents with the FX rate frozen per deal

**Status:** accepted 2026-08-31

## Context
Amounts are `NUMERIC` euros; ads are billed in PLN; the annual goal is in PLN; the
plan's unit economics are in USD; clients pay in USD/EUR/SEK/CAD and Stripe settles to
PLN. One global rate in `finance_settings` re-prices all history whenever it is edited.

## Decision
New money columns are `INTEGER` cents + `currency`. `deals.fx_rate_pln` is captured
from `fx_rates` (daily NBP/ECB) at `recognized_at` and never recomputed. Presentation
converts; storage never does.

## Consequences
- The commission counter toward 80 000 PLN is stable.
- Stage-4 backfill must decide how to price historical EUR rows (O-05).
- Every arithmetic on money goes through `packages/core/finance/money.ts`; no ad-hoc
  `* 100` in components.
