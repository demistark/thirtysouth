import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SubTabs } from "@/components/site/Blocks";
import { supabase } from "@/integrations/supabase/client";
import { useContent } from "@/lib/data";
import { photoExtension, preparePhoto } from "@/lib/image-resize";
import {
  CSV_MAX_BYTES, FLIGHT_CSV_COLUMNS, PACKING_CSV_COLUMNS, TRANSFER_CSV_COLUMNS,
  exportFlightsCsv, parseFlightsCsv, parsePackingCsv, parseTimeInput, parseTransfersCsv,
  shuffledCastOrders, type CastGuest, type PackingCategory, type PackingItem, type Transfer,
  type TravelLeg, type TravelSlot, type VillaRoom,
} from "@/lib/travel";
import type { ImportResult, RowError } from "@/lib/itinerary";
import { useGuestDirectory } from "@/lib/travel-data";

type Sub = "cast" | "villa" | "flights" | "transfers" | "packing" | "images" | "settings";

const VILLA_KEYS = ["travel_subtitle", "cast_heading", "cast_subheading", "cast_deck", "villa_name", "villa_address", "villa_stay", "villa_checkin", "villa_checkout", "villa_about", "villa_amenities", "villa_house_rules", "villa_power_note", "villa_after_checkout", "flights_deck", "flights_getting_to_villa", "flights_power_and_time", "packing_deck"];

function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all([["travel"], ["admin"], ["site_content"], ["settings"]].map((k) => qc.invalidateQueries({ queryKey: k })));
}

function F({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`block space-y-1 ${wide ? "md:col-span-2" : ""}`}><span className="label-caps text-muted-foreground">{label}</span>{children}</label>;
}

export function TravelAdmin() {
  const { t } = useContent();
  const [sub, setSub] = useState<Sub>("cast");
  return (
    <div>
      <SubTabs tabs={(["cast", "villa", "flights", "transfers", "packing", "images", "settings"] as const).map((id) => ({ id, label: t(`admin.travel.${id}`) }))} value={sub} onChange={setSub} />
      {sub === "cast" && <CastPanel />}
      {sub === "villa" && <VillaPanel />}
      {sub === "flights" && <FlightsPanel />}
      {sub === "transfers" && <TransfersPanel />}
      {sub === "packing" && <PackingPanel />}
      {sub === "images" && <ImagesPanel />}
      {sub === "settings" && <TravelSettingsPanel />}
    </div>
  );
}

/* ---------- shared CSV box ---------- */

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
    <div className="mb-8 space-y-4">
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

/* ---------- Cast ---------- */

interface AdminGuest extends CastGuest { email: string; status: string }

function CastPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const q = useQuery({
    queryKey: ["admin", "travel-cast"],
    queryFn: async (): Promise<AdminGuest[]> => {
      const { data, error } = await supabase.from("guests").select("id,full_name,display_name,email,status,pronoun_form,cast_order,cast_role_override").order("created_at");
      if (error) throw error;
      return (data ?? []) as AdminGuest[];
    },
  });
  const [f, setF] = useState<Record<string, AdminGuest>>({});
  useEffect(() => {
    if (q.data) setF(Object.fromEntries(q.data.map((g) => [g.id, g])));
  }, [q.data]);

  const save = async (g: AdminGuest) => {
    const row = f[g.id];
    if (!row) return;
    const { error } = await supabase.from("guests").update({
      full_name: row.full_name, status: row.status, pronoun_form: row.pronoun_form || null,
      cast_order: row.cast_order, cast_role_override: row.cast_role_override || null,
    }).eq("id", g.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved"));
    await refresh();
  };
  const reshuffle = async () => {
    const confirmed = (q.data ?? []).filter((g) => g.status === "confirmed");
    const orders = shuffledCastOrders(confirmed.map((g) => g.id));
    for (const g of confirmed) {
      const { error } = await supabase.from("guests").update({ cast_order: orders.get(g.id) }).eq("id", g.id);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(t("admin.itin.saved"));
    await refresh();
  };
  const markAllConfirmed = async () => {
    const { error } = await supabase.from("guests").update({ status: "confirmed" }).neq("status", "confirmed");
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved"));
    await refresh();
  };

  if (q.isPending) return <div className="h-64 border bg-card" />;
  return (
    <div>
      <div className="mb-4 flex flex-wrap justify-end gap-3">
        <button className="btn-pill" onClick={markAllConfirmed}>Mark everyone confirmed</button>
        <button className="btn-pill" onClick={reshuffle}>Reshuffle</button>
      </div>
      <ul className="space-y-4">
        {(q.data ?? []).map((g) => {
          const row = f[g.id] ?? g;
          return (
            <li key={g.id} className="grid gap-3 border bg-card p-5 md:grid-cols-3">
              <F label="Full name"><input className="field" value={row.full_name} onChange={(e) => setF({ ...f, [g.id]: { ...row, full_name: e.target.value } })} /></F>
              <F label="Pronoun form">
                <select className="field" value={row.pronoun_form ?? ""} onChange={(e) => setF({ ...f, [g.id]: { ...row, pronoun_form: e.target.value || null } })}>
                  <option value="">Themselves</option><option value="himself">Himself</option><option value="herself">Herself</option><option value="themselves">Themselves</option>
                </select>
              </F>
              <F label="Role override (optional)"><input className="field" placeholder="THE BIRTHDAY BOY" value={row.cast_role_override ?? ""} onChange={(e) => setF({ ...f, [g.id]: { ...row, cast_role_override: e.target.value } })} /></F>
              <F label="Cast order"><input type="number" className="field" value={row.cast_order ?? ""} onChange={(e) => setF({ ...f, [g.id]: { ...row, cast_order: e.target.value === "" ? null : +e.target.value } })} /></F>
              <label className="label-caps flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" checked={row.status === "confirmed"} onChange={(e) => setF({ ...f, [g.id]: { ...row, status: e.target.checked ? "confirmed" : "tentative" } })} />
                Confirmed
              </label>
              <div className="flex items-end"><button className="btn-pill btn-pill-solid" onClick={() => void save(g)}>{t("admin.itin.save")}</button></div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Villa ---------- */

function VillaPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const contentQ = useQuery({
    queryKey: ["admin", "travel-content"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_content").select("key,value").in("key", VILLA_KEYS);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });
  const roomsQ = useQuery({
    queryKey: ["admin", "travel-rooms"],
    queryFn: async (): Promise<VillaRoom[]> => {
      const { data, error } = await supabase.from("villa_rooms").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
  const assignQ = useQuery({
    queryKey: ["admin", "travel-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_assignments").select("room_id,guest_id");
      if (error) throw error;
      return data ?? [];
    },
  });
  const directory = useGuestDirectory(true).data ?? [];
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => { if (contentQ.data) setVals(contentQ.data); }, [contentQ.data]);

  const saveKey = async (key: string) => {
    const { error } = await supabase.from("site_content").upsert({ key, value: vals[key] ?? "" });
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved"));
    await refresh();
  };
  const assign = async (guestId: string, roomId: string) => {
    if (!roomId) {
      const { error } = await supabase.from("room_assignments").delete().eq("guest_id", guestId);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.from("room_assignments").upsert({ guest_id: guestId, room_id: roomId }, { onConflict: "guest_id" });
      if (error) toast.error(error.message);
    }
    await refresh();
  };

  if (contentQ.isPending || roomsQ.isPending) return <div className="h-64 border bg-card" />;
  const assigned = new Map((assignQ.data ?? []).map((a) => [a.guest_id, a.room_id]));
  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-2">
        {VILLA_KEYS.map((key) => (
          <div key={key} className="border bg-card p-4">
            <p className="label-caps text-muted-foreground">{key}</p>
            <textarea className="field mt-2 min-h-16" value={vals[key] ?? ""} onChange={(e) => setVals({ ...vals, [key]: e.target.value })} />
            {vals[key] && <p className="mt-2 border-l-2 border-seafoam pl-3 text-xs text-muted-foreground">{vals[key]}</p>}
            <button className="btn-pill mt-2 !px-3 !py-1.5" disabled={(vals[key] ?? "") === (contentQ.data?.[key] ?? "")} onClick={() => void saveKey(key)}>{t("admin.itin.save")}</button>
          </div>
        ))}
      </div>
      <div>
        <p className="label-caps mb-4">{t("travel.rooms")}</p>
        <ul className="space-y-4">
          {(roomsQ.data ?? []).map((r) => <RoomRow key={r.id} room={r} onDone={refresh} />)}
        </ul>
        <button className="btn-pill mt-4" onClick={async () => {
          const { error } = await supabase.from("villa_rooms").insert({ label: `Room ${(roomsQ.data?.length ?? 0) + 1}`, bed_config: "", sleeps: 2, sort_order: (roomsQ.data?.length ?? 0) + 1 });
          if (error) toast.error(error.message); else await refresh();
        }}>{t("admin.itin.add")}</button>
      </div>
      <div>
        <p className="label-caps mb-4">Room assignments</p>
        <ul className="divide-y border-y">
          {directory.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm">{d.display_name}</span>
              <select className="field max-w-48" value={assigned.get(d.id) ?? ""} onChange={(e) => void assign(d.id, e.target.value)} aria-label={`Room for ${d.display_name}`}>
                <option value="">Unassigned</option>
                {(roomsQ.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RoomRow({ room, onDone }: { room: VillaRoom; onDone: () => Promise<unknown> }) {
  const { t } = useContent();
  const [f, setF] = useState(room);
  useEffect(() => setF(room), [room]);
  const save = async () => {
    const { id: _id, ...row } = f;
    const { error } = await supabase.from("villa_rooms").update(row).eq("id", room.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved"));
    await onDone();
  };
  const del = async () => {
    if (!confirm(`Delete ${room.label}?`)) return;
    const { error } = await supabase.from("villa_rooms").delete().eq("id", room.id);
    if (error) toast.error(error.message); else await onDone();
  };
  return (
    <li className="grid gap-3 border bg-card p-5 md:grid-cols-3">
      <F label="Label"><input className="field" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></F>
      <F label="Beds"><input className="field" value={f.bed_config} onChange={(e) => setF({ ...f, bed_config: e.target.value })} /></F>
      <F label="Sleeps"><input type="number" className="field" value={f.sleeps} onChange={(e) => setF({ ...f, sleeps: +e.target.value })} /></F>
      <F label="Level"><input className="field" value={f.level ?? ""} onChange={(e) => setF({ ...f, level: e.target.value || null })} /></F>
      <F label="Order"><input type="number" className="field" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: +e.target.value })} /></F>
      <F label="Notes"><input className="field" value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value || null })} /></F>
      <div className="flex flex-wrap items-center gap-3 md:col-span-3">
        <button className="btn-pill btn-pill-solid" onClick={save}>{t("admin.itin.save")}</button>
        <button className="btn-pill" onClick={del}>{t("admin.itin.delete")}</button>
      </div>
    </li>
  );
}

/* ---------- Flights ---------- */

const blankLeg = (guestId: string): TravelLeg => ({ guest_id: guestId, direction: "arrival", airline: "", flight_number: "", other_airport: "", cpt_time: "2026-11-20T12:00:00", terminal: null, notes: null, transfer_id: null, visible: true });

function FlightsPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const directory = useGuestDirectory(true).data ?? [];
  const legsQ = useQuery({ queryKey: ["admin", "travel-legs"], queryFn: async (): Promise<TravelLeg[]> => {
    const { data, error } = await supabase.from("travel_legs").select("*").order("cpt_time");
    if (error) throw error;
    return (data ?? []) as TravelLeg[];
  } });
  const transfersQ = useQuery({ queryKey: ["admin", "travel-transfers"], queryFn: async (): Promise<Transfer[]> => {
    const { data, error } = await supabase.from("transfers").select("*").order("sort_order");
    if (error) throw error;
    return (data ?? []) as Transfer[];
  } });
  const [dirFilter, setDirFilter] = useState("");
  const [guestFilter, setGuestFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const legs = (legsQ.data ?? []).filter((l) => (!dirFilter || l.direction === dirFilter) && (!guestFilter || l.guest_id === guestFilter));

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className="btn-pill" onClick={() => {
          const url = URL.createObjectURL(new Blob([exportFlightsCsv(legsQ.data ?? [], directory, transfersQ.data ?? [])], { type: "text/csv;charset=utf-8" }));
          const a = document.createElement("a"); a.href = url; a.download = "flights.csv"; a.click(); URL.revokeObjectURL(url);
        }}>{t("admin.itin.export")}</button>
      </div>
      <CsvBox columns={FLIGHT_CSV_COLUMNS} filename="flights"
        parse={(csv) => parseFlightsCsv(csv, directory, legsQ.data ?? [], transfersQ.data ?? [])}
        commit={async (rows) => {
          for (const r of rows) {
            const { id, ...row } = r;
            const { error } = id
              ? await supabase.from("travel_legs").update(row).eq("id", id)
              : await supabase.from("travel_legs").insert(row);
            if (error) throw error;
          }
          await refresh();
        }} />
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="field max-w-40" value={dirFilter} onChange={(e) => setDirFilter(e.target.value)} aria-label="Direction filter">
          <option value="">All directions</option><option value="arrival">Arrivals</option><option value="departure">Departures</option>
        </select>
        <select className="field max-w-48" value={guestFilter} onChange={(e) => setGuestFilter(e.target.value)} aria-label="Guest filter">
          <option value="">Everyone</option>
          {directory.map((d) => <option key={d.id} value={d.id}>{d.display_name}</option>)}
        </select>
      </div>
      <ul className="space-y-4">
        {legs.map((l) => <LegRow key={l.id} leg={l} directory={directory} transfers={transfersQ.data ?? []} allLegs={legsQ.data ?? []} onDone={refresh} />)}
      </ul>
      {adding && directory.length ? (
        <ul className="mt-4"><LegRow leg={blankLeg(directory[0]!.id)} directory={directory} transfers={transfersQ.data ?? []} allLegs={legsQ.data ?? []} isNew onDone={async () => { setAdding(false); await refresh(); }} /></ul>
      ) : (
        <button className="btn-pill mt-4" onClick={() => setAdding(true)}>{t("admin.itin.add")}</button>
      )}
    </div>
  );
}

function LegRow({ leg, directory, transfers, allLegs, isNew, onDone }: {
  leg: TravelLeg; directory: { id: string; display_name: string }[]; transfers: Transfer[];
  allLegs: TravelLeg[]; isNew?: boolean; onDone: () => Promise<unknown>;
}) {
  const { t } = useContent();
  const [f, setF] = useState(leg);
  useEffect(() => setF(leg), [leg]);
  const date = f.cpt_time.slice(0, 10);
  const time = f.cpt_time.slice(11, 16);
  const save = async () => {
    const parsed = parseTimeInput(time);
    if (!parsed) { toast.error("Time must look like 2:30 PM or 14:30"); return; }
    if (!f.guest_id) { toast.error("Pick a friend"); return; }
    if (f.direction === "arrival" && allLegs.some((l) => l.id !== f.id && l.guest_id === f.guest_id && l.direction === "arrival"))
      toast.warning("This friend already has another arrival");
    const { id, ...row } = { ...f, cpt_time: `${date}T${parsed}:00` };
    const { error } = isNew ? await supabase.from("travel_legs").insert(row) : await supabase.from("travel_legs").update(row).eq("id", leg.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved"));
    await onDone();
  };
  const del = async () => {
    if (!confirm("Delete this flight?")) return;
    const { error } = await supabase.from("travel_legs").delete().eq("id", leg.id!);
    if (error) toast.error(error.message); else await onDone();
  };
  return (
    <li className="grid gap-3 border bg-card p-5 md:grid-cols-3">
      <F label="Friend">
        <select className="field" value={f.guest_id} onChange={(e) => setF({ ...f, guest_id: e.target.value })}>
          {directory.map((d) => <option key={d.id} value={d.id}>{d.display_name}</option>)}
        </select>
      </F>
      <F label="Direction">
        <select className="field" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value as TravelLeg["direction"] })}>
          <option value="arrival">Arrival</option><option value="departure">Departure</option>
        </select>
      </F>
      <F label="Airline"><input className="field" value={f.airline} onChange={(e) => setF({ ...f, airline: e.target.value })} /></F>
      <F label="Flight number"><input className="field" value={f.flight_number} onChange={(e) => setF({ ...f, flight_number: e.target.value })} /></F>
      <F label="Other airport"><input className="field" placeholder="DOH" value={f.other_airport} onChange={(e) => setF({ ...f, other_airport: e.target.value })} /></F>
      <F label="Cape Town date"><input type="date" className="field" value={date} onChange={(e) => setF({ ...f, cpt_time: `${e.target.value}T${time}:00` })} /></F>
      <F label="Cape Town time"><input className="field" placeholder="2:30 PM" value={time} onChange={(e) => setF({ ...f, cpt_time: `${date}T${e.target.value}:00` })} /></F>
      <F label="Terminal"><input className="field" value={f.terminal ?? ""} onChange={(e) => setF({ ...f, terminal: e.target.value || null })} /></F>
      <F label="Transfer">
        <select className="field" value={f.transfer_id ?? ""} onChange={(e) => setF({ ...f, transfer_id: e.target.value || null })}>
          <option value="">None</option>
          {transfers.map((tr) => <option key={tr.id} value={tr.id}>{tr.label}</option>)}
        </select>
      </F>
      <F label="Notes" wide><textarea className="field" value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value || null })} /></F>
      <div className="flex flex-wrap items-center gap-3 md:col-span-3">
        <label className="label-caps flex items-center gap-2 text-muted-foreground">
          <input type="checkbox" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} />{t("admin.itin.visible")}
        </label>
        <button className="btn-pill btn-pill-solid" onClick={save}>{t("admin.itin.save")}</button>
        {!isNew && <button className="btn-pill" onClick={del}>{t("admin.itin.delete")}</button>}
      </div>
    </li>
  );
}

/* ---------- Transfers ---------- */

const blankTransfer = (): Transfer => ({ direction: "arrival", label: "", meet_time: null, meeting_point: null, provider: null, driver_contact: null, included_with_villa: false, notes: null, visible: true, sort_order: 0 });

function TransfersPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ["admin", "travel-transfers"], queryFn: async (): Promise<Transfer[]> => {
    const { data, error } = await supabase.from("transfers").select("*").order("sort_order");
    if (error) throw error;
    return (data ?? []) as Transfer[];
  } });
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <CsvBox columns={TRANSFER_CSV_COLUMNS} filename="transfers"
        parse={(csv) => parseTransfersCsv(csv, q.data ?? [])}
        commit={async (rows) => {
          for (const r of rows) {
            const { id, ...row } = r;
            const { error } = id
              ? await supabase.from("transfers").update(row).eq("id", id)
              : await supabase.from("transfers").insert(row);
            if (error) throw error;
          }
          await refresh();
        }} />
      <ul className="space-y-4">{(q.data ?? []).map((tr) => <TransferRow key={tr.id} transfer={tr} onDone={refresh} />)}</ul>
      {adding ? (
        <ul className="mt-4"><TransferRow transfer={blankTransfer()} isNew onDone={async () => { setAdding(false); await refresh(); }} /></ul>
      ) : (
        <button className="btn-pill mt-4" onClick={() => setAdding(true)}>{t("admin.itin.add")}</button>
      )}
    </div>
  );
}

