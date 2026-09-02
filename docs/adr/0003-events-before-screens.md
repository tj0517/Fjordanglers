# ADR-0003 — Record events before anything reads them

**Status:** accepted 2026-08-31

## Context
Eight of the twenty-five metrics on the 2026 plan are about time and transitions (time to
offer, manual touches per booking, weeks to live, cohort conversion). The database stores
states, not events; five of ten statuses are set by hand. None of these metrics can be
computed for the past, ever.

## Decision
`inquiry_events` (append-only, actor-stamped) is created in stage 1 and written to by
every domain mutation from that day, with no UI reading it until stage 5–6. `transition()`
becomes the only way to change `inquiries.status`. `stage_reached` becomes a cache of
the event stream.

## Consequences
- History starts accumulating in September, so the first weekly reviews of the winter
  season have data.
- A repository method that changes state without emitting is a bug, enforced by review.
- The metrics layer (views, catalogue) can be built later without touching writers.
