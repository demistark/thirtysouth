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
- Chapter scripture is hidden from public via column grants; read it through the `chapter_scriptures()` RPC.
