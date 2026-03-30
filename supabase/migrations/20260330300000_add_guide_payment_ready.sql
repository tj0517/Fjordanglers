-- Add payment_ready generated column to guides.
--
-- TRUE  when guide has active Stripe Connect OR a saved IBAN number.
-- FALSE when neither is configured — guide cannot receive any payout.
--
-- This is a STORED generated column: Postgres recomputes it automatically
-- on every INSERT/UPDATE; never write to it directly.

alter table guides
  add column if not exists payment_ready boolean
    generated always as (
      (
        stripe_account_id is not null
        and stripe_charges_enabled = true
        and stripe_payouts_enabled = true
      )
      or
      (iban is not null and iban <> '')
    ) stored;

comment on column guides.payment_ready
  is 'Auto-computed. true = guide has active Stripe Connect OR saved IBAN. Never write directly.';

-- Index so admin queries (filter no_payment) are fast even at scale
create index if not exists guides_payment_ready_idx on guides (payment_ready);
