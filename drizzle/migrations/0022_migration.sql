-- One phase clock: new boundary keys (Eastern), keeping the old rows untouched.
INSERT INTO public.settings (key, value) VALUES
  ('phase_during_start', '2026-11-20 00:00'),
  ('phase_after_start', '2026-11-30 00:00'),
  ('phase_timezone', 'Etc/GMT+5'),
  ('phase_override', 'auto')
ON CONFLICT (key) DO NOTHING;

-- Carry the old during-end over to the new after-start when the host had set one.
UPDATE public.settings s
SET value = o.value
FROM public.settings o
WHERE s.key = 'phase_after_start'
  AND o.key = 'phase_during_end'
  AND o.value ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$'
  AND s.value = '2026-11-30 00:00';

-- Home hero image slot.
CREATE TABLE public.home_images (
  slot text PRIMARY KEY,
  storage_path text NOT NULL,
  alt text NOT NULL DEFAULT '',
  focal_x integer NOT NULL DEFAULT 50,
  focal_y integer NOT NULL DEFAULT 50
);

GRANT SELECT ON public.home_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_images TO authenticated;
GRANT ALL ON public.home_images TO service_role;

ALTER TABLE public.home_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read home images"
  ON public.home_images FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Host writes home images"
  ON public.home_images FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'host'))
  WITH CHECK (public.has_role(auth.uid(), 'host'));

-- Private bucket (workspace blocks public buckets); anyone may read, host writes.
CREATE POLICY "Anyone can view home images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'home-images');

CREATE POLICY "Host uploads home images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'home-images' AND public.has_role(auth.uid(), 'host'));

CREATE POLICY "Host updates home images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'home-images' AND public.has_role(auth.uid(), 'host'));

CREATE POLICY "Host deletes home images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'home-images' AND public.has_role(auth.uid(), 'host'));

-- New editable Home copy.
INSERT INTO public.site_content (key, value, updated_at) VALUES
  ('home.hero.dates', '20 – 29 November 2026', now()),
  ('home.hero.sub.far', 'Before long.', now()),
  ('home.hero.sub.near', 'Can you feel it?', now()),
  ('home.hero.sub.final', 'Diving in…', now()),
  ('home.look.heading', 'A look around', now()),
  ('home.look.itinerary', 'Shall we begin?', now()),
  ('home.look.travel', 'From everywhere to Cape Town.', now()),
  ('home.look.purse', 'The practical bits.', now()),
  ('home.look.journal', 'Our stories in between.', now())
ON CONFLICT (key) DO NOTHING;