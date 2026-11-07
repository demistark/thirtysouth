import Papa from "papaparse";
import { CSV_MAX_BYTES, CSV_MAX_ROWS, type ImportResult, type RowError } from "./itinerary";

export type TravelSlot = "cast" | "villa" | "roomies" | "flights" | "packing";
export const TRAVEL_SLOTS: TravelSlot[] = ["cast", "villa", "roomies", "flights", "packing"];

export interface Roomie { id: string; names: string; floor_room: string; note: string; sort_order: number }

export interface TravelImage {
  slot: TravelSlot;
  storage_path: string;
  focal_x: number;
  focal_y: number;
  alt: string;
  caption: string | null;
}
export interface VillaRoom {
  id: string; label: string; bed_config: string; sleeps: number;
  level: string | null; notes: string | null; sort_order: number;
}
export interface RoomAssignment { room_id: string; guest_id: string }
export type LegDirection = "arrival" | "departure";
export interface TravelLeg {
  id?: string; guest_id: string; direction: LegDirection; airline: string; flight_number: string;
  other_airport: string; cpt_time: string; terminal: string | null; notes: string | null;
  transfer_id: string | null; visible: boolean; connections?: string[];
}
export interface Transfer {
  id?: string; direction: LegDirection; label: string; meet_time: string | null;
  meeting_point: string | null; provider: string | null; driver_contact: string | null;
  included_with_villa: boolean; notes: string | null; visible: boolean; sort_order: number;
}
export interface PackingCategory { id: string; name: string; sort_order: number }
export interface PackingItem {
  id: string; category_id: string; name: string; note: string | null;
  chapter_number: number | null; look_order: number | null; sort_order: number; visible: boolean;
}
export interface CastGuest {
  id: string; full_name: string; display_name: string;
  pronoun_form: string | null; cast_order: number | null; cast_role_override: string | null;
}

/* ---------- Cast ---------- */

export function castName(g: Pick<CastGuest, "full_name" | "display_name">) {
  return (g.full_name.trim() || g.display_name).toUpperCase();
}
export function castRole(g: Pick<CastGuest, "pronoun_form" | "cast_role_override">) {
  const over = g.cast_role_override?.trim();
  if (over) return over.toUpperCase();
  return (g.pronoun_form ?? "themselves").toUpperCase();
}
/** Random cast order assigned once (1..n shuffled); never reshuffles existing orders. */
export function shuffledCastOrders(ids: string[], random: () => number = Math.random): Map<string, number> {
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.min(Math.max(random(), 0), 0.999999) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return new Map(shuffled.map((id, i) => [id, i + 1]));
}

/* ---------- Cape Town time (stored without time zone, always SAST) ---------- */

const T12 = /^(1[0-2]|[1-9]):([0-5][0-9])\s*(AM|PM)$/i;
const T24 = /^([01]?\d|2[0-3]):([0-5][0-9])$/;

/** Accepts "2:30 PM" or "14:30"; returns "HH:MM" (24h) or null. */
export function parseTimeInput(s: string): string | null {
  const v = s.trim();
  const m12 = T12.exec(v);
  if (m12) {
    let h = Number(m12[1]) % 12;
    if (m12[3]!.toUpperCase() === "PM") h += 12;
    return `${String(h).padStart(2, "0")}:${m12[2]}`;
  }
  const m24 = T24.exec(v);
  if (m24) return `${m24[1]!.padStart(2, "0")}:${m24[2]}`;
  return null;
}
export function formatTime12(hhmm: string) {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}
/** cpt_time comes back as "YYYY-MM-DDTHH:MM:SS" (no zone). */
export function cptDatePart(iso: string) { return iso.slice(0, 10); }
export function cptTimePart(iso: string) { return iso.slice(11, 16); }
export function formatLegTime(iso: string) { return formatTime12(cptTimePart(iso)); }
export function formatLegDate(iso: string) {
  const [y = 0, m = 1, d = 1] = cptDatePart(iso).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}
