ALTER TABLE public.scenes ADD COLUMN call_time text, ADD COLUMN wrap_time text, ADD COLUMN look_tag text NOT NULL DEFAULT 'auto' CHECK (look_tag IN ('auto','show','hide')), ADD COLUMN dot_shape text CHECK (dot_shape IN ('circle','square','triangle')), ADD COLUMN dot_color text CHECK (dot_color IN ('atlantic','olive','apricot'));
UPDATE public.scenes SET call_time = leave_at;
COMMENT ON COLUMN public.scenes.leave_at IS 'DEPRECATED: replaced by call_time';
CREATE FUNCTION public.save_itinerary_display(_indicator text, _shadow integer, _grain boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.can_edit_itinerary(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _indicator NOT IN ('edge','arrow','both') OR _shadow NOT BETWEEN 1 AND 5 OR _indicator IS NULL OR _shadow IS NULL OR _grain IS NULL THEN RAISE EXCEPTION 'Invalid display settings'; END IF;
 INSERT INTO public.settings(key,value) VALUES ('itinerary_indicator',_indicator),('itinerary_shadow',_shadow::text),('itinerary_grain',_grain::text) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;
END $$;
REVOKE ALL ON FUNCTION public.save_itinerary_display(text,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_itinerary_display(text,integer,boolean) TO authenticated;