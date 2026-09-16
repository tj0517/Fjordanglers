-- Fix inquiries.status column default.
-- The July 2026 migration (migrations_archive/20260708_inquiry_status_update.sql)
-- renamed pending_fa_review → pending in both rows and the check constraint,
-- but did not update the column default. Every INSERT without an explicit status
-- has been violating inquiries_status_check since then.
ALTER TABLE inquiries ALTER COLUMN status SET DEFAULT 'pending';
