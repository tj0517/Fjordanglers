-- FA-1.90 D1 — temporary LOCAL proof rows: 1 active Norway guide + 2 active Norway offers.
-- Copies of the seed rows (jon-seed-iceland, seed-salmon-week-iceland) with our own ids (fa190000-…),
-- slugs (fa190-…) and country Norway; user_id stays NULL. Generated columns are left to the database.
-- Deleted by temp-norway-rows-delete.sql.
BEGIN;
CREATE FUNCTION pg_temp.copy_row(tbl text, src_slug text, overrides jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = tbl AND is_generated = 'NEVER';
  EXECUTE format(
    'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I, (SELECT to_jsonb(s) || $1 FROM public.%1$I s WHERE s.slug = $2))',
    tbl, cols) USING overrides, src_slug;
END $$;

SELECT pg_temp.copy_row('guides', 'jon-seed-iceland', jsonb_build_object(
  'id', 'fa190000-0000-4000-8000-000000000001', 'slug', 'fa190-norway-guide',
  'full_name', 'FA190 Temp Norway Guide', 'country', 'Norway', 'city', 'Tromsø',
  'tagline', 'Temporary FA-1.90 proof row.', 'status', 'active', 'is_hidden', false, 'user_id', NULL));

SELECT pg_temp.copy_row('experience_pages', 'seed-salmon-week-iceland', jsonb_build_object(
  'id', 'fa190000-0000-4000-8000-0000000000a' || n, 'slug', 'fa190-norway-trip-' || n,
  'experience_name', 'FA190 Temp Norway trip ' || n, 'country', 'Norway', 'region', 'Troms',
  'hero_image_url', '/norway.jpg', 'status', 'active', 'guide_id', 'fa190000-0000-4000-8000-000000000001'))
FROM generate_series(1, 2) AS n;
COMMIT;

SELECT 'guides' t, slug, country, status::text, is_hidden::text FROM public.guides WHERE id::text LIKE 'fa190000-%'
UNION ALL SELECT 'experience_pages', slug, country, status::text, NULL FROM public.experience_pages WHERE id::text LIKE 'fa190000-%'
UNION ALL SELECT 'experience_guides', experience_id::text, guide_id::text, status::text, NULL FROM public.experience_guides WHERE guide_id::text LIKE 'fa190000-%'
ORDER BY 1, 2;
