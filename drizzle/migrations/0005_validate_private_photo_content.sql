ALTER POLICY "Friends upload own photo" ON storage.objects WITH CHECK (bucket_id = 'guest-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp') AND metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp') AND (public.has_role(auth.uid(),'trip_guest') OR public.has_role(auth.uid(),'friend_afar')));
ALTER POLICY "Friends replace own photo" ON storage.objects WITH CHECK (bucket_id = 'guest-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp') AND metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp') AND (public.has_role(auth.uid(),'trip_guest') OR public.has_role(auth.uid(),'friend_afar')));
CREATE OR REPLACE FUNCTION public.set_my_photo(path text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.guests WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
 IF path IS NOT NULL THEN
  IF path !~ ('^' || auth.uid()::text || '/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$') THEN RAISE EXCEPTION 'invalid photo path'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'guest-photos' AND name = path AND metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp')) THEN RAISE EXCEPTION 'photo not found'; END IF;
 END IF;
 UPDATE public.guests SET photo_url = path WHERE user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.set_my_photo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_photo(text) TO authenticated;