export function legRoute(leg: Pick<TravelLeg, "direction" | "airline" | "flight_number" | "other_airport">) {
  const flight = [leg.airline, leg.flight_number].filter(Boolean).join(" ");
  const route = leg.direction === "arrival" ? `${leg.other_airport} → CPT` : `CPT → ${leg.other_airport}`;
  return [flight, route].filter(Boolean).join(" // ");
}
export function groupLegsByDate(legs: TravelLeg[]) {
  const sorted = [...legs].sort((a, b) => a.cpt_time.localeCompare(b.cpt_time));
  const groups: { date: string; legs: TravelLeg[] }[] = [];
  for (const leg of sorted) {
    const date = cptDatePart(leg.cpt_time);
    const last = groups.at(-1);
    if (last && last.date === date) last.legs.push(leg);
    else groups.push({ date, legs: [leg] });
  }
  return groups;
}
/** The signed-in friend's next leg, for the Home tile live line. */
export function nextLeg(legs: TravelLeg[], myGuestId: string | null | undefined, todayCpt: string) {
  if (!myGuestId) return null;
  return legs
    .filter((l) => l.guest_id === myGuestId && cptDatePart(l.cpt_time) >= todayCpt)
    .sort((a, b) => a.cpt_time.localeCompare(b.cpt_time))[0] ?? null;
}

export function normalizeIata(code: string): string | null {
  const value = code.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(value) ? value : null;
}
/** Empty is valid; otherwise a flight identifier is at most eight letters/digits. */
export function flightNumberValid(value: string) {
  return /^[A-Za-z0-9]{0,8}$/.test(value);
}
export function flightAirportsValid(airport: string, connections: string[]) {
  return !!normalizeIata(airport) && connections.length <= 3 && connections.every(code => !!normalizeIata(code));
}
export function sortFlights(legs: TravelLeg[]) { return [...legs].sort((a,b) => a.cpt_time.localeCompare(b.cpt_time)); }
export function flightDate(iso: string) { return `${iso.slice(5,7)}.${iso.slice(8,10)}`; }
export function flightTime(iso: string) {
  const h = Number(iso.slice(11,13)), m = iso.slice(14,16);
  return `${h % 12 || 12}${m === "00" ? "" : `:${m}`} ${h >= 12 ? "P" : "A"}`;
}
export function flightRouteCodes(leg: Pick<TravelLeg,"direction" | "other_airport" | "connections">) {
  return leg.direction === "arrival" ? [leg.other_airport,...(leg.connections ?? []),"CPT"] : ["CPT",...(leg.connections ?? []),leg.other_airport];
}
/** Which of a guest's two flight directions still need a leg saved, if any. */
export function missingFlightDirections(legs: TravelLeg[], guestId: string): "both" | LegDirection | null {
  const arrival = legs.some((l) => l.guest_id === guestId && l.direction === "arrival");
  const departure = legs.some((l) => l.guest_id === guestId && l.direction === "departure");
  if (arrival && departure) return null;
  if (!arrival && !departure) return "both";
  return arrival ? "departure" : "arrival";
}

export function hasFlightDirection(legs: TravelLeg[], guestId: string, direction: LegDirection, exceptId?: string) {
  return legs.some(l => l.guest_id === guestId && l.direction === direction && (!exceptId || l.id !== exceptId));
}

export function copyFlightOptions(legs: TravelLeg[], directory: { id: string; display_name: string }[], guestId: string, direction: LegDirection) {
  return sortFlights(legs.filter(l => l.guest_id !== guestId && l.direction === direction)).flatMap(leg => {
    const guest = directory.find(g => g.id === leg.guest_id);
    if (!guest) return [];
    return [{ leg, label: `${guest.display_name}: ${flightRouteCodes(leg).join("→")}, ${flightDate(leg.cpt_time)} ${flightTime(leg.cpt_time)}${leg.flight_number ? `, ${leg.flight_number}` : ""}` }];
  });
}

/* ---------- Packing columns ---------- */

/** About 10 rows per column, capped by the width allowance; short lists use fewer. */
export function packingColumnCount(rows: number, maxCols: number) {
  return Math.max(1, Math.min(maxCols, Math.ceil(rows / 10)));
}

/* ---------- CSV ---------- */

type Raw = Record<string, string>;
const cell = (r: Raw, k: string) => (r[k] ?? "").trim();
const isInt = (s: string) => /^\d+$/.test(s);
function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}
function parseRaw(csv: string, columns: readonly string[]): { data: Raw[]; errors: RowError[] } {
  const res = Papa.parse<Raw>(csv.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim().toLowerCase() });
  const errors: RowError[] = res.errors.map((e) => ({ row: (e.row ?? 0) + 2, message: e.message }));
  const missing = columns.filter((c) => !res.meta.fields?.includes(c));
  if (missing.length) errors.push({ row: 1, message: `Missing columns: ${missing.join(", ")}` });
  if (!res.data.length) errors.push({ row: 1, message: "The file has no rows" });
  if (res.data.length > CSV_MAX_ROWS) errors.push({ row: 1, message: `More than ${CSV_MAX_ROWS} rows` });
  return { data: res.data, errors };
}
function finish<T>(rows: T[], errors: RowError[]): ImportResult<T> {
  return errors.length ? { rows: [], errors } : { rows, errors };
}
function dupCheck(keys: string[], errors: RowError[]) {
  const seen = new Map<string, number>();
  keys.forEach((k, i) => { if (!k) return; if (seen.has(k)) errors.push({ row: i + 2, message: `Same key as row ${seen.get(k)}` }); else seen.set(k, i + 2); });
}

