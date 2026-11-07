ALTER TABLE public.experiences
 ADD COLUMN photo_path text,
 ADD COLUMN photo_alt text NOT NULL DEFAULT '',
 ADD COLUMN photo_focal_x integer NOT NULL DEFAULT 50 CHECK (photo_focal_x BETWEEN 0 AND 100),
 ADD COLUMN photo_focal_y integer NOT NULL DEFAULT 50 CHECK (photo_focal_y BETWEEN 0 AND 100),
 ADD COLUMN photo_zoom numeric NOT NULL DEFAULT 1 CHECK (photo_zoom BETWEEN 1 AND 3);
CREATE POLICY "Purse viewers read experience photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'experience-photos' AND public.can_view_purse(auth.uid()));
CREATE POLICY "Purse editors upload experience photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'experience-photos' AND public.can_edit_purse(auth.uid()) AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp'));
CREATE POLICY "Purse editors update experience photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'experience-photos' AND public.can_edit_purse(auth.uid())) WITH CHECK (bucket_id = 'experience-photos' AND public.can_edit_purse(auth.uid()) AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp'));
CREATE POLICY "Purse editors delete experience photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'experience-photos' AND public.can_edit_purse(auth.uid()));
INSERT INTO public.site_content (key,value) VALUES
 ('admin.purse.photo_add','Add a photo'),
 ('admin.purse.photo_replace','Replace photo'),
 ('admin.purse.photo_remove','Remove photo'),
 ('admin.purse.photo_alt','Describe the photo (for screen readers)'),
 ('admin.purse.photo_zoom','Zoom'),
 ('admin.purse.photo','Photo'),
 ('admin.purse.photo_phone','Phone'),
 ('admin.purse.photo_desktop','Desktop'),
 ('admin.purse.photo_focal','Tap to set the focal point'),
 ('admin.purse.photo_empty','No image yet')
ON CONFLICT (key) DO NOTHING;