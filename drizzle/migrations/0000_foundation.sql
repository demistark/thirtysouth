
CREATE TYPE public.app_role AS ENUM ('host','schedule_manager','trip_guest','friend_afar');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'host'));

CREATE TABLE public.role_invites (
  email text NOT NULL,
  role public.app_role NOT NULL,
  PRIMARY KEY (email, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_invites TO authenticated;
GRANT ALL ON public.role_invites TO service_role;
ALTER TABLE public.role_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Host manages role invites" ON public.role_invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'host')) WITH CHECK (public.has_role(auth.uid(),'host'));

CREATE TABLE public.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL,
  display_name text NOT NULL,
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','tentative')),
  splitwise_name text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guests TO authenticated;
GRANT ALL ON public.guests TO service_role;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Host full access to guests" ON public.guests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'host')) WITH CHECK (public.has_role(auth.uid(),'host'));

CREATE OR REPLACE FUNCTION public.normalize_guest_email()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.email := lower(trim(NEW.email)); RETURN NEW; END $$;
CREATE TRIGGER guests_normalize_email BEFORE INSERT OR UPDATE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.normalize_guest_email();

CREATE OR REPLACE FUNCTION public.guest_directory()
RETURNS TABLE (id uuid, display_name text, photo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.display_name, g.photo_url FROM public.guests g
  WHERE g.status = 'confirmed'
    AND (public.has_role(auth.uid(),'trip_guest') OR public.has_role(auth.uid(),'host'))
  ORDER BY g.display_name
$$;
REVOKE EXECUTE ON FUNCTION public.guest_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guest_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_invited(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.guests WHERE email = lower(trim(_email)))
$$;
GRANT EXECUTE ON FUNCTION public.is_invited(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.link_guest(_user_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g_id uuid;
BEGIN
  SELECT id INTO g_id FROM public.guests WHERE email = lower(trim(_email));
  IF g_id IS NULL THEN RETURN; END IF;
  UPDATE public.guests SET user_id = _user_id WHERE id = g_id AND (user_id IS NULL OR user_id = _user_id);
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'trip_guest') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
    SELECT _user_id, ri.role FROM public.role_invites ri WHERE ri.email = lower(trim(_email))
    ON CONFLICT DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION public.link_guest(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.link_guest(NEW.id, NEW.email); RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION public.on_auth_user_created() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created();

CREATE OR REPLACE FUNCTION public.on_guest_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE u_id uuid;
BEGIN
  SELECT id INTO u_id FROM auth.users WHERE lower(email) = NEW.email LIMIT 1;
  IF u_id IS NOT NULL THEN PERFORM public.link_guest(u_id, NEW.email); END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.on_guest_inserted() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guests_after_insert AFTER INSERT ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.on_guest_inserted();

CREATE OR REPLACE FUNCTION public.on_guest_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = OLD.user_id AND role IN ('trip_guest','schedule_manager','friend_afar');
  END IF;
  DELETE FROM public.role_invites WHERE email = OLD.email AND role <> 'host';
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.on_guest_deleted() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guests_after_delete AFTER DELETE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.on_guest_deleted();

CREATE OR REPLACE FUNCTION public.set_schedule_manager(_guest_id uuid, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  IF NOT public.has_role(auth.uid(),'host') THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT * INTO g FROM public.guests WHERE id = _guest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'guest not found'; END IF;
  IF _enabled THEN
    INSERT INTO public.role_invites (email, role) VALUES (g.email, 'schedule_manager') ON CONFLICT DO NOTHING;
    IF g.user_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (g.user_id, 'schedule_manager') ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    DELETE FROM public.role_invites WHERE email = g.email AND role = 'schedule_manager';
    IF g.user_id IS NOT NULL THEN
      DELETE FROM public.user_roles WHERE user_id = g.user_id AND role = 'schedule_manager';
    END IF;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_schedule_manager(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_schedule_manager(uuid, boolean) TO authenticated;

CREATE TABLE public.settings (key text PRIMARY KEY, value text NOT NULL);
GRANT SELECT ON public.settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads settings" ON public.settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Host inserts settings" ON public.settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'host'));
CREATE POLICY "Host updates settings" ON public.settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'host')) WITH CHECK (public.has_role(auth.uid(),'host'));
CREATE POLICY "Host deletes settings" ON public.settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'host'));

CREATE TABLE public.site_content (key text PRIMARY KEY, value text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads content" ON public.site_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Host inserts content" ON public.site_content FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'host'));
CREATE POLICY "Host updates content" ON public.site_content FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'host')) WITH CHECK (public.has_role(auth.uid(),'host'));
CREATE POLICY "Host deletes content" ON public.site_content FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'host'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER site_content_touch BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.chapters (
  number int PRIMARY KEY CHECK (number BETWEEN 1 AND 10),
  date date NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  scripture_ref text,
  scripture_text text,
  photo_url text,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT (number, date, title, summary, sort_order) ON public.chapters TO anon, authenticated;
GRANT UPDATE (date, title, summary, scripture_ref, scripture_text, photo_url, sort_order) ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads chapter basics" ON public.chapters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Host updates chapters" ON public.chapters FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'host')) WITH CHECK (public.has_role(auth.uid(),'host'));

