import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SubTabs } from "@/components/site/Blocks";
import { supabase } from "@/integrations/supabase/client";
import { useContent } from "@/lib/data";
import { CSV_MAX_BYTES, type ImportResult, type RowError } from "@/lib/itinerary";
import type { Scene } from "@/lib/itinerary";
import {
  EXPERIENCE_CSV_COLUMNS, effectiveStatus, exportExperiencesCsv, parseExperiencesCsv,
  type Experience, type ExperienceImportRow, type ExperienceRsvp, type RsvpStatus,
} from "@/lib/purse";
import { useParticipantDirectory } from "@/lib/purse-data";

type Sub = "experiences" | "rsvps" | "settings";

function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all([["purse"], ["admin"], ["site_content"], ["settings"]].map((k) => qc.invalidateQueries({ queryKey: k })));
}

function F({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`block space-y-1 ${wide ? "md:col-span-2" : ""}`}><span className="label-caps text-muted-foreground">{label}</span>{children}</label>;
}

export function PurseAdmin() {
  const { t } = useContent();
  const [sub, setSub] = useState<Sub>("experiences");
  return (
    <div>
      <SubTabs
        tabs={(["experiences", "rsvps", "settings"] as const).map((id) => ({ id, label: t(`admin.purse.${id}`) }))}
        value={sub}
        onChange={setSub}
      />
      {sub === "experiences" && <ExperiencesPanel />}
      {sub === "rsvps" && <RsvpsPanel />}
      {sub === "settings" && <PurseSettingsPanel />}
    </div>
  );
}

/* ---------- Experiences ---------- */

const emptyExp = {
  rank: "", card: "", level: "big", parent_id: "", rsvp_mode: "none", default_status: "", choices: "",
  when_text: "", location: "", summary: "", details: "", price_zar: "", price_status: "", price_note: "",
  show_host_note: false, rsvp_deadline: "",
};
type ExpForm = typeof emptyExp;

function ExperiencesPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const q = useQuery({
    queryKey: ["admin", "purse-experiences"],
    queryFn: async () => {
      const [e, l, s] = await Promise.all([
        supabase.from("experiences").select("*").order("sort_order"),
        supabase.from("experience_scenes").select("experience_id,scene_id"),
        supabase.from("scenes").select("id,title,chapter_number,scene_order,details,location").order("chapter_number").order("scene_order"),
      ]);
      if (e.error) throw e.error;
      if (l.error) throw l.error;
      if (s.error) throw s.error;
      return {
        experiences: (e.data ?? []) as (Experience & { id: string })[],
        links: l.data ?? [],
        scenes: (s.data ?? []) as Scene[],
      };
    },
  });
  const [editing, setEditing] = useState<(Experience & { id: string }) | null>(null);
  const [form, setForm] = useState<ExpForm>(emptyExp);

  useEffect(() => {
    setForm(
      editing
        ? {
            rank: editing.rank, card: editing.card, level: editing.level, parent_id: editing.parent_id ?? "",
            rsvp_mode: editing.rsvp_mode, default_status: editing.default_status ?? "", choices: editing.choices ?? "",
            when_text: editing.when_text, location: editing.location ?? "", summary: editing.summary,
            details: editing.details ?? "", price_zar: editing.price_zar?.toString() ?? "", price_status: editing.price_status ?? "",
            price_note: editing.price_note ?? "", show_host_note: editing.show_host_note, rsvp_deadline: editing.rsvp_deadline ?? "",
          }
        : emptyExp,
    );
  }, [editing]);

  const experiences = q.data?.experiences ?? [];
  const scenes = q.data?.scenes ?? [];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      rank: form.rank, card: form.card, level: form.level, parent_id: form.parent_id || null,
      rsvp_mode: form.rsvp_mode, default_status: (form.default_status || null) as Experience["default_status"],
      choices: form.choices || null, when_text: form.when_text, location: form.location || null,
      summary: form.summary, details: form.details || null, price_zar: form.price_zar ? +form.price_zar : null,
      price_status: (form.price_status || null) as Experience["price_status"], price_note: form.price_note || null,
      show_host_note: form.show_host_note, rsvp_deadline: form.rsvp_deadline || null,
    };
    const { error } = editing
      ? await supabase.from("experiences").update(payload).eq("id", editing.id)
      : await supabase.from("experiences").insert({ ...payload, sort_order: experiences.length + 1 });
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved"));
    setEditing(null);
    setForm(emptyExp);
    await refresh();
  };

  const move = async (exp: Experience & { id: string }, dir: -1 | 1) => {
    const siblings = experiences.filter((e) => (e.parent_id ?? "") === (exp.parent_id ?? ""));
    const idx = siblings.findIndex((e) => e.id === exp.id);
    const other = siblings[idx + dir];
    if (!other) return;
    const a = await supabase.from("experiences").update({ sort_order: other.sort_order }).eq("id", exp.id);
    if (a.error) { toast.error(a.error.message); return; }
    const b = await supabase.from("experiences").update({ sort_order: exp.sort_order }).eq("id", other.id);
    if (b.error) { toast.error(b.error.message); return; }
    await refresh();
  };

  const toggleVisible = async (exp: Experience & { id: string }) => {
    const { error } = await supabase.from("experiences").update({ visible: !exp.visible }).eq("id", exp.id);
    if (error) { toast.error(error.message); return; }
    await refresh();
  };

  const remove = async (exp: Experience & { id: string }) => {
    if (!confirm(`Remove "${exp.card}"? Its RSVPs go with it.`)) return;
    const { error } = await supabase.from("experiences").delete().eq("id", exp.id);
    if (error) { toast.error(error.message); return; }
    await refresh();
  };

  const commit = async (rows: ExperienceImportRow[]) => {
    // Pass 1: upsert every row by card, collecting title → id.
    const titleToId = new Map(experiences.map((e) => [e.card.toLowerCase(), e.id]));
    for (const row of rows) {
      const { parent_title: _p, related_scene_titles: _s, id, ...fields } = row;
      if (id) {
        const { error } = await supabase.from("experiences").update(fields).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("experiences").insert(fields).select("id").single();
        if (error) throw error;
        if (data) titleToId.set(row.card.toLowerCase(), data.id);
      }
    }
    // Pass 2: parents and scene links.
    const sceneByTitle = new Map(scenes.map((s) => [s.title.toLowerCase(), s.id]));
    for (const row of rows) {
      const id = titleToId.get(row.card.toLowerCase());
      if (!id) continue;
      if (row.parent_title) {
        const pid = titleToId.get(row.parent_title.toLowerCase());
        if (pid) {
          const { error } = await supabase.from("experiences").update({ parent_id: pid }).eq("id", id);
          if (error) throw error;
        }
      }
      const { error: delErr } = await supabase.from("experience_scenes").delete().eq("experience_id", id);
      if (delErr) throw delErr;
      const links = row.related_scene_titles
        .map((title) => sceneByTitle.get(title.toLowerCase()))
        .filter((sid): sid is string => !!sid)
        .map((scene_id) => ({ experience_id: id, scene_id }));
      if (links.length) {
        const { error } = await supabase.from("experience_scenes").insert(links);
        if (error) throw error;
      }
    }
    await refresh();
  };

  const exportCsv = () => {
    const sceneTitles = new Map(scenes.map((s) => [s.id ?? "", s.title]));
    const csv = exportExperiencesCsv(experiences, sceneTitles, q.data?.links ?? []);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "experiences.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10">
      <CsvBox
        columns={EXPERIENCE_CSV_COLUMNS}
        filename="experiences"
        parse={(csv) => parseExperiencesCsv(csv, experiences, scenes.map((s) => s.title))}
        commit={commit}
      />
      <div className="flex justify-end">
        <button className="btn-pill" onClick={exportCsv}>{t("admin.purse.export")}</button>
      </div>

      <form onSubmit={save} className="grid gap-3 border bg-card p-5 md:grid-cols-2">
        <p className="label-caps md:col-span-2">{editing ? `Edit ${editing.card}` : "Add an experience"}</p>
        <F label="Title (card)"><input className="field" required value={form.card} onChange={(e) => setForm({ ...form, card: e.target.value })} /></F>
        <F label="Rank"><input className="field" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} placeholder="9.1" /></F>
        <F label="Level">
          <select className="field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            <option value="big">Big</option><option value="group">Group</option><option value="sub">Sub</option>
          </select>
        </F>
        <F label="Parent (for sub)">
          <select className="field" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
            <option value="">—</option>
            {experiences.filter((e) => e.id !== editing?.id).map((e) => <option key={e.id} value={e.id}>{e.card}</option>)}
          </select>
        </F>
        <F label="RSVP mode">
          <select className="field" value={form.rsvp_mode} onChange={(e) => setForm({ ...form, rsvp_mode: e.target.value })}>
            <option value="none">None</option><option value="must_reply">Must reply</option><option value="default_going">Default going</option>
          </select>
        </F>
        <F label="Default status">
          <select className="field" value={form.default_status} onChange={(e) => setForm({ ...form, default_status: e.target.value })}>
            <option value="">—</option><option value="unconfirmed">Unconfirmed</option><option value="going">Going</option>
          </select>
        </F>
        <F label="Choices (; separated)"><input className="field" value={form.choices} onChange={(e) => setForm({ ...form, choices: e.target.value })} /></F>
        <F label="When"><input className="field" value={form.when_text} onChange={(e) => setForm({ ...form, when_text: e.target.value })} placeholder="Fri Nov 27" /></F>
        <F label="Location"><input className="field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></F>
        <F label="RSVP deadline (Cape Town)"><input className="field" value={form.rsvp_deadline} onChange={(e) => setForm({ ...form, rsvp_deadline: e.target.value })} placeholder="2026-11-10 18:00" /></F>
        <F label="Summary" wide><textarea className="field min-h-16" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></F>
        <F label="Details" wide><textarea className="field min-h-24" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} /></F>
        <F label="Price (ZAR)"><input className="field" inputMode="numeric" value={form.price_zar} onChange={(e) => setForm({ ...form, price_zar: e.target.value })} /></F>
        <F label="Price status">
          <select className="field" value={form.price_status} onChange={(e) => setForm({ ...form, price_status: e.target.value })}>
            <option value="">—</option><option value="published">Published</option><option value="estimate">Estimate</option><option value="confirmed">Confirmed</option>
          </select>
        </F>
        <F label="Price note" wide><textarea className="field min-h-16" value={form.price_note} onChange={(e) => setForm({ ...form, price_note: e.target.value })} /></F>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={form.show_host_note} onChange={(e) => setForm({ ...form, show_host_note: e.target.checked })} />
          Show the host note instead of a price
        </label>
        <div className="flex items-end gap-3">
          <button className="btn-pill btn-pill-solid">{editing ? "Save" : "Add"}</button>
          {editing && <button type="button" className="btn-pill" onClick={() => setEditing(null)}>Cancel</button>}
        </div>
      </form>

      <ul className="divide-y border-y">
        {experiences.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-display-light text-lg">
                {e.card} <span className="text-sm text-muted-foreground">· {e.level}{e.rank ? ` · ${e.rank}` : ""}{e.visible ? "" : " · hidden"}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">{e.when_text}{e.price_zar != null ? ` · R${e.price_zar}` : ""} · {e.rsvp_mode}</p>
            </div>
            <button className="btn-pill !px-3 !py-1.5" onClick={() => move(e, -1)} aria-label={`Move ${e.card} up`}>↑</button>
            <button className="btn-pill !px-3 !py-1.5" onClick={() => move(e, 1)} aria-label={`Move ${e.card} down`}>↓</button>
            <button className="btn-pill !px-3 !py-1.5" onClick={() => toggleVisible(e)}>{e.visible ? "Hide" : "Show"}</button>
            <button className="btn-pill !px-3 !py-1.5" onClick={() => setEditing(e)}>Edit</button>
            <button className="btn-pill !px-3 !py-1.5" onClick={() => remove(e)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- shared CSV box (same pattern as Travel) ---------- */

function CsvBox<T>({ columns, filename, parse, commit }: {
  columns: readonly string[]; filename: string;
  parse: (csv: string) => ImportResult<T>; commit: (rows: T[]) => Promise<void>;
}) {
  const { t } = useContent();
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult<T>>();
  const [busy, setBusy] = useState(false);
  const pick = async (file: File) => {
    if (input.current) input.current.value = "";
    if (file.size > CSV_MAX_BYTES) { setResult({ rows: [], errors: [{ row: 0, message: "The file is larger than 1 MB" }] }); return; }
    setResult(parse(await file.text()));
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([columns.join(",") + "\n"], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${filename}-template.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const run = async () => {
    if (!result?.rows.length) return;
    setBusy(true);
    try { await commit(result.rows); toast.success(t("admin.itin.imported")); setResult(undefined); }
    catch { toast.error(t("admin.itin.error")); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-3">
        <button className="btn-pill" onClick={download}>{t("admin.itin.template")}</button>
        <button className="btn-pill" onClick={() => input.current?.click()}>{t("admin.itin.import")}</button>
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" aria-label={t("admin.itin.import")} onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
      </div>
      {result && (
        <div className="border bg-card p-4 text-sm">
          {result.errors.length ? (
            <>
              <p className="label-caps text-ember-deep">{t("admin.itin.preview_errors")}</p>
              <ul className="mt-2 space-y-1">{result.errors.map((e: RowError, i) => <li key={i}>{e.row > 0 ? `Row ${e.row}: ` : ""}{e.message}</li>)}</ul>
              <button className="btn-pill mt-3" onClick={() => setResult(undefined)}>{t("admin.itin.cancel")}</button>
            </>
          ) : (
            <>
              <p className="label-caps">{t("admin.itin.preview_ok")} ({result.rows.length})</p>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs">{result.rows.slice(0, 20).map((r) => JSON.stringify(r)).join("\n")}</pre>
              <div className="mt-3 flex gap-3">
                <button disabled={busy} className="btn-pill btn-pill-solid" onClick={run}>{t("admin.itin.confirm_import")}</button>
                <button className="btn-pill" onClick={() => setResult(undefined)}>{t("admin.itin.cancel")}</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- RSVPs ---------- */

function RsvpsPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const expsQ = useQuery({
    queryKey: ["admin", "purse-experiences"],
    queryFn: async () => {
      const { data, error } = await supabase.from("experiences").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as (Experience & { id: string })[];
    },
  });
  const rsvpsQ = useQuery({
    queryKey: ["admin", "purse-rsvps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("experience_rsvps").select("experience_id,guest_id,status,choice");
      if (error) throw error;
      return (data ?? []) as ExperienceRsvp[];
    },
  });
  const partsQ = useParticipantDirectory(true);
  const [selected, setSelected] = useState("");

  const experiences = (expsQ.data ?? []).filter((e) => e.rsvp_mode !== "none");
  const exp = experiences.find((e) => e.id === selected) ?? experiences[0];
  const participants = partsQ.data ?? [];
  const names = new Map(participants.map((p) => [p.id, p.display_name]));
  const rsvps = (rsvpsQ.data ?? []).filter((r) => r.experience_id === exp?.id && names.has(r.guest_id));
  const answered = new Set(rsvps.map((r) => r.guest_id));
  const awaiting = exp?.rsvp_mode === "must_reply" ? participants.filter((p) => !answered.has(p.id)) : [];

  const setRsvp = async (guestId: string, status: string) => {
    if (!exp?.id) return;
    if (status === "") {
      const { error } = await supabase.from("experience_rsvps").delete().eq("experience_id", exp.id).eq("guest_id", guestId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("experience_rsvps").upsert(
        { experience_id: exp.id, guest_id: guestId, status: status as RsvpStatus, choice: null },
        { onConflict: "experience_id,guest_id" },
      );
      if (error) { toast.error(error.message); return; }
    }
    toast.success(t("admin.itin.saved"));
    await refresh();
  };

  const exportCsv = () => {
    if (!exp) return;
    const rows = participants.map((p) => {
      const r = rsvps.find((x) => x.guest_id === p.id);
      return [p.display_name, r?.status ?? (exp.rsvp_mode === "must_reply" ? "awaiting" : (effectiveStatus(exp, undefined) ?? "")), r?.choice ?? ""];
    });
    const csv = ["name,status,choice", ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `rsvps-${exp.card.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (expsQ.isPending) return <div className="h-48 border bg-card" />;
  if (!experiences.length) return <p className="py-12 text-center text-sm">No experiences with RSVPs yet.</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select className="field max-w-72" value={exp?.id ?? ""} onChange={(e) => setSelected(e.target.value)} aria-label="Experience">
          {experiences.map((e) => <option key={e.id} value={e.id}>{e.card}</option>)}
        </select>
        <button className="btn-pill" onClick={exportCsv}>{t("admin.purse.export")}</button>
      </div>

      {awaiting.length > 0 && (
        <div className="border bg-card p-4">
          <p className="label-caps text-ember-deep">{t("admin.purse.nudge")}</p>
          <p className="mt-2 text-sm">{awaiting.map((p) => p.display_name).join(", ")}</p>
        </div>
      )}

      <ul className="divide-y border-y">
        {participants.map((p) => {
          const r = rsvps.find((x) => x.guest_id === p.id);
          const shown = r?.status ?? (exp?.rsvp_mode === "must_reply" ? "awaiting" : (exp ? effectiveStatus(exp, undefined) : ""));
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <p className="min-w-0 flex-1 text-sm">
                {p.display_name}
                {r?.choice && <span className="text-muted-foreground"> · {r.choice}</span>}
              </p>
              <select
                className="field !w-auto !py-1.5 text-xs"
                value={r?.status ?? ""}
                onChange={(e) => void setRsvp(p.id, e.target.value)}
                aria-label={`RSVP for ${p.display_name}`}
              >
                <option value="">{shown === "awaiting" ? "Awaiting" : "No reply"}</option>
                <option value="going">Going</option>
                <option value="maybe">Maybe</option>
                <option value="not_going">Not going</option>
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Settings ---------- */

function PurseSettingsPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const q = useQuery({
    queryKey: ["admin", "purse-settings"],
    queryFn: async () => {
      const [s, c] = await Promise.all([
        supabase.from("settings").select("key,value").in("key", ["zar_per_usd", "rsvp_show_names", "rsvp_global_lock"]),
        supabase.from("site_content").select("key,value").in("key", ["host_note_instead_of_price", "purse_experiences_deck"]),
      ]);
      if (s.error) throw s.error;
      if (c.error) throw c.error;
      return {
        settings: Object.fromEntries((s.data ?? []).map((r) => [r.key, r.value])) as Record<string, string>,
        content: Object.fromEntries((c.data ?? []).map((r) => [r.key, r.value])) as Record<string, string>,
      };
    },
  });
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (q.data) setF({ ...q.data.settings, ...q.data.content });
  }, [q.data]);

  const save = async () => {
    const settingsRows = [
      { key: "zar_per_usd", value: f["zar_per_usd"] || "16.5" },
      { key: "rsvp_show_names", value: f["rsvp_show_names"] === "true" ? "true" : "false" },
      { key: "rsvp_global_lock", value: f["rsvp_global_lock"] === "true" ? "true" : "false" },
    ];
    const contentRows = [
      { key: "host_note_instead_of_price", value: f["host_note_instead_of_price"] ?? "" },
      { key: "purse_experiences_deck", value: f["purse_experiences_deck"] ?? "" },
    ];
    const a = await supabase.from("settings").upsert(settingsRows);
    if (a.error) { toast.error(a.error.message); return; }
    const b = await supabase.from("site_content").upsert(contentRows);
    if (b.error) { toast.error(b.error.message); return; }
    toast.success(t("admin.settings.saved"));
    await refresh();
  };

  return (
    <div className="grid max-w-md gap-4 border bg-card p-5">
      <F label={t("admin.purse.exchange")}>
        <input className="field" inputMode="decimal" value={f["zar_per_usd"] ?? ""} onChange={(e) => setF({ ...f, zar_per_usd: e.target.value })} />
      </F>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={f["rsvp_show_names"] === "true"} onChange={(e) => setF({ ...f, rsvp_show_names: e.target.checked ? "true" : "false" })} />
        {t("admin.purse.show_names")}
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={f["rsvp_global_lock"] === "true"} onChange={(e) => setF({ ...f, rsvp_global_lock: e.target.checked ? "true" : "false" })} />
        {t("admin.purse.global_lock")}
      </label>
      <F label="Host note (shown instead of a price)" wide>
        <textarea className="field min-h-16" value={f["host_note_instead_of_price"] ?? ""} onChange={(e) => setF({ ...f, host_note_instead_of_price: e.target.value })} />
      </F>
      <F label="Shared Experiences intro line" wide>
        <textarea className="field min-h-16" value={f["purse_experiences_deck"] ?? ""} onChange={(e) => setF({ ...f, purse_experiences_deck: e.target.value })} />
      </F>
      <div>
        <button className="btn-pill btn-pill-solid" onClick={save}>{t("admin.settings.save")}</button>
      </div>
    </div>
  );
}
