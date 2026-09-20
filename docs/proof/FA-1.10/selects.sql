\pset format aligned
\echo '=== 1. Commission to date (M1) — PLN'
SELECT round(sum(COALESCE(offer_deposit_eur, deposit_amount, internal_commission_eur, 0)
              * CASE WHEN deal_currency='USD' THEN (SELECT value::numeric FROM finance_settings WHERE key='usd_eur_rate') ELSE 1 END)
         * (SELECT value::numeric FROM finance_settings WHERE key='eur_pln_rate'), 2) AS commission_pln,
       count(*) AS paid_deposits
FROM inquiries WHERE deposit_paid_at IS NOT NULL AND deposit_paid_at >= '2026-01-01';

\echo '=== 2. Bookings in the month (M2) — this and previous Warsaw month'
SELECT to_char(date_trunc('month', deposit_paid_at AT TIME ZONE 'Europe/Warsaw'), 'YYYY-MM') AS month, count(*)
FROM inquiries WHERE deposit_paid_at IS NOT NULL GROUP BY 1 ORDER BY 1 DESC;

\echo '=== 3. Inquiries per ISO week, last 5 (Warsaw)'
WITH w AS (SELECT (date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - make_interval(weeks => g))::date AS wk FROM generate_series(0,4) g)
SELECT to_char(w.wk, 'IYYY"-W"IW') AS week, w.wk AS start, count(i.id) AS inquiries
FROM w LEFT JOIN inquiries i ON date_trunc('week', i.created_at AT TIME ZONE 'Europe/Warsaw')::date = w.wk
GROUP BY w.wk ORDER BY w.wk DESC;

\echo '=== 4. Qualified per ISO week (yes / no / unknown)'
WITH w AS (SELECT (date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - make_interval(weeks => g))::date AS wk FROM generate_series(0,4) g)
SELECT to_char(w.wk, 'IYYY"-W"IW') AS week,
       count(i.id) FILTER (WHERE i.qualified='yes') AS yes,
       count(i.id) FILTER (WHERE i.qualified='no') AS no,
       count(i.id) FILTER (WHERE i.qualified='unknown') AS unknown,
       count(i.id) AS total
FROM w LEFT JOIN inquiries i ON date_trunc('week', i.created_at AT TIME ZONE 'Europe/Warsaw')::date = w.wk
GROUP BY w.wk ORDER BY w.wk DESC;

\echo '=== 5. Ad spend per ISO week — PLN straight from ad_campaigns.spend'
WITH w AS (SELECT (date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - make_interval(weeks => g))::date AS wk FROM generate_series(0,4) g)
SELECT to_char(w.wk, 'IYYY"-W"IW') AS week, COALESCE(sum(a.spend), 0) AS spend_pln
FROM w LEFT JOIN ad_campaigns a ON date_trunc('week', a.date)::date = w.wk
GROUP BY w.wk ORDER BY w.wk DESC;
SELECT max(date) AS last_ad_date FROM ad_campaigns;

\echo '=== 6. Cost per inquiry / per qualified — paid-attributed (gclid or utm_medium cpc/paid) and all'
WITH w AS (SELECT (date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - make_interval(weeks => g))::date AS wk FROM generate_series(0,4) g),
sp AS (SELECT w.wk, COALESCE(sum(a.spend),0) AS spend FROM w LEFT JOIN ad_campaigns a ON date_trunc('week', a.date)::date = w.wk GROUP BY w.wk),
c AS (SELECT date_trunc('week', created_at AT TIME ZONE 'Europe/Warsaw')::date AS wk,
             count(*) AS all_i, count(*) FILTER (WHERE qualified='yes') AS all_q,
             count(*) FILTER (WHERE gclid IS NOT NULL OR lower(trim(utm->>'utm_medium')) IN ('cpc','paid')) AS att_i,
             count(*) FILTER (WHERE qualified='yes' AND (gclid IS NOT NULL OR lower(trim(utm->>'utm_medium')) IN ('cpc','paid'))) AS att_q
      FROM inquiries GROUP BY 1)
SELECT to_char(sp.wk, 'IYYY"-W"IW') AS week, sp.spend,
       COALESCE(c.att_i,0) AS paid_inq, COALESCE(c.att_q,0) AS paid_qual,
       round(sp.spend / NULLIF(c.att_i,0), 2) AS paid_per_inq, round(sp.spend / NULLIF(c.att_q,0), 2) AS paid_per_qual,
       COALESCE(c.all_i,0) AS all_inq, COALESCE(c.all_q,0) AS all_qual,
       round(sp.spend / NULLIF(c.all_i,0), 2) AS all_per_inq, round(sp.spend / NULLIF(c.all_q,0), 2) AS all_per_qual
FROM sp LEFT JOIN c ON c.wk = sp.wk ORDER BY sp.wk DESC;

\echo '=== 7. Cumulative conversion (M7 approx.)'
SELECT count(*) FILTER (WHERE deposit_paid_at IS NOT NULL) AS booked, count(*) AS inquiries,
       round(100.0 * count(*) FILTER (WHERE deposit_paid_at IS NOT NULL) / NULLIF(count(*),0), 1) AS pct
FROM inquiries WHERE created_at >= '2026-01-01';

\echo '=== 8. Lost reasons, last 90 days (updated_at proxy)'
SELECT COALESCE(lost_reason_code, 'no code') AS reason, count(*)
FROM inquiries WHERE status='lost' AND updated_at > now() - interval '90 days'
GROUP BY lost_reason_code ORDER BY count(*) DESC, lost_reason_code NULLS LAST;
