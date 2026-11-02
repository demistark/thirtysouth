import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AFAR_GENERIC_ERROR,
  AFAR_LOCKED_ERROR,
  constantTimeEqual,
  generateAfarCode,
  hashAfarCode,
  isValidAfarCodeFormat,
  normalizeAfarCode,
} from "@/lib/afar-codes";

const WINDOW_15M = 15 * 60_000;
const WINDOW_24H = 24 * 3600_000;
const MAX_FAILS_15M = 5;
const MAX_FAILS_24H = 30;

type Admin = Awaited<ReturnType<typeof loadAdmin>>;
async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function randomInt(max: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}

function newSalt(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function requestAddress(): string {
  const fwd = getRequest()?.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

type Fail = { ok: false; error: string; locked?: boolean };

/**
 * Public entry point for friends afar. The code is the credential: on success it
 * returns a one-time token hash the browser exchanges for a session with
 * supabase.auth.verifyOtp. Every failure returns the identical generic message.
 * The code and its hash are never logged.
 */
export const afarSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data }) => {
    const admin = await loadAdmin();
    const address = requestAddress();

    const { data: enabledRow } = await admin.from("settings").select("value").eq("key", "afar_enabled").maybeSingle();
    if (enabledRow?.value === "false") return { ok: false, error: AFAR_GENERIC_ERROR } satisfies Fail;

    const since15 = new Date(Date.now() - WINDOW_15M).toISOString();
    const since24 = new Date(Date.now() - WINDOW_24H).toISOString();
    const [{ count: recent }, { count: today }] = await Promise.all([
      admin.from("afar_attempts").select("id", { count: "exact", head: true }).eq("address", address).gte("attempted_at", since15),
      admin.from("afar_attempts").select("id", { count: "exact", head: true }).eq("address", address).gte("attempted_at", since24),
    ]);
    if ((recent ?? 0) >= MAX_FAILS_15M || (today ?? 0) >= MAX_FAILS_24H) {
      return { ok: false, error: AFAR_LOCKED_ERROR, locked: true } satisfies Fail;
    }

    const fail = async (): Promise<Fail> => {
      await admin.from("afar_attempts").insert({ address });
      return { ok: false, error: AFAR_GENERIC_ERROR };
    };

    const normalized = normalizeAfarCode(data.code ?? "");
    if (!isValidAfarCodeFormat(normalized)) return fail();

    const { data: rows } = await admin.from("afar_codes").select("guest_id, code_hash, salt, disabled");
    let matchedGuestId: string | null = null;
    for (const row of rows ?? []) {
      if (row.disabled) continue;
      const candidate = await hashAfarCode(row.salt, normalized);
      if (constantTimeEqual(candidate, row.code_hash)) {
        matchedGuestId = row.guest_id;
        break;
      }
    }
    if (!matchedGuestId) return fail();

    const { data: guest } = await admin
      .from("guests")
      .select("id, user_id, email, pending_role")
      .eq("id", matchedGuestId)
      .maybeSingle();
    if (!guest) return fail();

    // The code only works while the guest's current role is friend_afar.
    let isAfar = false;
    if (guest.user_id) {
      const { data: roleRows } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", guest.user_id)
        .eq("role", "friend_afar");
      isAfar = (roleRows ?? []).length > 0;
    } else {
      isAfar = guest.pending_role === "friend_afar";
    }
    if (!isAfar) return fail();

    // Resolve or create the auth account. Placeholder addresses are never emailed.
    let userId = guest.user_id as string | null;
    let email = "";
    if (userId) {
      const { data: u, error: uErr } = await admin.auth.admin.getUserById(userId);
      if (uErr || !u.user?.email) return fail();
      email = u.user.email;
    } else {
      if (guest.email) {
        for (let page = 1; ; page++) {
          const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
          if (lErr) return fail();
          const found = list.users.find((u) => u.email?.trim().toLowerCase() === guest.email);
          if (found) {
            userId = found.id;
            email = found.email!;
            break;
          }
          if (list.users.length < 1000) break;
        }
      }
      if (!userId) {
        email = guest.email || `guest-${guest.id}@codes.invalid`;
        const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
        if (cErr || !created.user) return fail();
        userId = created.user.id;
      }
      await admin.from("guests").update({ user_id: userId }).eq("id", guest.id);
      await admin.from("user_roles").delete().eq("user_id", userId).in("role", ["trip_guest", "friend_afar", "honorary_guest"]);
      await admin.from("user_roles").insert({ user_id: userId, role: "friend_afar" });
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkErr || !link.properties?.hashed_token) return fail();

    await admin.from("afar_codes").update({ last_signed_in_at: new Date().toISOString() }).eq("guest_id", guest.id);
    return { ok: true as const, tokenHash: link.properties.hashed_token, email };
  });

