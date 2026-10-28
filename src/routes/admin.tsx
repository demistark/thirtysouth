import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SubTabs } from "@/components/site/Blocks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

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

type Tab = "guests" | "content" | "chapters" | "settings";

function Admin() {
  const { isHost, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("guests");
  if (loading) return <main className="mx-auto max-w-5xl px-5 pt-20"><div className="h-48 border bg-card" /></main>;
  if (!isHost)
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
          tabs={[
            { id: "guests", label: "Guests" },
            { id: "content", label: "Content" },
            { id: "chapters", label: "Chapters" },
            { id: "settings", label: "Settings" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "guests" && <GuestsAdmin />}
        {tab === "content" && <ContentAdmin />}
        {tab === "chapters" && <ChaptersAdmin />}
        {tab === "settings" && <SettingsAdmin />}
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
  photo_url: string | null;
}

const emptyGuest = { full_name: "", display_name: "", email: "", status: "confirmed", splitwise_name: "" };

function GuestsAdmin() {
  const qc = useQueryClient();
  const guestsQ = useQuery({
    queryKey: ["admin", "guests"],
    queryFn: async () => {
      const [g, ri] = await Promise.all([
        supabase.from("guests").select("*").order("created_at"),
        supabase.from("role_invites").select("email,role").eq("role", "schedule_manager"),
      ]);
      if (g.error) throw g.error;
      const managers = new Set((ri.data ?? []).map((r) => r.email));
      const guests = (g.data ?? []) as Guest[];
      const paths = guests.map((x) => x.photo_url).filter(Boolean) as string[];
      const urls: Record<string, string> = {};
      if (paths.length) {
        const { data } = await supabase.storage.from("guest-photos").createSignedUrls(paths, 3600);
        data?.forEach((d) => d.path && d.signedUrl && (urls[d.path] = d.signedUrl));
      }
      return { guests, managers, urls };
    },
  });
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

  const upload = async (g: Guest, file: File) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${g.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("guest-photos").upload(path, file);
    if (error) { toast.error(error.message); return; }
    await supabase.from("guests").update({ photo_url: path }).eq("id", g.id);
    toast.success("Photo uploaded");
    refresh();
  };

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
        <Field label="Email">
          <input className="field" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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

      <ul className="divide-y border-y">
        {guestsQ.data?.guests.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center gap-4 py-4">
            {g.photo_url && guestsQ.data.urls[g.photo_url] ? (
              <img src={guestsQ.data.urls[g.photo_url]} alt="" className="h-12 w-12 rounded-full border object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-full border bg-paper" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-display-light text-xl">
                {g.display_name} <span className="text-sm text-muted-foreground">· {g.full_name}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {g.email} · {g.status}
                {g.splitwise_name ? ` · Splitwise: ${g.splitwise_name}` : ""} · {g.user_id ? "signed in before" : "not signed in yet"}
              </p>
            </div>
            <label className="label-caps flex items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={guestsQ.data.managers.has(g.email)}
                onChange={(e) => toggleManager(g, e.target.checked)}
              />
              Schedule manager
            </label>
            <label className="btn-pill !px-3 !py-1.5 cursor-pointer">
              Photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(g, e.target.files[0])} />
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

/* ---------------- Chapters ---------------- */

interface ChapterFull {
  number: number;
  date: string;
  title: string;
  summary: string;
  scripture_ref: string;
  scripture_text: string;
}

function ChaptersAdmin() {
  const q = useQuery({
    queryKey: ["admin", "chapters"],
    queryFn: async (): Promise<ChapterFull[]> => {
      const [basic, scr] = await Promise.all([
        supabase.from("chapters").select("number,date,title,summary").order("sort_order"),
        supabase.rpc("chapter_scriptures"),
      ]);
      if (basic.error) throw basic.error;
      const m = new Map((scr.data ?? []).map((s) => [s.number, s]));
      return (basic.data ?? []).map((c) => ({
        ...c,
        scripture_ref: m.get(c.number)?.scripture_ref ?? "",
        scripture_text: m.get(c.number)?.scripture_text ?? "",
      }));
    },
  });
  return <ul className="space-y-6">{q.data?.map((c) => <ChapterRow key={c.number} c={c} />)}</ul>;
}

function ChapterRow({ c }: { c: ChapterFull }) {
  const qc = useQueryClient();
  const [f, setF] = useState(c);
  const save = async () => {
    const { error } = await supabase
      .from("chapters")
      .update({
        date: f.date,
        title: f.title,
        summary: f.summary,
        scripture_ref: f.scripture_ref || null,
        scripture_text: f.scripture_text || null,
      })
      .eq("number", c.number);
    if (error) { toast.error(error.message); return; }
    toast.success(`Chapter ${c.number} saved`);
    qc.invalidateQueries({ queryKey: ["chapters"] });
  };
  return (
    <li className="grid gap-3 border bg-card p-5 md:grid-cols-2">
      <p className="eyebrow md:col-span-2">Chapter {c.number}</p>
      <Field label="Date">
        <input type="date" className="field" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      </Field>
      <Field label="Title">
        <input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Summary">
          <textarea className="field" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
        </Field>
      </div>
      <Field label="Scripture reference">
        <input className="field" value={f.scripture_ref} onChange={(e) => setF({ ...f, scripture_ref: e.target.value })} />
      </Field>
      <Field label="Scripture text">
        <textarea className="field" value={f.scripture_text} onChange={(e) => setF({ ...f, scripture_text: e.target.value })} />
      </Field>
      <div>
        <button className="btn-pill" onClick={save}>
          Save
        </button>
      </div>
    </li>
  );
}

/* ---------------- Settings ---------------- */

const DATE_KEYS = [
  { key: "trip_start", label: "Trip start" },
  { key: "trip_end", label: "Trip end" },
  { key: "after_trip_start", label: "After-trip start" },
];

function SettingsAdmin() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key,value");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (q.data) setF(q.data);
  }, [q.data]);

  const save = async () => {
    const rows = DATE_KEYS.map((d) => ({ key: d.key, value: f[d.key] ?? "" }));
    const { error } = await supabase.from("settings").upsert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success("Dates saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="grid max-w-md gap-4 border bg-card p-5">
      {DATE_KEYS.map((d) => (
        <Field key={d.key} label={d.label}>
          <input type="date" className="field" value={f[d.key] ?? ""} onChange={(e) => setF({ ...f, [d.key]: e.target.value })} />
        </Field>
      ))}
      <p className="caption-serif text-sm">All dates are read in {f["timezone"] ?? "Africa/Johannesburg"} time.</p>
      <div>
        <button className="btn-pill btn-pill-solid" onClick={save}>
          Save dates
        </button>
      </div>
    </div>
  );
}
