# Make chapter scripture public (smallest change)

## Current state
- Visitors can already read `scripture_ref` and `scripture_text` directly from `chapters`.
- Only `chapter_scriptures()` still limits scripture to friends: it checks roles, and visitors can't run it.

## Change (one small database update, no site code changes)
```sql
CREATE OR REPLACE FUNCTION public.chapter_scriptures()
 RETURNS TABLE(number integer, scripture_ref text, scripture_text text, photo_url text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.number, c.scripture_ref, c.scripture_text, c.photo_url
  FROM public.chapters c ORDER BY c.sort_order
$$;
GRANT EXECUTE ON FUNCTION public.chapter_scriptures() TO anon, authenticated;
```

## Follow-up
- Update the project rule that says scripture is hidden from the public.
- Check: a signed-out visitor sees scripture on the itinerary page.
