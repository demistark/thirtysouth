import { describe, expect, it } from "vitest";
import { canViewTravel, isTripParticipant } from "@/lib/locked-areas";
import {
  castName, castRole, groupLegsByDate, legRoute, nextLeg, packingColumnCount,
  parseFlightsCsv, parsePackingCsv, parseTimeInput, parseTransfersCsv, shuffledCastOrders,
  type CastGuest, type PackingCategory, type PackingItem, type Transfer, type TravelLeg,
} from "@/lib/travel";

/* ---------- role helpers ---------- */

describe("travel roles", () => {
  it("canViewTravel: host, schedule_manager, trip_guest, honorary_guest — never friend_afar", () => {
    expect(canViewTravel(["host"])).toBe(true);
    expect(canViewTravel(["schedule_manager"])).toBe(true);
    expect(canViewTravel(["trip_guest"])).toBe(true);
    expect(canViewTravel(["honorary_guest"])).toBe(true);
    expect(canViewTravel(["friend_afar"])).toBe(false);
    expect(canViewTravel([])).toBe(false);
  });
  it("isTripParticipant: host, schedule_manager, trip_guest only", () => {
    expect(isTripParticipant(["host"])).toBe(true);
    expect(isTripParticipant(["schedule_manager"])).toBe(true);
    expect(isTripParticipant(["trip_guest"])).toBe(true);
    expect(isTripParticipant(["honorary_guest"])).toBe(false);
    expect(isTripParticipant(["friend_afar"])).toBe(false);
  });
});

/* ---------- cast ---------- */

const guest = (over: Partial<CastGuest>): CastGuest => ({
  id: "g1", full_name: "Demi Ogunkanmi", display_name: "Demi",
  pronoun_form: null, cast_order: null, cast_role_override: null, ...over,
});

describe("cast", () => {
  it("name falls back to display name and is uppercase", () => {
    expect(castName(guest({}))).toBe("DEMI OGUNKANMI");
    expect(castName(guest({ full_name: "  ", display_name: "Demi" }))).toBe("DEMI");
  });
  it("role is the override when set, else the pronoun form, else THEMSELVES", () => {
    expect(castRole(guest({ cast_role_override: "the birthday boy" }))).toBe("THE BIRTHDAY BOY");
    expect(castRole(guest({ pronoun_form: "herself" }))).toBe("HERSELF");
    expect(castRole(guest({}))).toBe("THEMSELVES");
  });
  it("shuffled orders cover every id exactly once, starting at 1", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const orders = shuffledCastOrders(ids, () => 0.42);
    expect([...orders.keys()].sort()).toEqual(ids);
    expect([...orders.values()].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
  });
});

/* ---------- time ---------- */

describe("Cape Town time", () => {
  it("parses 12-hour and 24-hour input", () => {
    expect(parseTimeInput("2:30 PM")).toBe("14:30");
    expect(parseTimeInput("12:05 AM")).toBe("00:05");
    expect(parseTimeInput("12:05 PM")).toBe("12:05");
    expect(parseTimeInput("14:30")).toBe("14:30");
    expect(parseTimeInput("9:05")).toBe("09:05");
    expect(parseTimeInput("25:00")).toBeNull();
    expect(parseTimeInput("noon")).toBeNull();
  });
  it("renders the flight route line per direction", () => {
    const leg = { direction: "arrival" as const, airline: "QR", flight_number: "1369", other_airport: "DOH" };
    expect(legRoute(leg)).toBe("QR 1369 // DOH → CPT");
    expect(legRoute({ ...leg, direction: "departure" })).toBe("QR 1369 // CPT → DOH");
  });
  it("groups legs by Cape Town date in time order", () => {
    const legs: TravelLeg[] = [
      { guest_id: "a", direction: "arrival", airline: "", flight_number: "", other_airport: "", cpt_time: "2026-11-20T18:00:00", terminal: null, notes: null, transfer_id: null, visible: true },
      { guest_id: "b", direction: "arrival", airline: "", flight_number: "", other_airport: "", cpt_time: "2026-11-20T09:00:00", terminal: null, notes: null, transfer_id: null, visible: true },
      { guest_id: "c", direction: "arrival", airline: "", flight_number: "", other_airport: "", cpt_time: "2026-11-21T09:00:00", terminal: null, notes: null, transfer_id: null, visible: true },
    ];
    const groups = groupLegsByDate(legs);
    expect(groups.map((g) => g.date)).toEqual(["2026-11-20", "2026-11-21"]);
    expect(groups[0]!.legs.map((l) => l.guest_id)).toEqual(["b", "a"]);
  });
  it("nextLeg picks the friend's first future leg", () => {
    const legs: TravelLeg[] = [
      { guest_id: "me", direction: "arrival", airline: "", flight_number: "", other_airport: "", cpt_time: "2026-11-20T16:40:00", terminal: null, notes: null, transfer_id: null, visible: true },
      { guest_id: "me", direction: "departure", airline: "", flight_number: "", other_airport: "", cpt_time: "2026-11-28T10:00:00", terminal: null, notes: null, transfer_id: null, visible: true },
      { guest_id: "you", direction: "arrival", airline: "", flight_number: "", other_airport: "", cpt_time: "2026-11-19T08:00:00", terminal: null, notes: null, transfer_id: null, visible: true },
    ];
    expect(nextLeg(legs, "me", "2026-11-01")?.cpt_time).toBe("2026-11-20T16:40:00");
    expect(nextLeg(legs, "me", "2026-11-21")?.direction).toBe("departure");
    expect(nextLeg(legs, null, "2026-11-01")).toBeNull();
  });
});

