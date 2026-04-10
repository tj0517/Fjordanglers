-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: icelandic_inquiry_form_defaults
-- Sets default inquiry_form_config for all icelandic experiences that have no
-- guide configuration yet (inquiry_form_config IS NULL or all fields excluded).
--
-- Default field statuses (order = INQUIRY_PRESET_FIELDS display order):
--   1. experience_level        → optional
--   2. fishing_method          → optional
--   3. target_species          → included  (required)
--   4. own_gear                → included  (required)
--   5. group_type              → excluded  (omitted from stored array)
--   6. accommodation           → optional
--   7. notes                   → optional
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE experiences
SET inquiry_form_config = '{
  "fields": [
    {"id": "experience_level", "status": "optional"},
    {"id": "fishing_method",   "status": "optional"},
    {"id": "target_species",   "status": "included"},
    {"id": "own_gear",         "status": "included"},
    {"id": "accommodation",    "status": "optional"},
    {"id": "notes",            "status": "optional"}
  ]
}'::jsonb
WHERE booking_type = 'icelandic'
  AND (
    inquiry_form_config IS NULL
    OR NOT (
         inquiry_form_config -> 'fields' @> '[{"status":"optional"}]'
      OR inquiry_form_config -> 'fields' @> '[{"status":"included"}]'
    )
  );
