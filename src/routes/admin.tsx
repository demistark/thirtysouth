import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SubTabs } from "@/components/site/Blocks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { normalizeEmail } from "@/lib/email";
import { syncGuestAccounts } from "@/lib/guest-accounts.functions";
import { AfarAdmin } from "@/components/site/AfarAdmin";
import { FactsAdmin } from "@/components/site/FactsAdmin";
import { HomeAdmin } from "@/components/site/HomeAdmin";
import { ItineraryAdmin } from "@/components/site/ItineraryAdmin";
import { JournalAdmin } from "@/components/site/JournalAdmin";
import { PurseAdmin } from "@/components/site/PurseAdmin";
import { TravelAdmin } from "@/components/site/TravelAdmin";
import { useContent } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { TripTimeZoneSelect } from "@/components/site/TripTimeInput";
import { CPT_ZONE, EST_ZONE, localTimeDate, tripTimeZone } from "@/lib/trip-time";
import { DEFAULT_SETTINGS, getPhase, type TripSettings } from "@/lib/phase";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · 30° South" },
      { name: "description", content: "Manage guests, content, chapters and dates." },
      { property: "og:title", content: "Admin · 30° South" },
      { property: "og:description", content: "Manage guests, content, chapters and dates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type Tab = "guests" | "content" | "home" | "itinerary" | "travel" | "purse" | "journal" | "settings" | "facts";

function Admin() {
  const { isHost, roles, loading } = useAuth();
  const { t } = useContent();
  const isManager = roles.includes("schedule_manager");
  const [tab, setTab] = useState<Tab>("guests");
  const active: Tab = isHost ? tab : tab === "travel" || tab === "purse" || tab === "journal" ? tab : "itinerary";
  if (loading) return <main className="mx-auto max-w-5xl px-5 pt-20"><div className="h-48 border bg-card" /></main>;
  if (!isHost && !isManager)
    return (
      <main className="mx-auto max-w-md px-5 pt-24 text-center">
        <p className="eyebrow">Admin</p>
        <p className="font-display-light mt-4 text-2xl">This page is only for the person running the trip.</p>
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl px-5 pt-14">
      <h1 className="font-display-light text-5xl">Admin</h1>
      <div className="mt-8">
        <SubTabs
          tabs={isHost ? [
            { id: "guests", label: "Guests" },
            { id: "content", label: "Content" },
            { id: "home", label: "Home" },
            { id: "itinerary", label: t("admin.tab.itinerary") },
            { id: "travel", label: t("admin.tab.travel") },
            { id: "purse", label: t("admin.tab.purse") },
            { id: "journal", label: "Journal" },
            { id: "settings", label: "Settings" },
            { id: "facts", label: t("admin.tab.facts") },
          ] : [
            { id: "itinerary", label: t("admin.tab.itinerary") },
            { id: "travel", label: t("admin.tab.travel") },
            { id: "purse", label: t("admin.tab.purse") },
            { id: "journal", label: "Journal" },
          ]}
          value={active}
          onChange={setTab}
        />
        {active === "guests" && (
          <>
            <GuestsAdmin />
            <AfarAdmin />
          </>
        )}
        {active === "content" && <ContentAdmin />}
        {active === "home" && <HomeAdmin />}
        {active === "itinerary" && <ItineraryAdmin />}
        {active === "travel" && <TravelAdmin />}
        {active === "purse" && <PurseAdmin />}
        {active === "journal" && <JournalAdmin />}
        {active === "settings" && <SettingsAdmin />}
        {active === "facts" && <FactsAdmin />}
      </div>
    </main>
  );
}

/* ---------------- Guests ---------------- */

interface Guest {
  id: string;
  user_id: string | null;
  full_name: string;
  display_name: string;
  email: string;
  status: string;
  splitwise_name: string | null;
  pending_role: string | null;
}

const emptyGuest = { full_name: "", display_name: "", email: "", status: "confirmed", splitwise_name: "" };

function GuestsAdmin() {
  const qc = useQueryClient();
  const guestsQ = useQuery({
    queryKey: ["admin", "guests"],
    queryFn: async () => {
      const [g, ri] = await Promise.all([
        supabase.from("guests").select("id,user_id,full_name,display_name,email,status,splitwise_name,pending_role").order("created_at"),
        supabase.from("role_invites").select("email,role"),
      ]);
      if (g.error) throw g.error;
      const managers = new Set((ri.data ?? []).filter((r) => r.role === "schedule_manager").map((r) => r.email));
      const baseRoles = new Map((ri.data ?? []).filter((r) => r.role !== "schedule_manager").map((r) => [r.email, r.role as string]));
      const guests = (g.data ?? []) as Guest[];
      return { guests, managers, baseRoles };
    },
  });
  const [roleFilter, setRoleFilter] = useState("all");
  const [editing, setEditing] = useState<Guest | null>(null);
  const [form, setForm] = useState(emptyGuest);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "guests"] });

  useEffect(() => {
    setForm(
      editing
        ? {
            full_name: editing.full_name,
            display_name: editing.display_name,
            email: editing.email,
            status: editing.status,
            splitwise_name: editing.splitwise_name ?? "",
          }
        : emptyGuest,
    );
  }, [editing]);

  const syncAccounts = useServerFn(syncGuestAccounts);
  const runSync = async (announce: boolean) => {
    try {
      const r = await syncAccounts();
      if (r.failed.length) toast.error(`Couldn't create sign-in for: ${r.failed.join(", ")}`);
      else if (announce) toast.success(r.created ? `Ready to sign in: ${r.created} added` : "Everyone can already sign in");
    } catch {
      toast.error("Couldn't prepare sign-in. Try the button below the list.");
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, email: normalizeEmail(form.email), splitwise_name: form.splitwise_name || null };
    const { error } = editing
      ? await supabase.from("guests").update(payload).eq("id", editing.id)
      : await supabase.from("guests").insert(payload);
    if (error) {
      toast.error(error.code === "23505" ? "That email is already on the list" : error.message);
      return;
    }
    toast.success("Saved");
    setEditing(null);
    setForm(emptyGuest);
    refresh();
    await runSync(false);
  };

  const remove = async (g: Guest) => {
    if (!confirm(`Remove ${g.display_name}? They will lose access.`)) return;
    const { error } = await supabase.from("guests").delete().eq("id", g.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const toggleManager = async (g: Guest, enabled: boolean) => {
    const { error } = await supabase.rpc("set_schedule_manager", { _guest_id: g.id, _enabled: enabled });
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const baseRoleOf = (g: Guest) => guestsQ.data?.baseRoles.get(g.email) ?? g.pending_role ?? "trip_guest";
  const setBaseRole = async (g: Guest, role: string) => {
    const { error } = await supabase.rpc("set_guest_role", { _guest_id: g.id, _role: role as "trip_guest" | "friend_afar" | "honorary_guest" });
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    refresh();
  };
  const visibleGuests = (guestsQ.data?.guests ?? []).filter((g) => roleFilter === "all" || baseRoleOf(g) === roleFilter);

  return (
    <div className="space-y-10">
      <form onSubmit={save} className="grid gap-3 border bg-card p-5 md:grid-cols-2">
        <p className="label-caps md:col-span-2">{editing ? `Edit ${editing.display_name}` : "Add a guest"}</p>
        <Field label="Full name">
          <input className="field" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field label="Display name">
          <input className="field" required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </Field>
        <Field label="Email (blank for friends afar)">
          <input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Splitwise name">
          <input className="field" value={form.splitwise_name} onChange={(e) => setForm({ ...form, splitwise_name: e.target.value })} />
        </Field>
        <Field label="Status">
          <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="confirmed">Confirmed</option>
            <option value="tentative">Tentative</option>
          </select>
        </Field>
        <div className="flex items-end gap-3">
          <button className="btn-pill btn-pill-solid">{editing ? "Save" : "Add"}</button>
          {editing && (
            <button type="button" className="btn-pill" onClick={() => setEditing(null)}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="flex justify-end">
        <select className="field max-w-56" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
          <option value="all">Everyone</option>
          <option value="trip_guest">On the trip</option>
          <option value="friend_afar">Afar</option>
          <option value="honorary_guest">Honorary guest</option>
        </select>
      </div>
      <ul className="divide-y border-y">
        {visibleGuests.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-display-light text-xl">
                {g.display_name} <span className="text-sm text-muted-foreground">· {g.full_name}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {g.email || "personal code only"} · {g.status}
                {g.splitwise_name ? ` · Splitwise: ${g.splitwise_name}` : ""} · {g.user_id ? "signed in before" : "not signed in yet"}
              </p>
            </div>
            <select
              className="field !w-auto !py-1.5 text-xs"
              value={baseRoleOf(g)}
              onChange={(e) => void setBaseRole(g, e.target.value)}
              aria-label={`Role for ${g.display_name}`}
            >
              <option value="trip_guest">On the trip</option>
              <option value="friend_afar">Afar</option>
              <option value="honorary_guest">Honorary guest</option>
            </select>
            <label className="label-caps flex items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={guestsQ.data?.managers.has(g.email) ?? false}
                onChange={(e) => toggleManager(g, e.target.checked)}
              />
              Schedule manager
            </label>
            <button className="btn-pill !px-3 !py-1.5" onClick={() => setEditing(g)}>
              Edit
            </button>
            <button className="btn-pill !px-3 !py-1.5" onClick={() => remove(g)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-pill" onClick={() => runSync(true)}>
        Make sure everyone can sign in
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="label-caps text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/* ---------------- Content ---------------- */

function ContentAdmin() {
  const q = useQuery({
    queryKey: ["admin", "content"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_content").select("key,value").order("key");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <ul className="space-y-4">
      {q.data?.map((row) => <ContentRow key={row.key} k={row.key} initial={row.value} />)}
    </ul>
  );
}

function ContentRow({ k, initial }: { k: string; initial: string }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(initial);
  const save = async () => {
    const { error } = await supabase.from("site_content").update({ value }).eq("key", k);
    if (error) { toast.error(error.message); return; }
    toast.success(`Saved ${k}`);
    qc.invalidateQueries({ queryKey: ["site_content"] });
  };
  return (
    <li className="border bg-card p-4">
      <p className="label-caps text-muted-foreground">{k}</p>
      <textarea className="field mt-2 min-h-16" value={value} onChange={(e) => setValue(e.target.value)} />
      <button className="btn-pill mt-2 !px-3 !py-1.5" disabled={value === initial} onClick={save}>
        Save
      </button>
    </li>
  );
}

/* ---------------- Settings ---------------- */

const PHASE_STAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

/** Quiet "Fri 20 Nov, 7:00 AM Cape Town" equivalent under a phase boundary. */
function capeTownLine(stamp: string, fromZone: string): string {
  if (!PHASE_STAMP.test(stamp)) return "";
  const d = localTimeDate(stamp, tripTimeZone(fromZone));
  if (!Number.isFinite(d.getTime())) return "";
  const date = new Intl.DateTimeFormat("en-US", { timeZone: CPT_ZONE, weekday: "short", day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: CPT_ZONE, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${date}, ${time} Cape Town`;
}

function SettingsAdmin() {
  const qc = useQueryClient();
  const { t } = useContent();
  const q = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key,value");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });
  const [f, setF] = useState<Record<string, string>>({});
  const [settingsReady, setSettingsReady] = useState(false);
  useEffect(() => {
    if (q.data) {
      setF({ ...DEFAULT_SETTINGS, ...q.data });
      setSettingsReady(true);
    }
  }, [q.data]);

  const phaseZone = f["phase_timezone"] || EST_ZONE;
  const duringOk = PHASE_STAMP.test(f["phase_during_start"] ?? "");
  const afterOk = PHASE_STAMP.test(f["phase_after_start"] ?? "");
  const currentPhase = settingsReady ? getPhase(new Date(), { ...DEFAULT_SETTINGS, ...f } as TripSettings) : null;

  const save = async () => {
    if (!settingsReady || !duringOk || !afterOk) return;
    const rows = [
      { key: "phase_during_start", value: f["phase_during_start"] },
      { key: "phase_after_start", value: f["phase_after_start"] },
      { key: "phase_timezone", value: tripTimeZone(phaseZone) },
      { key: "phase_override", value: f["phase_override"] || "auto" },
      { key: "timezone", value: f["timezone"] || CPT_ZONE },
      { key: "otp_enabled", value: f["otp_enabled"] === "true" ? "true" : "false" },
    ];
    const { error } = await supabase.from("settings").upsert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.settings.saved"));
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="grid max-w-md gap-6">
      <div className="grid gap-4 border bg-card p-5">
        <p className="text-sm font-medium">Site phases</p>
        <TripTimeZoneSelect label={t("time.trip.phase_zone")} value={tripTimeZone(phaseZone)} onChange={(zone) => setF({ ...f, phase_timezone: zone })} />
        <Field label="During starts">
          <input className="field" placeholder="YYYY-MM-DD HH:mm" value={f["phase_during_start"] ?? ""} onChange={(e) => setF({ ...f, phase_during_start: e.target.value })} />
          {duringOk ? (
            <span className="text-xs text-slate">{capeTownLine(f["phase_during_start"] ?? "", phaseZone)}</span>
          ) : (
            <span className="text-xs text-slate">Use YYYY-MM-DD HH:mm</span>
          )}
        </Field>
        <Field label="After starts">
          <input className="field" placeholder="YYYY-MM-DD HH:mm" value={f["phase_after_start"] ?? ""} onChange={(e) => setF({ ...f, phase_after_start: e.target.value })} />
          {afterOk ? (
            <span className="text-xs text-slate">{capeTownLine(f["phase_after_start"] ?? "", phaseZone)}</span>
          ) : (
            <span className="text-xs text-slate">Use YYYY-MM-DD HH:mm</span>
          )}
        </Field>
        <Field label="Phase override">
          <select className="field" value={f["phase_override"] || "auto"} onChange={(e) => setF({ ...f, phase_override: e.target.value })}>
            {["auto", "before", "during", "after"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <p className="text-xs text-slate">Current phase: {currentPhase ?? "…"}</p>
      </div>
      <div className="grid gap-4 border bg-card p-5">
        <TripTimeZoneSelect value={tripTimeZone(f["timezone"] || CPT_ZONE)} onChange={(zone) => setF({ ...f, timezone: zone })} />
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={f["otp_enabled"] === "true"} onChange={(e) => setF({ ...f, otp_enabled: e.target.checked ? "true" : "false" })} />
          {t("admin.settings.otp")}
        </label>
      </div>
      <div>
        <Button variant="pill" className="btn-pill-solid" disabled={!settingsReady || !duringOk || !afterOk} onClick={save}>{t("admin.settings.save")}</Button>
      </div>
    </div>
  );
}
