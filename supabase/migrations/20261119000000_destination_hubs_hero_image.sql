-- Hub redesign (2026-11): a hero photo per hub, set by hand in /admin/hubs (tj, 2026-11-17).
-- Empty = the page falls back to the newest offer's photo, then to the default canyon photo.
--
-- The shape matches blog_posts.image_url: a file uploaded through the editor (an https Storage
-- URL; the action checks it is under guide-photos/hubs/) or a site path such as /hub/canyon.jpg.
-- Anything else (another scheme, `//host`) is refused here as the second line.

ALTER TABLE public.destination_hubs
  ADD COLUMN hero_image_url TEXT;

ALTER TABLE public.destination_hubs
  ADD CONSTRAINT destination_hubs_hero_image_url_shape
    CHECK (hero_image_url IS NULL OR (hero_image_url ~ '^(/[^/]|https://)' AND length(hero_image_url) <= 2048));

COMMENT ON COLUMN public.destination_hubs.hero_image_url IS
  'Hero photo of the hub page: an uploaded guide-photos/hubs/ URL or a site path. NULL = newest offer photo, then the default.';
