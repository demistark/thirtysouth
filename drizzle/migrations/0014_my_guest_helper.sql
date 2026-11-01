-- Signed-in friend's own guest id (for "my flight" and room assignment highlights)
CREATE OR REPLACE FUNCTION public.my_guest()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.guests WHERE user_id = auth.uid() LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.my_guest() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_guest() TO authenticated;