function TransferRow({ transfer, isNew, onDone }: { transfer: Transfer; isNew?: boolean; onDone: () => Promise<unknown> }) {
  const { t } = useContent();
  const [f, setF] = useState(transfer);
  useEffect(() => setF(transfer), [transfer]);
  const date = f.meet_time?.slice(0, 10) ?? "";
  const time = f.meet_time?.slice(11, 16) ?? "";
  const save = async () => {
    if (!f.label.trim()) { toast.error("A transfer needs a label"); return; }
    let meet: string | null = null;
    if (date || time) {
      const parsed = parseTimeInput(time);
      if (!date || !parsed) { toast.error("Meet time needs a date and a time like 2:30 PM"); return; }
      meet = `${date}T${parsed}:00`;
    }
    const { id, ...row } = { ...f, meet_time: meet };
    const { error } = isNew ? await supabase.from("transfers").insert(row) : await supabase.from("transfers").update(row).eq("id", transfer.id!);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved"));
    await onDone();
  };
  const del = async () => {
    if (!confirm(`Delete ${transfer.label}? Legs stay, they just lose the transfer.`)) return;
    const { error } = await supabase.from("transfers").delete().eq("id", transfer.id!);
    if (error) toast.error(error.message); else await onDone();
  };
  return (
    <li className="grid gap-3 border bg-card p-5 md:grid-cols-3">
      <F label="Label"><input className="field" placeholder="TRANSFER A" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></F>
      <F label="Direction">
        <select className="field" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value as Transfer["direction"] })}>
          <option value="arrival">Arrival</option><option value="departure">Departure</option>
        </select>
      </F>
      <F label="Order"><input type="number" className="field" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: +e.target.value })} /></F>
      <F label="Meet date"><input type="date" className="field" value={date} onChange={(e) => setF({ ...f, meet_time: e.target.value ? `${e.target.value}T${time || "12:00"}:00` : null })} /></F>
      <F label="Meet time"><input className="field" placeholder="2:30 PM" value={time} onChange={(e) => setF({ ...f, meet_time: date ? `${date}T${e.target.value}:00` : null })} /></F>
      <F label="Meeting point"><input className="field" value={f.meeting_point ?? ""} onChange={(e) => setF({ ...f, meeting_point: e.target.value || null })} /></F>
      <F label="Provider"><input className="field" value={f.provider ?? ""} onChange={(e) => setF({ ...f, provider: e.target.value || null })} /></F>
      <F label="Driver contact"><input className="field" value={f.driver_contact ?? ""} onChange={(e) => setF({ ...f, driver_contact: e.target.value || null })} /></F>
      <F label="Notes"><input className="field" value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value || null })} /></F>
      <div className="flex flex-wrap items-center gap-3 md:col-span-3">
        <label className="label-caps flex items-center gap-2 text-muted-foreground">
          <input type="checkbox" checked={f.included_with_villa} onChange={(e) => setF({ ...f, included_with_villa: e.target.checked })} />Included with the villa
        </label>
        <label className="label-caps flex items-center gap-2 text-muted-foreground">
          <input type="checkbox" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} />{t("admin.itin.visible")}
        </label>
        <button className="btn-pill btn-pill-solid" onClick={save}>{t("admin.itin.save")}</button>
        {!isNew && <button className="btn-pill" onClick={del}>{t("admin.itin.delete")}</button>}
      </div>
    </li>
  );
}

