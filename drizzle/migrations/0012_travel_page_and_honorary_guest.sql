-- Honorary guests can view the itinerary too
CREATE OR REPLACE FUNCTION public.can_view_itinerary(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('host','schedule_manager','trip_guest','friend_afar','honorary_guest'))
$$;

-- Travel helpers (friend_afar is intentionally NOT a travel viewer)
CREATE OR REPLACE FUNCTION public.can_view_travel(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('host','schedule_manager','trip_guest','honorary_guest'))
$$;
CREATE OR REPLACE FUNCTION public.can_edit_travel(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('host','schedule_manager'))
$$;
CREATE OR REPLACE FUNCTION public.is_trip_participant(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('host','schedule_manager','trip_guest'))
$$;
CREATE OR REPLACE FUNCTION public.travel_share_all()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT value FROM public.settings WHERE key = 'travel_share_all'), 'true') = 'true'
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_travel(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_edit_travel(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_trip_participant(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.travel_share_all() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_view_travel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_travel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.travel_share_all() TO authenticated;

-- Base role comes from role_invites when one exists; otherwise trip_guest
CREATE OR REPLACE FUNCTION public.link_guest(_user_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE g_id uuid;
BEGIN
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
END $$;

CREATE OR REPLACE FUNCTION public.on_guest_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = OLD.user_id AND role IN ('trip_guest','schedule_manager','friend_afar','honorary_guest');
  END IF;
  DELETE FROM public.role_invites WHERE lower(email) = lower(OLD.email) AND role <> 'host';
  RETURN OLD;
END $$;

-- Host-only base role picker (trip_guest | friend_afar | honorary_guest)
CREATE OR REPLACE FUNCTION public.set_guest_role(_guest_id uuid, _role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  IF NOT public.has_role(auth.uid(),'host') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _role NOT IN ('trip_guest','friend_afar','honorary_guest') THEN RAISE EXCEPTION 'invalid role'; END IF;
  SELECT * INTO g FROM public.guests WHERE id = _guest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'guest not found'; END IF;
  DELETE FROM public.role_invites WHERE lower(email) = lower(g.email) AND role IN ('trip_guest','friend_afar','honorary_guest');
  INSERT INTO public.role_invites (email, role) VALUES (lower(g.email), _role);
  IF g.user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = g.user_id AND role IN ('trip_guest','friend_afar','honorary_guest');
    INSERT INTO public.user_roles (user_id, role) VALUES (g.user_id, _role) ON CONFLICT DO NOTHING;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_guest_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_guest_role(uuid, app_role) TO authenticated;

-- Guests: cast fields (status = 'confirmed' is the existing confirmation field)
ALTER TABLE public.guests ADD COLUMN pronoun_form text;
ALTER TABLE public.guests ADD COLUMN cast_order integer;
ALTER TABLE public.guests ADD COLUMN cast_role_override text;
ALTER TABLE public.guests ADD CONSTRAINT guests_pronoun_form_check
  CHECK (pronoun_form IS NULL OR pronoun_form IN ('himself','herself','themselves'));

-- Travel images (one row per slot)
CREATE TABLE public.travel_images (
  slot text PRIMARY KEY,
  storage_path text NOT NULL,
  focal_x integer NOT NULL DEFAULT 50,
  focal_y integer NOT NULL DEFAULT 50,
  alt text NOT NULL DEFAULT '',
  caption text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_images TO authenticated;
GRANT ALL ON public.travel_images TO service_role;
ALTER TABLE public.travel_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Viewers read travel images" ON public.travel_images FOR SELECT TO authenticated
  USING (public.can_view_travel(auth.uid()));
CREATE POLICY "Editors manage travel images" ON public.travel_images FOR ALL TO authenticated
  USING (public.can_edit_travel(auth.uid())) WITH CHECK (public.can_edit_travel(auth.uid()));

-- Villa rooms and assignments
CREATE TABLE public.villa_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  bed_config text NOT NULL DEFAULT '',
  sleeps integer NOT NULL DEFAULT 2,
  level text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.villa_rooms TO authenticated;
GRANT ALL ON public.villa_rooms TO service_role;
ALTER TABLE public.villa_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Viewers read rooms" ON public.villa_rooms FOR SELECT TO authenticated
  USING (public.can_view_travel(auth.uid()));
CREATE POLICY "Editors manage rooms" ON public.villa_rooms FOR ALL TO authenticated
  USING (public.can_edit_travel(auth.uid())) WITH CHECK (public.can_edit_travel(auth.uid()));

CREATE TABLE public.room_assignments (
  room_id uuid NOT NULL REFERENCES public.villa_rooms(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, guest_id),
  UNIQUE (guest_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_assignments TO authenticated;
GRANT ALL ON public.room_assignments TO service_role;
ALTER TABLE public.room_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Viewers read assignments" ON public.room_assignments FOR SELECT TO authenticated
  USING (public.can_view_travel(auth.uid()));
CREATE POLICY "Editors manage assignments" ON public.room_assignments FOR ALL TO authenticated
  USING (public.can_edit_travel(auth.uid())) WITH CHECK (public.can_edit_travel(auth.uid()));

INSERT INTO public.villa_rooms (label, bed_config, sleeps, sort_order) VALUES
  ('Room 1','King',2,1),('Room 2','King',2,2),('Room 3','King',2,3),
  ('Room 4','Twin',2,4),('Room 5','Twin',2,5),('Room 6','Two queens',4,6);

-- Transfers
CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL,
  label text NOT NULL,
  meet_time timestamp without time zone,
  meeting_point text,
  provider text,
  driver_contact text,
  included_with_villa boolean NOT NULL DEFAULT false,
  notes text,
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors manage transfers" ON public.transfers FOR ALL TO authenticated
  USING (public.can_edit_travel(auth.uid())) WITH CHECK (public.can_edit_travel(auth.uid()));

-- Flight legs (Cape Town local time only; no booking refs or seat numbers)
CREATE TABLE public.travel_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  direction text NOT NULL,
  airline text NOT NULL DEFAULT '',
  flight_number text NOT NULL DEFAULT '',
  other_airport text NOT NULL DEFAULT '',
  cpt_time timestamp without time zone NOT NULL,
  terminal text,
  notes text,
  transfer_id uuid REFERENCES public.transfers(id) ON DELETE SET NULL,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_legs TO authenticated;
GRANT ALL ON public.travel_legs TO service_role;
ALTER TABLE public.travel_legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Viewers read shared or own legs" ON public.travel_legs FOR SELECT TO authenticated
  USING (public.can_view_travel(auth.uid()) AND (visible OR public.can_edit_travel(auth.uid()))
    AND (public.travel_share_all() OR public.can_edit_travel(auth.uid())
      OR guest_id = (SELECT g.id FROM public.guests g WHERE g.user_id = auth.uid())));
CREATE POLICY "Editors manage legs" ON public.travel_legs FOR ALL TO authenticated
  USING (public.can_edit_travel(auth.uid())) WITH CHECK (public.can_edit_travel(auth.uid()));

-- Transfers viewer policy (needs travel_legs to exist)
CREATE POLICY "Viewers read shared or own transfers" ON public.transfers FOR SELECT TO authenticated
  USING (public.can_view_travel(auth.uid()) AND (visible OR public.can_edit_travel(auth.uid()))
    AND (public.travel_share_all() OR public.can_edit_travel(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.travel_legs l
      WHERE l.transfer_id = transfers.id AND l.guest_id = (SELECT g.id FROM public.guests g WHERE g.user_id = auth.uid()))));

-- Packing
CREATE TABLE public.packing_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_categories TO authenticated;
GRANT ALL ON public.packing_categories TO service_role;
ALTER TABLE public.packing_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Viewers read packing categories" ON public.packing_categories FOR SELECT TO authenticated
  USING (public.can_view_travel(auth.uid()));
CREATE POLICY "Editors manage packing categories" ON public.packing_categories FOR ALL TO authenticated
  USING (public.can_edit_travel(auth.uid())) WITH CHECK (public.can_edit_travel(auth.uid()));

CREATE TABLE public.packing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.packing_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  note text,
  chapter_number integer REFERENCES public.chapters(number),
  look_order integer,
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_items TO authenticated;
GRANT ALL ON public.packing_items TO service_role;
ALTER TABLE public.packing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Viewers read visible packing items" ON public.packing_items FOR SELECT TO authenticated
  USING (public.can_view_travel(auth.uid()) AND (visible OR public.can_edit_travel(auth.uid())));
CREATE POLICY "Editors manage packing items" ON public.packing_items FOR ALL TO authenticated
  USING (public.can_edit_travel(auth.uid())) WITH CHECK (public.can_edit_travel(auth.uid()));

CREATE TABLE public.packing_checks (
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.packing_items(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_checks TO authenticated;
GRANT ALL ON public.packing_checks TO service_role;
ALTER TABLE public.packing_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Friends read own checks" ON public.packing_checks FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.can_view_travel(auth.uid()));
CREATE POLICY "Friends write own checks" ON public.packing_checks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_travel(auth.uid()));
CREATE POLICY "Friends delete own checks" ON public.packing_checks FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.can_view_travel(auth.uid()));

-- Travel image bucket policies (bucket itself is created via the storage tool)
CREATE POLICY "Viewers read travel image files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'travel-images' AND public.can_view_travel(auth.uid()));
CREATE POLICY "Editors upload travel image files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'travel-images' AND public.can_edit_travel(auth.uid()));
CREATE POLICY "Editors update travel image files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'travel-images' AND public.can_edit_travel(auth.uid()));
CREATE POLICY "Editors delete travel image files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'travel-images' AND public.can_edit_travel(auth.uid()));

-- Settings seed
INSERT INTO public.settings (key, value) VALUES ('travel_share_all', 'true') ON CONFLICT (key) DO NOTHING;

-- Editable copy seeds
INSERT INTO public.site_content (key, value) VALUES
  ('travel_subtitle', 'Wheels down to wheels up.'),
  ('cast_heading', 'CAST'),
  ('cast_subheading', '(IN NO PARTICULAR ORDER)'),
  ('cast_deck', ''),
  ('villa_name', 'Lobster Villa'),
  ('villa_address', '10 Hoopoe Ave, Camps Bay, Cape Town'),
  ('villa_stay', 'Fri, Nov 20 to Sat, Nov 28'),
  ('villa_checkin', '2:00 PM'),
  ('villa_checkout', '10:00 AM'),
  ('villa_about', ''),
  ('villa_house_rules', 'No children under 12. Smoking outside only. The house has a noise monitor, so please keep the volume reasonable late at night.'),
  ('villa_amenities', 'Private pool and jacuzzi, garden and outdoor lounge, Wi-Fi and DStv, a fully equipped kitchen with Nespresso machine, dishwasher, washer and dryer, air conditioning in every bedroom, alarm and security system, double garage, daily housekeeping Monday to Saturday (excluding public holidays), linen and towels included.'),
  ('villa_power_note', 'Backup power keeps the lights, plugs, TV, Wi-Fi, fridge and gas hobs running. Air conditioning, geysers and the oven are not covered.'),
  ('villa_after_checkout', ''),
  ('flights_deck', ''),
  ('flights_getting_to_villa', ''),
  ('flights_power_and_time', 'South Africa runs on SAST (UTC+2), no daylight saving. Sockets are Type M and N, 230 V, 50 Hz. Bring an adapter.'),
  ('packing_deck', ''),
  ('gate_heading', 'You''re here in spirit.'),
  ('gate_message_rsvp', 'RSVPs are for friends who are on the trip, so the plans stay accurate for everyone. You can see everything, and your reflections are always yours.'),
  ('gate_message_commons', 'Our Commons is where the friends on the trip share moments as they happen. You can read along, and your own reflections are yours alone.'),
  ('gate_message_expense', 'Shared expenses are only for the friends on the trip. You can see the shared experiences, just not split costs.'),
  ('gate_message_default', 'This part is for the friends on the trip. You can still see everything else.'),
  ('travel.section.cast', 'CAST'),
  ('travel.section.villa', 'THE VILLA'),
  ('travel.section.flights', 'FLIGHTS'),
  ('travel.section.packing', 'THINGS TO PACK'),
  ('travel.cast.empty', 'The cast will be announced.'),
  ('travel.flights.empty', 'Flights will appear here once they are added.'),
  ('travel.your_flight', 'YOUR FLIGHT'),
  ('travel.your_flights', 'YOUR FLIGHTS'),
  ('travel.arrivals', 'ARRIVALS'),
  ('travel.departures', 'DEPARTURES'),
  ('travel.rooms', 'ROOMS'),
  ('travel.not_assigned', 'Not assigned yet'),
  ('travel.included_villa', 'Included with the villa booking'),
  ('travel.checkin', 'CHECK-IN'),
  ('travel.checkout', 'CHECK-OUT'),
  ('travel.about', 'ABOUT'),
  ('travel.amenities', 'AMENITIES'),
  ('travel.house_rules', 'HOUSE RULES'),
  ('travel.power_note', 'POWER'),
  ('travel.after_checkout', 'AFTER CHECK-OUT'),
  ('travel.getting_to_villa', 'GETTING TO THE VILLA'),
  ('travel.power_time', 'POWER & TIME'),
  ('travel.continued', '(CONTINUED)'),
  ('travel.packed', 'packed'),
  ('travel.of', 'of'),
  ('admin.tab.travel', 'Travel'),
  ('admin.travel.cast', 'Cast'),
  ('admin.travel.villa', 'Villa'),
  ('admin.travel.flights', 'Flights'),
  ('admin.travel.transfers', 'Transfers'),
  ('admin.travel.packing', 'Packing'),
  ('admin.travel.images', 'Images'),
  ('admin.travel.settings', 'Settings'),
  ('admin.travel.share_all', 'On: every friend sees everyone''s flights. Off: friends see only their own.'),
  ('home.card3.live_arrival', 'Your arrival'),
  ('home.card3.live_departure', 'Your departure')
ON CONFLICT (key) DO NOTHING;