export const FLIGHT_CSV_COLUMNS = ["guest_name", "direction", "airline", "flight_number", "other_airport", "cpt_date", "cpt_time", "terminal", "notes", "transfer_label", "connections"] as const;
export const TRANSFER_CSV_COLUMNS = ["direction", "label", "meet_date", "meet_time", "meeting_point", "provider", "driver_contact", "included_with_villa", "notes"] as const;
export const PACKING_CSV_COLUMNS = ["category", "item", "note", "chapter", "look_order"] as const;

/** Upsert key: guest_name + direction + flight_number + cpt_date. Blank cells keep existing values. */
export function parseFlightsCsv(
  csv: string,
  guests: { id: string; display_name: string }[],
  existing: TravelLeg[],
  transfers: Transfer[],
): ImportResult<TravelLeg> {
  const { data, errors } = parseRaw(csv, FLIGHT_CSV_COLUMNS.filter(c => c !== "connections"));
  if (errors.length) return finish([], errors);
  const out: TravelLeg[] = [];
  data.forEach((r, i) => {
    const row = i + 2;
    const name = cell(r, "guest_name").toLowerCase();
    const guest = guests.find((g) => g.display_name.toLowerCase() === name);
    if (!guest) { errors.push({ row, message: `No guest called “${cell(r, "guest_name")}”` }); return; }
    const direction = cell(r, "direction").toLowerCase();
    if (direction !== "arrival" && direction !== "departure") { errors.push({ row, message: "direction must be arrival or departure" }); return; }
    const date = cell(r, "cpt_date");
    if (!validDate(date)) { errors.push({ row, message: "cpt_date must be YYYY-MM-DD" }); return; }
    const time = parseTimeInput(cell(r, "cpt_time"));
    if (!time) { errors.push({ row, message: "cpt_time must look like 2:30 PM or 14:30" }); return; }
    const old = existing.find((l) => l.guest_id === guest.id && l.direction === direction
      );
    const transferLabel = cell(r, "transfer_label").toLowerCase();
    const transfer = transferLabel ? transfers.find((tr) => tr.label.toLowerCase() === transferLabel) : undefined;
    if (transferLabel && !transfer) errors.push({ row, message: `No transfer called “${cell(r, "transfer_label")}”` });
    const keep = (v: string, o: string | null | undefined) => (v ? v : (old ? (o ?? null) : null));
    const connections = cell(r,"connections") ? cell(r,"connections").split(/[; >→]+/).filter(Boolean).map(c => c.toUpperCase()) : old?.connections ?? [];
    const airport = (cell(r,"other_airport") || old?.other_airport || "").toUpperCase();
    if (!flightAirportsValid(airport,connections)) errors.push({row,message:"Invalid airport codes or more than three connections"});
    out.push({
      ...(old?.id ? { id: old.id } : {}),
      guest_id: guest.id, direction,
      airline: cell(r, "airline") || old?.airline || "",
      flight_number: cell(r, "flight_number") || old?.flight_number || "",
      other_airport: airport, connections,
      cpt_time: `${date}T${time}:00`,
      terminal: keep(cell(r, "terminal"), old?.terminal),
      notes: keep(cell(r, "notes"), old?.notes),
      transfer_id: transfer?.id ?? (transferLabel ? null : (old?.transfer_id ?? null)),
      visible: old?.visible ?? true,
    });
  });
  dupCheck(data.map((r) => `${cell(r, "guest_name").toLowerCase()}|${cell(r, "direction").toLowerCase()}`), errors);
  return finish(out, errors);
}

