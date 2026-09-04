-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: inquiries_add_selected_option
--
-- Stores which trip option (e.g. "Full Day Trip") the angler selected when
-- submitting an inquiry from an experience page with multiple options.
-- Nullable — inquiries from pages without options leave this NULL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS selected_option TEXT;
