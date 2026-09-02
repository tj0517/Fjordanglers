# ADR-0001 — Agency model, not a marketplace

**Status:** accepted 2026-08-31

## Context
The original plan (April 2026, archived `docs/archive/CLAUDE-v1-marketplace.md`) was a
two-sided marketplace: anglers book self-serve, Stripe Connect splits the money, guides
get payouts. It was never built. What was built, and what earns money, is an inquiry desk:
angler asks → FA qualifies and matches → FA sends an offer in the guide's name → angler
pays a deposit (= FA's fee, 20% on top of the guide's price) to FA's own Stripe account →
angler pays the guide directly. FA never holds client funds, which also keeps it outside
payment-institution regulation.

## Decision
The agency flow is the product. The schema, the code and the documentation describe it
and nothing else. Marketplace tables (`bookings`, `payments` v1, Stripe Connect fields on
`guides`) are dropped, not kept "in case".

## Consequences
- `inquiries` (→ `offers`, `payments`, `deals`) is the core; there is no `bookings`.
- No payouts, no balance charges, no cancellation engine in scope.
- `payments.kind` keeps `balance` and `refund` as values so the schema does not need to
  change if the model ever extends — but nothing implements them.
