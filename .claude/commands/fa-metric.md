---
description: Add or change one business metric end-to-end — definition, view/query, screen, test
argument-hint: <metric key or name, e.g. M10 time_to_offer>
---

Metric: $ARGUMENTS

A metric exists only when all four layers agree. Walk them in order; stop at the first
one that is not ready and say what is missing.

1. **Definition.** Find the metric in `docs/REBUILD_PLAN.md` §7 (id, formula, source,
   screen, target, FigJam section). If it is not there, it is not a metric yet — propose
   the row and stop. Check `docs/04-open-questions.md` for anything that blocks its
   definition (e.g. O-03, O-10); if blocked, stop.
2. **Catalogue entry** in `packages/core/metrics/` (today `src/lib/metrics/`): key, name
   (PL/EN), unit, formula as a function over the view or a SQL string, target, source,
   section, `since` date (first date the underlying data exists — e.g. events start).
   Delegate to `fa-core`.
3. **Data.** Which view or table feeds it? If a materialised view needs a column, add it
   via `fa-db` (`/fa-migrate`) with the refresh cron unchanged. Never compute in a
   component. For snapshot metrics (GA4, manual), the `metric_key` in `metric_snapshots`
   must equal the catalogue key.
4. **Test.** Vitest on the formula with a fixture that includes: empty input, one row,
   the edge that matters (a duration crossing a week boundary; a cohort with zero
   bookings; a currency mix). Medians not means; cohorts not period ratios.
5. **Screen.** Delegate to `fa-admin`: place it on the screen named in the definition,
   with target line, period selector, empty-state reason, and click-through to rows.
6. **Report** with: the catalogue entry, the query, the test names, a screenshot or
   rendered value for the last closed week, and the `since` date so the founders know
   how much history the number has.
