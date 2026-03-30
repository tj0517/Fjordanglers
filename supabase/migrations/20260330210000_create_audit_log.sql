-- Create audit_log table referenced by existing DB triggers.
-- Schema matches the type definitions already in database.types.ts.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  text        NOT NULL,
  operation   text        NOT NULL,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  changed_by  text,
  changed_at  timestamptz DEFAULT now()
);

-- Restrict direct reads to authenticated users (service role bypasses RLS).
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit_log"
  ON public.audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
