# Send the 6-digit sign-in code from your own domain

## Where things stand
- `notify.fieldfrenzy.org` is registered for sending and is waiting on DNS checks.
- Sign-in already accepts the code. Only the email itself needs to show it.

## About the "@thirtysouth.com" address
- Emails can only come from a domain you own. If you don't own `thirtysouth.com` yet, buy it first (GoDaddy, or Project Settings → Domains → Buy new domain).
- Lovable sends from a sending subdomain that you point at Lovable at GoDaddy, like `notify.thirtysouth.com`. That keeps your main domain's own email and website safe.
- **What friends see:** the sender name shows first in most inboxes, so it can read **"30° South"**. Replies can go to demvic007@yahoo.com. The address itself would be something like `hello@notify.thirtysouth.com`.
- I can't confirm sending from a plain `@thirtysouth.com` address. I'll check this during setup and tell you plainly if it can't be done.

## Steps
1. **Pick the domain.** Either keep `fieldfrenzy.org` or switch to `thirtysouth.com` (you'd need to own it).
2. **GoDaddy DNS (you do this, about 5 minutes).** In GoDaddy → My Products → the domain → DNS → Add record:
   - Type **NS**, Name **notify**, Value: the first nameserver shown in More → Emails
   - Add a second **NS** record for the second nameserver
   - If you switch to thirtysouth.com, I'll start setup for it first so the right nameservers show. You can delete the old `notify` NS records for fieldfrenzy.org.
3. **Branded sign-in emails (I do this).** I'll set up the six sign-in emails (sign-in, confirm, reset, and so on) in your colours and fonts. The sign-in email shows the **6-digit code** at the top in large type, with the link below as a backup.
4. **Sender details.** Sender name "30° South", address `hello@` on the sending domain, and replies go to demvic007@yahoo.com.
5. **Activation.** Emails switch over automatically once GoDaddy DNS checks pass, which can take up to 72 hours. Until then, friends get the current link-only email and sign-in keeps working.
6. **Check.** After it's active, I'll send a code to your email and confirm it signs you in.

## Technical notes
- Use the managed auth email scaffold. Set SITE_NAME to "30° South" and replyTo to the host email. Restyle the templates with the palette and Jost/Lora, on a white email body.
- The magic-link template shows `token` prominently. Sign-in already uses `signInWithOtp` + `verifyOtp`, so no app changes are needed.
- Switching domains means starting a new email-domain setup through the setup dialog.