/* ---------- Packing ---------- */

function PackingPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const catsQ = useQuery({ queryKey: ["admin", "packing-cats"], queryFn: async (): Promise<PackingCategory[]> => {
    const { data, error } = await supabase.from("packing_categories").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  } });
  const itemsQ = useQuery({ queryKey: ["admin", "packing-items"], queryFn: async (): Promise<PackingItem[]> => {
    const { data, error } = await supabase.from("packing_items").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  } });
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const { error } = await supabase.from("packing_categories").insert({ name: newCat.trim(), sort_order: (catsQ.data?.length ?? 0) + 1 });
    if (error) { toast.error(error.message); return; }
    setNewCat(""); setAddingCat(false);
    await refresh();
  };

  return (
    <div>
      <CsvBox columns={PACKING_CSV_COLUMNS} filename="packing"
        parse={(csv) => parsePackingCsv(csv, catsQ.data ?? [], itemsQ.data ?? [])}
        commit={async (rows) => {
          const cats = [...(catsQ.data ?? [])];
          for (const r of rows) {
            let cat = cats.find((c) => c.name.toLowerCase() === r.category.toLowerCase());
            if (!cat) {
              const { data, error } = await supabase.from("packing_categories").insert({ name: r.category, sort_order: cats.length + 1 }).select().single();
              if (error) throw error;
              cat = data as PackingCategory;
              cats.push(cat);
            }
            const existing = (itemsQ.data ?? []).find((i) => i.category_id === cat!.id && i.name.toLowerCase() === r.name.toLowerCase());
            const row = { category_id: cat.id, name: r.name, note: r.note, chapter_number: r.chapter_number, look_order: r.look_order };
            const { error } = existing
              ? await supabase.from("packing_items").update(row).eq("id", existing.id)
              : await supabase.from("packing_items").insert({ ...row, sort_order: (itemsQ.data ?? []).length + 1 });
            if (error) throw error;
          }
          await refresh();
        }} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {addingCat ? (
          <>
            <input className="field max-w-64" placeholder="Category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button className="btn-pill btn-pill-solid" onClick={addCategory}>{t("admin.itin.add")}</button>
            <button className="btn-pill" onClick={() => setAddingCat(false)}>{t("admin.itin.cancel")}</button>
          </>
        ) : (
          <button className="btn-pill" onClick={() => setAddingCat(true)}>+ Category</button>
        )}
      </div>
      {(catsQ.data ?? []).map((c) => (
        <CategoryBlock key={c.id} category={c} items={(itemsQ.data ?? []).filter((i) => i.category_id === c.id)} onDone={refresh} />
      ))}
    </div>
  );
}

