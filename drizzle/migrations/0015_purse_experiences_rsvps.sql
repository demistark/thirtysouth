create or replace function public.can_view_purse(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('host','schedule_manager','trip_guest','honorary_guest')
  )
$$;

create or replace function public.can_edit_purse(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('host','schedule_manager')
  )
$$;

revoke execute on function public.can_view_purse(uuid) from anon, public;
revoke execute on function public.can_edit_purse(uuid) from anon, public;
grant execute on function public.can_view_purse(uuid) to authenticated;
grant execute on function public.can_edit_purse(uuid) to authenticated;

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  rank text not null default '',
  sort_order integer not null default 0,
  card text not null,
  level text not null default 'big' check (level in ('big','group','sub')),
  parent_id uuid references public.experiences(id) on delete set null,
  rsvp_mode text not null default 'none' check (rsvp_mode in ('must_reply','default_going','none')),
  default_status text check (default_status in ('unconfirmed','going')),
  choices text,
  when_text text not null default '',
  location text,
  summary text not null default '',
  details text,
  price_zar integer,
  price_status text check (price_status in ('published','estimate','confirmed')),
  price_note text,
  show_host_note boolean not null default false,
  rsvp_deadline timestamp without time zone,
  visible boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.experience_scenes (
  experience_id uuid not null references public.experiences(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  primary key (experience_id, scene_id)
);

create table public.experience_rsvps (
  experience_id uuid not null references public.experiences(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  status text not null check (status in ('going','maybe','not_going')),
  choice text,
  updated_at timestamp with time zone not null default now(),
  primary key (experience_id, guest_id)
);

create or replace function public.rsvp_open(_experience_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.settings where key = 'rsvp_global_lock'), 'false') <> 'true'
    and exists (
      select 1 from public.experiences e
      where e.id = _experience_id
        and (e.rsvp_deadline is null or e.rsvp_deadline > (now() at time zone 'Africa/Johannesburg'))
    )
$$;
revoke execute on function public.rsvp_open(uuid) from anon, public;
grant execute on function public.rsvp_open(uuid) to authenticated;

create or replace function public.participant_directory()
returns table(id uuid, display_name text) language sql stable security definer set search_path = public as $$
  select g.id, g.display_name
  from public.guests g
  where public.can_view_purse(auth.uid())
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = g.user_id and ur.role in ('host','schedule_manager','trip_guest')
    )
  order by g.display_name
$$;
revoke execute on function public.participant_directory() from anon, public;
grant execute on function public.participant_directory() to authenticated;

grant select on public.experiences to authenticated;
grant insert, update, delete on public.experiences to authenticated;
grant all on public.experiences to service_role;
grant select on public.experience_scenes to authenticated;
grant insert, update, delete on public.experience_scenes to authenticated;
grant all on public.experience_scenes to service_role;
grant select, insert, update, delete on public.experience_rsvps to authenticated;
grant all on public.experience_rsvps to service_role;

alter table public.experiences enable row level security;
alter table public.experience_scenes enable row level security;
alter table public.experience_rsvps enable row level security;

create policy "Viewers read experiences" on public.experiences for select to authenticated using (public.can_view_purse(auth.uid()));
create policy "Editors insert experiences" on public.experiences for insert to authenticated with check (public.can_edit_purse(auth.uid()));
create policy "Editors update experiences" on public.experiences for update to authenticated using (public.can_edit_purse(auth.uid())) with check (public.can_edit_purse(auth.uid()));
create policy "Editors delete experiences" on public.experiences for delete to authenticated using (public.can_edit_purse(auth.uid()));

create policy "Viewers read experience scenes" on public.experience_scenes for select to authenticated using (public.can_view_purse(auth.uid()));
create policy "Editors insert experience scenes" on public.experience_scenes for insert to authenticated with check (public.can_edit_purse(auth.uid()));
create policy "Editors update experience scenes" on public.experience_scenes for update to authenticated using (public.can_edit_purse(auth.uid())) with check (public.can_edit_purse(auth.uid()));
create policy "Editors delete experience scenes" on public.experience_scenes for delete to authenticated using (public.can_edit_purse(auth.uid()));

create policy "Viewers read RSVPs" on public.experience_rsvps for select to authenticated using (public.can_view_purse(auth.uid()));
create policy "Participants add own RSVP while open" on public.experience_rsvps for insert to authenticated with check (public.is_trip_participant(auth.uid()) and guest_id = public.my_guest() and public.rsvp_open(experience_id));
create policy "Participants update own RSVP while open" on public.experience_rsvps for update to authenticated using (public.is_trip_participant(auth.uid()) and guest_id = public.my_guest() and public.rsvp_open(experience_id)) with check (public.is_trip_participant(auth.uid()) and guest_id = public.my_guest() and public.rsvp_open(experience_id));
create policy "Participants delete own RSVP while open" on public.experience_rsvps for delete to authenticated using (public.is_trip_participant(auth.uid()) and guest_id = public.my_guest() and public.rsvp_open(experience_id));
create policy "Editors manage all RSVPs" on public.experience_rsvps for all to authenticated using (public.can_edit_purse(auth.uid())) with check (public.can_edit_purse(auth.uid()));

create trigger experiences_touch_updated_at before update on public.experiences for each row execute function public.touch_updated_at();
create trigger experience_rsvps_touch_updated_at before update on public.experience_rsvps for each row execute function public.touch_updated_at();