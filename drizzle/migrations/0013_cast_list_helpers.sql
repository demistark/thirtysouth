-- Confirmed trip participants for the Cast credit roll (never honorary guests or friends afar).
-- Base role = role_invites row when present, else trip_guest (mirrors link_guest).
CREATE OR REPLACE FUNCTION public.cast_list()
RETURNS TABLE(id uuid, full_name text, display_name text, pronoun_form text, cast_order integer, cast_role_override text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.full_name, g.display_name, g.pronoun_form, g.cast_order, g.cast_role_override
  FROM public.guests g
  WHERE public.can_view_travel(auth.uid())
    AND g.status = 'confirmed'
    AND COALESCE((
      SELECT ri.role::text FROM public.role_invites ri
      WHERE lower(ri.email) = lower(g.email)
        AND ri.role IN ('host','trip_guest','friend_afar','honorary_guest')
      ORDER BY CASE WHEN ri.role = 'host' THEN 0 ELSE 1 END LIMIT 1
    ), 'trip_guest') IN ('host','trip_guest')
  ORDER BY g.cast_order NULLS LAST, g.display_name
$$;
REVOKE EXECUTE ON FUNCTION public.cast_list() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cast_list() TO authenticated;

-- Assign a random cast order once to confirmed participants who lack one; never reshuffles.
CREATE OR REPLACE FUNCTION public.ensure_cast_order()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_view_travel(auth.uid()) THEN RETURN; END IF;
  WITH todo AS (
    SELECT g.id FROM public.guests g
    WHERE g.status = 'confirmed' AND g.cast_order IS NULL
      AND COALESCE((
        SELECT ri.role::text FROM public.role_invites ri
        WHERE lower(ri.email) = lower(g.email)
          AND ri.role IN ('host','trip_guest','friend_afar','honorary_guest')
        ORDER BY CASE WHEN ri.role = 'host' THEN 0 ELSE 1 END LIMIT 1
      ), 'trip_guest') IN ('host','trip_guest')
  ), numbered AS (
    SELECT id, row_number() OVER (ORDER BY random()) AS rn FROM todo
  ), base AS (
    SELECT COALESCE(max(cast_order), 0) AS m FROM public.guests
  )
  UPDATE public.guests g SET cast_order = base.m + numbered.rn
  FROM numbered, base WHERE g.id = numbered.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.ensure_cast_order() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_cast_order() TO authenticated;