function CategoryBlock({ category, items, onDone }: { category: PackingCategory; items: PackingItem[]; onDone: () => Promise<unknown> }) {
  const { t } = useContent();
  const [name, setName] = useState(category.name);
  const [adding, setAdding] = useState(false);
  const saveName = async () => {
    const { error } = await supabase.from("packing_categories").update({ name }).eq("id", category.id);
    if (error) toast.error(error.message); else await onDone();
  };
  const del = async () => {
    if (!confirm(`Delete “${category.name}” and its items?`)) return;
    const { error } = await supabase.from("packing_categories").delete().eq("id", category.id);
    if (error) toast.error(error.message); else await onDone();
  };
  return (
    <section className="mb-8 border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <input className="field max-w-64" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} aria-label="Category name" />
        <input type="number" className="field w-20" defaultValue={category.sort_order} aria-label="Order"
          onBlur={async (e) => { await supabase.from("packing_categories").update({ sort_order: +e.target.value }).eq("id", category.id); await onDone(); }} />
        <button className="btn-pill !px-3 !py-1.5" onClick={del}>{t("admin.itin.delete")}</button>
        <button className="btn-pill !px-3 !py-1.5" onClick={() => setAdding(true)}>{t("admin.itin.add")}</button>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((i) => <PackingItemRow key={i.id} item={i} onDone={onDone} />)}
        {adding && <PackingItemRow item={{ id: "", category_id: category.id, name: "", note: null, chapter_number: null, look_order: null, sort_order: items.length + 1, visible: true }} isNew onDone={async () => { setAdding(false); await onDone(); }} />}
      </ul>
    </section>
  );
}

