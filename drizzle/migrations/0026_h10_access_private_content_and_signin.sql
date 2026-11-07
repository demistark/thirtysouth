CREATE TABLE public.private_content (key text PRIMARY KEY, value text NOT NULL DEFAULT '', updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_content TO authenticated;
GRANT ALL ON public.private_content TO service_role;
ALTER TABLE public.private_content ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.can_view_private_content(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_trip_participant(_user_id) $$;
REVOKE ALL ON FUNCTION public.can_view_private_content(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_view_private_content(uuid) TO authenticated;
CREATE POLICY "Trip participants read private content" ON public.private_content FOR SELECT TO authenticated USING(public.can_view_private_content(auth.uid()));
CREATE POLICY "Travel editors insert private content" ON public.private_content FOR INSERT TO authenticated WITH CHECK(public.can_edit_travel(auth.uid()));
CREATE POLICY "Travel editors update private content" ON public.private_content FOR UPDATE TO authenticated USING(public.can_edit_travel(auth.uid())) WITH CHECK(public.can_edit_travel(auth.uid()));
CREATE POLICY "Travel editors delete private content" ON public.private_content FOR DELETE TO authenticated USING(public.can_edit_travel(auth.uid()));
CREATE TRIGGER private_content_touch BEFORE UPDATE ON public.private_content FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.private_content(key,value,updated_at) SELECT key,value,updated_at FROM public.site_content WHERE key IN ('villa_address','villa_vrbo_url','villa_website_url','villa_checkin','villa_checkout','villa_house_rules','villa_amenities','villa_power_note','villa_about','villa_after_checkout','flights_getting_to_villa','splitwise_url') ON CONFLICT(key) DO NOTHING;
DELETE FROM public.site_content WHERE key IN ('villa_address','villa_vrbo_url','villa_website_url','villa_checkin','villa_checkout','villa_house_rules','villa_amenities','villa_power_note','villa_about','villa_after_checkout','flights_getting_to_villa','splitwise_url');
INSERT INTO public.user_roles(user_id,role) SELECT user_id,'friend_afar'::public.app_role FROM public.user_roles WHERE role='honorary_guest' ON CONFLICT(user_id,role) DO NOTHING;
DELETE FROM public.user_roles WHERE role='honorary_guest';
INSERT INTO public.role_invites(email,role) SELECT email,'friend_afar'::public.app_role FROM public.role_invites WHERE role='honorary_guest' ON CONFLICT(email,role) DO NOTHING;
DELETE FROM public.role_invites WHERE role='honorary_guest';
UPDATE public.guests SET pending_role='friend_afar' WHERE pending_role='honorary_guest';
DELETE FROM public.settings WHERE key IN ('commons_show_honorary','heart_show_honorary');
CREATE OR REPLACE FUNCTION public.can_view_itinerary(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('host','schedule_manager','trip_guest','friend_afar')) $$;
CREATE OR REPLACE FUNCTION public.can_view_travel(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.can_view_itinerary(_user_id) $$;
CREATE OR REPLACE FUNCTION public.can_view_purse(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.can_view_itinerary(_user_id) $$;
REVOKE ALL ON FUNCTION public.can_view_itinerary(uuid),public.can_view_travel(uuid),public.can_view_purse(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_view_itinerary(uuid),public.can_view_travel(uuid),public.can_view_purse(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.journal_level(_user_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT CASE WHEN public.is_trip_participant(_user_id) THEN 'participant' WHEN public.has_role(_user_id,'friend_afar') THEN 'afar' ELSE 'none' END $$;
-- Preserve the exact live functions, removing only the retired role from role lists.
DO $$ DECLARE f record; BEGIN FOR f IN SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN ('set_guest_role','on_guest_deleted','cast_list','ensure_cast_order') LOOP EXECUTE replace(f.def,',''honorary_guest''',''); END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.link_guest(_user_id uuid,_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$ DECLARE g_id uuid; BEGIN
IF _email IS NULL OR trim(_email)='' THEN RETURN; END IF;
IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=_user_id AND email_confirmed_at IS NOT NULL) THEN RETURN; END IF;
SELECT id INTO g_id FROM public.guests WHERE lower(email)=lower(trim(_email)); IF g_id IS NULL THEN RETURN; END IF;
UPDATE public.guests SET user_id=_user_id WHERE id=g_id AND (user_id IS NULL OR user_id=_user_id);
INSERT INTO public.user_roles(user_id,role) SELECT _user_id,ri.role FROM public.role_invites ri WHERE lower(ri.email)=lower(trim(_email)) AND ri.role IN ('host','schedule_manager','trip_guest','friend_afar') ON CONFLICT DO NOTHING;
IF NOT EXISTS(SELECT 1 FROM public.role_invites WHERE lower(email)=lower(trim(_email))) THEN INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,'trip_guest') ON CONFLICT DO NOTHING; END IF; END $$;
DROP POLICY "Travel friends read Roomies" ON public.travel_roomies;
CREATE POLICY "Travel friends read Roomies" ON public.travel_roomies FOR SELECT TO authenticated USING(public.can_view_travel(auth.uid()));
DROP POLICY "Friends write own checks" ON public.packing_checks;
CREATE POLICY "Friends write own checks" ON public.packing_checks FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.is_trip_participant(auth.uid()));
DROP POLICY "Friends delete own checks" ON public.packing_checks;
CREATE POLICY "Friends delete own checks" ON public.packing_checks FOR DELETE TO authenticated USING(user_id=auth.uid() AND public.is_trip_participant(auth.uid()));
DROP POLICY "Journal readers see visible commons posts" ON public.commons_posts;
CREATE POLICY "Journal readers see visible commons posts" ON public.commons_posts FOR SELECT TO authenticated USING (((NOT hidden) OR public.can_edit_journal(auth.uid())) AND CASE public.journal_level(auth.uid()) WHEN 'participant' THEN true WHEN 'afar' THEN coalesce((SELECT value FROM public.settings WHERE key='commons_show_afar'),'true')='true' ELSE false END);
DROP POLICY "Journal readers see visible heart cards" ON public.heart_cards;
CREATE POLICY "Journal readers see visible heart cards" ON public.heart_cards FOR SELECT TO authenticated USING (((NOT hidden) OR public.can_edit_journal(auth.uid())) AND CASE public.journal_level(auth.uid()) WHEN 'participant' THEN true WHEN 'afar' THEN coalesce((SELECT value FROM public.settings WHERE key='heart_show_afar'),'true')='true' ELSE false END);
DROP POLICY "Journal photo read mirrors tab access" ON storage.objects;
CREATE POLICY "Journal photo read mirrors tab access" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='journal-photos' AND CASE (storage.foldername(name))[1] WHEN 'commons' THEN CASE public.journal_level(auth.uid()) WHEN 'participant' THEN true WHEN 'afar' THEN coalesce((SELECT value FROM public.settings WHERE key='commons_show_afar'),'true')='true' ELSE false END WHEN 'heart' THEN CASE public.journal_level(auth.uid()) WHEN 'participant' THEN true WHEN 'afar' THEN coalesce((SELECT value FROM public.settings WHERE key='heart_show_afar'),'true')='true' ELSE false END ELSE false END);
-- Keep chapters public: signed-out Script uses its day outline and HomeIntro waits for the query.
REVOKE EXECUTE ON FUNCTION public.is_invited(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_invited(text) TO authenticated;
INSERT INTO public.site_content(key,value) VALUES
('signin.sent_title','Your link is on its way.'),('signin.sent_body','It can take a minute. If it doesn''t arrive, double-check the email and try again.'),
('enter.code_title','Your personal code'),('enter.code_intro','Type the code you were sent. This phone will remember you.'),('enter.code_label','Your personal code'),('enter.continue','Continue'),('enter.name_title','And your name?'),('enter.name_intro','The name Demi has you down as.'),('enter.name_label','Your name'),('enter.come_in','Come in'),('enter.back','Back'),('enter.error','That didn''t work. Check your code and your name and try again.'),('enter.locked','Too many tries just now. Take a breath and try again in a little while.'),('enter.code_placeholder','COAST-7K4M2'),
('travel.villa_private_note','The rest of the villa details are for friends on the trip.'),('admin.content.private_title','Private text. Only people on the trip can read this.'),('admin.content.private_add','Add a private row'),('admin.content.private_key','Key'),('admin.content.private_value','Value'),('admin.afar.add_title','Add a friend'),('admin.afar.add_label','Friend''s name'),('admin.afar.add_button','Add and make a code'),('admin.afar.whatsapp','Open in WhatsApp'),('admin.afar.add_error','Couldn''t add a friend and make a code. Try again.'),('admin.journal.non_participant_label','Message for friends afar'),('commons.composer_label','PIN SOMETHING TO THE BOARD'),('commons.pin','Pin it') ON CONFLICT(key) DO NOTHING;