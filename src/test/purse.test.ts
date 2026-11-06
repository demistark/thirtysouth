import { describe, expect, it } from "vitest";
import { canEditPurse, canViewPurse, isTripParticipant } from "@/lib/locked-areas";
import {
  alsoGoingList, capeTownNow, choiceList, deadlineUpcoming, effectiveStatus, experienceExpandable,
  exportExperiencesCsv, flowSteps, formatDeadline, formatPriceZar, formatWhenList, needsReplyCount,
  parseExperiencesCsv, priceLineParts, readPurseCurrency, readRsvpDraft, rsvpCounts, rsvpOpen,
  runningTotalZar, sceneExperienceTags, showCurrencyToggle, storePurseCurrency, unfinishedByGuest,
  usdFromZar, whatsAppUrl, writeRsvpDraft, clearRsvpDraft, RSVP_DRAFT_PREFIX, RSVP_DRAFT_MAX_AGE_MS,
  type Experience, type ExperienceRsvp,
} from "@/lib/purse";
import { queueRsvpSave } from "@/lib/purse-data";

const exp = (over: Partial<Experience>): Experience => ({
  id: "e1", rank: "", sort_order: 1, card: "Aquila Safari", level: "big", parent_id: null,
  rsvp_mode: "must_reply", default_status: "unconfirmed", choices: null, when_text: "", location: null,
  summary: "", details: null, price_zar: null, price_status: null, price_note: null,
  show_host_note: false, rsvp_deadline: null, visible: true, ...over,
});

describe("purse access", () => {
  it("lets host, schedule manager, trip guest and honorary guest view Purse", () => {
    expect(canViewPurse(["host"])).toBe(true);
    expect(canViewPurse(["schedule_manager"])).toBe(true);
    expect(canViewPurse(["trip_guest"])).toBe(true);
    expect(canViewPurse(["honorary_guest"])).toBe(true);
  });
  it("keeps friends afar and signed-out visitors out of Purse", () => {
    expect(canViewPurse(["friend_afar"])).toBe(false);
    expect(canViewPurse([])).toBe(false);
  });
  it("lets only host and schedule manager edit Purse", () => {
    expect(canEditPurse(["host"])).toBe(true);
    expect(canEditPurse(["schedule_manager"])).toBe(true);
    expect(canEditPurse(["trip_guest"])).toBe(false);
    expect(canEditPurse(["honorary_guest"])).toBe(false);
  });
  it("honorary guests are never trip participants", () => {
    expect(isTripParticipant(["honorary_guest"])).toBe(false);
    expect(isTripParticipant(["trip_guest"])).toBe(true);
  });
});

describe("default status resolution", () => {
  it("treats a missing row as Going for default_going", () => {
    expect(effectiveStatus(exp({ rsvp_mode: "default_going", default_status: "going" }), undefined)).toBe("going");
  });
  it("treats a missing row as Unconfirmed for must_reply", () => {
    expect(effectiveStatus(exp({ rsvp_mode: "must_reply" }), undefined)).toBe("unconfirmed");
  });
  it("uses the stored row when one exists", () => {
    expect(effectiveStatus(exp({ rsvp_mode: "default_going" }), { status: "not_going" })).toBe("not_going");
  });
  it("has no status when RSVPs are off", () => {
    expect(effectiveStatus(exp({ rsvp_mode: "none" }), undefined)).toBeNull();
  });
});

describe("RSVP counts", () => {
  const participants = ["g1", "g2", "g3"];
  const rsvps: ExperienceRsvp[] = [
    { experience_id: "e1", guest_id: "g1", status: "going", choice: null },
    { experience_id: "e1", guest_id: "honorary", status: "going", choice: null },
  ];
  it("counts participants only, never honorary guests", () => {
    const c = rsvpCounts(exp({}), rsvps, participants);
    expect(c.going).toBe(1);
    expect(c.awaiting).toBe(2);
  });
  it("counts no-row participants as going for default_going", () => {
    const c = rsvpCounts(exp({ rsvp_mode: "default_going" }), rsvps, participants);
    expect(c.going).toBe(3);
    expect(c.awaiting).toBe(0);
  });
});

