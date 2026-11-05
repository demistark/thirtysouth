import { describe, expect, it } from "vitest";
import { showHeroPlaceholder } from "@/lib/data";

describe("Home hero placeholder", () => {
  it("shows only for the host when no hero image is uploaded", () => {
    expect(showHeroPlaceholder(true, false)).toBe(true);
    expect(showHeroPlaceholder(false, false)).toBe(false);
    expect(showHeroPlaceholder(true, true)).toBe(false);
    expect(showHeroPlaceholder(false, true)).toBe(false);
  });
});
