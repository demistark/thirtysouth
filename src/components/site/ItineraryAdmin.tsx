import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SubTabs } from "@/components/site/Blocks";
import { supabase } from "@/integrations/supabase/client";
import { useContent } from "@/lib/data";
import {
  CSV_MAX_BYTES, SCENE_KINDS, TIME_RE, csvTemplate, parseChaptersCsv, parseScenesCsv, parseWardrobeCsv,
  type Chapter, type CsvKind, type ImportResult, type RowError, type Scene, type WardrobeLook,
} from "@/lib/itinerary";
import { fetchAllChapters, toLook, toScene, usePhotoUrls } from "@/lib/itinerary-data";
import { photoExtension, preparePhoto } from "@/lib/image-resize";

type Sub = "chapters" | "scenes" | "wardrobe";

function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all(["chapters", "scenes", "wardrobe_looks", "admin"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

const useAdminChapters = () => useQuery({ queryKey: ["admin", "itin-chapters"], queryFn: fetchAllChapters });
const useAdminScenes = () => useQuery({ queryKey: ["admin", "itin-scenes"], queryFn: async () => {
  const { data, error } = await supabase.from("scenes").select("*").order("chapter_number").order("scene_order");
  if (error) throw error; return (data ?? []).map(toScene);
} });
const useAdminLooks = () => useQuery({ queryKey: ["admin", "itin-looks"], queryFn: async () => {
  const { data, error } = await supabase.from("wardrobe_looks").select("*").order("chapter_number").order("look_order");
  if (error) throw error; return (data ?? []).map(toLook);
} });

export function ItineraryAdmin() {
  const { t } = useContent();
  const [sub, setSub] = useState<Sub>("chapters");
  return <div>
    <SubTabs tabs={(["chapters", "scenes", "wardrobe"] as const).map((id) => ({ id, label: t(`admin.itin.${id}`) }))} value={sub} onChange={setSub} />
    {sub === "chapters" && <ChaptersPanel />}
    {sub === "scenes" && <ScenesPanel />}
    {sub === "wardrobe" && <WardrobePanel />}
  </div>;
}

function F({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`block space-y-1 ${wide ? "md:col-span-2" : ""}`}><span className="label-caps text-muted-foreground">{label}</span>{children}</label>;
}

/* ---------- CSV import ---------- */

function CsvImport<T>({ kind, parse, commit }: { kind: CsvKind; parse: (csv: string) => ImportResult<T>; commit: (rows: T[]) => Promise<void> }) {
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
    const url = URL.createObjectURL(new Blob([csvTemplate(kind)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${kind}-template.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const run = async () => {
    if (!result?.rows.length) return;
    setBusy(true);
    try { await commit(result.rows); toast.success(t("admin.itin.imported")); setResult(undefined); }
    catch { toast.error(t("admin.itin.error")); } finally { setBusy(false); }
  };
  return <div className="mb-8 space-y-4">
    <div className="flex flex-wrap justify-end gap-3">
      <button className="btn-pill" onClick={download}>{t("admin.itin.template")}</button>
      <button className="btn-pill" onClick={() => input.current?.click()}>{t("admin.itin.import")}</button>
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" aria-label={t("admin.itin.import")} onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
    </div>
    {result && <div className="border bg-card p-4 text-sm">
      {result.errors.length ? <>
        <p className="label-caps text-ember-deep">{t("admin.itin.preview_errors")}</p>
        <ul className="mt-2 space-y-1">{result.errors.map((e: RowError, i) => <li key={i}>{e.row > 0 ? `Row ${e.row}: ` : ""}{e.message}</li>)}</ul>
        <button className="btn-pill mt-3" onClick={() => setResult(undefined)}>{t("admin.itin.cancel")}</button>
      </> : <>
        <p className="label-caps">{t("admin.itin.preview_ok")} ({result.rows.length})</p>
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs">{result.rows.slice(0, 20).map((r) => JSON.stringify(r)).join("\n")}</pre>
        <div className="mt-3 flex gap-3"><button disabled={busy} className="btn-pill btn-pill-solid" onClick={run}>{t("admin.itin.confirm_import")}</button><button className="btn-pill" onClick={() => setResult(undefined)}>{t("admin.itin.cancel")}</button></div>
      </>}
    </div>}
  </div>;
}

/* ---------- Chapters ---------- */

function ChaptersPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const q = useAdminChapters();
  const [adding, setAdding] = useState(false);
  return <div>
    <CsvImport kind="chapters" parse={(csv) => parseChaptersCsv(csv, q.data ?? [])} commit={async (rows) => {
      const { error } = await supabase.from("chapters").upsert(rows, { onConflict: "number" }); if (error) throw error; await refresh();
    }} />
    <ul className="space-y-4">{q.data?.map((c) => <ChapterRow key={`${c.number}-${c.date}-${c.title}`} c={c} />)}</ul>
    {adding ? <ul className="mt-4"><ChapterRow c={{ number: (q.data?.length ?? 0) + 1, date: "", title: "", summary: "", visible: true, sort_order: (q.data?.length ?? 0) + 1 }} isNew onDone={() => setAdding(false)} /></ul>
      : (q.data?.length ?? 0) < 10 && <button className="btn-pill mt-4" onClick={() => setAdding(true)}>{t("admin.itin.add")}</button>}
  </div>;
}

function ChapterRow({ c, isNew, onDone }: { c: Chapter; isNew?: boolean; onDone?: (() => void) | undefined }) {
  const { t } = useContent();
  const refresh = useRefresh();
  const [f, setF] = useState(c);
  const save = async () => {
    const row = { ...f, sort_order: f.number };
    const { error } = isNew ? await supabase.from("chapters").insert(row) : await supabase.from("chapters").update(row).eq("number", c.number);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved")); onDone?.(); await refresh();
  };
  const del = async () => {
    if (!confirm(`Delete chapter ${c.number} and its scenes and looks?`)) return;
    const { error } = await supabase.from("chapters").delete().eq("number", c.number);
    if (error) toast.error(error.message); else await refresh();
  };
  return <li className="grid gap-3 border bg-card p-5 md:grid-cols-2">
    <F label="Chapter"><input type="number" min={1} max={10} className="field" value={f.number} onChange={(e) => setF({ ...f, number: +e.target.value })} /></F>
    <F label="Date"><input type="date" className="field" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></F>
    <F label="Title" wide><input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></F>
    <F label="Summary" wide><textarea className="field" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></F>
    <Actions visible={f.visible} onVisible={(v) => setF({ ...f, visible: v })} onSave={save} onDelete={isNew ? onDone : del} />
  </li>;
}

function Actions({ visible, onVisible, onSave, onDelete }: { visible: boolean; onVisible: (v: boolean) => void; onSave: () => void; onDelete?: (() => void) | undefined }) {
  const { t } = useContent();
  return <div className="flex flex-wrap items-center gap-3 md:col-span-2">
    <label className="label-caps flex items-center gap-2 text-muted-foreground"><input type="checkbox" checked={visible} onChange={(e) => onVisible(e.target.checked)} />{t("admin.itin.visible")}</label>
    <button className="btn-pill btn-pill-solid" onClick={onSave}>{t("admin.itin.save")}</button>
    {onDelete && <button className="btn-pill" onClick={onDelete}>{t("admin.itin.delete")}</button>}
  </div>;
}

/* ---------- Scenes ---------- */

const blankScene = (chapter: number, order: number): Scene => ({ chapter_number: chapter, scene_order: order, title: "", location: "", kind: "core", leave_at: null, start_time: null, end_time: null, summary: "", details: "", experience_card: null, wardrobe_look: null, visible: true });

function ScenesPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const chapters = useAdminChapters().data ?? [];
  const q = useAdminScenes();
  const [chapter, setChapter] = useState(1);
  const [adding, setAdding] = useState(false);
  const list = (q.data ?? []).filter((s) => s.chapter_number === chapter);
  return <div>
    <CsvImport kind="scenes" parse={(csv) => parseScenesCsv(csv, q.data ?? [], chapters.map((c) => c.number))} commit={async (rows) => {
      const { error } = await supabase.from("scenes").upsert(rows.map(({ id: _id, ...r }) => r), { onConflict: "chapter_number,scene_order" }); if (error) throw error; await refresh();
    }} />
    <ChapterPicker chapters={chapters} value={chapter} onChange={(n) => { setChapter(n); setAdding(false); }} />
    <ul className="space-y-4">{list.map((s) => <SceneRow key={`${s.id}-${s.scene_order}`} s={s} />)}</ul>
    {adding ? <ul className="mt-4"><SceneRow s={blankScene(chapter, (list.at(-1)?.scene_order ?? 0) + 1)} isNew onDone={() => setAdding(false)} /></ul>
      : <button className="btn-pill mt-4" onClick={() => setAdding(true)}>{t("admin.itin.add")}</button>}
  </div>;
}

function ChapterPicker({ chapters, value, onChange }: { chapters: Chapter[]; value: number; onChange: (n: number) => void }) {
  return <select className="field mb-6 max-w-xs" value={value} onChange={(e) => onChange(+e.target.value)} aria-label="Chapter">
    {chapters.map((c) => <option key={c.number} value={c.number}>Chapter {c.number} · {c.title}</option>)}
  </select>;
}

function SceneRow({ s, isNew, onDone }: { s: Scene; isNew?: boolean; onDone?: (() => void) | undefined }) {
  const { t } = useContent();
  const refresh = useRefresh();
  const [f, setF] = useState(s);
  const set = <K extends keyof Scene>(k: K, v: Scene[K]) => setF({ ...f, [k]: v });
  const time = (k: "leave_at" | "start_time" | "end_time", label: string) => <F label={label}><input className="field" placeholder="9:30 AM" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value.trim() ? e.target.value : null)} /></F>;
  const save = async () => {
    for (const k of ["leave_at", "start_time", "end_time"] as const) if (f[k] && !TIME_RE.test(f[k]!.trim())) { toast.error("Times must look like 9:30 AM"); return; }
    if (!f.title.trim()) { toast.error("A scene needs a title"); return; }
    const { id: _id, ...row } = { ...f, leave_at: f.leave_at?.trim() || null, start_time: f.start_time?.trim() || null, end_time: f.end_time?.trim() || null };
    const { error } = isNew ? await supabase.from("scenes").insert(row) : await supabase.from("scenes").update(row).eq("id", s.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved")); onDone?.(); await refresh();
  };
  const del = async () => {
    if (!confirm(`Delete “${s.title}”?`)) return;
    const { error } = await supabase.from("scenes").delete().eq("id", s.id!);
    if (error) toast.error(error.message); else await refresh();
  };
  return <li className="grid gap-3 border bg-card p-5 md:grid-cols-2">
    <F label="Order"><input type="number" className="field" value={f.scene_order} onChange={(e) => set("scene_order", +e.target.value)} /></F>
    <F label="Kind"><select className="field" value={f.kind} onChange={(e) => set("kind", e.target.value as Scene["kind"])}>{SCENE_KINDS.map((k) => <option key={k}>{k}</option>)}</select></F>
    <F label="Title"><input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} /></F>
    <F label="Location"><input className="field" value={f.location} onChange={(e) => set("location", e.target.value)} /></F>
    {time("start_time", "Start")}{time("end_time", "End")}{time("leave_at", "Leave at")}
    <F label="Wardrobe look (number)"><input type="number" className="field" value={f.wardrobe_look ?? ""} onChange={(e) => set("wardrobe_look", e.target.value === "" ? null : +e.target.value)} /></F>
    <F label="Summary" wide><textarea className="field" value={f.summary} onChange={(e) => set("summary", e.target.value)} /></F>
    <F label="Details" wide><textarea className="field min-h-32" value={f.details} onChange={(e) => set("details", e.target.value)} /></F>
    <F label="Experience card" wide><input className="field" value={f.experience_card ?? ""} onChange={(e) => set("experience_card", e.target.value || null)} /></F>
    <Actions visible={f.visible} onVisible={(v) => set("visible", v)} onSave={save} onDelete={isNew ? onDone : del} />
  </li>;
}

/* ---------- Wardrobe ---------- */

const blankLook = (chapter: number, order: number): WardrobeLook => ({ chapter_number: chapter, look_order: order, date_label: "", look_label: "", title: "", description: "", palette: [], photos: [], visible: true });

function WardrobePanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const chapters = useAdminChapters().data ?? [];
  const q = useAdminLooks();
  const [chapter, setChapter] = useState(1);
  const [adding, setAdding] = useState(false);
  const list = (q.data ?? []).filter((l) => l.chapter_number === chapter);
  return <div>
    <CsvImport kind="wardrobe" parse={(csv) => parseWardrobeCsv(csv, q.data ?? [], chapters.map((c) => c.number))} commit={async (rows) => {
      const { error } = await supabase.from("wardrobe_looks").upsert(rows.map(({ id: _id, ...r }) => ({ ...r, palette: r.palette as never, photos: r.photos as never })), { onConflict: "chapter_number,look_order" }); if (error) throw error; await refresh();
    }} />
    <ChapterPicker chapters={chapters} value={chapter} onChange={(n) => { setChapter(n); setAdding(false); }} />
    <ul className="space-y-4">{list.map((l) => <LookRow key={`${l.id}-${l.look_order}-${l.photos.join()}`} l={l} />)}</ul>
    {adding ? <ul className="mt-4"><LookRow l={blankLook(chapter, (list.at(-1)?.look_order ?? 0) + 1)} isNew onDone={() => setAdding(false)} /></ul>
      : <button className="btn-pill mt-4" onClick={() => setAdding(true)}>{t("admin.itin.add")}</button>}
  </div>;
}

