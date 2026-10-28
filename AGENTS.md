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
