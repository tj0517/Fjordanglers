-- Add IBAN fields to guides table for manual payment model.
-- Used when a guide hasn't connected Stripe (or is in an unsupported country).
-- The payment_model itself is DERIVED in code from stripe_account_status —
-- these columns only store the bank details needed for the manual flow.

alter table guides
  add column if not exists iban               text     null,
  add column if not exists iban_holder_name   text     null,
  add column if not exists iban_bic           text     null,
  add column if not exists iban_bank_name     text     null;

comment on column guides.iban             is 'IBAN for direct angler→guide payment in manual payment model';
comment on column guides.iban_holder_name is 'Account holder name shown to angler for manual transfers';
comment on column guides.iban_bic         is 'BIC/SWIFT code for the IBAN — required for international SEPA transfers';
comment on column guides.iban_bank_name   is 'Optional bank name shown to angler for clarity';