function LookRow({ l, isNew, onDone }: { l: WardrobeLook; isNew?: boolean; onDone?: (() => void) | undefined }) {
  const { t } = useContent();
  const refresh = useRefresh();
  const [f, setF] = useState(l);
  useEffect(() => setF(l), [l]);
  const set = <K extends keyof WardrobeLook>(k: K, v: WardrobeLook[K]) => setF((p) => ({ ...p, [k]: v }));
  const persist = async (next: WardrobeLook) => {
    const { id: _id, ...row } = next;
    const payload = { ...row, palette: row.palette as never, photos: row.photos as never };
    const { error } = isNew ? await supabase.from("wardrobe_looks").insert(payload) : await supabase.from("wardrobe_looks").update(payload).eq("id", l.id!);
    if (error) { toast.error(error.message); return false; }
    return true;
  };
  const save = async () => {
    if (!f.title.trim()) { toast.error("A look needs a title"); return; }
    if (await persist(f)) { toast.success(t("admin.itin.saved")); onDone?.(); await refresh(); }
  };
  const del = async () => {
    if (!confirm(`Delete “${l.title}”?`)) return;
    if (l.photos.length) await supabase.storage.from("wardrobe-photos").remove(l.photos);
    const { error } = await supabase.from("wardrobe_looks").delete().eq("id", l.id!);
    if (error) toast.error(error.message); else await refresh();
  };
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (files: FileList) => {
    setUploading(true);
    const added: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const blob = await preparePhoto(file);
        const path = `ch${f.chapter_number}/${crypto.randomUUID()}.${photoExtension(blob.type)}`;
        const { error } = await supabase.storage.from("wardrobe-photos").upload(path, blob, { contentType: blob.type });
        if (error) throw error;
        added.push(path);
      } catch { toast.error(t("admin.itin.photo_error")); }
    }
    if (added.length) { const next = { ...f, photos: [...f.photos, ...added] }; setF(next); if (!isNew && await persist(next)) await refresh(); }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  };
  const removePhoto = async (p: string) => {
    const next = { ...f, photos: f.photos.filter((x) => x !== p) }; setF(next);
    await supabase.storage.from("wardrobe-photos").remove([p]);
    if (!isNew && await persist(next)) await refresh();
  };
  const move = async (i: number, d: -1 | 1) => {
    const photos = [...f.photos]; const j = i + d; if (j < 0 || j >= photos.length) return;
    [photos[i], photos[j]] = [photos[j]!, photos[i]!];
    const next = { ...f, photos }; setF(next); if (!isNew && await persist(next)) await refresh();
  };
  const urls = usePhotoUrls(f.photos).data ?? {};
  return <li className="grid gap-3 border bg-card p-5 md:grid-cols-2">
    <F label="Order"><input type="number" className="field" value={f.look_order} onChange={(e) => set("look_order", +e.target.value)} /></F>
    <F label="Title"><input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} /></F>
    <F label="Date label"><input className="field" value={f.date_label} onChange={(e) => set("date_label", e.target.value)} /></F>
    <F label="Look label"><input className="field" value={f.look_label} onChange={(e) => set("look_label", e.target.value)} /></F>
    <F label="Description" wide><textarea className="field min-h-24" value={f.description} onChange={(e) => set("description", e.target.value)} /></F>
    <div className="space-y-2 md:col-span-2">
      <p className="label-caps text-muted-foreground">Palette</p>
      {f.palette.map((p, i) => <div key={i} className="flex items-center gap-2">
        <input type="color" aria-label={`Colour for ${p.name || "item"}`} value={p.hex || "#ffffff"} onChange={(e) => set("palette", f.palette.map((x, k) => k === i ? { ...x, hex: e.target.value } : x))} className="h-9 w-10 border bg-transparent" />
        <input className="field flex-1" value={p.name} placeholder="Name" onChange={(e) => set("palette", f.palette.map((x, k) => k === i ? { ...x, name: e.target.value } : x))} />
        {p.hex && <button className="btn-pill !px-2 !py-1 text-xs" onClick={() => set("palette", f.palette.map((x, k) => k === i ? { ...x, hex: "" } : x))}>No colour</button>}
        <button className="btn-pill !px-2 !py-1 text-xs" onClick={() => set("palette", f.palette.filter((_, k) => k !== i))}>×</button>
      </div>)}
      <button className="btn-pill !px-3 !py-1.5" onClick={() => set("palette", [...f.palette, { name: "", hex: "" }])}>+ {t("itinerary.palette")}</button>
    </div>
    <div className="space-y-2 md:col-span-2">
      <p className="label-caps text-muted-foreground">{t("admin.itin.photos")}</p>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
        {f.photos.map((p, i) => <div key={p} className="space-y-1">
          {urls[p] ? <img src={urls[p]} alt="" className="aspect-[4/5] w-full border object-cover" /> : <div className="aspect-[4/5] border bg-paper" />}
          <div className="flex gap-1"><button className="btn-pill !px-2 !py-0.5 text-xs" onClick={() => move(i, -1)} aria-label="Move earlier">←</button><button className="btn-pill !px-2 !py-0.5 text-xs" onClick={() => move(i, 1)} aria-label="Move later">→</button><button className="btn-pill !px-2 !py-0.5 text-xs" onClick={() => removePhoto(p)} aria-label="Remove photo">×</button></div>
        </div>)}
      </div>
      <button className="btn-pill" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? "…" : t("admin.itin.upload")}</button>
      <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" aria-label={t("admin.itin.upload")} onChange={(e) => e.target.files && upload(e.target.files)} />
    </div>
    <Actions visible={f.visible} onVisible={(v) => set("visible", v)} onSave={save} onDelete={isNew ? onDone : del} />
  </li>;
}