function PackingItemRow({ item, isNew, onDone }: { item: PackingItem; isNew?: boolean; onDone: () => Promise<unknown> }) {
  const { t } = useContent();
  const [f, setF] = useState(item);
  useEffect(() => setF(item), [item]);
  const save = async () => {
    if (!f.name.trim()) { toast.error("An item needs a name"); return; }
    const { id: _id, ...row } = f;
    const { error } = isNew ? await supabase.from("packing_items").insert(row) : await supabase.from("packing_items").update(row).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved"));
    await onDone();
  };
  const del = async () => {
    const { error } = await supabase.from("packing_items").delete().eq("id", item.id);
    if (error) toast.error(error.message); else await onDone();
  };
  return (
    <li className="grid gap-2 border-t pt-3 md:grid-cols-6">
      <input className="field md:col-span-2" placeholder="Item" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Item name" />
      <input className="field" placeholder="Note" value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value || null })} aria-label="Note" />
      <input type="number" min={1} max={10} className="field" placeholder="Chp" value={f.chapter_number ?? ""} onChange={(e) => setF({ ...f, chapter_number: e.target.value === "" ? null : +e.target.value })} aria-label="Chapter" />
      <input type="number" min={1} className="field" placeholder="Look" value={f.look_order ?? ""} onChange={(e) => setF({ ...f, look_order: e.target.value === "" ? null : +e.target.value })} aria-label="Look order" />
      <input type="number" className="field" placeholder="Order" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: +e.target.value })} aria-label="Order" />
      <div className="flex flex-wrap items-center gap-2 md:col-span-6">
        <label className="label-caps flex items-center gap-2 text-muted-foreground">
          <input type="checkbox" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} />{t("admin.itin.visible")}
        </label>
        <button className="btn-pill btn-pill-solid !px-3 !py-1.5" onClick={save}>{t("admin.itin.save")}</button>
        {!isNew && <button className="btn-pill !px-3 !py-1.5" onClick={del}>{t("admin.itin.delete")}</button>}
      </div>
    </li>
  );
}

