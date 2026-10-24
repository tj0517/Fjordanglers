-- FA-1.71 — how a testimonial photo is shown: across the top, or down the side
--
-- Why: the banner (FA-1.69) crops every photo into a 180px strip across the top of the card.
-- A client photo is as often portrait as landscape, and a portrait one in that strip is a
-- chest and a pair of hands. tj wants the choice in the admin rather than guessed from the
-- file (2026-10-24): FA uploads the photo, so FA decides, and the decision survives a photo
-- swap.
--
-- What: one column with two values. `horizontal` is what every existing row already shows,
-- so the default keeps the five testimonials on prod looking exactly as they do now — the
-- column is NOT NULL with that default and needs no backfill.
--
-- No RLS change: the table keeps "enabled, no policy" from FA-1.68, and the column is read
-- through the service role like every other public column.

ALTER TABLE public.testimonials
  ADD COLUMN photo_layout TEXT NOT NULL DEFAULT 'horizontal';

-- A list of values is a CHECK, never an enum type (docs/03-conventions.md).
ALTER TABLE public.testimonials
  ADD CONSTRAINT testimonials_photo_layout_check
    CHECK (photo_layout IN ('horizontal', 'vertical'));

COMMENT ON COLUMN public.testimonials.photo_layout IS
  'How the banner shows the photo: horizontal = a strip across the top of the card, vertical = down the side with the quote beside it. Set in /admin/testimonials; means nothing when photo_url IS NULL.';
