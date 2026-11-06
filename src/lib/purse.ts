import Papa from "papaparse";
import { CSV_MAX_ROWS, type ImportResult, type RowError } from "./itinerary";

export type RsvpMode = "must_reply" | "default_going" | "none";
export type RsvpStatus = "going" | "not_going";
export type ExperienceLevel = "big" | "group" | "sub";
export type PriceStatus = "published" | "estimate" | "confirmed";

export interface Experience {
  id?: string;
  rank: string;
  sort_order: number;
  card: string;
  level: ExperienceLevel;
  parent_id: string | null;
  rsvp_mode: RsvpMode;
  default_status: "unconfirmed" | "going" | null;
  choices: string | null;
  when_text: string;
  location: string | null;
  summary: string;
  details: string | null;
  price_zar: number | null;
  price_status: PriceStatus | null;
  price_note: string | null;
  show_host_note: boolean;
  rsvp_deadline: string | null;
  visible: boolean;
}

export interface ExperienceRsvp {
  experience_id: string;
  guest_id: string;
  status: RsvpStatus;
  choice: string | null;
}

/** A participant with no row gets the experience's default status; never stored. */
export function effectiveStatus(exp: Pick<Experience, "rsvp_mode">, rsvp: Pick<ExperienceRsvp, "status"> | undefined): RsvpStatus | "unconfirmed" | null {
  if (exp.rsvp_mode === "none") return null;
  if (rsvp) return rsvp.status;
  return exp.rsvp_mode === "default_going" ? "going" : "unconfirmed";
}

export interface RsvpCounts { going: number; not_going: number; awaiting: number }

/** Counts cover participants only — never honorary guests or friends afar. */
export function rsvpCounts(
  exp: Pick<Experience, "id" | "rsvp_mode">,
  rsvps: ExperienceRsvp[],
  participantIds: readonly string[],
): RsvpCounts {
  const mine = rsvps.filter((r) => r.experience_id === exp.id && participantIds.includes(r.guest_id));
  const byStatus = (s: RsvpStatus) => mine.filter((r) => r.status === s).length;
  const answered = new Set(mine.map((r) => r.guest_id));
  const noRow = participantIds.filter((id) => !answered.has(id)).length;
  return {
    going: byStatus("going") + (exp.rsvp_mode === "default_going" ? noRow : 0),
    not_going: byStatus("not_going"),
    awaiting: exp.rsvp_mode === "must_reply" ? noRow : 0,
  };
}

export function formatPriceZar(zar: number) {
  return `R${zar.toLocaleString("en-US")}`;
}

export function usdFromZar(zar: number, zarPerUsd: number) {
  return zarPerUsd > 0 ? Math.round(zar / zarPerUsd) : null;
}

/* ---------------- currency toggle (Shared Experiences prices only) ---------------- */

export type PurseCurrency = "zar" | "usd";
const CURRENCY_KEY = "purse_currency";

/** Stored amounts are always ZAR; the toggle only changes how the price line reads. */
export function readPurseCurrency(storage: Pick<Storage, "getItem"> | null | undefined): PurseCurrency {
  try {
    return (storage ?? window.localStorage).getItem(CURRENCY_KEY) === "usd" ? "usd" : "zar";
  } catch {
    return "zar";
  }
}

export function storePurseCurrency(currency: PurseCurrency, storage: Pick<Storage, "setItem"> | null | undefined): void {
  try {
    (storage ?? window.localStorage).setItem(CURRENCY_KEY, currency);
  } catch {
    /* private mode: the page works without remembering */
  }
}

/** The switch only exists on the Shared Experiences tab. */
export function showCurrencyToggle(tab: string): boolean {
  return tab === "experiences";
}

/** Primary amount takes "per person"; the secondary reads "about …". */
export function priceLineParts(priceZar: number, zarPerUsd: number, currency: PurseCurrency): { primary: string; secondary: string | null } {
  const usd = usdFromZar(priceZar, zarPerUsd);
  if (currency === "usd" && usd != null) return { primary: `$${usd}`, secondary: formatPriceZar(priceZar) };
  return { primary: formatPriceZar(priceZar), secondary: usd != null ? `$${usd}` : null };
}

/* ---------------- scene experience tags ---------------- */

