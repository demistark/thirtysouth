CREATE TABLE public.fun_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fun_facts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fun_facts TO authenticated;
GRANT ALL ON public.fun_facts TO service_role;
ALTER TABLE public.fun_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active facts" ON public.fun_facts FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "Host manages facts" ON public.fun_facts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'host')) WITH CHECK (public.has_role(auth.uid(), 'host'));