import { describe, expect, it } from "vitest";
import {
  AFAR_ALPHABET,
  AFAR_DEFAULT_TEMPLATE,
  AFAR_GENERIC_ERROR,
  AFAR_WORDS,
  buildAfarMessage,
  constantTimeEqual,
  generateAfarCode,
  hashAfarCode,
  isValidAfarCodeFormat,
  normalizeAfarCode,
  normalizeAfarName,
  afarNameMatches,
} from "@/lib/afar-codes";

// Deterministic rng for tests.
const seq = (values: number[]) => {
  let i = 0;
  return (max: number) => values[i++ % values.length]! % max;
};

describe("afar code format", () => {
  it("generates WORD-XXXXX with a listed word and safe alphabet", () => {
    const code = generateAfarCode(seq([3, 0, 5, 10, 20, 31]));
    const [word, suffix] = code.split("-");
    expect(AFAR_WORDS).toContain(word);
    expect(suffix).toHaveLength(5);
    for (const c of suffix ?? "") expect(AFAR_ALPHABET).toContain(c);
  });

  it("alphabet has no look-alikes (no 0, 1, I, L, O)", () => {
    for (const bad of ["0", "1", "I", "L", "O"]) expect(AFAR_ALPHABET).not.toContain(bad);
  });

  it("uses about twenty coastal words", () => {
    expect(AFAR_WORDS.length).toBeGreaterThanOrEqual(18);
    expect(AFAR_WORDS.length).toBeLessThanOrEqual(24);
  });
});

describe("afar code normalisation", () => {
  it("is case-insensitive and ignores spaces and dashes", () => {
    expect(normalizeAfarCode("coast-7k4m2")).toBe("COAST7K4M2");
    expect(normalizeAfarCode("  Coast 7K4M2 ")).toBe("COAST7K4M2");
    expect(normalizeAfarCode("C O A S T - 7 K 4 M 2")).toBe("COAST7K4M2");
  });

  it("accepts every generated code after normalisation", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateAfarCode((max) => Math.floor(Math.random() * max));
      expect(isValidAfarCodeFormat(normalizeAfarCode(code))).toBe(true);
    }
  });

  it("rejects wrong shapes and look-alike characters", () => {
    expect(isValidAfarCodeFormat("COAST7K4M")).toBe(false); // too short
    expect(isValidAfarCodeFormat("COAST7K4M2X")).toBe(false); // too long
    expect(isValidAfarCodeFormat("COAST7K4MI")).toBe(false); // I not allowed
    expect(isValidAfarCodeFormat("COAST7K4MO")).toBe(false); // O not allowed
    expect(isValidAfarCodeFormat("COAST1K4M2")).toBe(false); // 1 not allowed
    expect(isValidAfarCodeFormat("NOSUCHWORD7K4M2")).toBe(false); // unknown word
    expect(isValidAfarCodeFormat("")).toBe(false);
  });
});

describe("afar code hashing", () => {
  it("is salted: same code, different salt, different hash", async () => {
    const a = await hashAfarCode("salt-a", "COAST7K4M2");
    const b = await hashAfarCode("salt-b", "COAST7K4M2");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies the same salt and code deterministically", async () => {
    const a = await hashAfarCode("salt", "COAST7K4M2");
    const b = await hashAfarCode("salt", normalizeAfarCode("coast-7k4m2"));
    expect(constantTimeEqual(a, b)).toBe(true);
  });

  it("constantTimeEqual rejects different or different-length values", () => {
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("abc", "abc")).toBe(true);
  });
});

describe("afar message template", () => {
  it("default template has name, code and link placeholders", () => {
    expect(AFAR_DEFAULT_TEMPLATE).toContain("{name}");
    expect(AFAR_DEFAULT_TEMPLATE).toContain("{code}");
    expect(AFAR_DEFAULT_TEMPLATE).toContain("{link}");
  });

  it("fills all placeholders", () => {
    const out = buildAfarMessage(AFAR_DEFAULT_TEMPLATE, "Ada", "TIDE-22AAA", "https://x/enter?code=TIDE-22AAA");
    expect(out).toContain("Ada");
    expect(out).toContain("TIDE-22AAA");
    expect(out).toContain("https://x/enter?code=TIDE-22AAA");
    expect(out).not.toContain("{");
  });

  it("failure message is a single generic string", () => {
    expect(AFAR_GENERIC_ERROR).toBe("That didn't work. Check your code and your name and try again.");
  });
});

describe("afar name matching", () => {
  it("ignores case, spaces, accents and punctuation", () => {
    expect(normalizeAfarName("  DÉMI---Ogunkanmi! ")).toBe("demi ogunkanmi");
    expect(afarNameMatches("DÉMI", "Demi", "Demilade Ogunkanmi")).toBe(true);
  });
  it("accepts the full name", () => expect(afarNameMatches("demilade  ogunkanmi", "Demi", "Demilade Ogunkanmi")).toBe(true));
  it("accepts the first full-name word", () => expect(afarNameMatches("Demilade", "Demi", "Demilade Ogunkanmi")).toBe(true));
  it("rejects another name and blanks", () => {
    expect(afarNameMatches("Ada", "Demi", "Demilade Ogunkanmi")).toBe(false);
    expect(afarNameMatches(" ", "", "")).toBe(false);
  });
});