export type SceneExperienceStatus = RsvpStatus | "needs_reply" | null;
export interface SceneExperienceTag { id: string; card: string; status: SceneExperienceStatus }

/**
 * One tag per linked experience (experience_scenes links, with the scenes.experience_card
 * text match as a fallback). The status is the viewer's own reply; honorary guests,
 * friends afar and no-RSVP experiences get the link only.
 */
export function sceneExperienceTags(
  scene: { id?: string | undefined; experience_card: string | null },
  experiences: Experience[],
  links: { experience_id: string; scene_id: string }[],
  rsvps: ExperienceRsvp[],
  myGuestId: string | null,
  participant: boolean,
): SceneExperienceTag[] {
  const byId = new Map(experiences.map((e) => [e.id, e]));
  const linked = links.filter((l) => l.scene_id === scene.id)
    .map((l) => byId.get(l.experience_id))
    .filter((e): e is Experience => !!e);
  const wanted = (scene.experience_card ?? "").trim().toLowerCase();
  if (wanted && !linked.some((e) => e.card.toLowerCase() === wanted)) {
    const match = experiences.find((e) => e.card.toLowerCase() === wanted);
    if (match) linked.push(match);
  }
  return linked.map((e) => {
    let status: SceneExperienceStatus = null;
    if (participant && e.rsvp_mode !== "none") {
      const mine = myGuestId ? rsvps.find((r) => r.experience_id === e.id && r.guest_id === myGuestId) : undefined;
      const eff = effectiveStatus(e, mine);
      status = eff === "unconfirmed" ? "needs_reply" : eff;
    }
    return { id: e.id!, card: e.card, status };
  });
}

/** Several days on one card are separated with a comma and a space, never a dot or dash. */
export function formatWhenList(text: string) {
  return text
    .split(/\s*(?:·|•|\||—|–| - )\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

export function choiceList(choices: string | null | undefined) {
  return (choices ?? "").split(";").map((s) => s.trim()).filter(Boolean);
}

/** A card opens only if it has details, a price note, related scenes, or an RSVP summary. */
export function experienceExpandable(
  exp: Pick<Experience, "details" | "price_note" | "rsvp_mode">,
  relatedSceneCount: number,
  showNames: boolean,
) {
  return Boolean(
    (exp.details ?? "").trim() ||
      (exp.price_note ?? "").trim() ||
      relatedSceneCount > 0 ||
      (exp.rsvp_mode !== "none" && showNames),
  );
}

/** must_reply experiences the given guest has not answered yet (groups never ask). */
export function needsReplyCount(
  experiences: Pick<Experience, "id" | "rsvp_mode" | "level" | "visible">[],
  rsvps: Pick<ExperienceRsvp, "experience_id" | "guest_id">[],
  myGuestId: string | null | undefined,
) {
  if (!myGuestId) return 0;
  return experiences.filter(
    (e) =>
      e.visible &&
      e.rsvp_mode === "must_reply" &&
      e.level !== "group" &&
      !rsvps.some((r) => r.experience_id === e.id && r.guest_id === myGuestId),
  ).length;
}

/** RSVP writes close only under the host's global lock; deadlines are reminders. */
export function rsvpOpen(globalLock: boolean) {
  return !globalLock;
}

/** A deadline is shown as a reminder only while it is still in the future. */
export function deadlineUpcoming(deadline: string | null | undefined, nowCpt: string) {
  return !!deadline && deadline > nowCpt;
}

/** Current Cape Town wall time as "YYYY-MM-DD HH:MM", comparable to stored deadlines. */
export function capeTownNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function formatDeadline(deadline: string) {
  const [d] = deadline.split(" ");
  const [y = 1970, m = 1, day = 1] = (d ?? "").split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, day)));
}

/* ---------------- RSVP flow ("Come to everything!") ---------------- */

export interface RsvpAnswer { status: RsvpStatus; choice: string | null }

