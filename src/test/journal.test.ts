import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_JOURNAL_SETTINGS,
  HEART_PAPER_HEX,
  HEART_TONE_HEX,
  allowanceState,
  assignCommonsLook,
  clampAspect,
  contrastRatio,
  formatBoardDay,
  groupByDay,
  heartCardStyle,
  heartCardPlace,
  earlierReflectionPages,
  heartTextColor,
  heartTilt,
  orderHeartCards,
  parseJournalSettings,
  phoneAdjust,
  showCounter,
  type CommonsPost,
  type HeartCard,
  type ReflectionEntry,
} from "@/lib/journal";

const rand = (seq: number[]) => {
  let i = 0;
  return () => seq[i++ % seq.length]!;
};

describe("Earlier Pages filter", () => {
  it("excludes today and keeps an open earlier date only once", () => {
    const page = (id: string, entry_date: string): ReflectionEntry => ({ id, entry_date, guest_id: "me", body: id, updated_at: "2026-11-03T12:00:00Z" });
    const entries = [page("today", "2026-11-03"), page("open", "2026-11-02"), page("duplicate", "2026-11-02"), page("older", "2026-11-01")];
    expect(earlierReflectionPages(entries, "2026-11-03").map(e => e.id)).toEqual(["open", "older"]);
    expect(earlierReflectionPages(entries, "2026-11-02").map(e => e.id)).toEqual(["today", "older"]);
  });
});

describe("Postcard place picker", () => {
  const pool = "Cape Town, 30\nDetroit, 20\nAtlanta, 15\nChicago, 15\n-, 15\nAbuja, 5";
  it("keeps the same address for the same id", () => {
    const picks = Array.from({ length: 100 }, (_, i) => heartCardPlace(`card-${i}`, pool, "Fallback"));
    expect(Array.from({ length: 100 }, (_, i) => heartCardPlace(`card-${i}`, pool, "Fallback"))).toEqual(picks);
    expect(new Set(picks).size).toBeGreaterThan(1);
  });
  it("respects relative weights across many stable ids", () => {
    const counts = new Map<string | undefined, number>();
    for (let i = 0; i < 20000; i++) {
      const place = heartCardPlace(`card-${i}`, pool, "Fallback");
      counts.set(place, (counts.get(place) ?? 0) + 1);
    }
    for (const [place, weight] of [["Cape Town", 30], ["Detroit", 20], ["Atlanta", 15], ["Chicago", 15], [undefined, 15], ["Abuja", 5]] as const) {
      expect(Math.abs((counts.get(place) ?? 0) / 20000 - weight / 100)).toBeLessThan(0.025);
    }
    expect(heartCardPlace("same", "Cape Town, 3\nDetroit, 2", "Fallback")).toBe(heartCardPlace("same", "Cape Town, 30\nDetroit, 20", "Fallback"));
  });
  it("a dash line prints no place", () => {
    expect(heartCardPlace("card", "-, 15", "Cape Town")).toBeUndefined();
  });
  it("empty or invalid pools fall back to heart_to_place", () => {
    for (const setting of ["", "\n", "Detroit", "Detroit,", "Detroit, 0", "Detroit, -3", "Detroit, nope", "Detroit, Infinity", ", 15"]) {
      expect(heartCardPlace("card", setting, "Cape Town")).toBe("Cape Town");
    }
    expect(heartCardPlace("card", "\nDetroit, 0\nAtlanta, 2\nAbuja, -3", "Cape Town")).toBe("Atlanta");
  });
});

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
    // Note look draws size first, then the straight-check: [size, straight?, ...]
    expect(assignCommonsLook(50, false, rand([0.5, 0.1, 0.9, 0.9])).tilt_deg).toBe(0);
    const note = assignCommonsLook(50, false, rand([0.5, 0.9, 0.9, 0.9]));
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

describe("Close to Heart type variety", () => {
  const ids = Array.from({ length: 200 }, () => crypto.randomUUID());

  it("is deterministic: the same card id gives the same style every time", () => {
    const a = heartCardStyle(ids[0]!, 120);
    const b = heartCardStyle(ids[0]!, 120);
    expect(a).toEqual(b);
    expect([...ids].reverse().map((id) => heartCardStyle(id, 60))).toEqual(
      ids.slice().reverse().map((id) => heartCardStyle(id, 60)),
    );
  });

  it("steps size down at 40, 90 and 180 characters", () => {
    const size = (n: number) => heartCardStyle(ids[0]!, n).sizePx;
    expect(size(40)).toBe(26);
    expect(size(41)).toBe(22);
    expect(size(90)).toBe(22);
    expect(size(91)).toBe(18);
    expect(size(180)).toBe(18);
    expect(size(181)).toBe(16);
  });

  it("uses weight 600 only for messages of 40 characters or fewer", () => {
    for (const id of ids) {
      expect([400, 600]).toContain(heartCardStyle(id, 40).weight);
      expect([400, 500]).toContain(heartCardStyle(id, 41).weight);
    }
    expect(ids.some((id) => heartCardStyle(id, 30).weight === 600)).toBe(true);
    expect(ids.some((id) => heartCardStyle(id, 200).weight === 500)).toBe(true);
  });

  it("splits colour roughly 80/10/10 over 200 ids", () => {
    const tones = ids.map((id) => heartCardStyle(id, 100).tone);
    const count = (t: string) => tones.filter((x) => x === t).length;
    expect(count("ink")).toBeGreaterThanOrEqual(140);
    expect(count("ink")).toBeLessThanOrEqual(180);
    expect(count("ember")).toBeGreaterThanOrEqual(8);
    expect(count("ember")).toBeLessThanOrEqual(40);
    expect(count("olive")).toBeGreaterThanOrEqual(8);
    expect(count("olive")).toBeLessThanOrEqual(40);
  });

  it("keeps every rendered colour within contrast rules on the card paper", () => {
    expect(contrastRatio(HEART_TONE_HEX.ink, HEART_PAPER_HEX)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(HEART_TONE_HEX.ember, HEART_PAPER_HEX)).toBeGreaterThanOrEqual(4.5);
    expect(HEART_TONE_HEX.olive).toBe("#646E3C");
    expect(contrastRatio(HEART_TONE_HEX.olive, HEART_PAPER_HEX)).toBeGreaterThanOrEqual(4.5);
    expect(heartTextColor("ember", 16)).toBe("var(--ember-deep)");
    for (const size of [26, 22, 18, 16]) expect(heartTextColor("olive", size)).toBe("var(--olive)");
    expect(heartTextColor("ink", 26)).toBe("var(--ink)");
  });

  it("has no handwriting anywhere on Close to Heart and loads Shantell Sans on Our Commons only", () => {
    const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
    const heart = read("../components/site/JournalHeart.tsx");
    const reflections = read("../components/site/JournalReflections.tsx");
    const route = read("../routes/journal.tsx");
    const commons = read("../components/site/JournalCommons.tsx");
    for (const src of [heart, reflections, route]) {
      expect(src).not.toContain("Shantell");
      expect(src).not.toContain("journal-hand");
      expect(src).not.toContain("heartUsesHandwriting");
    }
    expect(commons).toContain("Shantell+Sans");
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
    // 2026-11-23 22:30 UTC is already Nov 24 in Cape Town (UTC+2)
    const posts = [
      post("a", "2026-11-23T10:00:00Z"),
      post("b", "2026-11-23T22:30:00Z"),
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
