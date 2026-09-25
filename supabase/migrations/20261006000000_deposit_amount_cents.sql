-- FA-1.28: deposit amount in minor units + currency + frozen FX rate
-- Payment-link columns are empty here; FA-1.29 populates them.
-- Legacy deposit_amount (numeric, EUR) is intentionally kept for commission.ts fallback.

ALTER TABLE inquiries
  ADD COLUMN deposit_amount_cents     BIGINT,
  ADD COLUMN deposit_currency         CHAR(3)
    CONSTRAINT deposit_currency_check
    CHECK (deposit_currency IN ('EUR','USD','ISK','NZD')),
  ADD COLUMN deposit_eur_rate         NUMERIC,
  ADD COLUMN deposit_eur_rate_at      TIMESTAMPTZ,
  ADD COLUMN deposit_payment_link_id  TEXT,
  ADD COLUMN deposit_payment_link_url TEXT;

-- All-or-nothing: the four amount/rate columns must be set together or not at all.
ALTER TABLE inquiries
  ADD CONSTRAINT deposit_cents_all_or_nothing CHECK (
    (deposit_amount_cents IS NULL) = (deposit_currency IS NULL) AND
    (deposit_amount_cents IS NULL) = (deposit_eur_rate IS NULL) AND
    (deposit_amount_cents IS NULL) = (deposit_eur_rate_at IS NULL)
  );

-- Positive values only when set.
ALTER TABLE inquiries
  ADD CONSTRAINT deposit_cents_positive CHECK (
    deposit_amount_cents IS NULL OR deposit_amount_cents > 0
  ),
  ADD CONSTRAINT deposit_eur_rate_positive CHECK (
    deposit_eur_rate IS NULL OR deposit_eur_rate > 0
  );

COMMENT ON COLUMN inquiries.deposit_amount_cents IS
  'Deposit amount in minor units ×100 for every currency (EUR cents, USD cents, ISK ×100, NZD cents — same convention as offer_options.price_cents). Integer minor units; never float.';

COMMENT ON COLUMN inquiries.deposit_currency IS
  'ISO 4217 currency of the deposit (always uppercase). Must match the accepted offer option''s currency.';

COMMENT ON COLUMN inquiries.deposit_eur_rate IS
  '1 EUR = X units of deposit_currency (ECB via frankfurter at deposit_eur_rate_at); EUR amount = deposit_amount_cents / rate / 100. For EUR deposits: 1. Frozen at the moment the admin sets the amount (CLAUDE.md rule 6).';

COMMENT ON COLUMN inquiries.deposit_eur_rate_at IS
  'Timestamp when deposit_eur_rate was fetched and frozen.';

COMMENT ON COLUMN inquiries.deposit_payment_link_id IS
  'Stripe Payment Link id (plink_…). Set by FA-1.29 when the link is created.';

COMMENT ON COLUMN inquiries.deposit_payment_link_url IS
  'Full Stripe Payment Link URL. Set by FA-1.29 when the link is created.';
