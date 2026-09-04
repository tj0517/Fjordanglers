-- Guide Intake Forms
-- FA creates forms with custom questions, sends links to prospective guides.
-- Multiple guides can respond to the same form. No login required for guides.

CREATE TABLE guide_intake_forms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,
  questions   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  token       TEXT        UNIQUE NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE guide_intake_responses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id          UUID        NOT NULL REFERENCES guide_intake_forms(id) ON DELETE CASCADE,
  respondent_name  TEXT        NOT NULL,
  respondent_email TEXT        NOT NULL,
  answers          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX guide_intake_responses_form_id_idx ON guide_intake_responses (form_id);

ALTER TABLE guide_intake_forms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_intake_responses ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with forms
CREATE POLICY "admin_manage_forms" ON guide_intake_forms
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Anyone (anon) can read active forms (for the public intake page)
CREATE POLICY "public_read_active_forms" ON guide_intake_forms
  FOR SELECT TO anon
  USING (is_active = true);

-- Anyone can submit a response to an active form
CREATE POLICY "public_insert_responses" ON guide_intake_responses
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM guide_intake_forms
      WHERE id = form_id AND is_active = true
    )
  );

-- Admins can read all responses
CREATE POLICY "admin_read_responses" ON guide_intake_responses
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
