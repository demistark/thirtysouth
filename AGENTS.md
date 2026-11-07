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
- Public copy uses site_content/useContent; trip-private text uses private_content/usePrivateContent with user/access-scoped cache. Why: public text must not reveal private links or villa details.
- Roles live only in user_roles; confirmed-email link_guest grants invited roles. Email sign-in never calls is_invited and shows one sent state. Why: prevent guest-list disclosure.
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
- Travel stays one flowing page; can_view_travel includes afar, but is_trip_participant gates own-flight and packing writes. Roomies remains independent data; flight uniqueness is per guest/direction. Private text is participant-only; RSVP/Commons use ActionGate. Why: viewing must not permit writes or expose private details.
- Flight times are stored as timestamp without time zone in Cape Town local time; no booking references, seat numbers, prices, or house-manager contacts anywhere. Cast order is randomised once via ensure_cast_order, never reshuffled. Why: privacy and stable order.
- Purse RLS uses can_view_purse/can_edit_purse; own RSVPs use participant+my_guest and global-lock-only rsvp_open. Defaults resolve on read. Photo saves use experience-photo; CSV omits photo fields; signed URLs batch in purse-data. Why: enforce access and preserve photos.
- Afar entry checks code plus normalized name server-side; browser step one validates format only. afar.functions.ts authorizes host actions; afar-codes.ts owns tested hashing/name logic. Code tables remain service-role-only; blank-email guests use pending_role and confirmed placeholders. Revocation uses afar_session_valid. Why: protect personal access.
- Journal access/limits stay in RPCs/RLS; Reflections remain own-row-only with no host read path. One phase clock: getPhase in phase.ts reads the phase_* settings; all pages use useTripClock().phase. Why: phases must agree.
- Shared TripTimeInput conversions keep transfers and RSVP deadlines in CPT; Travel's own-flight form uses CPT-local date/time fields, and phase settings store their zone. Flight number validation lives in the shared travel helper. Why: CPT schedules and consistent optional flight identifiers.
- Shared section-tab styling; SharedExpenses uses content links/ComingSoon fallback; ComingSoon reuses SignInLink when signed out. Why: consistent UI.
- Close to Heart text is always Lora italic; style and weighted address picks use salted card-id hashes in journal.ts; Earlier Pages filtering and copy-flight options stay pure and tested. Shantell Sans loads on Our Commons only. Why: deterministic exportable presentation and deduplicated lists.
- During Home ("Your Day") is HomeDuring in src/routes/index.tsx; pure logic (weather codes, verse choice, reference stripping, highlights, dateline) in src/lib/home-during.ts with tests, queries in home-during-data.ts. Verses: daily_verses (chapter 0 = fallback; anyone reads, host writes). Highlights: scenes.home_highlight, max four per chapter, first-four fallback. Weather: Open-Meteo client-side, 30-min stale time, silent on failure. Why: deterministic, testable, quiet on errors.