/* ---------- packing columns ---------- */

describe("packing columns", () => {
  it("aims for about 10 rows per column, capped by width, down to 1", () => {
    expect(packingColumnCount(5, 4)).toBe(1);
    expect(packingColumnCount(11, 4)).toBe(2);
    expect(packingColumnCount(25, 4)).toBe(3);
    expect(packingColumnCount(40, 4)).toBe(4);
    expect(packingColumnCount(100, 4)).toBe(4);
    expect(packingColumnCount(25, 2)).toBe(2);
  });
});

/* ---------- CSV imports ---------- */

const guests = [{ id: "g1", display_name: "Demi" }, { id: "g2", display_name: "Ü" }];
const transfers: Transfer[] = [{ id: "t1", direction: "arrival", label: "Transfer A", meet_time: null, meeting_point: null, provider: null, driver_contact: null, included_with_villa: false, notes: null, visible: true, sort_order: 0 }];

describe("flights CSV", () => {
  const header = "guest_name,direction,airline,flight_number,other_airport,cpt_date,cpt_time,terminal,notes,transfer_label";
  it("parses a happy-path row and resolves guest and transfer case-insensitively", () => {
    const r = parseFlightsCsv(`${header}\ndemi,arrival,QR,1369,DOH,2026-11-20,4:40 PM,,,transfer a`, guests, [], transfers);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ guest_id: "g1", direction: "arrival", cpt_time: "2026-11-20T16:40:00", transfer_id: "t1" });
  });
  it("is all-or-nothing: one bad row fails the whole import", () => {
    const r = parseFlightsCsv(`${header}\nDemi,arrival,QR,1369,DOH,2026-11-20,4:40 PM,,,\nNobody,arrival,QR,1,JNB,2026-11-20,4:40 PM,,,`, guests, [], transfers);
    expect(r.rows).toEqual([]);
    expect(r.errors[0]!.message).toContain("Nobody");
  });
  it("rejects bad directions, dates and times", () => {
    const badDir = parseFlightsCsv(`${header}\nDemi,sideways,QR,1369,DOH,2026-11-20,4:40 PM,,,`, guests, [], transfers);
    expect(badDir.rows).toEqual([]);
    expect(badDir.errors[0]!.message).toContain("arrival or departure");
    const badDateTime = parseFlightsCsv(`${header}\nDemi,arrival,QR,1369,DOH,20-11-2026,25:00,,,`, guests, [], transfers);
    expect(badDateTime.rows).toEqual([]);
    expect(badDateTime.errors.length).toBeGreaterThanOrEqual(2);
  });
  it("blank cells keep existing values on upsert", () => {
    const old: TravelLeg = { id: "l1", guest_id: "g1", direction: "arrival", airline: "QR", flight_number: "1369", other_airport: "DOH", cpt_time: "2026-11-20T16:40:00", terminal: "T1", notes: "Window seat", transfer_id: null, visible: true };
    const r = parseFlightsCsv(`${header}\nDemi,arrival,,1369,,2026-11-20,6:40 PM,,,`, guests, [old], transfers);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ id: "l1", airline: "QR", terminal: "T1", notes: "Window seat", cpt_time: "2026-11-20T18:40:00" });
  });
});

describe("transfers CSV", () => {
  const header = "direction,label,meet_date,meet_time,meeting_point,provider,driver_contact,included_with_villa,notes";
  it("parses a happy-path row", () => {
    const r = parseTransfersCsv(`${header}\narrival,Transfer A,2026-11-20,2:30 PM,Arrivals hall,Bob,,yes,`, []);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ label: "Transfer A", meet_time: "2026-11-20T14:30:00", included_with_villa: true });
  });
  it("upserts by direction + label and keeps existing values for blanks", () => {
    const old = transfers[0]!;
    const r = parseTransfersCsv(`${header}\narrival,transfer a,,,New point,,,,`, [old]);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ id: "t1", meeting_point: "New point", label: "transfer a" });
  });
});

describe("packing CSV", () => {
  const cats: PackingCategory[] = [{ id: "c1", name: "Clothes", sort_order: 1 }];
  const items: PackingItem[] = [{ id: "i1", category_id: "c1", name: "Linen shirt", note: "White", chapter_number: null, look_order: null, sort_order: 1, visible: true }];
  const header = "category,item,note,chapter,look_order";
  it("parses rows and keeps existing values for blank cells", () => {
    const r = parsePackingCsv(`${header}\nClothes,Linen shirt,,4,1\nClothes,Sunglasses,Polarised,,`, cats, items);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ category: "Clothes", name: "Linen shirt", note: "White", chapter_number: 4, look_order: 1 });
    expect(r.rows[1]).toMatchObject({ name: "Sunglasses", note: "Polarised", chapter_number: null });
  });
  it("rejects bad chapters and duplicate keys", () => {
    const r = parsePackingCsv(`${header}\nClothes,A,,99,\nClothes,A,,,`, cats, items);
    expect(r.rows).toEqual([]);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});
