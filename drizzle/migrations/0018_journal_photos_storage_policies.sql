-- journal-photos bucket: read mirrors each tab's visibility, write mirrors each tab's posting rules
CREATE POLICY "Journal photo read mirrors tab access" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'journal-photos'
  AND CASE (storage.foldername(name))[1]
    WHEN 'commons' THEN CASE public.journal_level(auth.uid())
      WHEN 'participant' THEN true
      WHEN 'honorary' THEN coalesce((SELECT value FROM public.settings WHERE key='commons_show_honorary'),'true') = 'true'
      WHEN 'afar' THEN coalesce((SELECT value FROM public.settings WHERE key='commons_show_afar'),'true') = 'true'
      ELSE false END
    WHEN 'heart' THEN CASE public.journal_level(auth.uid())
      WHEN 'participant' THEN true
      WHEN 'honorary' THEN coalesce((SELECT value FROM public.settings WHERE key='heart_show_honorary'),'true') = 'true'
      WHEN 'afar' THEN coalesce((SELECT value FROM public.settings WHERE key='heart_show_afar'),'true') = 'true'
      ELSE false END
    ELSE false END
);
CREATE POLICY "Journal photo write mirrors posting rules" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'journal-photos'
  AND (
    ((storage.foldername(name))[1] = 'commons' AND public.is_trip_participant(auth.uid()))
    OR ((storage.foldername(name))[1] = 'heart' AND public.can_view_journal(auth.uid()))
  )
);
CREATE POLICY "Journal editors replace photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'journal-photos' AND public.can_edit_journal(auth.uid()))
  WITH CHECK (bucket_id = 'journal-photos' AND public.can_edit_journal(auth.uid()));
CREATE POLICY "Journal editors remove photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'journal-photos' AND public.can_edit_journal(auth.uid()));