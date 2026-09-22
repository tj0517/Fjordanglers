-- FA-1.22 — the agent's knowledge lives in the database, not in repo files
--
-- Why: until 22 Sep the agent's knowledge sat in docs/knowledge/*.md, so every correction
-- to a price or a tone of voice needed git and a deploy. Worse, a guide file was bound to
-- its guide by `guide_name` matching guides.full_name "case-insensitive"
-- (docs/knowledge/README.md): a typo in the surname silently dropped the entry, the agent
-- drafted an offer knowing nothing about the guide, and nobody could see it had happened.
--
-- What: one table of entries. The database itself guarantees an entry is loadable — the
-- country comes only from COUNTRIES (src/lib/countries.ts), the guide is referenced by id
-- rather than by name, and at most one `instructions` entry is active (O-20). No change
-- history, only updated_by/updated_at (O-22). Guide rates are plain text inside `body`;
-- structured fields wait for stage 4 (O-21). FA-1.23 makes the loader read this table,
-- FA-1.24 adds the editing screen.
--
-- Decisions tj took at the STOP gate on 22 Sep (full record: docs/tasks/FA-1.22.md):
--   D-A  four kinds, no `offer` and no `regions` column — region detail goes into `body`.
--   D-D  strict shape: each kind carries only its own scope field, one CHECK per kind.
--   D-E  guide_id ON DELETE RESTRICT, not CASCADE — with no change history a cascade
--        would silently destroy rate notes typed by hand.
--   D-F  a test asserts this file's country list still equals COUNTRIES.

-- ────────────────────────────────────────────────────────
-- 1. Table
-- ────────────────────────────────────────────────────────
CREATE TABLE public.agent_knowledge (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT        NOT NULL,
  country     TEXT,
  guide_id    UUID        REFERENCES public.guides(id)  ON DELETE RESTRICT,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  active      BOOLEAN     NOT NULL DEFAULT true,
  updated_by  UUID        REFERENCES auth.users(id)     ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A list of kinds is a CHECK, never an enum type (docs/03-conventions.md).
  CONSTRAINT agent_knowledge_kind_check
    CHECK (kind IN ('instructions', 'tone', 'destination', 'guide')),

  -- Country only from COUNTRIES (src/lib/countries.ts) — full names, not ISO codes.
  -- src/lib/__tests__/agentKnowledgeCountries.test.ts asserts this list still matches.
  CONSTRAINT agent_knowledge_country_check
    CHECK (country IS NULL OR country IN (
      'Norway', 'Sweden', 'Finland', 'Iceland', 'Denmark',
      'Argentina', 'Chile', 'New Zealand'
    )),

  CONSTRAINT agent_knowledge_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT agent_knowledge_body_not_blank  CHECK (btrim(body)  <> ''),

  -- Entry shape — one rule per kind (D-D, tj 22 Sep). Each CHECK names both the field it
  -- requires and the field it forbids, so the constraint name in the error message is
  -- enough to know what is wrong, and FA-1.24 can map that name onto a form field.
  CONSTRAINT agent_knowledge_destination_shape
    CHECK (kind <> 'destination' OR (country IS NOT NULL AND guide_id IS NULL)),
  CONSTRAINT agent_knowledge_guide_shape
    CHECK (kind <> 'guide' OR (guide_id IS NOT NULL AND country IS NULL)),
  CONSTRAINT agent_knowledge_global_shape
    CHECK (kind NOT IN ('instructions', 'tone') OR (country IS NULL AND guide_id IS NULL))
);

COMMENT ON TABLE public.agent_knowledge IS
  'Knowledge and instructions for the agent that answers inquiries: kind, scope (country or guide), body in markdown. The single source of truth — replaces docs/knowledge/*.md (FA-1.22). Read by the loader (FA-1.23), edited in /admin/knowledge (FA-1.24). Admin only, RLS enabled.';

COMMENT ON COLUMN public.agent_knowledge.kind IS
  'instructions = the agent system prompt / decision graph (at most one active); tone = tone of voice, always appended; destination = knowledge about a country; guide = knowledge about a guide, including rates written as prose (O-21).';
