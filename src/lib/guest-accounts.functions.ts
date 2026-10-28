import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Host-only. Public sign-up is disabled, so every guest on the list gets an
 * unconfirmed account here (no email sent). Roles are granted by the database
 * only once the friend proves the email by link or code.
 */
export const syncGuestAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isHost } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "host",
    });
    if (!isHost) throw new Error("Forbidden");

    const { data: guests, error } = await context.supabase.from("guests").select("email");
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = new Set<string>();
    for (let page = 1; ; page++) {
      const { data, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listErr) throw new Error(listErr.message);
      data.users.forEach((u) => u.email && existing.add(u.email.trim().toLowerCase()));
      if (data.users.length < 1000) break;
    }

    let created = 0;
    const failed: string[] = [];
    for (const g of guests ?? []) {
      const email = g.email.trim().toLowerCase();
      if (existing.has(email)) continue;
      const { error: cErr } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: false });
      if (cErr) failed.push(email);
      else created++;
    }
    return { created, failed };
  });
