DROP FUNCTION IF EXISTS public.set_my_photo(text);
DROP POLICY IF EXISTS "Friends read own photo" ON storage.objects;
DROP POLICY IF EXISTS "Friends remove own photo" ON storage.objects;
DROP POLICY IF EXISTS "Friends replace own photo" ON storage.objects;
DROP POLICY IF EXISTS "Friends upload own photo" ON storage.objects;
DROP POLICY IF EXISTS "Friends view guest photos" ON storage.objects;
DROP POLICY IF EXISTS "Host deletes guest photos" ON storage.objects;
DROP POLICY IF EXISTS "Host updates guest photos" ON storage.objects;
DROP POLICY IF EXISTS "Host uploads guest photos" ON storage.objects;
DROP FUNCTION public.guest_directory();
CREATE FUNCTION public.guest_directory() RETURNS TABLE(id uuid, display_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT g.id, g.display_name FROM public.guests g
 WHERE g.status = 'confirmed' AND (public.has_role(auth.uid(),'trip_guest') OR public.has_role(auth.uid(),'host'))
 ORDER BY g.display_name
$$;
REVOKE ALL ON FUNCTION public.guest_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guest_directory() TO authenticated, service_role;
DROP FUNCTION public.my_profile();
CREATE FUNCTION public.my_profile() RETURNS TABLE(display_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT g.display_name FROM public.guests g WHERE g.user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated, service_role;
COMMENT ON COLUMN public.guests.photo_url IS 'DEPRECATED: profile photos removed; unused and cleared. Column deletion blocked by migration permission.';