COMMENT ON COLUMN public.agent_knowledge.country IS
  'Full country name from COUNTRIES (src/lib/countries.ts), e.g. ''New Zealand''. Not an ISO code. Set only for kind=''destination''.';
COMMENT ON COLUMN public.agent_knowledge.guide_id IS
  'The guide referenced by id, not by surname — a typo no longer silently loses the entry, which is how docs/knowledge/guides/*.md used to work. Set only for kind=''guide''. ON DELETE RESTRICT: deleting a guide that still has knowledge entries is refused, because there is no change history (O-22) and a cascade would destroy those notes for good — the entries must be deactivated or removed deliberately first.';
COMMENT ON COLUMN public.agent_knowledge.active IS
  'An inactive entry stays in the table and is left out of the prompt. FA-1.24 deactivates instead of deleting.';
COMMENT ON COLUMN public.agent_knowledge.updated_by IS
  'Who changed it last. No change history — tj decision 22 Sep (O-22). Set by the data layer, not by a trigger.';

-- ────────────────────────────────────────────────────────
-- 2. "At most one active instructions entry" + indexes
-- ────────────────────────────────────────────────────────
-- Partial unique index: with kind='instructions' AND active, uniqueness on `kind` allows
-- exactly one such row. Inactive rows and the other kinds are unconstrained.
CREATE UNIQUE INDEX agent_knowledge_one_active_instructions
  ON public.agent_knowledge (kind)
  WHERE kind = 'instructions' AND active;

-- An unindexed FK means a sequential scan of agent_knowledge on every DELETE from guides,
-- and with ON DELETE RESTRICT that scan runs every time, not only on a real deletion.
CREATE INDEX agent_knowledge_guide_id_idx
  ON public.agent_knowledge (guide_id)
  WHERE guide_id IS NOT NULL;

-- The loader's access path in FA-1.23: "active entries of this kind for this country".
CREATE INDEX agent_knowledge_active_kind_country_idx
  ON public.agent_knowledge (kind, country)
  WHERE active;

-- ────────────────────────────────────────────────────────
-- 3. updated_at — the only trigger, reusing the baseline function (lines 394-397)
-- ────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER agent_knowledge_set_updated_at
  BEFORE UPDATE ON public.agent_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────
-- 4. RLS — in the same migration as the table, never a separate one
-- ────────────────────────────────────────────────────────
-- Closed by default: RLS on, and a single policy below. anon, guides and anglers get no
-- policy at all — neither read nor write. Plus a REVOKE, because the baseline's
-- ALTER DEFAULT PRIVILEGES (lines 9699-9702) grants anon ALL on every new table in public.
ALTER TABLE public.agent_knowledge ENABLE ROW LEVEL SECURITY;

-- Exactly the baseline pattern (lines 2995-2997, 3277-3283, 3385-3393), narrowed from
-- TO public to TO authenticated. No FOR clause means FOR ALL: USING covers
-- SELECT/UPDATE/DELETE, WITH CHECK covers INSERT/UPDATE. profiles carries the policy
-- "Public reads all profiles" (line 3357), so the sub-select resolves without a
-- SECURITY DEFINER helper.
CREATE POLICY "Admins manage agent_knowledge" ON public.agent_knowledge
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- There is deliberately no policy for service_role (D-C, tj 22 Sep): service_role has
-- rolbypassrls = true, so no policy applies to it either way. What actually opens the
-- table to the FA-1.23 loader (createServiceClient) is the GRANT below.

-- ────────────────────────────────────────────────────────
-- 5. Table privileges
-- ────────────────────────────────────────────────────────
-- REVOKE first, then grant back only what is needed. The baseline's ALTER DEFAULT
-- PRIVILEGES hands anon AND authenticated every privilege on a new public table,
-- including TRUNCATE — and TRUNCATE is not subject to row-level security, so leaving it
-- in place would let any signed-in angler empty the table despite the policy above.
-- inquiry_events (20260916201226) revokes TRUNCATE for the same reason.
REVOKE ALL ON TABLE public.agent_knowledge FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_knowledge TO authenticated;
GRANT ALL                            ON TABLE public.agent_knowledge TO service_role;
