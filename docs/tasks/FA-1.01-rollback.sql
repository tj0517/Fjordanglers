-- FA-1.01 Phase B — Rollback plan for Step 1 (migration repair --status reverted)
--
-- USE ONLY if Step 1 or Step 3 of Phase B partially failed or if you need to
-- restore schema_migrations to the pre-Phase-B state.
--
-- Run as:
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" \
--     -f docs/tasks/FA-1.01-rollback.sql
--
-- After running: verify count = 38, then STOP and report to tj.
-- Do NOT proceed with Phase B after rollback — treat as failed Phase B.
--
-- Source: SELECT version, name FROM supabase_migrations.schema_migrations
--         ORDER BY version; run on 2026-09-04 during FA-1.01 Phase A.
-- schema_migrations columns: version text PK, statements text[], name text,
--   created_by text, idempotency_key text UNIQUE, rollback text[]

BEGIN;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('20260309154301', 'add_location_coords_to_experiences',              '{}'),
  ('20260313125203', 'add_guide_profile_columns',                       '{}'),
  ('20260313125204', 'add_experience_trip_columns',                     '{}'),
  ('20260314205947', 'add_landscape_url_to_experiences',                '{}'),
  ('20260315111628', 'extend_booking_status_enum',                      '{}'),
  ('20260315111629', 'add_booking_payment_columns',                     '{}'),
  ('20260315111630', 'create_trip_inquiries',                           '{}'),
  ('20260315120358', 'add_location_area_to_experiences',                '{}'),
  ('20260315200000', 'add_booking_type_to_experiences',                 '{}'),
  ('20260315210000', 'add_guide_images',                                '{}'),
  ('20260315220000', 'make_price_nullable_for_icelandic',               '{}'),
  ('20260315230000', 'add_both_booking_type',                           '{}'),
  ('20260316000000', 'add_landscape_url_to_guides',                     '{}'),
  ('20260316000001', 'add_social_urls_to_guides',                       '{}'),
  ('20260316171516', 'cleanup_experiences_add_packages',                '{}'),
  ('20260317150718', 'make_bookings_angler_nullable',                   '{}'),
  ('20260612123117', 'lead_messages',                                   '{}'),
  ('20260612143616', 'unmatched_messages',                              '{}'),
  ('20260625121435', 'add_deal_currency_to_inquiries',                  '{}'),
  ('20260702095048', 'add_assigned_guide_to_inquiries',                 '{}'),
  ('20260702105041', 'simplify_calendar_to_available_dates',            '{}'),
  ('20260702111410', 'rename_available_to_unavailable_dates',           '{}'),
  ('20260702125051', 'guide_trip_brief_todos',                          '{}'),
  ('20260702195913', 'simplify_trip_details_fields',                    '{}'),
  ('20260703083126', 'guide_offer_response_fields',                     '{}'),
  ('20260703084107', 'guide_options_replace_location_price',            '{}'),
  ('20260703084856', 'drop_guide_description_column',                   '{}'),
  ('20260703085912', 'create_offer_photos_bucket',                      '{}'),
  ('20260703091923', 'add_confirmed_date_party_size_to_trip_details',   '{}'),
  ('20260703093751', 'add_guide_offer_eta_to_inquiries',                '{}'),
  ('20260703110956', 'add_guide_final_dates_to_trip_details',           '{}'),
  ('20260703114757', 'add_external_offer_sent_to_inquiries',            '{}'),
  ('20260707114355', 'ad_campaign_defs_google_id',                      '{}'),
  ('20260708090020', 'inquiry_agent_state',                             '{}'),
  ('20260708133046', 'offer_options',                                   '{}'),
  ('20260708154121', 'reviews',                                         '{}'),
  ('20260708155000', 'reviews_media',                                   '{}'),
  ('20260708163723', 'reviews_trip_description',                        '{}')
ON CONFLICT (version) DO UPDATE
  SET name       = EXCLUDED.name,
      statements = EXCLUDED.statements;

-- Verify
SELECT count(*) AS row_count FROM supabase_migrations.schema_migrations;
-- Expected: 38. If not 38 → STOP, do not continue.

COMMIT;