/** Steps of the reply flow: unanswered, visible, non-group must-reply cards in date order. */
export function flowSteps(
  experiences: Pick<Experience, "id" | "rsvp_mode" | "level" | "visible" | "sort_order">[],
  rsvps: Pick<ExperienceRsvp, "experience_id" | "guest_id">[],
  myGuestId: string | null | undefined,
): string[] {
  if (!myGuestId) return [];
  return experiences
    .filter((e) => e.visible && e.rsvp_mode === "must_reply" && e.level !== "group"
      && !rsvps.some((r) => r.experience_id === e.id && r.guest_id === myGuestId))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => e.id!);
}

/** Visible, non-group default-going experiences the guest has not answered. */
export function alsoGoingList(
  experiences: Pick<Experience, "id" | "rsvp_mode" | "level" | "visible" | "sort_order" | "card">[],
  rsvps: Pick<ExperienceRsvp, "experience_id" | "guest_id">[],
  myGuestId: string | null | undefined,
): string[] {
  if (!myGuestId) return [];
  return experiences
    .filter((e) => e.visible && e.rsvp_mode === "default_going" && e.level !== "group"
      && !rsvps.some((r) => r.experience_id === e.id && r.guest_id === myGuestId))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => e.card);
}

/**
 * Running total in ZAR: the person's Going answers in the flow plus the default-going
 * experiences they have not answered. Experiences with no price add nothing.
 */
export function runningTotalZar(
  experiences: Pick<Experience, "id" | "rsvp_mode" | "level" | "visible" | "price_zar">[],
  answers: Readonly<Record<string, RsvpAnswer>>,
  rsvps: Pick<ExperienceRsvp, "experience_id" | "guest_id">[],
  myGuestId: string | null | undefined,
): number {
  if (!myGuestId) return 0;
  let total = 0;
  for (const e of experiences) {
    if (!e.visible || e.level === "group" || e.price_zar == null) continue;
    const answer = answers[e.id!];
    if (answer) {
      if (answer.status === "going") total += e.price_zar;
      continue;
    }
    const mine = rsvps.some((r) => r.experience_id === e.id && r.guest_id === myGuestId);
    if (!mine && e.rsvp_mode === "default_going") total += e.price_zar;
  }
  return total;
}

/* ---------------- on-device draft ---------------- */

export const RSVP_DRAFT_PREFIX = "30s-rsvp-draft:";
export const RSVP_DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface RsvpDraft { answers: Record<string, RsvpAnswer>; step: number; savedAt: number }

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null | undefined;

function draftStore(storage: DraftStorage): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try { return storage ?? window.localStorage; } catch { return null; }
}

/**
 * Reads the saved draft, keeping only answers for experiences that are still unanswered
 * on the server, visible, must-reply and not a group. Drafts older than 14 days are ignored.
 */
