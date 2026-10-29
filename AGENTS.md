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
- Chapter scripture is public (like title/summary); `chapter_scriptures()` is executable by anon and authenticated.
- Accounts are invite-only: public sign-up is disabled; the host-only `syncGuestAccounts` server fn creates unconfirmed accounts for guests, and sign-in uses `shouldCreateUser: false`. Why: nobody can claim an invited friend's email first.
- Roles are granted only after `email_confirmed_at` is set (trigger on INSERT OR UPDATE OF email_confirmed_at). Emails are matched with `normalizeEmail()` / lower(trim()) and unique on lower(email). Why: an unproven or differently-cased email never gets access.
- Area-specific lockouts live in the shared Lockouts module; itinerary access is checked through canViewScenes, independently of other friends-only sections. Why: broader itinerary access must not expose travel or purse.
- Reflections is the nested /journal/reflections route, rendered through Journal's Outlet; other Journal tabs remain public. Why: its URL and page identity stay consistent with its name.
- Travel facts use fun_facts with active-only public reads and host-scoped full access; CSV parsing uses Papa Parse and validates the entire import before writing. Why: hidden facts remain private and quoted CSV text imports reliably.
- Read signed-in display names through the ownership-scoped, name-only my_profile RPC. Why: preserve header names without exposing guest records or retaining photo functionality.
- Keep header scroll behavior in SiteHeader with a stable reserved height and global anchor offset. Why: compacting cannot move or obscure page content.
- Treat otp_enabled as an exact-string opt-in setting checked by shared isOtpEnabled. Why: unavailable email codes remain hidden by default.
- Keep phase-independent itinerary ordering in itinerary-tabs and its regression test. Why: date overrides must not reshuffle tabs.
