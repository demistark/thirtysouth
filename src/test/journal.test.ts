import { describe, expect, it } from "vitest";
import {
  DEFAULT_JOURNAL_SETTINGS,
  allowanceState,
  assignCommonsLook,
  clampAspect,
  formatBoardDay,
  groupByDay,
  heartTilt,
  orderHeartCards,
  parseJournalSettings,
  phaseFromSettings,
  phoneAdjust,
  showCounter,
  type CommonsPost,
  type HeartCard,
} from "@/lib/journal";

const rand = (seq: number[]) => {
  let i = 0;
  return () => seq[i++ % seq.length]!;
};

describe("assignCommonsLook", () => {
  it("short text (≤120 chars) becomes a note with a tint", () => {
    const look = assignCommonsLook(80, false, rand([0.5, 0.5, 0.5, 0.5]));
    expect(look.card_style).toBe("note");
    expect(["apricot", "seafoam", "sand"]).toContain(look.tint);
    expect(look.page_number).toBeNull();
  });

  it("text of 121–200 chars becomes a page, never a book page", () => {
    const look = assignCommonsLook(150, false, rand([0.0, 0.5, 0.5, 0.5]));
    expect(look.card_style).toBe("page");
  });

  it("book page only over 200 chars and about 1 in 6", () => {
    expect(assignCommonsLook(250, false, rand([0.1, 0.5, 0.5, 0.5])).card_style).toBe("book");
    expect(assignCommonsLook(250, false, rand([0.5, 0.5, 0.5, 0.5])).card_style).toBe("page");
    expect(assignCommonsLook(200, false, rand([0.1, 0.5, 0.5, 0.5])).card_style).toBe("page");
  });

  it("book pages carry a stored cosmetic page number from 100 to 400", () => {
    const look = assignCommonsLook(300, false, rand([0.1, 0.5, 0.5, 0.5, 0.5]));
    expect(look.page_number).toBeGreaterThanOrEqual(100);
    expect(look.page_number).toBeLessThanOrEqual(400);
  });

  it("photos become polaroid or film, alternating roughly evenly", () => {
    expect(assignCommonsLook(0, true, rand([0.2, 0.5, 0.5, 0.5])).card_style).toBe("polaroid");
    expect(assignCommonsLook(0, true, rand([0.8, 0.5, 0.5, 0.5])).card_style).toBe("film");
    const film = assignCommonsLook(0, true, rand([0.8, 0.5, 0.5, 0.5, 0.5]));
    expect(film.frame_no).toBeGreaterThanOrEqual(1);
    expect(film.frame_no).toBeLessThanOrEqual(36);
  });

  it("sizes stay in range: 72–100 for notes/photos, 85–100 for pages", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const note = assignCommonsLook(50, false, rand([r, r, r, r]));
      expect(note.size_pct).toBeGreaterThanOrEqual(72);
      expect(note.size_pct).toBeLessThanOrEqual(100);
      const page = assignCommonsLook(150, false, rand([r, r, r, r]));
      expect(page.size_pct).toBeGreaterThanOrEqual(85);
      expect(page.size_pct).toBeLessThanOrEqual(100);
    }
  });

  it("about one card in three is straight; tilts stay within per-type caps", () => {
    expect(assignCommonsLook(50, false, rand([0.1, 0.9, 0.9, 0.9])).tilt_deg).toBe(0);
    const note = assignCommonsLook(50, false, rand([0.9, 0.9, 0.9, 0.9]));
    expect(Math.abs(note.tilt_deg)).toBeLessThanOrEqual(2.5);
    const photo = assignCommonsLook(0, true, rand([0.9, 0.9, 0.9, 0.9]));
    expect(Math.abs(photo.tilt_deg)).toBeLessThanOrEqual(4);
    const book = assignCommonsLook(300, false, rand([0.1, 0.9, 0.9, 0.9, 0.9]));
    expect(Math.abs(book.tilt_deg)).toBeLessThanOrEqual(2);
  });
});

describe("heartTilt", () => {
  it("stays within ±1 degree", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const t = heartTilt(rand([r]));
      expect(t).toBeGreaterThanOrEqual(-1);
      expect(t).toBeLessThanOrEqual(1);
    }
  });
});

describe("phoneAdjust", () => {
  it("softens tilt by 0.6 and lifts cards to at least 76%", () => {
    expect(phoneAdjust(72, 4)).toEqual({ size_pct: 76, tilt_deg: 2.4 });
    expect(phoneAdjust(90, -2)).toEqual({ size_pct: 90, tilt_deg: -1.2 });
  });
});