/* ---------- Images ---------- */

function ImagesPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const q = useQuery({
    queryKey: ["admin", "travel-images"],
    queryFn: async () => {
      const { data, error } = await supabase.from("travel_images").select("*");
      if (error) throw error;
      const rows = (data ?? []) as import("@/lib/travel").TravelImage[];
      let urls: Record<string, string> = {};
      if (rows.length) {
        const { data: signed } = await supabase.storage.from("travel-images").createSignedUrls(rows.map((r) => r.storage_path), 3600);
        urls = Object.fromEntries((signed ?? []).filter((d) => d.signedUrl).map((d) => [d.path ?? "", d.signedUrl!]));
      }
      return { rows, urls };
    },
  });
  if (q.isPending) return <div className="h-64 border bg-card" />;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {(["cast", "villa", "flights", "packing"] as TravelSlot[]).map((slot) => (
        <ImageSlot key={slot} slot={slot} image={q.data?.rows.find((r) => r.slot === slot)} url={q.data?.urls[q.data.rows.find((r) => r.slot === slot)?.storage_path ?? ""]} onDone={refresh} label={t(`travel.section.${slot}`)} />
      ))}
    </div>
  );
}

function ImageSlot({ slot, image, url, onDone, label }: { slot: TravelSlot; image?: import("@/lib/travel").TravelImage | undefined; url?: string | undefined; onDone: () => Promise<unknown>; label: string }) {
  const { t } = useContent();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [alt, setAlt] = useState(image?.alt ?? "");
  const [caption, setCaption] = useState(image?.caption ?? "");
  useEffect(() => { setAlt(image?.alt ?? ""); setCaption(image?.caption ?? ""); }, [image]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const blob = await preparePhoto(file);
      const path = `${slot}/${crypto.randomUUID()}.${photoExtension(blob.type)}`;
      const { error } = await supabase.storage.from("travel-images").upload(path, blob, { contentType: blob.type });
      if (error) throw error;
      if (image?.storage_path) await supabase.storage.from("travel-images").remove([image.storage_path]);
      const { error: uErr } = await supabase.from("travel_images").upsert({ slot, storage_path: path, alt, caption: caption || null });
      if (uErr) throw uErr;
      toast.success(t("admin.itin.saved"));
      await onDone();
    } catch { toast.error(t("admin.itin.photo_error")); } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };
  const setFocal = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!image) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const focal_x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const focal_y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const { error } = await supabase.from("travel_images").update({ focal_x, focal_y }).eq("slot", slot);
    if (error) toast.error(error.message); else await onDone();
  };
  const saveText = async () => {
    if (!image) return;
    const { error } = await supabase.from("travel_images").update({ alt, caption: caption || null }).eq("slot", slot);
    if (error) toast.error(error.message); else { toast.success(t("admin.itin.saved")); await onDone(); }
  };

  return (
    <div className="border bg-card p-4">
      <p className="label-caps text-muted-foreground">{label}</p>
      {image && url ? (
        <img src={url} alt={image.alt} onClick={(e) => void setFocal(e)}
          className="mt-3 aspect-[3/2] w-full cursor-crosshair border object-cover"
          style={{ objectPosition: `${image.focal_x}% ${image.focal_y}%` }}
          title="Tap to set the focal point" />
      ) : (
        <div className="mt-3 flex aspect-[3/2] items-center justify-center border bg-paper text-xs text-muted-foreground">No image yet</div>
      )}
      <div className="mt-3 grid gap-2">
        <input className="field" placeholder="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} aria-label="Alt text" />
        <input className="field" placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Caption" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-pill" disabled={uploading} onClick={() => input.current?.click()}>{uploading ? "…" : t("admin.itin.upload")}</button>
        {image && <button className="btn-pill" onClick={saveText}>{t("admin.itin.save")}</button>}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" aria-label={t("admin.itin.upload")} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      </div>
    </div>
  );
}

/* ---------- Settings ---------- */

function TravelSettingsPanel() {
  const { t } = useContent();
  const refresh = useRefresh();
  const q = useQuery({
    queryKey: ["admin", "travel-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("value").eq("key", "travel_share_all").maybeSingle();
      if (error) throw error;
      return (data?.value ?? "true") === "true";
    },
  });
  const toggle = async (on: boolean) => {
    const { error } = await supabase.from("settings").upsert({ key: "travel_share_all", value: on ? "true" : "false" });
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved"));
    await refresh();
  };
  if (q.isPending) return <div className="h-32 border bg-card" />;
  return (
    <div className="max-w-md border bg-card p-5">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={q.data ?? true} onChange={(e) => void toggle(e.target.checked)} />
        <span>{t("admin.travel.share_all")}</span>
      </label>
    </div>
  );
}