export function readRsvpDraft(
  storage: DraftStorage,
  guestId: string,
  experiences: Pick<Experience, "id" | "rsvp_mode" | "level" | "visible">[],
  rsvps: Pick<ExperienceRsvp, "experience_id" | "guest_id">[],
  nowMs: number,
): RsvpDraft | null {
  const store = draftStore(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(RSVP_DRAFT_PREFIX + guestId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RsvpDraft>;
    if (typeof parsed.savedAt !== "number" || nowMs - parsed.savedAt > RSVP_DRAFT_MAX_AGE_MS) return null;
    const open = new Set(flowSteps(experiences, rsvps, guestId));
    const answers: Record<string, RsvpAnswer> = {};
    for (const [id, a] of Object.entries(parsed.answers ?? {})) {
      if (!open.has(id)) continue;
      if (a && (a.status === "going" || a.status === "not_going")) {
        answers[id] = { status: a.status, choice: a.status === "going" ? a.choice ?? null : null };
      }
    }
    return { answers, step: typeof parsed.step === "number" ? parsed.step : 0, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function writeRsvpDraft(storage: DraftStorage, guestId: string, draft: RsvpDraft): void {
  const store = draftStore(storage);
  if (!store) return;
  try { store.setItem(RSVP_DRAFT_PREFIX + guestId, JSON.stringify(draft)); } catch { /* storage blocked */ }
}

export function clearRsvpDraft(storage: DraftStorage, guestId: string): void {
  const store = draftStore(storage);
  if (!store) return;
  try { store.removeItem(RSVP_DRAFT_PREFIX + guestId); } catch { /* storage blocked */ }
}

/* ---------------- host tools ---------------- */

export interface UnfinishedGuest { id: string; display_name: string; left: number; total: number }

/** Per participant: how many of the visible, non-group must-reply cards are still unanswered. */
export function unfinishedByGuest(
  experiences: Pick<Experience, "id" | "rsvp_mode" | "level" | "visible">[],
  rsvps: Pick<ExperienceRsvp, "experience_id" | "guest_id">[],
  participants: readonly { id: string; display_name: string }[],
): UnfinishedGuest[] {
  const mustReply = experiences.filter((e) => e.visible && e.rsvp_mode === "must_reply" && e.level !== "group");
  const total = mustReply.length;
  return participants
    .map((p) => ({
      id: p.id,
      display_name: p.display_name,
      total,
      left: mustReply.filter((e) => !rsvps.some((r) => r.experience_id === e.id && r.guest_id === p.id)).length,
    }))
    .filter((g) => g.left > 0)
    .sort((a, b) => b.left - a.left || a.display_name.localeCompare(b.display_name));
}

/** Opens WhatsApp with a ready message; {link} and {experience} are filled in first. */
export function whatsAppUrl(template: string, link: string, experience?: string): string {
  const message = template.replaceAll("{link}", link).replaceAll("{experience}", experience ?? "");
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/* ---------------- CSV ---------------- */

export const EXPERIENCE_CSV_COLUMNS = [
  "rank", "card", "level", "parent", "rsvp_mode", "default_status", "choices", "when", "location",
  "summary", "details", "price_zar", "price_status", "price_note", "show_host_note", "related_scenes", "rsvp_deadline",
] as const;

export interface ExperienceImportRow extends Experience {
  parent_title: string | null;
  related_scene_titles: string[];
}

type Raw = Record<string, string>;
const cell = (r: Raw, k: string) => (r[k] ?? "").trim();
const DEADLINE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

export function experiencesCsvTemplate() {
  return EXPERIENCE_CSV_COLUMNS.join(",") + "\n";
}

export function exportExperiencesCsv(experiences: Experience[], sceneTitles: Map<string, string>, related: { experience_id: string; scene_id: string }[]) {
  const byId = new Map(experiences.map((e) => [e.id, e]));
  return Papa.unparse({
    fields: [...EXPERIENCE_CSV_COLUMNS],
    data: experiences.map((e) => [
      e.rank, e.card, e.level, (e.parent_id && byId.get(e.parent_id)?.card) ?? "", e.rsvp_mode, e.default_status ?? "",
      e.choices ?? "", e.when_text, e.location ?? "", e.summary, e.details ?? "", e.price_zar ?? "", e.price_status ?? "",
      e.price_note ?? "", e.show_host_note ? "true" : "false",
      related.filter((r) => r.experience_id === e.id).map((r) => sceneTitles.get(r.scene_id) ?? "").filter(Boolean).join(";"),
      e.rsvp_deadline ?? "",
    ]),
  });
}

/** All-or-nothing import: upsert by card, blank cells never overwrite, parents and scenes matched by title. */
export function parseExperiencesCsv(
  csv: string,
  existing: Experience[],
  sceneTitles: readonly string[],
): ImportResult<ExperienceImportRow> {
  const errors: RowError[] = [];
  const res = Papa.parse<Raw>(csv.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim().toLowerCase() });
  errors.push(...res.errors.map((e) => ({ row: (e.row ?? 0) + 2, message: e.message })));
  const missing = EXPERIENCE_CSV_COLUMNS.filter((c) => !res.meta.fields?.includes(c));
  if (missing.length) errors.push({ row: 1, message: `Missing columns: ${missing.join(", ")}` });
  if (!res.data.length) errors.push({ row: 1, message: "The file has no rows" });
  if (res.data.length > CSV_MAX_ROWS) errors.push({ row: 1, message: `More than ${CSV_MAX_ROWS} rows` });
  if (errors.length) return { rows: [], errors };

  const sceneSet = new Map(sceneTitles.map((t) => [t.toLowerCase(), t]));
  const knownCards = new Set(existing.map((e) => e.card.toLowerCase()));
  const fileCards = new Set(res.data.map((r) => cell(r, "card").toLowerCase()).filter(Boolean));
  const out: ExperienceImportRow[] = [];

  res.data.forEach((r, i) => {
    const row = i + 2;
    const card = cell(r, "card");
    if (!card) { errors.push({ row, message: "card (the title) is required" }); return; }
    const old = existing.find((e) => e.card.toLowerCase() === card.toLowerCase());

    const level = cell(r, "level").toLowerCase();
    if (level && !["big", "group", "sub"].includes(level)) errors.push({ row, message: "level must be big, group or sub" });
    const mode = cell(r, "rsvp_mode").toLowerCase();
    if (mode && !["must_reply", "default_going", "none"].includes(mode)) errors.push({ row, message: "rsvp_mode must be must_reply, default_going or none" });
    const defStatus = cell(r, "default_status").toLowerCase();
    if (defStatus && !["unconfirmed", "going"].includes(defStatus)) errors.push({ row, message: "default_status must be unconfirmed or going" });
    const priceStatus = cell(r, "price_status").toLowerCase();
    if (priceStatus && !["published", "estimate", "confirmed"].includes(priceStatus)) errors.push({ row, message: "price_status must be published, estimate or confirmed" });
    const price = cell(r, "price_zar");
    if (price && !/^\d+$/.test(price)) errors.push({ row, message: "price_zar must be a whole number" });
    const hostNote = cell(r, "show_host_note").toLowerCase();
    if (hostNote && !["true", "false"].includes(hostNote)) errors.push({ row, message: "show_host_note must be true or false" });
    const deadline = cell(r, "rsvp_deadline");
    if (deadline && !DEADLINE_RE.test(deadline)) errors.push({ row, message: "rsvp_deadline must look like 2026-11-10 18:00 (Cape Town)" });

    const parentTitle = cell(r, "parent") || null;
    if (parentTitle && !knownCards.has(parentTitle.toLowerCase()) && !fileCards.has(parentTitle.toLowerCase()))
      errors.push({ row, message: `parent "${parentTitle}" matches no experience title` });

    const relatedTitles = cell(r, "related_scenes").split(";").map((s) => s.trim()).filter(Boolean);
    for (const title of relatedTitles)
      if (!sceneSet.has(title.toLowerCase())) errors.push({ row, message: `related_scenes: no scene titled "${title}"` });

    const keep = <K extends keyof Experience>(v: string, k: K, fallback: Experience[K]): Experience[K] => (v ? (v as Experience[K]) : old ? old[k] : fallback);
    out.push({
      ...(old?.id ? { id: old.id } : {}),
      rank: keep(cell(r, "rank"), "rank", ""),
      sort_order: old?.sort_order ?? i + 1,
      card: old?.card ?? card,
      level: (level || old?.level || "big") as ExperienceLevel,
      parent_id: old?.parent_id ?? null,
      rsvp_mode: (mode || old?.rsvp_mode || "none") as RsvpMode,
      default_status: (defStatus || old?.default_status || null) as Experience["default_status"],
      choices: keep(cell(r, "choices"), "choices", null),
      when_text: keep(cell(r, "when"), "when_text", ""),
      location: keep(cell(r, "location"), "location", null),
      summary: keep(cell(r, "summary"), "summary", ""),
      details: (r["details"] ?? "").trim() ? (r["details"] ?? "").replace(/\r\n/g, "\n").trim() : (old?.details ?? null),
      price_zar: price ? +price : (old?.price_zar ?? null),
      price_status: (priceStatus || old?.price_status || null) as PriceStatus | null,
      price_note: keep(cell(r, "price_note"), "price_note", null),
      show_host_note: hostNote ? hostNote === "true" : (old?.show_host_note ?? false),
      rsvp_deadline: deadline || old?.rsvp_deadline || null,
      visible: old?.visible ?? true,
      parent_title: parentTitle,
      related_scene_titles: relatedTitles,
    });
  });

  const seen = new Map<string, number>();
  res.data.forEach((r, i) => {
    const k = cell(r, "card").toLowerCase();
    if (!k) return;
    if (seen.has(k)) errors.push({ row: i + 2, message: `Same card as row ${seen.get(k)}` });
    else seen.set(k, i + 2);
  });

  return errors.length ? { rows: [], errors } : { rows: out, errors };
}
