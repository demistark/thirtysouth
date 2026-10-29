CREATE OR REPLACE FUNCTION public.can_view_itinerary(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('host','schedule_manager','trip_guest','friend_afar'))
$$;
CREATE OR REPLACE FUNCTION public.can_edit_itinerary(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('host','schedule_manager'))
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_itinerary(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_itinerary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_itinerary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_itinerary(uuid) TO authenticated;

-- Chapters: visibility, editors, retire scripture
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;
UPDATE public.chapters SET scripture_ref = NULL, scripture_text = NULL WHERE scripture_ref IS NOT NULL OR scripture_text IS NOT NULL;
COMMENT ON COLUMN public.chapters.scripture_ref IS 'DEPRECATED: chapters carry no scripture';
COMMENT ON COLUMN public.chapters.scripture_text IS 'DEPRECATED: chapters carry no scripture';
DROP FUNCTION IF EXISTS public.chapter_scriptures();
ALTER TABLE public.chapters ADD CONSTRAINT chapters_number_range CHECK (number BETWEEN 1 AND 10);
GRANT SELECT ON public.chapters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;
DROP POLICY IF EXISTS "Anyone reads chapter basics" ON public.chapters;
DROP POLICY IF EXISTS "Host updates chapters" ON public.chapters;
CREATE POLICY "Anyone reads visible chapters" ON public.chapters FOR SELECT TO anon, authenticated USING (visible = true);
CREATE POLICY "Editors read all chapters" ON public.chapters FOR SELECT TO authenticated USING (public.can_edit_itinerary(auth.uid()));
CREATE POLICY "Editors insert chapters" ON public.chapters FOR INSERT TO authenticated WITH CHECK (public.can_edit_itinerary(auth.uid()));
CREATE POLICY "Editors update chapters" ON public.chapters FOR UPDATE TO authenticated USING (public.can_edit_itinerary(auth.uid())) WITH CHECK (public.can_edit_itinerary(auth.uid()));
CREATE POLICY "Editors delete chapters" ON public.chapters FOR DELETE TO authenticated USING (public.can_edit_itinerary(auth.uid()));

-- Scenes
CREATE TABLE public.scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_number integer NOT NULL REFERENCES public.chapters(number) ON UPDATE CASCADE ON DELETE CASCADE,
  scene_order integer NOT NULL,
  title text NOT NULL,
  location text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'core' CHECK (kind IN ('core','flex','optional')),
  leave_at text CHECK (leave_at IS NULL OR leave_at ~ '^(1[0-2]|[1-9]):[0-5][0-9] (AM|PM)$'),
  start_time text CHECK (start_time IS NULL OR start_time ~ '^(1[0-2]|[1-9]):[0-5][0-9] (AM|PM)$'),
  end_time text CHECK (end_time IS NULL OR end_time ~ '^(1[0-2]|[1-9]):[0-5][0-9] (AM|PM)$'),
  summary text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  experience_card text,
  wardrobe_look integer,
  visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_number, scene_order)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenes TO authenticated;
GRANT ALL ON public.scenes TO service_role;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Friends read visible scenes" ON public.scenes FOR SELECT TO authenticated USING (visible = true AND public.can_view_itinerary(auth.uid()));
CREATE POLICY "Editors read all scenes" ON public.scenes FOR SELECT TO authenticated USING (public.can_edit_itinerary(auth.uid()));
CREATE POLICY "Editors insert scenes" ON public.scenes FOR INSERT TO authenticated WITH CHECK (public.can_edit_itinerary(auth.uid()));
CREATE POLICY "Editors update scenes" ON public.scenes FOR UPDATE TO authenticated USING (public.can_edit_itinerary(auth.uid())) WITH CHECK (public.can_edit_itinerary(auth.uid()));
CREATE POLICY "Editors delete scenes" ON public.scenes FOR DELETE TO authenticated USING (public.can_edit_itinerary(auth.uid()));
CREATE TRIGGER scenes_touch BEFORE UPDATE ON public.scenes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Wardrobe looks
CREATE TABLE public.wardrobe_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_number integer NOT NULL REFERENCES public.chapters(number) ON UPDATE CASCADE ON DELETE CASCADE,
  look_order integer NOT NULL,
  date_label text NOT NULL DEFAULT '',
  look_label text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  palette jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  visible boolean NOT NULL DEFAULT true,
  UNIQUE (chapter_number, look_order)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wardrobe_looks TO authenticated;
GRANT ALL ON public.wardrobe_looks TO service_role;
ALTER TABLE public.wardrobe_looks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Friends read visible looks" ON public.wardrobe_looks FOR SELECT TO authenticated USING (visible = true AND public.can_view_itinerary(auth.uid()));
CREATE POLICY "Editors read all looks" ON public.wardrobe_looks FOR SELECT TO authenticated USING (public.can_edit_itinerary(auth.uid()));
CREATE POLICY "Editors insert looks" ON public.wardrobe_looks FOR INSERT TO authenticated WITH CHECK (public.can_edit_itinerary(auth.uid()));
CREATE POLICY "Editors update looks" ON public.wardrobe_looks FOR UPDATE TO authenticated USING (public.can_edit_itinerary(auth.uid())) WITH CHECK (public.can_edit_itinerary(auth.uid()));
CREATE POLICY "Editors delete looks" ON public.wardrobe_looks FOR DELETE TO authenticated USING (public.can_edit_itinerary(auth.uid()));

-- Wardrobe photos storage
CREATE POLICY "Friends read wardrobe photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'wardrobe-photos' AND public.can_view_itinerary(auth.uid()));
CREATE POLICY "Editors upload wardrobe photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'wardrobe-photos' AND public.can_edit_itinerary(auth.uid()));
CREATE POLICY "Editors update wardrobe photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'wardrobe-photos' AND public.can_edit_itinerary(auth.uid())) WITH CHECK (bucket_id = 'wardrobe-photos' AND public.can_edit_itinerary(auth.uid()));
CREATE POLICY "Editors delete wardrobe photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'wardrobe-photos' AND public.can_edit_itinerary(auth.uid()));