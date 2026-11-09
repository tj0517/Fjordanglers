-- FA-1.86: slugs for active guides, hide two empty profiles, retire the Josh Hart
-- duplicate, then enforce "active => slug". Data first, constraint last.
-- Rows are never deleted. Every UPDATE is keyed by id and guarded, so a re-run is harmless.

update public.guides set slug = 'dustin-habener-new-zealand'
  where id = 'cab7c3ae-2d30-4b10-8167-8a44925cd5ee' and slug is null;
update public.guides set slug = 'josh-hart-new-zealand'
  where id = '1a30602e-05f8-4a5d-a89f-76b4d53843a4' and slug is null;
update public.guides set slug = 'kristina-placko-daryl-paskell-new-zealand'
  where id = '0f6e5a30-0e63-4bfe-9fc8-988306f965a0' and slug is null;

-- Profiles with no content yet: hidden until tj fills them in with the guides.
update public.guides set slug = 'emanuel-cosic', is_hidden = true
  where id = '385083d2-f2e1-4b74-88e2-78e161cf21a7' and slug is null;
update public.guides set slug = 'lucky-lure-fishing-finland', is_hidden = true
  where id = 'c1a7c96f-b292-432e-873b-390cac353384' and slug is null;

-- Duplicate of Josh Hart (1a30602e…): retired, not deleted. Its 3 inquiries keep
-- assigned_guide_id = cd8f48f1… as recorded (tj decision, 2026-11-09, option C).
-- /guides/cd8f48f1… redirects to the real profile from the page code.
update public.guides set status = 'suspended', is_hidden = true
  where id = 'cd8f48f1-0633-4832-9c56-0f2cb4c7ee6d' and slug is null;

-- The agent's Josh Hart brief follows the real guide.
update public.agent_knowledge set guide_id = '1a30602e-05f8-4a5d-a89f-76b4d53843a4'
  where id = '14fd7003-9137-487f-aa34-3a14bd2d56ef'
    and guide_id = 'cd8f48f1-0633-4832-9c56-0f2cb4c7ee6d';

alter table public.guides
  add constraint guides_active_requires_slug
  check (status <> 'active' or (slug is not null and btrim(slug) <> ''));