/* ---------------- Host-only administration ---------------- */

type HostContext = { supabase: any; userId: string };

async function requireHost(context: HostContext) {
  const { data: isHost } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "host" });
  if (!isHost) throw new Error("Forbidden");
}

function effectiveRole(
  g: { user_id: string | null; email: string; pending_role: string | null },
  rolesByUser: Map<string, string>,
  invitesByEmail: Map<string, string>,
): string {
  if (g.user_id && rolesByUser.has(g.user_id)) return rolesByUser.get(g.user_id)!;
  if (g.email && invitesByEmail.has(g.email)) return invitesByEmail.get(g.email)!;
  return g.pending_role ?? "trip_guest";
}

async function listFriendsAfar(admin: Admin) {
  const [{ data: guests }, { data: invites }, { data: roles }, { data: codes }] = await Promise.all([
    admin.from("guests").select("id, display_name, full_name, email, user_id, pending_role").order("created_at"),
    admin.from("role_invites").select("email, role"),
    admin.from("user_roles").select("user_id, role"),
    admin.from("afar_codes").select("guest_id, issued_at, last_signed_in_at, disabled"),
  ]);
  const rolesByUser = new Map((roles ?? []).filter((r) => r.role !== "schedule_manager" && r.role !== "host").map((r) => [r.user_id, r.role as string]));
  const invitesByEmail = new Map((invites ?? []).filter((r) => r.role !== "schedule_manager").map((r) => [r.email, r.role as string]));
  const codeByGuest = new Map((codes ?? []).map((c) => [c.guest_id, c]));
  return (guests ?? [])
    .filter((g) => effectiveRole(g, rolesByUser, invitesByEmail) === "friend_afar")
    .map((g) => {
      const code = codeByGuest.get(g.id);
      return {
        id: g.id,
        displayName: g.display_name,
        fullName: g.full_name,
        hasCode: !!code,
        disabled: code?.disabled ?? false,
        issuedAt: code?.issued_at ?? null,
        lastSignedInAt: code?.last_signed_in_at ?? null,
      };
    });
}

export const afarAdminList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireHost(context);
    const admin = await loadAdmin();
    return { friends: await listFriendsAfar(admin) };
  });

async function issueCode(admin: Admin, guestId: string): Promise<string> {
  const code = generateAfarCode(randomInt);
  const salt = newSalt();
  const codeHash = await hashAfarCode(salt, normalizeAfarCode(code));
  const { error } = await admin.from("afar_codes").upsert({
    guest_id: guestId,
    code_hash: codeHash,
    salt,
    issued_at: new Date().toISOString(),
    last_signed_in_at: null,
    disabled: false,
  });
  if (error) throw new Error(error.message);
  return code;
}

async function revokeSessions(admin: Admin, guestId: string) {
  const { data: guest } = await admin.from("guests").select("user_id").eq("id", guestId).maybeSingle();
  if (guest?.user_id) await admin.auth.admin.signOut(guest.user_id);
}

export const afarGenerateCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { guestId: string }) => input)
  .handler(async ({ data, context }) => {
    await requireHost(context);
    const admin = await loadAdmin();
    const friend = (await listFriendsAfar(admin)).find((f) => f.id === data.guestId);
    if (!friend) throw new Error("Not a friend afar");
    const code = await issueCode(admin, data.guestId);
    if (friend.hasCode) await revokeSessions(admin, data.guestId); // regenerate signs them out everywhere
    return { code, displayName: friend.displayName };
  });

export const afarGenerateAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireHost(context);
    const admin = await loadAdmin();
    const missing = (await listFriendsAfar(admin)).filter((f) => !f.hasCode);
    const issued: { displayName: string; code: string }[] = [];
    for (const f of missing) issued.push({ displayName: f.displayName, code: await issueCode(admin, f.id) });
    return { issued };
  });

export const afarSetDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { guestId: string; disabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    await requireHost(context);
    const admin = await loadAdmin();
    const { error } = await admin.from("afar_codes").update({ disabled: data.disabled }).eq("guest_id", data.guestId);
    if (error) throw new Error(error.message);
    if (data.disabled) await revokeSessions(admin, data.guestId);
    return { ok: true as const };
  });
