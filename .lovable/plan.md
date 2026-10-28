# Invite-only accounts, confirmed-email roles, case-insensitive email, stay signed in, 6-digit code

## Current state (checked)
- 2 accounts exist, both confirmed. All guest and role-invite emails are already lowercase/trimmed; no duplicates.
- `guests` lowercases email on save (trigger), unique on raw `email`. `role_invites` has no normalising trigger.
- `link_guest` runs on account creation (AFTER INSERT on auth.users) and grants roles immediately, confirmed or not. `on_guest_inserted` links an existing account when the host adds a guest.
- Sign-in page: `is_invited` pre-check, then email link with default `shouldCreateUser` (true) — so today anyone who calls the API directly can create an account with any email.
- Browser client: `persistSession: true`, `autoRefreshToken: true` (confirmed in code).

## 1. What Lovable Cloud allows, and the simplest approach
- **Turn off public sign-ups: yes.** One auth setting ("disable sign-up"). After that, the public API cannot create any account — not by email link, not by code, not by password sign-up. This is enforced by the auth server, not the UI. Existing accounts still sign in.
- **Password sign-up off at the API level: yes, via the same switch.** Nobody can sign up with a password. Email sign-in itself must stay on because the link and code use it; an account created by the host has no password, so password sign-in is useless to it.
- **Creating accounts for invited friends:** admin-only calls still work with sign-ups disabled. No edge function (this app uses its own server code): a host-only server action runs when the host adds a guest. It first checks the caller is host, then creates the account **unconfirmed with no email sent** (`admin.createUser`, `email_confirm: false`). Simpler than the invite API: no extra invite email or invite page, and the friend just uses the normal sign-in.
- **Sign-in:** `signInWithOtp({ email, options: { shouldCreateUser: false } })`. The first successful link or code proves the email and sets `email_confirmed_at`, which grants roles (section 2).
- Backfill: create accounts for any guest already on the list without one. A "Create account" retry button in Admin covers failures.
- Removing a guest keeps the current behaviour (roles removed). Deleting the account itself is out of scope unless you want it.

## 2. Roles only after the email is confirmed
```sql
CREATE OR REPLACE FUNCTION public.link_guest(_user_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE g_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND email_confirmed_at IS NOT NULL)
  THEN RETURN; END IF;
  SELECT id INTO g_id FROM public.guests WHERE lower(email) = lower(trim(_email));
  IF g_id IS NULL THEN RETURN; END IF;
  UPDATE public.guests SET user_id = _user_id WHERE id = g_id AND (user_id IS NULL OR user_id = _user_id);
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'trip_guest') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
    SELECT _user_id, ri.role FROM public.role_invites ri WHERE lower(ri.email) = lower(trim(_email))
    ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN PERFORM public.link_guest(NEW.id, NEW.email); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created();

-- One-time backfill for already-confirmed users
SELECT public.link_guest(u.id, u.email) FROM auth.users u WHERE u.email_confirmed_at IS NOT NULL;
```
`on_guest_inserted` is unchanged in shape; it now only grants when the matched account is confirmed (checked inside `link_guest`). The UPDATE trigger fires only when the confirmation time changes, not on every sign-in.

## 3 + 4. Case-insensitive email everywhere
Database:
```sql
CREATE OR REPLACE FUNCTION public.normalize_email()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.email := lower(trim(NEW.email)); RETURN NEW; END $$;

-- backfill (currently 0 rows need it)
UPDATE public.guests SET email = lower(trim(email)) WHERE email <> lower(trim(email));
UPDATE public.role_invites SET email = lower(trim(email)) WHERE email <> lower(trim(email));

DROP TRIGGER IF EXISTS guests_normalize_email ON public.guests;
CREATE TRIGGER guests_normalize_email BEFORE INSERT OR UPDATE OF email ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.normalize_email();
CREATE TRIGGER role_invites_normalize_email BEFORE INSERT OR UPDATE OF email ON public.role_invites
  FOR EACH ROW EXECUTE FUNCTION public.normalize_email();

CREATE UNIQUE INDEX guests_email_lower_key ON public.guests (lower(email));
CREATE UNIQUE INDEX role_invites_email_lower_role_key ON public.role_invites (lower(email), role);
```
- `is_invited`, `link_guest`, `on_guest_inserted`, `on_guest_deleted`, `set_schedule_manager` compare with `lower(...)` on both sides.
- Old `normalize_guest_email` left in place but unused (marked deprecated in a comment).
- App: Admin add/edit guest trims + lowercases before saving and shows "That email is already on the list" on a duplicate. Sign-in page trims + lowercases before the check, the link and the code.

## 5. Stay signed in, plus 6-digit code
- Code already keeps the session on the device and refreshes it automatically. A session ends only on Sign out, unless the hosted session limits are set. Cloud's default has no session time-box and no inactivity timeout. I'll check the hosted values during build. If a limit is set, I'll tell you where to turn it off. I won't claim it's off until I've checked.
- Sign-in page, after "Send": the message offers both "Tap the link in the email" and a "Or type the 6-digit code" field. Entering the code runs `verifyOtp({ email, token, type: 'email' })`, which signs in on this browser. A "Resend" link is included. The sign-in email wording gets the code added (`{{ .Token }}`) so both appear in the same email. New wording goes in editable site copy. Code length/expiry stay at the Cloud settings (you can set 6 digits in Auth settings → Email → Email OTP length).

## Order of work
1. Database: normalisation, unique indexes, confirmed-only `link_guest`, trigger, backfills.
2. Host-only server action to create guest accounts (+ backfill existing guests, Admin retry button).
3. Sign-in page: `shouldCreateUser: false`, normalisation, 6-digit code field.
4. Update the sign-in email to include the code.
5. Disable public sign-ups (last, so invited friends already have accounts).
6. Check: sign in as yourself, add a test guest, confirm the account is created with no roles, then sign in by code → roles appear. Confirm a direct sign-up attempt with an unlisted email is refused.
7. Update project notes (invite-only accounts, confirmed-only roles).