/** Upsert key: direction + label. Blank cells keep existing values. */
export function parseTransfersCsv(csv: string, existing: Transfer[]): ImportResult<Transfer> {
  const { data, errors } = parseRaw(csv, TRANSFER_CSV_COLUMNS);
  if (errors.length) return finish([], errors);
  const out: Transfer[] = [];
  data.forEach((r, i) => {
    const row = i + 2;
    const direction = cell(r, "direction").toLowerCase();
    if (direction !== "arrival" && direction !== "departure") { errors.push({ row, message: "direction must be arrival or departure" }); return; }
    const label = cell(r, "label");
    if (!label) { errors.push({ row, message: "A transfer needs a label" }); return; }
    const old = existing.find((tr) => tr.direction === direction && tr.label.toLowerCase() === label.toLowerCase());
    const date = cell(r, "meet_date"), timeRaw = cell(r, "meet_time");
    let meet: string | null = old?.meet_time ?? null;
    if (date || timeRaw) {
      const time = parseTimeInput(timeRaw);
      if (!validDate(date)) errors.push({ row, message: "meet_date must be YYYY-MM-DD" });
      else if (!time) errors.push({ row, message: "meet_time must look like 2:30 PM or 14:30" });
      else meet = `${date}T${time}:00`;
    }
    const incl = cell(r, "included_with_villa").toLowerCase();
    if (incl && !["true", "yes", "1", "false", "no", "0"].includes(incl)) errors.push({ row, message: "included_with_villa must be true or false" });
    const keep = (v: string, o: string | null | undefined) => (v ? v : (o ?? null));
    out.push({
      ...(old?.id ? { id: old.id } : {}),
      direction, label: label || old?.label || "",
      meet_time: meet,
      meeting_point: keep(cell(r, "meeting_point"), old?.meeting_point),
      provider: keep(cell(r, "provider"), old?.provider),
      driver_contact: keep(cell(r, "driver_contact"), old?.driver_contact),
      included_with_villa: incl ? ["true", "yes", "1"].includes(incl) : (old?.included_with_villa ?? false),
      notes: keep(cell(r, "notes"), old?.notes),
      visible: old?.visible ?? true,
      sort_order: old?.sort_order ?? 0,
    });
  });
  dupCheck(data.map((r) => `${cell(r, "direction").toLowerCase()}|${cell(r, "label").toLowerCase()}`), errors);
  return finish(out, errors);
}

export interface PackingCsvRow { category: string; item: PackingItem & { category_name?: string } }
/** Upsert key: category + item. New categories are created. Blank cells keep existing values. */
export function parsePackingCsv(
  csv: string,
  categories: PackingCategory[],
  items: PackingItem[],
): ImportResult<{ category: string; name: string; note: string | null; chapter_number: number | null; look_order: number | null }> {
  const { data, errors } = parseRaw(csv, PACKING_CSV_COLUMNS);
  if (errors.length) return finish([], errors);
  const out: { category: string; name: string; note: string | null; chapter_number: number | null; look_order: number | null }[] = [];
  data.forEach((r, i) => {
    const row = i + 2;
    const category = cell(r, "category"), name = cell(r, "item");
    if (!category || !name) { errors.push({ row, message: "Each row needs a category and an item" }); return; }
    const cat = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());
    const old = cat ? items.find((it) => it.category_id === cat.id && it.name.toLowerCase() === name.toLowerCase()) : undefined;
    const chapter = cell(r, "chapter"), look = cell(r, "look_order");
    if (chapter && (!isInt(chapter) || +chapter < 1 || +chapter > 10)) errors.push({ row, message: "chapter must be a whole number from 1 to 10" });
    if (look && !isInt(look)) errors.push({ row, message: "look_order must be a whole number" });
    out.push({
      category, name,
      note: cell(r, "note") || old?.note || null,
      chapter_number: chapter ? +chapter : (old?.chapter_number ?? null),
      look_order: look ? +look : (old?.look_order ?? null),
    });
  });
  dupCheck(data.map((r) => `${cell(r, "category").toLowerCase()}|${cell(r, "item").toLowerCase()}`), errors);
  return finish(out, errors);
}

export function exportFlightsCsv(legs: TravelLeg[], guests: { id: string; display_name: string }[], transfers: Transfer[]) {
  return Papa.unparse({
    fields: [...FLIGHT_CSV_COLUMNS],
    data: legs.map((l) => [
      guests.find((g) => g.id === l.guest_id)?.display_name ?? "", l.direction, l.airline, l.flight_number,
      l.other_airport, cptDatePart(l.cpt_time), formatLegTime(l.cpt_time), l.terminal ?? "", l.notes ?? "",
      transfers.find((tr) => tr.id === l.transfer_id)?.label ?? "", (l.connections ?? []).join(";"),
    ]),
  });
}

export { CSV_MAX_BYTES };
