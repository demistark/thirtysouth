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
- Chapters carry no scripture; the old scripture columns are deprecated. Itinerary scenes/wardrobe_looks/wardrobe-photos are read via can_view_itinerary() and written via can_edit_itinerary() in RLS; CSV parsing and opening-tab logic live in src/lib/itinerary.ts with tests. Why: access is enforced server-side and import rules stay testable.
- Accounts are invite-only: public sign-up is disabled; the host-only `syncGuestAccounts` server fn creates unconfirmed accounts, and sign-in uses `shouldCreateUser: false`. Why: nobody can claim an invited friend's email first.
- Roles are granted only after `email_confirmed_at` is set (trigger on INSERT OR UPDATE OF email_confirmed_at). Emails are matched with `normalizeEmail()` / lower(trim()) and unique on lower(email). Why: an unproven or differently-cased email never gets access.
- Area-specific lockouts live in the shared Lockouts module; itinerary access is checked through canViewScenes, independent of other friends-only sections. Why: broader itinerary access must not expose travel or purse.
- Reflections is the nested /journal/reflections route, rendered through Journal's Outlet. Why: its URL and identity stay consistent with its name.
- Travel facts use fun_facts with active-only public reads and host-scoped full access; CSV parsing uses Papa Parse and validates the whole import before writing. Why: hidden facts stay private and quoted CSV imports reliably.
- Read signed-in display names through the ownership-scoped, name-only my_profile RPC. Why: header names without exposing guest records.
- Keep SiteHeader's reserved height and Home first-card return marker; content links use measured data-scroll-obstruction elements, with instant Itinerary chapter-top landings and resetScroll:false day selection. Why: preserve scroll behavior.
- Treat otp_enabled as an exact-string opt-in checked by shared isOtpEnabled. Why: unavailable email codes stay hidden by default.
- Keep phase-independent itinerary ordering in itinerary-tabs and its regression test. Why: date overrides must not reshuffle tabs.
- Share ItineraryDays and ItineraryScript; chapter CSV lives with itinerary parsing. Why: keep displays consistent and edits round-trippable.
- Keep validated itinerary search and rail rules in itinerary-display; appearance saves use save_itinerary_display; Wardrobe visibility uses host-only settings RLS. Why: safe links and access.
- Travel is one flowing /travel page (Cast, Villa, Roomies, Flights, Packing) gated by can_view_travel (host, schedule_manager, trip_guest, honorary_guest — never friend_afar); Roomies is independent travel_roomies data; flight writes are own-row only via my_guest, one leg per direction. Honorary guests are read-only; is_trip_participant enforces RSVP/Commons/expense writes in RLS, and controls use ActionGate. Why: viewing must not permit shared writes.
- Flight times are stored as timestamp without time zone in Cape Town local time; no booking references, seat numbers, prices, or house-manager contacts anywhere. Cast order is randomised once via ensure_cast_order, never reshuffled. Why: privacy and stable order.
- Purse Shared Experiences: experiences/experience_scenes/experience_rsvps are read via can_view_purse and written via can_edit_purse in RLS; RSVP writes are own-row only via is_trip_participant + my_guest() and gated by rsvp_open() (CPT deadline, rsvp_global_lock setting). Default statuses resolve at read time, never stored. Pure logic in src/lib/purse.ts with tests; queries in purse-data.ts. Why: enforce deadlines and access.
- Friends afar sign in only with personal codes at /enter (never email; is_invited returns false for them). afar_codes/afar_attempts are service_role only; code work goes through src/lib/afar.functions.ts with supabaseAdmin, hashing in src/lib/afar-codes.ts with tests. Code-only guests keep a blank guests.email and their role in guests.pending_role; first sign-in creates a confirmed never-emailed placeholder account; regenerate/disable revoke sessions via afar_session_valid(). Why: protect code-only access and revocation.
- Journal access/limits stay in RPCs/RLS; Reflections remain own-row-only with no host read path. One phase clock: getPhase in phase.ts reads the phase_* settings; all pages use useTripClock().phase. Why: phases must agree.
- Shared TripTimeInput conversions keep transfers and RSVP deadlines in CPT; Travel's own-flight form uses CPT-local date/time fields, and phase settings store their zone. Flight number validation lives in the shared travel helper. Why: CPT schedules and consistent optional flight identifiers.
- Shared section-tab styling; SharedExpenses uses content links/ComingSoon fallback; ComingSoon reuses SignInLink when signed out. Why: consistent UI.
- Close to Heart text is always Lora italic; style and weighted address picks use salted card-id hashes in journal.ts; Earlier Pages filtering and copy-flight options stay pure and tested. Shantell Sans loads on Our Commons only. Why: deterministic exportable presentation and deduplicated lists.
- During Home ("Your Day") is HomeDuring in src/routes/index.tsx; pure logic (weather codes, verse choice, reference stripping, highlights, dateline) in src/lib/home-during.ts with tests, queries in home-during-data.ts. Verses: daily_verses (chapter 0 = fallback; anyone reads, host writes). Highlights: scenes.home_highlight, max four per chapter, first-four fallback. Weather: Open-Meteo client-side, 30-min stale time, silent on failure. Why: deterministic, testable, quiet on errors.
