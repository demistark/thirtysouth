<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## 30° South rules
- All user-facing copy lives in the `site_content` table and is read via `useContent().t(key)`; never hardcode editable copy. Why: the host edits copy in /admin.
- Roles live only in `user_roles`; checked with `has_role()` in RLS. Invite gating: `is_invited()` pre-check + `link_guest()` trigger grants roles only for emails in `guests`. Why: privacy enforced server-side.
- Phase-dependent UI must use `useTripClock()` (src/lib/trip-clock.tsx); phase math is in src/lib/phase.ts with tests. Why: single source for host "Preview as" override.
- Chapters carry no scripture; the old scripture columns are deprecated and unused. Itinerary scenes/wardrobe_looks/wardrobe-photos are read via can_view_itinerary() and written via can_edit_itinerary() in RLS; CSV parsing/validation and opening-tab logic live in src/lib/itinerary.ts with tests. Why: access is enforced server-side and import rules stay testable.
- Accounts are invite-only: public sign-up is disabled; the host-only `syncGuestAccounts` server fn creates unconfirmed accounts for guests, and sign-in uses `shouldCreateUser: false`. Why: nobody can claim an invited friend's email first.
- Roles are granted only after `email_confirmed_at` is set (trigger on INSERT OR UPDATE OF email_confirmed_at). Emails are matched with `normalizeEmail()` / lower(trim()) and unique on lower(email). Why: an unproven or differently-cased email never gets access.
- Area-specific lockouts live in the shared Lockouts module; itinerary access is checked through canViewScenes, independently of other friends-only sections. Why: broader itinerary access must not expose travel or purse.
- Reflections is the nested /journal/reflections route, rendered through Journal's Outlet. Why: its URL and page identity stay consistent with its name.
- Travel facts use fun_facts with active-only public reads and host-scoped full access; CSV parsing uses Papa Parse and validates the entire import before writing. Why: hidden facts remain private and quoted CSV text imports reliably.
- Read signed-in display names through the ownership-scoped, name-only my_profile RPC. Why: preserve header names without exposing guest records or retaining photo functionality.
- Keep header scroll behavior in SiteHeader with a stable reserved height, global anchor offset and a Home first-card marker for the returning fixed header. Why: header transitions cannot move content or depend on guessed page heights.
- Treat otp_enabled as an exact-string opt-in setting checked by shared isOtpEnabled. Why: unavailable email codes remain hidden by default.
- Keep phase-independent itinerary ordering in itinerary-tabs and its regression test. Why: date overrides must not reshuffle tabs.
- Share day navigation through ItineraryDays and render the screenplay through ItineraryScript using additive chapter fields; chapter CSV export/import lives with itinerary parsing. Why: Scenes/Wardrobe stay consistent and screenplay edits round-trip without changing access or photo flows.
- Keep itinerary deep links in validated route search and rail/tag/expansion rules in itinerary-display; save display preferences through the narrowly validated editor-only save_itinerary_display RPC without widening settings RLS. Why: refresh preserves return anchors and schedule managers can change only itinerary appearance.
- Travel is one flowing /travel page (Cast, Villa, Flights, Packing) gated by can_view_travel (host, schedule_manager, trip_guest, honorary_guest — never friend_afar); edits go through can_edit_travel. Honorary guests are read-only participants-viewers: is_trip_participant gates every future RSVP/Commons/expense write, enforced in RLS, and gated controls open the ActionGate dialog (copy keys gate_message_*) instead of acting. Why: honorary friends see everything but must never change shared trip data.
- Flight times are stored as timestamp without time zone in Cape Town local time; no booking references, seat numbers, prices, or house-manager contacts anywhere. Cast order is randomised once via ensure_cast_order and never reshuffled on load. Why: privacy and a stable credit roll.
- Purse Shared Experiences: experiences/experience_scenes/experience_rsvps are read via can_view_purse and written via can_edit_purse in RLS; RSVP writes are own-row only via is_trip_participant + my_guest() and gated by rsvp_open() (deadline in Cape Town local, rsvp_global_lock setting). Default statuses resolve at read time, never stored. Pure logic (counts, prices, CSV) lives in src/lib/purse.ts with tests; queries in src/lib/purse-data.ts. Why: access and deadline rules stay server-side and testable.
- Friends afar sign in only with personal codes at /enter (never email; is_invited returns false for them). afar_codes/afar_attempts have no client grants — only service_role; all code work goes through src/lib/afar.functions.ts with supabaseAdmin, code format/hashing in src/lib/afar-codes.ts with tests. Code-only guests keep a blank guests.email and their role in guests.pending_role; first sign-in creates a confirmed placeholder account (guest-<uuid>@codes.invalid, never emailed) and the session comes from admin.generateLink + client verifyOtp. Regenerate/disable revoke refresh tokens via admin.signOut; the client also checks afar_session_valid() on load. Why: codes are the only credential, hashes never leave the server, and revoked access ends everywhere.
- Journal access/limits stay in RPCs/RLS; Reflections remain own-row-only with no host read path. Phase timestamps use phase_timezone in current_phase() and phaseFromSettings(); queries live in journal-data. Why: client/server phase boundaries must agree.
- Shared TripTimeInput/trip-time conversions keep flights, transfers and RSVP deadlines in canonical CPT; phase/date settings store their selected zone. Why: zone choices preserve enforcement and schedules.
- Heart handwriting is derived from immutable card UUIDs. Why: typography stays stable across sorting, pinning and reloads.
