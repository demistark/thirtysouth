delete from public.experience_rsvps where status = 'maybe';
update public.experience_rsvps set choice = null where status = 'not_going';
alter table public.experience_rsvps drop constraint experience_rsvps_status_check;
alter table public.experience_rsvps add constraint experience_rsvps_status_check check (status in ('going','not_going'));
alter table public.experience_rsvps add constraint experience_rsvps_choice_check check (choice is null or status = 'going');

create or replace function public.rsvp_open(_experience_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.settings where key = 'rsvp_global_lock'), 'false') <> 'true'
$$;
revoke execute on function public.rsvp_open(uuid) from anon, public;
grant execute on function public.rsvp_open(uuid) to authenticated;

insert into public.settings (key, value) values ('rsvp_show_total', 'false') on conflict do nothing;

insert into public.site_content (key, value) values
  ('purse.banner.label_one', '1 reply waiting'),
  ('purse.banner.label_other', '{n} replies waiting'),
  ('purse.banner.title', 'Come to everything!'),
  ('purse.banner.line', 'RSVPs to big items.'),
  ('purse.banner.start', 'Start'),
  ('purse.banner.continue', 'Continue'),
  ('purse.banner.closed', 'Replies are closed.'),
  ('purse.banner.no_guest', 'We can''t find your invitation. Ask Demi.'),
  ('purse.no_guest', 'We can''t find your invitation. Ask Demi.'),
  ('purse.flow.of', '{i} of {n}'),
  ('purse.flow.reply_by', 'Reply by'),
  ('purse.flow.more', 'More about this'),
  ('purse.flow.less', 'Less'),
  ('purse.flow.choice_prompt', 'Pick one'),
  ('purse.flow.back', 'Back'),
  ('purse.flow.next', 'Next'),
  ('purse.flow.review', 'Review'),
  ('purse.flow.review_title', 'Your replies'),
  ('purse.flow.change', 'Change'),
  ('purse.flow.also_going_label', 'Also down as going'),
  ('purse.flow.also_going_note', 'You can change these any time on the cards.'),
  ('purse.flow.total_label', 'Your share so far'),
  ('purse.flow.total_note', 'Per person. Estimates and published prices.'),
  ('purse.flow.save', 'Save my replies'),
  ('purse.flow.saving', 'Saving…'),
  ('purse.flow.retry', 'Try again'),
  ('purse.flow.save_failed', 'We couldn''t save. Your answers are still here.'),
  ('purse.flow.saved', 'Saved. See you out there.'),
  ('purse.flow.leave_title', 'Leave without saving?'),
  ('purse.flow.leave_body', 'Your answers stay on this phone, so you can pick up where you left off.'),
  ('purse.flow.stay', 'Stay'),
  ('purse.flow.leave', 'Leave'),
  ('purse.flow.close', 'Close'),
  ('home.rsvp_waiting_one', '1 RSVP to complete'),
  ('home.rsvp_waiting_other', '{n} RSVPs to complete'),
  ('admin.purse.deadline_hint', 'Shown as a reminder. Replies stay open until you close them all with the global lock.'),
  ('admin.purse.show_total', 'Show the running total on the review step'),
  ('admin.purse.unfinished_title', 'Who hasn''t finished'),
  ('admin.purse.unfinished_left', '{n} of {total} left'),
  ('admin.purse.all_done', 'Everyone has replied.'),
  ('admin.purse.whatsapp', 'Nudge on WhatsApp'),
  ('admin.purse.whatsapp_exp', 'Nudge about this one'),
  ('admin.purse.whatsapp_default', 'New RSVP up on 30° SOUTH. Takes 10 seconds: {link}'),
  ('admin.purse.whatsapp_exp_text', 'New RSVP up: {experience}. Takes 10 seconds: {link}'),
  ('admin.purse.clear_all', 'Clear all RSVPs'),
  ('admin.purse.clear_all_confirm', 'This deletes every guest''s RSVP for good. Type CLEAR to confirm.'),
  ('admin.purse.clear_all_done', 'All RSVPs cleared.')
on conflict (key) do nothing;