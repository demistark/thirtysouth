CREATE OR REPLACE FUNCTION public.current_phase()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _override text;
  _start text;
  _end text;
  _zone text;
  _now timestamp;
BEGIN
  SELECT value INTO _override FROM public.settings WHERE key = 'phase_override';
  IF _override IN ('before','during','after') THEN RETURN _override; END IF;
  SELECT value INTO _start FROM public.settings WHERE key = 'phase_during_start';
  SELECT value INTO _end FROM public.settings WHERE key = 'phase_during_end';
  SELECT value INTO _zone FROM public.settings WHERE key = 'phase_timezone';
  _zone := CASE WHEN _zone = 'Africa/Johannesburg' THEN 'Africa/Johannesburg' ELSE 'Etc/GMT+5' END;
  _now := now() AT TIME ZONE _zone;
  IF _start IS NOT NULL AND _now < _start::timestamp THEN RETURN 'before'; END IF;
  IF _end IS NOT NULL AND _now > _end::timestamp THEN RETURN 'after'; END IF;
  RETURN 'during';
END $$;
REVOKE EXECUTE ON FUNCTION public.current_phase() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_phase() TO authenticated;