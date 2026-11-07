/**
 * Friends afar personal access codes.
 * Format: a coastal word, a dash, five characters (e.g. COAST-7K4M2).
 * Matching is case-insensitive and ignores spaces and dashes.
 * Only salted hashes are stored; the code itself is never stored or logged.
 */

export const AFAR_WORDS = [
  "COAST",
  "TIDE",
  "DUNE",
  "REEF",
  "KELP",
  "PROTEA",
  "SURF",
  "SHORE",
  "GULL",
  "BAY",
  "SAND",
  "WAVE",
  "CAPE",
  "COVE",
  "CLIFF",
  "SHELL",
  "CORAL",
  "ANCHOR",
  "LAGOON",
  "BREEZE",
] as const;

/** No look-alikes: digits 2-9 and A-Z without I, L, O. */
export const AFAR_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const AFAR_DEFAULT_TEMPLATE =
  "Hi {name}, here is your personal code for 30° SOUTH: {code}. Open {link}, enter the code, then type your name ({name}) when it asks. This phone will remember you.";

/** Identical for every failure so nothing is revealed about which part was wrong. */
export const AFAR_GENERIC_ERROR = "That didn't work. Check your code and your name and try again.";
export const AFAR_LOCKED_ERROR = "Too many tries just now. Take a breath and try again in a little while.";

export function normalizeAfarName(input: string): string {
  return input.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function afarNameMatches(input: string, displayName: string, fullName: string): boolean {
  const name = normalizeAfarName(input);
  const full = normalizeAfarName(fullName);
  return !!name && [normalizeAfarName(displayName), full, full.split(" ")[0]].includes(name);
}

/** Uppercases and strips everything that is not a letter or digit (spaces, dashes). */
export function normalizeAfarCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True when the normalized code is one known word followed by exactly five alphabet characters. */
export function isValidAfarCodeFormat(normalized: string): boolean {
  const word = AFAR_WORDS.find((w) => normalized.startsWith(w));
  if (!word) return false;
  const rest = normalized.slice(word.length);
  return rest.length === 5 && [...rest].every((c) => AFAR_ALPHABET.includes(c));
}

/** Builds a display code like COAST-7K4M2. randomInt(max) must return 0..max-1. */
export function generateAfarCode(randomInt: (max: number) => number): string {
  const word = AFAR_WORDS[randomInt(AFAR_WORDS.length)];
  let suffix = "";
  for (let i = 0; i < 5; i++) suffix += AFAR_ALPHABET[randomInt(AFAR_ALPHABET.length)];
  return `${word}-${suffix}`;
}

/** Salted SHA-256 of the normalized code, hex-encoded. */
export async function hashAfarCode(salt: string, normalized: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${normalized}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two equal-length hex strings. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Fills {name}, {code} and {link} in the host-editable message template. */
export function buildAfarMessage(template: string, name: string, code: string, link: string): string {
  return template.replaceAll("{name}", name).replaceAll("{code}", code).replaceAll("{link}", link);
}