CREATE OR REPLACE FUNCTION public.chapter_scriptures()
RETURNS TABLE (number int, scripture_ref text, scripture_text text, photo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.number, c.scripture_ref, c.scripture_text, c.photo_url FROM public.chapters c
  WHERE public.has_role(auth.uid(),'trip_guest') OR public.has_role(auth.uid(),'host')
  ORDER BY c.sort_order
$$;
REVOKE EXECUTE ON FUNCTION public.chapter_scriptures() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chapter_scriptures() TO authenticated;

CREATE POLICY "Friends view guest photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'guest-photos' AND (public.has_role(auth.uid(),'trip_guest') OR public.has_role(auth.uid(),'host')));
CREATE POLICY "Host uploads guest photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'guest-photos' AND public.has_role(auth.uid(),'host'));
CREATE POLICY "Host updates guest photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'guest-photos' AND public.has_role(auth.uid(),'host'));
CREATE POLICY "Host deletes guest photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'guest-photos' AND public.has_role(auth.uid(),'host'));

INSERT INTO public.role_invites (email, role) VALUES ('demvic007@yahoo.com','host');
INSERT INTO public.guests (full_name, display_name, email, status) VALUES ('Demilade','Demi','demvic007@yahoo.com','confirmed');

INSERT INTO public.settings (key, value) VALUES
 ('trip_start','2026-11-20'),('trip_end','2026-11-29'),('after_trip_start','2026-11-30'),('timezone','Africa/Johannesburg');

INSERT INTO public.chapters (number, date, title, summary, sort_order) VALUES
 (1,'2026-11-20','Opening Credits','Touchdown, a late arrival at the villa, and a soft landing.',1),
 (2,'2026-11-21','Slow Mornings and Wanderlust','A slow morning, the Old Biscuit Mill, and dinner on Bree Street.',2),
 (3,'2026-11-22','Based on a True Story','Robben Island by ferry, the Waterfront, and an early night.',3),
 (4,'2026-11-23','Into The Wild','A full day on safari at Aquila.',4),
 (5,'2026-11-24','It’s giving…Grown','Worship, yoga, massages, and Demi’s birthday dinner at the villa.',5),
 (6,'2026-11-25','The Great Cape Caper','Chapman’s Peak on the way to the penguins, Kalk Bay, and Talent Night.',6),
 (7,'2026-11-26','Soft Life, naturally','Babylonstoren, a picnic at Boschendal, and a free evening.',7),
 (8,'2026-11-27','Demi ma pa wa na','Table Mountain by cable car, Bo-Kaap, dinner on Kloof Street, and a night out.',8),
 (9,'2026-11-28','The Art of Almost Leaving','Checkout, a new base for the night, Zeitz MOCAA, and sunset at Signal Hill.',9),
 (10,'2026-11-29','End Credits','Oranjezicht market, the Sea Point Promenade, and the flight home.',10);

INSERT INTO public.site_content (key, value) VALUES
 ('nav.home','Home'),('nav.itinerary','Itinerary'),('nav.travel','Travel'),('nav.purse','Purse'),('nav.journal','Journal'),
 ('nav.sign_in','Sign in'),('nav.sign_out','Sign out'),
 ('footer.line','30° South · Cape Town · November 2026'),
 ('gate.title','Just for friends'),('gate.body','This part is just for friends. Sign in to see it.'),('gate.link','Sign in'),
 ('common.coming_soon','Coming soon'),
 ('common.photo_slot','Photo slot'),
 ('signin.title','Sign in'),('signin.intro','Enter the email Demi has on the list and we’ll send you a sign-in link.'),
 ('signin.button','Send my link'),('signin.sent','Check your inbox. Your sign-in link is on its way.'),
 ('signin.not_found','We couldn’t find that email. Ask Demi to add you.'),
 ('home.hero.welcome','WELCOME TO DEMILADE’S 30TH'),
 ('home.hero.place','CAPE TOWN, SOUTH AFRICA · NOVEMBER 20–29, 2026'),
 ('home.hero.days_to_go','days to go'),('home.hero.day_to_go','day to go'),
 ('home.card1.eyebrow','ONE SITE, DIFFERENT MOMENTS'),
 ('home.card1.headline','A place that changes with the journey.'),
 ('home.card1.sentence','Before Cape Town, while we’re together, and after the last flight home, 30° South stays familiar.'),
 ('home.card1.before.heading','The journey begins here.'),
 ('home.card1.before.sentence','Itinerary, travel information, and everything to arrange before Cape Town.'),
 ('home.card1.during.heading','Your day, at a glance.'),
 ('home.card1.during.sentence','Today’s plan, the weather, and a verse for the morning.'),
 ('home.card1.after.heading','The memories remain.'),
 ('home.card1.after.sentence','Look back through the Journal and the trip in numbers.'),
 ('home.card2.eyebrow','THE PLAN'),('home.card2.headline','Ten chapters, one story.'),
 ('home.card2.sentence','See the whole trip at a glance, then open any day for the play-by-play and what to wear.'),('home.card2.button','OPEN ITINERARY'),
 ('home.card3.eyebrow','GETTING THERE'),('home.card3.headline','Everything for the journey.'),
 ('home.card3.sentence','Flights, the villa, what to pack, and who’s coming.'),('home.card3.button','OPEN TRAVEL'),
 ('home.card4.eyebrow','THE FINANCIAL SIDE OF THINGS'),('home.card4.headline','The practical bit, made pretty.'),
 ('home.card4.sentence','Choose what you’re joining and see who owes whom, without the spreadsheet.'),('home.card4.button','OPEN PURSE'),
 ('home.card5.eyebrow','BEYOND THE ITINERARY'),('home.card5.headline','The stories in between.'),
 ('home.card5.sentence','Journal gives the little things their own place: the photographs, shared stories, private pages and words sent with love.'),
 ('home.card5.button','EXPLORE JOURNAL'),('home.card5.caption','Somewhere along the coast'),('home.card5.note','The moments we didn’t plan for.'),
 ('home.during.title','We’re in Cape Town'),('home.after.title','Home again'),
 ('itinerary.title','Itinerary'),('itinerary.intro','Ten chapters, one story.'),
 ('itinerary.tab.script','Script'),('itinerary.tab.scenes','Scenes'),('itinerary.tab.wardrobe','Wardrobe'),
 ('travel.title','Travel'),('travel.intro','Everything for the journey.'),
 ('purse.title','Purse'),('purse.intro','The practical bit, made pretty.'),
 ('purse.tab.experiences','Shared Experiences'),('purse.tab.expenses','Shared Expenses'),('purse.tab.sum','Sum of It All'),
 ('journal.title','Journal'),('journal.intro','The stories in between.'),
 ('journal.tab.commons','Our Commons'),('journal.tab.personal','Personal Journal'),('journal.tab.heart','Close to Heart');