describe("prices", () => {
  it("formats rand with a thousands separator", () => expect(formatPriceZar(2895)).toBe("R2,895"));
  it("converts to rounded dollars", () => expect(usdFromZar(2895, 16.5)).toBe(175));
  it("returns no dollar figure without a rate", () => expect(usdFromZar(2895, 0)).toBeNull());
});

describe("dates and deadlines", () => {
  it("joins several days with a comma and a space", () => {
    expect(formatWhenList("Fri Nov 27 · Sat Nov 28")).toBe("Fri Nov 27, Sat Nov 28");
    expect(formatWhenList("Fri Nov 27 - Sat Nov 28")).toBe("Fri Nov 27, Sat Nov 28");
    expect(formatWhenList("Fri Nov 27")).toBe("Fri Nov 27");
  });
  it("closes RSVPs only under the global lock; deadlines are reminders", () => {
    expect(rsvpOpen(false)).toBe(true);
    expect(rsvpOpen(true)).toBe(false);
  });
  it("shows a deadline as a reminder only while it is in the future", () => {
    expect(deadlineUpcoming("2026-11-10 18:00", "2026-11-10 17:59")).toBe(true);
    expect(deadlineUpcoming("2026-11-10 18:00", "2026-11-10 18:00")).toBe(false);
    expect(deadlineUpcoming(null, "2026-11-01 12:00")).toBe(false);
  });
  it("formats the reply-by date", () => expect(formatDeadline("2026-11-10 18:00")).toBe("Nov 10"));
  it("reads Cape Town wall time", () => {
    expect(capeTownNow(new Date(Date.UTC(2026, 10, 10, 16, 5)))).toBe("2026-11-10 18:05");
  });
});

describe("expandable rule", () => {
  it("opens only with details, a price note, related scenes or an RSVP summary", () => {
    expect(experienceExpandable(exp({}), 0, false)).toBe(false);
    expect(experienceExpandable(exp({ details: "x" }), 0, false)).toBe(true);
    expect(experienceExpandable(exp({ price_note: "x" }), 0, false)).toBe(true);
    expect(experienceExpandable(exp({}), 1, false)).toBe(true);
    expect(experienceExpandable(exp({}), 0, true)).toBe(true);
    expect(experienceExpandable(exp({ rsvp_mode: "none" }), 0, true)).toBe(false);
  });
});

describe("home live line", () => {
  const list = [
    exp({ id: "a", rsvp_mode: "must_reply" }),
    exp({ id: "b", rsvp_mode: "must_reply", level: "group" }),
    exp({ id: "c", rsvp_mode: "default_going" }),
    exp({ id: "d", rsvp_mode: "must_reply", visible: false }),
  ];
  it("counts unanswered must_reply experiences for the signed-in guest", () => {
    expect(needsReplyCount(list, [], "g1")).toBe(1);
    expect(needsReplyCount(list, [{ experience_id: "a", guest_id: "g1" }], "g1")).toBe(0);
  });
  it("never counts for a guest without a row or for hidden/group cards", () => {
    expect(needsReplyCount(list, [], null)).toBe(0);
  });
});

describe("choices", () => {
  it("splits semicolon choices", () => {
    expect(choiceList("Game drive; Sunset cruise")).toEqual(["Game drive", "Sunset cruise"]);
    expect(choiceList(null)).toEqual([]);
  });
});

const CSV_HEADER = "rank,card,level,parent,rsvp_mode,default_status,choices,when,location,summary,details,price_zar,price_status,price_note,show_host_note,related_scenes,rsvp_deadline";

