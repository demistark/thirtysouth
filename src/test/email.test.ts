import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/lib/email";

describe("normalizeEmail", () => {
  it("lowercases and trims so case/spacing never creates a second identity", () => {
    expect(normalizeEmail("  Demvic007@Yahoo.COM ")).toBe("demvic007@yahoo.com");
  });
});
