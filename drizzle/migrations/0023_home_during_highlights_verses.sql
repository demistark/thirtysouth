ALTER TABLE public.scenes ADD COLUMN home_highlight boolean NOT NULL DEFAULT false;

CREATE TABLE public.daily_verses (
  chapter_number integer PRIMARY KEY,
  text text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT ''
);
GRANT SELECT ON public.daily_verses TO anon, authenticated;
GRANT ALL ON public.daily_verses TO service_role;
ALTER TABLE public.daily_verses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read daily verses"
  ON public.daily_verses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Host can write daily verses"
  ON public.daily_verses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'host'))
  WITH CHECK (public.has_role(auth.uid(), 'host'));

INSERT INTO public.daily_verses (chapter_number, text, reference) VALUES
  (1, 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.', 'Jeremiah 29:11'),
  (6, 'The LORD shall preserve thy going out and thy coming in from this time forth, and even for evermore.', 'Psalm 121:8'),
  (0, 'Be still, and know that I am God.', 'Psalm 46:10');

INSERT INTO public.site_content (key, value) VALUES
  ('home.during.heading', 'Your Day'),
  ('home.during.button', 'Today''s scene'),
  ('home.during.rest', 'Nothing is planned today.')
ON CONFLICT (key) DO NOTHING;