CREATE OR REPLACE FUNCTION public.chapter_scriptures()
 RETURNS TABLE(number integer, scripture_ref text, scripture_text text, photo_url text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.number, c.scripture_ref, c.scripture_text, c.photo_url
  FROM public.chapters c ORDER BY c.sort_order
$$;
GRANT EXECUTE ON FUNCTION public.chapter_scriptures() TO anon, authenticated;