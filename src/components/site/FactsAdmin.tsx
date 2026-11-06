import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useContent } from "@/lib/data";
import { parseFactsCsv } from "@/lib/facts";

export function FactsAdmin() {
  const { t } = useContent();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<string>();
  const [text, setText] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const facts = useQuery({
    queryKey: ["admin", "facts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fun_facts").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["admin", "facts"] }), qc.invalidateQueries({ queryKey: ["fun_facts"] })]);
  };
  const reset = () => { setEditing(undefined); setText(""); setActive(true); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const row = { text: text.trim(), active };
      const { error } = editing ? await supabase.from("fun_facts").update(row).eq("id", editing) : await supabase.from("fun_facts").insert(row);
      if (error) throw error;
      reset(); await refresh(); toast.success(t("facts.saved"));
    } catch { toast.error(t("facts.error")); }
    finally { setBusy(false); }
  };
  const toggle = async (id: string, next: boolean) => {
    const { error } = await supabase.from("fun_facts").update({ active: next }).eq("id", id);
    if (error) toast.error(t("facts.error"));
    else await refresh();
  };
  const remove = async (ids: string[]) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("fun_facts").delete().in("id", ids);
      if (error) throw error;
      setConfirmingId(undefined); setConfirmingBulk(false);
      setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next; });
      await refresh(); toast.success(t("facts.deleted"));
    } catch { toast.error(t("facts.error")); }
    finally { setBusy(false); }
  };
  const toggleSelected = (id: string, on: boolean) => {
    setSelected((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });
    setConfirmingBulk(false);
  };
  const importCsv = async (file: File) => {
    setBusy(true);
    try {
      let rows;
      try { rows = parseFactsCsv(await file.text()); }
      catch { toast.error(t("facts.csv_error")); return; }
      const { error } = await supabase.from("fun_facts").insert(rows);
      if (error) throw error;
      await refresh(); toast.success(t("facts.imported"));
    } catch { toast.error(t("facts.error")); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  const rows = facts.data ?? [];
  const allSelected = rows.length > 0 && rows.every((fact) => selected.has(fact.id));
  return <div className="space-y-8">
    <div className="flex flex-col items-end gap-2">
      <Button variant="pill" disabled={busy} onClick={() => fileInput.current?.click()}>{t("facts.import")}</Button>
      <p className="caption-serif">{t("facts.import_hint")}</p>
      <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" aria-label={t("facts.import")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); }} />
    </div>
    <form onSubmit={save} className="space-y-4">
      <label className="block"><span className="label-caps">{t("facts.text")}</span><textarea className="field mt-2 min-h-24" required value={text} onChange={(event) => setText(event.target.value)} /></label>
      <label className="label-caps flex items-center gap-2"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />{t("facts.active")}</label>
      <div className="flex gap-3"><Button variant="pill" type="submit" disabled={busy || !text.trim()}>{t(editing ? "facts.save" : "facts.add")}</Button>{editing && <Button variant="pill" type="button" onClick={reset}>{t("facts.cancel")}</Button>}</div>
    </form>
    {facts.isError && <p className="caption-serif">{t("facts.error")}</p>}
    {rows.length === 0 && !facts.isPending && <p className="caption-serif">{t("facts.empty")}</p>}
    {rows.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="label-caps flex items-center gap-2"><input type="checkbox" checked={allSelected} onChange={(event) => { setSelected(event.target.checked ? new Set(rows.map((fact) => fact.id)) : new Set()); setConfirmingBulk(false); }} />{t("facts.select_all")}</label>
      {selected.size > 0 && (confirmingBulk ? (
        <span className="flex flex-wrap items-center gap-3">
          <span className="caption-serif">{t("facts.delete_selected_confirm").replace("{n}", String(selected.size))}</span>
          <Button variant="pill" disabled={busy} onClick={() => void remove([...selected])}>{t("facts.delete")}</Button>
          <Button variant="pill" disabled={busy} onClick={() => setConfirmingBulk(false)}>{t("facts.keep")}</Button>
        </span>
      ) : (
        <Button variant="pill" disabled={busy} onClick={() => setConfirmingBulk(true)}>{t("facts.delete_selected")} ({selected.size})</Button>
      ))}
    </div>}
    <ul className="divide-y border-y">{rows.map((fact) => <li key={fact.id} className="flex flex-wrap items-center gap-4 py-5">
      <input type="checkbox" aria-label={fact.text} checked={selected.has(fact.id)} onChange={(event) => toggleSelected(fact.id, event.target.checked)} />
      <p className={`min-w-0 flex-1 font-serif italic ${fact.active ? "text-foreground" : "text-muted-foreground"}`}>{fact.text}</p>
      {confirmingId === fact.id ? (
        <span className="flex flex-wrap items-center gap-3">
          <span className="caption-serif">{t("facts.delete_confirm")}</span>
          <Button variant="pill" disabled={busy} onClick={() => void remove([fact.id])}>{t("facts.delete")}</Button>
          <Button variant="pill" disabled={busy} onClick={() => setConfirmingId(undefined)}>{t("facts.keep")}</Button>
        </span>
      ) : (
        <>
          <Button variant="pill" onClick={() => { setEditing(fact.id); setText(fact.text); setActive(fact.active); }}>{t("facts.edit")}</Button>
          <Button variant="pill" onClick={() => toggle(fact.id, !fact.active)}>{t(fact.active ? "facts.hide" : "facts.show")}</Button>
          <Button variant="pill" onClick={() => setConfirmingId(fact.id)}>{t("facts.delete")}</Button>
        </>
      )}
    </li>)}</ul>
  </div>;
}
