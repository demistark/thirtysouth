CREATE OR REPLACE FUNCTION public.normalize_email()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.email := lower(trim(NEW.email)); RETURN NEW; END $$;

UPDATE public.guests SET email = lower(trim(email)) WHERE email <> lower(trim(email));
UPDATE public.role_invites SET email = lower(trim(email)) WHERE email <> lower(trim(email));

DROP TRIGGER IF EXISTS guests_normalize_email ON public.guests;
CREATE TRIGGER guests_normalize_email BEFORE INSERT OR UPDATE OF email ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.normalize_email();
CREATE TRIGGER role_invites_normalize_email BEFORE INSERT OR UPDATE OF email ON public.role_invites
  FOR EACH ROW EXECUTE FUNCTION public.normalize_email();
COMMENT ON FUNCTION public.normalize_guest_email() IS 'DEPRECATED: replaced by normalize_email';

CREATE UNIQUE INDEX guests_email_lower_key ON public.guests (lower(email));
CREATE UNIQUE INDEX role_invites_email_lower_role_key ON public.role_invites (lower(email), role);

CREATE OR REPLACE FUNCTION public.is_invited(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.guests WHERE lower(email) = lower(trim(_email)))
$$;

CREATE OR REPLACE FUNCTION public.link_guest(_user_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE g_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND email_confirmed_at IS NOT NULL)
  THEN RETURN; END IF;
  SELECT id INTO g_id FROM public.guests WHERE lower(email) = lower(trim(_email));
  IF g_id IS NULL THEN RETURN; END IF;
  UPDATE public.guests SET user_id = _user_id WHERE id = g_id AND (user_id IS NULL OR user_id = _user_id);
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'trip_guest') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
    SELECT _user_id, ri.role FROM public.role_invites ri WHERE lower(ri.email) = lower(trim(_email))
    ON CONFLICT DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION public.link_guest(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN PERFORM public.link_guest(NEW.id, NEW.email); END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.on_auth_user_created() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created();

CREATE OR REPLACE FUNCTION public.on_guest_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE u_id uuid;
BEGIN
  SELECT id INTO u_id FROM auth.users WHERE lower(email) = lower(NEW.email) LIMIT 1;
  IF u_id IS NOT NULL THEN PERFORM public.link_guest(u_id, NEW.email); END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.on_guest_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = OLD.user_id AND role IN ('trip_guest','schedule_manager','friend_afar');
  END IF;
  DELETE FROM public.role_invites WHERE lower(email) = lower(OLD.email) AND role <> 'host';
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.set_schedule_manager(_guest_id uuid, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  IF NOT public.has_role(auth.uid(),'host') THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT * INTO g FROM public.guests WHERE id = _guest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'guest not found'; END IF;
  IF _enabled THEN
    INSERT INTO public.role_invites (email, role) VALUES (lower(g.email), 'schedule_manager') ON CONFLICT DO NOTHING;
    IF g.user_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (g.user_id, 'schedule_manager') ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    DELETE FROM public.role_invites WHERE lower(email) = lower(g.email) AND role = 'schedule_manager';
    IF g.user_id IS NOT NULL THEN
      DELETE FROM public.user_roles WHERE user_id = g.user_id AND role = 'schedule_manager';
    END IF;
  END IF;
END $$;

SELECT public.link_guest(u.id, u.email) FROM auth.users u WHERE u.email_confirmed_at IS NOT NULL;