describe("experiences CSV import", () => {
  it("imports a happy-path file in order", () => {
    const csv = `${CSV_HEADER}\n9.1,Aquila Safari,big,,must_reply,unconfirmed,,Fri Nov 27,Aquila,Big day out,,2895,estimate,,false,Aquila Safari,2026-11-10 18:00\n,Winelands,group,,none,,,Sat Nov 28,,Wine day,,,,,false,,`;
    const r = parseExperiencesCsv(csv, [], ["Aquila Safari"]);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.card)).toEqual(["Aquila Safari", "Winelands"]);
    expect(r.rows[0]?.sort_order).toBe(1);
    expect(r.rows[0]?.price_zar).toBe(2895);
    expect(r.rows[0]?.rsvp_deadline).toBe("2026-11-10 18:00");
    expect(r.rows[0]?.related_scene_titles).toEqual(["Aquila Safari"]);
  });
  it("is all-or-nothing: one bad row rejects the whole file", () => {
    const csv = `${CSV_HEADER}\n,Good,big,,none,,,,,,,,,,false,,\n,Bad,big,,sometimes,,,,,,,,,,false,,`;
    const r = parseExperiencesCsv(csv, [], []);
    expect(r.rows).toEqual([]);
    expect(r.errors.some((e) => e.message.includes("rsvp_mode"))).toBe(true);
  });
  it("reports unmatched scene titles", () => {
    const csv = `${CSV_HEADER}\n,Safari,big,,none,,,,,,,,,,false,No Such Scene,`;
    const r = parseExperiencesCsv(csv, [], ["Aquila Safari"]);
    expect(r.rows).toEqual([]);
    expect(r.errors[0]?.message).toContain('no scene titled "No Such Scene"');
  });
  it("matches parents by title from the file or existing rows", () => {
    const csv = `${CSV_HEADER}\n,Winelands,group,,none,,,,,,,,,,false,,\n,Franschhoek,sub,Winelands,must_reply,,,,,,,,,,false,,`;
    const r = parseExperiencesCsv(csv, [], []);
    expect(r.errors).toEqual([]);
    expect(r.rows[1]?.parent_title).toBe("Winelands");
    const orphan = parseExperiencesCsv(`${CSV_HEADER}\n,Franschhoek,sub,Nowhere,none,,,,,,,,,,false,,`, [], []);
    expect(orphan.rows).toEqual([]);
    expect(orphan.errors[0]?.message).toContain('parent "Nowhere"');
  });
  it("upserts by card and blank cells never overwrite", () => {
    const old = exp({ id: "e1", card: "Aquila Safari", summary: "Keep me", price_zar: 2895 });
    const csv = `${CSV_HEADER}\n,Aquila Safari,big,,default_going,,,,,,,,,,false,,`;
    const r = parseExperiencesCsv(csv, [old], []);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]?.id).toBe("e1");
    expect(r.rows[0]?.summary).toBe("Keep me");
    expect(r.rows[0]?.price_zar).toBe(2895);
    expect(r.rows[0]?.rsvp_mode).toBe("default_going");
  });
  it("validates the deadline format", () => {
    const csv = `${CSV_HEADER}\n,Safari,big,,none,,,,,,,,,,false,,Nov 10`;
    const r = parseExperiencesCsv(csv, [], []);
    expect(r.rows).toEqual([]);
    expect(r.errors[0]?.message).toContain("rsvp_deadline");
  });
  it("round-trips through export", () => {
    const rows = [exp({ id: "e1", card: "Aquila Safari", rank: "9.1", when_text: "Fri Nov 27", price_zar: 2895, price_status: "estimate" })];
    const csv = exportExperiencesCsv(rows, new Map([["s1", "Aquila Safari"]]), [{ experience_id: "e1", scene_id: "s1" }]);
    const r = parseExperiencesCsv(csv, rows, ["Aquila Safari"]);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]?.card).toBe("Aquila Safari");
    expect(r.rows[0]?.related_scene_titles).toEqual(["Aquila Safari"]);
  });
});

