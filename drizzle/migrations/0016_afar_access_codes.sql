-- Friends afar: personal access codes (no email).

-- 1. Role authority for code-only guests with no email or linked account.
ALTER TABLE public.guests ADD COLUMN pending_role app_role;
COMMENT ON COLUMN public.guests.pending_role IS 'Role authority for code-only friends afar with no email/account; mirrors role_invites otherwise.';

-- 2. Code table: only the salted hash is stored, never the code.
CREATE TABLE public.afar_codes (
  guest_id uuid PRIMARY KEY REFERENCES public.guests(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  salt text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  last_signed_in_at timestamptz,
  disabled boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.afar_codes TO service_role;
ALTER TABLE public.afar_codes ENABLE ROW LEVEL SECURITY;

-- 3. Rate-limit attempts per device/address. No client access.
CREATE TABLE public.afar_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  address text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.afar_attempts TO service_role;
ALTER TABLE public.afar_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX afar_attempts_address_time ON public.afar_attempts (address, attempted_at);

-- 4. Friends afar may have a blank email; uniqueness applies only to real emails.
DROP INDEX IF EXISTS public.guests_email_lower_key;
CREATE UNIQUE INDEX guests_email_lower_key ON public.guests (lower(email)) WHERE email <> '';

-- 5. Email sign-in route is closed for friends afar (and for blank emails).
CREATE OR REPLACE FUNCTION public.is_invited(_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT lower(trim(_email)) <> ''
    AND EXISTS (SELECT 1 FROM public.guests g WHERE lower(g.email) = lower(trim(_email)))
    AND NOT EXISTS (SELECT 1 FROM public.role_invites ri WHERE lower(ri.email) = lower(trim(_email)) AND ri.role = 'friend_afar')
    AND NOT EXISTS (
      SELECT 1 FROM public.guests g JOIN public.user_roles ur ON ur.user_id = g.user_id
      WHERE lower(g.email) = lower(trim(_email)) AND ur.role = 'friend_afar'
    )
$function$;

-- 6. Role changes: blank-email guests use pending_role; leaving friend_afar destroys the code.
CREATE OR REPLACE FUNCTION public.set_guest_role(_guest_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE g record;
BEGIN
  IF NOT public.has_role(auth.uid(),'host') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _role NOT IN ('trip_guest','friend_afar','honorary_guest') THEN RAISE EXCEPTION 'invalid role'; END IF;
  SELECT * INTO g FROM public.guests WHERE id = _guest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'guest not found'; END IF;
  IF g.email <> '' THEN
    DELETE FROM public.role_invites WHERE lower(email) = lower(g.email) AND role IN ('trip_guest','friend_afar','honorary_guest');
    INSERT INTO public.role_invites (email, role) VALUES (lower(g.email), _role);
  END IF;
  UPDATE public.guests SET pending_role = _role WHERE id = _guest_id;
  IF g.user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = g.user_id AND role IN ('trip_guest','friend_afar','honorary_guest');
    INSERT INTO public.user_roles (user_id, role) VALUES (g.user_id, _role) ON CONFLICT DO NOTHING;
  END IF;
  IF _role <> 'friend_afar' THEN
    DELETE FROM public.afar_codes WHERE guest_id = _guest_id;
  END IF;
END $function$;

-- 7. Blank-email guards on the email-matching triggers.
CREATE OR REPLACE FUNCTION public.link_guest(_user_id uuid, _email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $function$
DECLARE g_id uuid;
BEGIN
  IF _email IS NULL OR trim(_email) = '' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND email_confirmed_at IS NOT NULL)
  THEN RETURN; END IF;
  SELECT id INTO g_id FROM public.guests WHERE lower(email) = lower(trim(_email));
  IF g_id IS NULL THEN RETURN; END IF;
  UPDATE public.guests SET user_id = _user_id WHERE id = g_id AND (user_id IS NULL OR user_id = _user_id);
  INSERT INTO public.user_roles (user_id, role)
    SELECT _user_id, ri.role FROM public.role_invites ri WHERE lower(ri.email) = lower(trim(_email))
    ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.role_invites WHERE lower(email) = lower(trim(_email))) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'trip_guest') ON CONFLICT DO NOTHING;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.on_guest_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $function$
DECLARE u_id uuid;
BEGIN
  IF NEW.email = '' THEN RETURN NEW; END IF;
  SELECT id INTO u_id FROM auth.users WHERE lower(email) = lower(NEW.email) LIMIT 1;
  IF u_id IS NOT NULL THEN PERFORM public.link_guest(u_id, NEW.email); END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.on_guest_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF OLD.user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = OLD.user_id AND role IN ('trip_guest','schedule_manager','friend_afar','honorary_guest');
  END IF;
  IF OLD.email <> '' THEN
    DELETE FROM public.role_invites WHERE lower(email) = lower(OLD.email) AND role <> 'host';
  END IF;
  RETURN OLD;
END $function$;

-- 8. Session gate checked by the app for signed-in friends afar.
CREATE OR REPLACE FUNCTION public.afar_session_valid()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN NOT public.has_role(auth.uid(), 'friend_afar') THEN true
    WHEN coalesce((SELECT s.value FROM public.settings s WHERE s.key = 'afar_enabled'), 'true') <> 'true' THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.afar_codes ac
      JOIN public.guests g ON g.id = ac.guest_id
      WHERE g.user_id = auth.uid() AND NOT ac.disabled
    )
  END
$function$;
REVOKE EXECUTE ON FUNCTION public.afar_session_valid() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.afar_session_valid() TO authenticated;