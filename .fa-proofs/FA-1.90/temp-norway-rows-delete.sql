-- FA-1.90 D1 — remove the temporary proof rows (experience_guides cascade from experience_pages).
BEGIN;
DELETE FROM public.experience_pages WHERE id::text LIKE 'fa190000-%' RETURNING 'experience_pages' AS t, slug;
DELETE FROM public.guides WHERE id::text LIKE 'fa190000-%' RETURNING 'guides' AS t, slug;
DELETE FROM public.audit_log WHERE record_id::text LIKE 'fa190000-%' RETURNING 'audit_log' AS t, operation;
COMMIT;

SELECT
  (SELECT count(*) FROM public.experience_pages  WHERE id::text LIKE 'fa190000-%')            AS experience_pages_left,
  (SELECT count(*) FROM public.guides            WHERE id::text LIKE 'fa190000-%')            AS guides_left,
  (SELECT count(*) FROM public.experience_guides WHERE experience_id::text LIKE 'fa190000-%'
                                                    OR guide_id::text LIKE 'fa190000-%')      AS experience_guides_left,
  (SELECT count(*) FROM public.audit_log         WHERE record_id::text LIKE 'fa190000-%')     AS audit_log_left;