describe("currency toggle", () => {
  it("defaults to ZAR", () => {
    expect(readPurseCurrency({ getItem: () => null })).toBe("zar");
  });
  it("remembers the choice per viewer", () => {
    const m = new Map<string, string>();
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    storePurseCurrency("usd", storage);
    expect(readPurseCurrency(storage)).toBe("usd");
    storePurseCurrency("zar", storage);
    expect(readPurseCurrency(storage)).toBe("zar");
  });
  it("works with storage blocked: ZAR fallback, no throw", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readPurseCurrency(blocked)).toBe("zar");
    expect(() => storePurseCurrency("usd", blocked)).not.toThrow();
  });
  it("shows the switch on Shared Experiences only, never on Shared Expenses", () => {
    expect(showCurrencyToggle("experiences")).toBe(true);
    expect(showCurrencyToggle("expenses")).toBe(false);
    expect(showCurrencyToggle("sum")).toBe(false);
  });
});

describe("price line in both directions", () => {
  it("ZAR selected: rand primary, about-dollars secondary", () => {
    expect(priceLineParts(2895, 16.5, "zar")).toEqual({ primary: "R2,895", secondary: "$175" });
  });
  it("USD selected: dollars primary, about-rand secondary", () => {
    expect(priceLineParts(2895, 16.5, "usd")).toEqual({ primary: "$175", secondary: "R2,895" });
  });
  it("drops the secondary when there is no rate", () => {
    expect(priceLineParts(2895, 0, "zar")).toEqual({ primary: "R2,895", secondary: null });
    expect(priceLineParts(2895, 0, "usd")).toEqual({ primary: "R2,895", secondary: null });
  });
});

describe("scene experience tags", () => {
  const safari = exp({ id: "e1", card: "Aquila Safari", rsvp_mode: "must_reply" });
  const wine = exp({ id: "e2", card: "Winelands", rsvp_mode: "default_going" });
  const picnic = exp({ id: "e3", card: "Picnic", rsvp_mode: "none" });
  const all = [safari, wine, picnic];
  const links = [
    { experience_id: "e1", scene_id: "s1" },
    { experience_id: "e2", scene_id: "s1" },
  ];
  const scene = { id: "s1", experience_card: null as string | null };

  it("shows one tag per linked experience with the viewer's own status", () => {
    const tags = sceneExperienceTags(scene, all, links, [{ experience_id: "e1", guest_id: "g1", status: "not_going", choice: null }], "g1", true);
    expect(tags.map((t) => t.id)).toEqual(["e1", "e2"]);
    expect(tags[0]?.status).toBe("not_going");
    expect(tags[1]?.status).toBe("going"); // default_going, no row
  });
  it("marks an unanswered must_reply as needs_reply", () => {
    const tags = sceneExperienceTags(scene, all, links, [], "g1", true);
    expect(tags[0]?.status).toBe("needs_reply");
  });
  it("shows going/not_going straight from the reply", () => {
    for (const status of ["going", "not_going"] as const) {
      const tags = sceneExperienceTags(scene, all, links, [{ experience_id: "e1", guest_id: "g1", status, choice: null }], "g1", true);
      expect(tags[0]?.status).toBe(status);
    }
  });
  it("keeps the experience_card text match as a fallback", () => {
    const tags = sceneExperienceTags({ id: "s9", experience_card: "Picnic" }, all, [], [], "g1", true);
    expect(tags.map((t) => t.id)).toEqual(["e3"]);
    expect(tags[0]?.status).toBeNull(); // no RSVP on this experience
  });
  it("never duplicates a card matched by both link and text", () => {
    const tags = sceneExperienceTags({ id: "s1", experience_card: "Aquila Safari" }, all, links, [], "g1", true);
    expect(tags.map((t) => t.id)).toEqual(["e1", "e2"]);
  });
  it("gives honorary guests and non-participants the link only", () => {
    const tags = sceneExperienceTags(scene, all, links, [], "g1", false);
    expect(tags.every((t) => t.status === null)).toBe(true);
  });
});
