-- Journal: Our Commons, Reflections, Close to Heart (additive)

-- Access helpers -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.journal_level(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(_user_id,'host') OR public.has_role(_user_id,'schedule_manager') OR public.has_role(_user_id,'trip_guest') THEN 'participant'
    WHEN public.has_role(_user_id,'honorary_guest') THEN 'honorary'
    WHEN public.has_role(_user_id,'friend_afar') THEN 'afar'
    ELSE 'none' END
$$;
REVOKE EXECUTE ON FUNCTION public.journal_level(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.journal_level(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_journal(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.journal_level(_user_id) <> 'none'
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_journal(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_view_journal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_edit_journal(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'host') OR public.has_role(_user_id,'schedule_manager')
$$;
REVOKE EXECUTE ON FUNCTION public.can_edit_journal(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_edit_journal(uuid) TO authenticated;

-- Site-wide phase (America/Detroit settings; override wins unless 'auto') -----
CREATE OR REPLACE FUNCTION public.current_phase()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _override text;
  _start text;
  _end text;
  _now timestamp;
BEGIN
  SELECT value INTO _override FROM public.settings WHERE key = 'phase_override';
  IF _override IS NOT NULL AND _override <> 'auto' THEN RETURN _override; END IF;
  SELECT value INTO _start FROM public.settings WHERE key = 'phase_during_start';
  SELECT value INTO _end FROM public.settings WHERE key = 'phase_during_end';
  _now := now() AT TIME ZONE 'America/Detroit';
  IF _start IS NOT NULL AND _now < _start::timestamp THEN RETURN 'before'; END IF;
  IF _end IS NOT NULL AND _now > _end::timestamp THEN RETURN 'after'; END IF;
  RETURN 'during';
END $$;
REVOKE EXECUTE ON FUNCTION public.current_phase() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_phase() TO authenticated;

-- Tables ---------------------------------------------------------------------
CREATE TABLE public.commons_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  body text,
  photo_path text,
  photo_w integer,
  photo_h integer,
  card_style text NOT NULL CHECK (card_style IN ('note','page','book','polaroid','film')),
  size_pct integer NOT NULL CHECK (size_pct BETWEEN 72 AND 100),
  tilt_deg numeric NOT NULL DEFAULT 0,
  tint text CHECK (tint IN ('apricot','seafoam','sand')),
  stamp boolean NOT NULL DEFAULT false,
  page_number integer,
  frame_no integer,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commons_posts_body_or_photo CHECK (body IS NOT NULL OR photo_path IS NOT NULL),
  CONSTRAINT commons_posts_request_unique UNIQUE (author_guest_id, request_id)
);
GRANT SELECT, UPDATE, DELETE ON public.commons_posts TO authenticated;
GRANT ALL ON public.commons_posts TO service_role;
ALTER TABLE public.commons_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Journal readers see visible commons posts" ON public.commons_posts FOR SELECT TO authenticated USING (
  (NOT hidden OR public.can_edit_journal(auth.uid()))
  AND CASE public.journal_level(auth.uid())
    WHEN 'participant' THEN true
    WHEN 'honorary' THEN coalesce((SELECT value FROM public.settings WHERE key='commons_show_honorary'),'true') = 'true'
    WHEN 'afar' THEN coalesce((SELECT value FROM public.settings WHERE key='commons_show_afar'),'true') = 'true'
    ELSE false END
);
CREATE POLICY "Journal editors update commons posts" ON public.commons_posts FOR UPDATE TO authenticated
  USING (public.can_edit_journal(auth.uid())) WITH CHECK (public.can_edit_journal(auth.uid()));
CREATE POLICY "Journal editors delete commons posts" ON public.commons_posts FOR DELETE TO authenticated
  USING (public.can_edit_journal(auth.uid()));

CREATE TABLE public.reflection_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reflection_entries_one_per_day UNIQUE (guest_id, entry_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflection_entries TO authenticated;
GRANT ALL ON public.reflection_entries TO service_role;
ALTER TABLE public.reflection_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authors read own reflections" ON public.reflection_entries FOR SELECT TO authenticated
  USING (guest_id = public.my_guest());
CREATE POLICY "Authors add own reflections" ON public.reflection_entries FOR INSERT TO authenticated
  WITH CHECK (guest_id = public.my_guest() AND public.is_trip_participant(auth.uid()));
CREATE POLICY "Authors edit own reflections" ON public.reflection_entries FOR UPDATE TO authenticated
  USING (guest_id = public.my_guest()) WITH CHECK (guest_id = public.my_guest());
CREATE POLICY "Authors delete own reflections" ON public.reflection_entries FOR DELETE TO authenticated
  USING (guest_id = public.my_guest());

CREATE OR REPLACE FUNCTION public.validate_reflection_date()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entry_date > current_date + 1 THEN
    RAISE EXCEPTION 'entry_date_future';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reflection_entries_validate_date BEFORE INSERT OR UPDATE ON public.reflection_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_reflection_date();
CREATE TRIGGER reflection_entries_touch BEFORE UPDATE ON public.reflection_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.heart_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  body text NOT NULL,
  city text,
  photo_path text,
  photo_w integer,
  photo_h integer,
  pinned boolean NOT NULL DEFAULT false,
  pinned_at timestamptz,
  tilt_deg numeric NOT NULL DEFAULT 0 CHECK (tilt_deg BETWEEN -1 AND 1),
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT heart_cards_request_unique UNIQUE (author_guest_id, request_id)
);
GRANT SELECT, UPDATE, DELETE ON public.heart_cards TO authenticated;
GRANT ALL ON public.heart_cards TO service_role;
ALTER TABLE public.heart_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Journal readers see visible heart cards" ON public.heart_cards FOR SELECT TO authenticated USING (
  (NOT hidden OR public.can_edit_journal(auth.uid()))
  AND CASE public.journal_level(auth.uid())
    WHEN 'participant' THEN true
    WHEN 'honorary' THEN coalesce((SELECT value FROM public.settings WHERE key='heart_show_honorary'),'true') = 'true'
    WHEN 'afar' THEN coalesce((SELECT value FROM public.settings WHERE key='heart_show_afar'),'true') = 'true'
    ELSE false END
);
CREATE POLICY "Journal editors update heart cards" ON public.heart_cards FOR UPDATE TO authenticated
  USING (public.can_edit_journal(auth.uid())) WITH CHECK (public.can_edit_journal(auth.uid()));
CREATE POLICY "Journal editors delete heart cards" ON public.heart_cards FOR DELETE TO authenticated
  USING (public.can_edit_journal(auth.uid()));

-- Posting RPCs (limits enforced in the database, idempotent on request id) ---
CREATE OR REPLACE FUNCTION public.create_commons_post(
  _request_id uuid, _body text, _photo_path text, _photo_w integer, _photo_h integer,
  _card_style text, _size_pct integer, _tilt_deg numeric, _tint text, _stamp boolean,
  _page_number integer, _frame_no integer
) RETURNS public.commons_posts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _guest uuid := public.my_guest();
  _existing public.commons_posts;
  _row public.commons_posts;
  _max_chars integer := coalesce((SELECT value::integer FROM public.settings WHERE key='commons_chars'), 500);
  _per_day integer := coalesce((SELECT value::integer FROM public.settings WHERE key='commons_posts_per_day'), 5);
  _today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
  IF _guest IS NULL OR NOT public.is_trip_participant(auth.uid()) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;
  SELECT * INTO _existing FROM public.commons_posts WHERE author_guest_id = _guest AND request_id = _request_id;
  IF FOUND THEN RETURN _existing; END IF;
  IF public.current_phase() = 'before' AND NOT public.has_role(auth.uid(),'host') THEN
    RAISE EXCEPTION 'commons_not_open';
  END IF;
  IF _body IS NULL AND _photo_path IS NULL THEN
    RAISE EXCEPTION 'empty_post';
  END IF;
  IF _body IS NOT NULL AND length(_body) > _max_chars THEN
    RAISE EXCEPTION 'too_long';
  END IF;
  IF (SELECT count(*) FROM public.commons_posts
      WHERE author_guest_id = _guest
        AND (created_at AT TIME ZONE 'Africa/Johannesburg')::date = _today) >= _per_day THEN
    RAISE EXCEPTION 'daily_limit';
  END IF;
  INSERT INTO public.commons_posts (
    author_guest_id, request_id, body, photo_path, photo_w, photo_h,
    card_style, size_pct, tilt_deg, tint, stamp, page_number, frame_no
  ) VALUES (
    _guest, _request_id, nullif(trim(_body),''), _photo_path, _photo_w, _photo_h,
    _card_style, _size_pct, _tilt_deg, _tint, coalesce(_stamp,false), _page_number, _frame_no
  ) RETURNING * INTO _row;
  RETURN _row;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_commons_post(uuid,text,text,integer,integer,text,integer,numeric,text,boolean,integer,integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_commons_post(uuid,text,text,integer,integer,text,integer,numeric,text,boolean,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_heart_card(
  _request_id uuid, _body text, _city text, _photo_path text, _photo_w integer, _photo_h integer, _tilt_deg numeric
) RETURNS public.heart_cards LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _guest uuid := public.my_guest();
  _existing public.heart_cards;
  _row public.heart_cards;
  _max_chars integer := coalesce((SELECT value::integer FROM public.settings WHERE key='heart_chars'), 800);
  _per_person integer := coalesce((SELECT value::integer FROM public.settings WHERE key='heart_cards_per_person'), 5);
  _photo_max integer := coalesce((SELECT value::integer FROM public.settings WHERE key='heart_photos_per_person'), 3);
BEGIN
  IF _guest IS NULL OR NOT public.can_view_journal(auth.uid()) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  SELECT * INTO _existing FROM public.heart_cards WHERE author_guest_id = _guest AND request_id = _request_id;
  IF FOUND THEN RETURN _existing; END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN
    RAISE EXCEPTION 'empty_card';
  END IF;
  IF length(_body) > _max_chars THEN
    RAISE EXCEPTION 'too_long';
  END IF;
  IF _city IS NOT NULL AND length(_city) > 60 THEN
    RAISE EXCEPTION 'city_too_long';
  END IF;
  IF (SELECT count(*) FROM public.heart_cards WHERE author_guest_id = _guest) >= _per_person THEN
    RAISE EXCEPTION 'card_limit';
  END IF;
  IF _photo_path IS NOT NULL AND
     (SELECT count(*) FROM public.heart_cards WHERE author_guest_id = _guest AND photo_path IS NOT NULL) >= _photo_max THEN
    RAISE EXCEPTION 'photo_limit';
  END IF;
  INSERT INTO public.heart_cards (author_guest_id, request_id, body, city, photo_path, photo_w, photo_h, tilt_deg)
  VALUES (_guest, _request_id, trim(_body), nullif(trim(_city),''), _photo_path, _photo_w, _photo_h, greatest(-1, least(1, coalesce(_tilt_deg,0))))
  RETURNING * INTO _row;
  RETURN _row;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_heart_card(uuid,text,text,text,integer,integer,numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_heart_card(uuid,text,text,text,integer,integer,numeric) TO authenticated;

-- Settings defaults ----------------------------------------------------------
INSERT INTO public.settings (key, value) VALUES
  ('commons_posts_per_day','5'),
  ('commons_chars','500'),
  ('heart_cards_per_person','5'),
  ('heart_photos_per_person','3'),
  ('heart_chars','800'),
  ('counter_show_at_pct','70'),
  ('commons_show_honorary','true'),
  ('commons_show_afar','true'),
  ('heart_show_honorary','true'),
  ('heart_show_afar','true'),
  ('reflections_open','true'),
  ('phase_during_start','2026-11-20 00:00'),
  ('phase_during_end','2026-11-30 23:59'),
  ('phase_override','auto')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_content (key, value) VALUES
  ('heart_tagline','Birthday postcards from near and far.'),
  ('heart_to_name','Demi'),
  ('heart_to_place','Cape Town'),
  ('reflections_notice_title','A space that''s entirely yours.'),
  ('reflections_notice_body','Your Reflections are private to you. Other friends and the host cannot view your entries through the website. You can write and revisit your thoughts whenever you like.'),
  ('reflections_message_non_participant','This page is kept for the friends in Cape Town, we hope you''ll keep a journal of your own too. Pen and paper are all it takes, future you will be delighted.'),
  ('commons_before_title','Our scrapbook opens on November 20.'),
  ('commons_before_body','This is where the trip gets pinned up: photos, small thoughts, anything funny. From the 20th, post away, with one photo per post, or simply leave a note, no photo! Once something is pinned it stays, so give it a second look first. Friends everywhere can read along.'),
  ('commons_after_line','South Africa in our words.'),
  ('reflections_before_title','Start before you go.'),
  ('reflections_before_body','Reflections is your private notebook, open from today. Write about what you''re looking forward to, who you''ll be thinking of, what you hope the week holds. On November 20 this note goes away, and the pages are yours.'),
  ('reflections_closed_message','Reflections is closed for now. Your pages are still here for you to read.')
ON CONFLICT (key) DO NOTHING;