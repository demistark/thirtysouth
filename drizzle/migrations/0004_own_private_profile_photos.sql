CREATE OR REPLACE FUNCTION public.my_profile()
RETURNS TABLE(display_name text, photo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT g.display_name,g.photo_url FROM public.guests g WHERE g.user_id = auth.uid() $$;
REVOKE ALL ON FUNCTION public.my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;
CREATE OR REPLACE FUNCTION public.set_my_photo(path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.guests WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
 IF path IS NOT NULL THEN
  IF path !~ ('^' || auth.uid()::text || '/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$') THEN RAISE EXCEPTION 'invalid photo path'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'guest-photos' AND name = path) THEN RAISE EXCEPTION 'photo not found'; END IF;
 END IF;
 UPDATE public.guests SET photo_url = path WHERE user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.set_my_photo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_photo(text) TO authenticated;
CREATE POLICY "Friends upload own photo" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'guest-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp') AND (public.has_role(auth.uid(),'trip_guest') OR public.has_role(auth.uid(),'friend_afar')));
CREATE POLICY "Friends replace own photo" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'guest-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND (public.has_role(auth.uid(),'trip_guest') OR public.has_role(auth.uid(),'friend_afar'))) WITH CHECK (bucket_id = 'guest-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp') AND (public.has_role(auth.uid(),'trip_guest') OR public.has_role(auth.uid(),'friend_afar')));
CREATE POLICY "Friends remove own photo" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'guest-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND (public.has_role(auth.uid(),'trip_guest') OR public.has_role(auth.uid(),'friend_afar')));
CREATE POLICY "Friends read own photo" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'guest-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND (public.has_role(auth.uid(),'trip_guest') OR public.has_role(auth.uid(),'friend_afar')));