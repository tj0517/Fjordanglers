-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: inquiries_add_phone
--
-- Adds angler_phone to inquiries so FA can reach anglers via WhatsApp.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS angler_phone TEXT;