describe("counter and allowance thresholds", () => {
  it("counter hidden at 349 of 500, shown at 350 (70%)", () => {
    expect(showCounter(349, 500, 70)).toBe(false);
    expect(showCounter(350, 500, 70)).toBe(true);
  });

  it("allowance hidden at 3 of 5, shown at 4, blocked at 5", () => {
    expect(allowanceState(3, 5, 70).state).toBe("hidden");
    expect(allowanceState(4, 5, 70)).toEqual({ state: "remaining", left: 1 });
    expect(allowanceState(5, 5, 70)).toEqual({ state: "limit", left: 0 });
  });
});

describe("phases (America/Detroit settings)", () => {
  const s = parseJournalSettings({});
  it("boundary minutes: Nov 20 00:00 is during, one minute before is before", () => {
    // 2026-11-20 00:00 Detroit = 05:00 UTC (EST, UTC-5)
    expect(phaseFromSettings(new Date("2026-11-20T04:59:00Z"), s)).toBe("before");
    expect(phaseFromSettings(new Date("2026-11-20T05:00:00Z"), s)).toBe("during");
  });
  it("Nov 30 23:59 is during, one minute later is after", () => {
    expect(phaseFromSettings(new Date("2026-12-01T04:59:00Z"), s)).toBe("during");
    expect(phaseFromSettings(new Date("2026-12-01T05:00:00Z"), s)).toBe("after");
  });
  it("the override wins unless it is auto", () => {
    const during = new Date("2026-11-25T12:00:00Z");
    expect(phaseFromSettings(during, { ...s, phaseOverride: "before" })).toBe("before");
    expect(phaseFromSettings(during, { ...s, phaseOverride: "after" })).toBe("after");
    expect(phaseFromSettings(during, { ...s, phaseOverride: "auto" })).toBe("during");
  });
});

describe("parseJournalSettings", () => {
  it("falls back to defaults and parses visibility switches", () => {
    const s = parseJournalSettings({ commons_show_afar: "false", heart_cards_per_person: "7" });
    expect(s.commonsShowAfar).toBe(false);
    expect(s.heartCardsPerPerson).toBe(7);
    expect(s.commonsPostsPerDay).toBe(DEFAULT_JOURNAL_SETTINGS.commonsPostsPerDay);
    expect(s.reflectionsOpen).toBe(true);
  });
  it("an unknown override value falls back to auto", () => {
    expect(parseJournalSettings({ phase_override: "sideways" }).phaseOverride).toBe("auto");
  });
});

describe("board grouping and ordering", () => {
  const post = (id: string, created_at: string): CommonsPost => ({
    id, author_guest_id: "g", body: "x", photo_path: null, photo_w: null, photo_h: null,
    card_style: "note", size_pct: 90, tilt_deg: 0, tint: "sand", stamp: false,
    page_number: null, frame_no: null, hidden: false, created_at,
  });

  it("groups by Cape Town day, newest day first, newest post first within a day", () => {
    // 2026-11-23 21:30 UTC is already Nov 24 in Cape Town (UTC+2)
    const posts = [
      post("a", "2026-11-23T10:00:00Z"),
      post("b", "2026-11-23T21:30:00Z"),
      post("c", "2026-11-23T12:00:00Z"),
    ];
    const days = groupByDay(posts);
    expect(days.map((d) => d.day)).toEqual(["2026-11-24", "2026-11-23"]);
    expect(days[1]!.posts.map((p) => p.id)).toEqual(["c", "a"]);
  });

  it("formats day headings as date only", () => {
    expect(formatBoardDay("2026-11-23")).toBe("Mon Nov 23");
  });
});

describe("orderHeartCards", () => {
  const card = (id: string, pinned: boolean, created_at: string): HeartCard => ({
    id, author_guest_id: "g", body: "x", city: null, photo_path: null, photo_w: null, photo_h: null,
    pinned, pinned_at: null, tilt_deg: 0, hidden: false, created_at,
  });

  it("pinned cards first, then newest first", () => {
    const cards = [card("a", false, "2026-11-22T10:00:00Z"), card("b", true, "2026-11-20T10:00:00Z"), card("c", false, "2026-11-23T10:00:00Z")];
    expect(orderHeartCards(cards).map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
});

describe("clampAspect", () => {
  it("follows the photo, clamped between 4:5 and 16:10", () => {
    expect(clampAspect(1000, 2000)).toBe(4 / 5);
    expect(clampAspect(2000, 1000)).toBe(16 / 10);
    expect(clampAspect(1200, 900)).toBe(1200 / 900);
    expect(clampAspect(null, null)).toBe(3 / 2);
  });
});
