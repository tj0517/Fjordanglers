-- Replaces the intent lost in the corrupt 20260815_fix_nz_species_casing.sql (see that
-- file for the history). The seed migration 20260815_seed_dustin_habener_new_zealand.sql
-- wrote target_species as ARRAY['Rainbow trout', 'Brown trout', 'Kingfish'] on the
-- Central North Island experience page, lowercase, unlike every other NZ target_species
-- array (12 occurrences across the three NZ seed files), which use Title Case
-- ('Rainbow Trout', 'Brown Trout'). Production currently has ["Rainbow trout","Brown
-- trout"] for that row (Kingfish is not present in production and is intentionally left
-- alone here — reintroducing a species not currently on the page is out of scope for a
-- casing fix).
--
-- Idempotent: array_replace only touches elements equal to the lowercase form, so a
-- second run is a no-op once the casing has been corrected.
update experience_pages
set target_species = array_replace(
      array_replace(target_species, 'Rainbow trout', 'Rainbow Trout'),
      'Brown trout', 'Brown Trout'
    )
where country ilike '%zealand%';
