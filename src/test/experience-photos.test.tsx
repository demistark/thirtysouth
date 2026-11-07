import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Experience } from "@/lib/purse";

const state = vi.hoisted(() => ({ roles: ["trip_guest"], session: { user: { id: "one" } } as object | null, signed: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ roles: state.roles, session: state.session, loading: false }) }));
vi.mock("@/lib/data", () => ({ useContent: () => ({ t: (key: string) => key }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ createSignedUrls: state.signed, upload: state.upload, remove: state.remove }) } } }));
vi.mock("@/lib/itinerary-data", () => ({ useScenes: vi.fn() }));
vi.mock("@/lib/itinerary-display-data", () => ({ useItineraryDisplay: vi.fn() }));
vi.mock("@/lib/travel-data", () => ({ useMyGuest: vi.fn() }));
vi.mock("@/lib/trip-clock", () => ({ useTripClock: vi.fn() }));
vi.mock("@/components/site/ActionGate", () => ({ useActionGate: () => ({ wrap: (fn: unknown) => fn, dialog: null }) }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
import { ExperienceCard } from "@/components/site/Experiences";
import { EMPTY_EXPERIENCE_PHOTO, normalizeExperiencePhoto, saveExperiencePhoto } from "@/lib/experience-photo";
import { useExperiencePhotoUrls } from "@/lib/purse-data";
import { exportExperiencesCsv, parseExperiencesCsv } from "@/lib/purse";

const exp: Experience = { id: "e1", card: "Dinner", rank: "", sort_order: 1, level: "big", parent_id: null, rsvp_mode: "none", default_status: null, choices: null, when_text: "Friday", location: null, summary: "Dinner together", details: "Plain details", price_zar: null, price_status: null, price_note: null, show_host_note: false, rsvp_deadline: null, visible: true, photo_path: "experiences/e1/old.jpg", photo_alt: "", photo_focal_x: 23, photo_focal_y: 71, photo_zoom: 1.5 };
const ctx = { scenes: [], related: [], rsvps: [], participants: [], settings: { zarPerUsd: 16.5, showNames: false, globalLock: false, showTotal: false }, myGuestId: null, participant: false, editor: false, nowCpt: "2026-11-07 00:00", currency: "zar" as const, photoUrls: { "experiences/e1/old.jpg": "https://photo.test/old" } };
function wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>; }
beforeEach(() => { vi.clearAllMocks(); state.roles = ["trip_guest"]; state.session = { user: { id: "one" } }; state.upload.mockResolvedValue({ error: null }); state.remove.mockResolvedValue({ error: null }); state.signed.mockImplementation(async (paths: string[]) => ({ error: null, data: paths.map(path => ({ path, signedUrl: `https://photo.test/${path}` })) })); });
afterEach(cleanup);
describe("experience photo load safety", () => {
  it("stays normal until loaded and returns to normal on failure", () => {
    const { container } = render(<ExperienceCard exp={exp} ctx={ctx} />);
    const card = container.querySelector("article"); const img = container.querySelector("img"); if (!img) throw new Error("Missing image");
    expect(card).not.toHaveAttribute("data-photo"); fireEvent.load(img); expect(card).toHaveAttribute("data-photo", "true"); fireEvent.error(img); expect(card).not.toHaveAttribute("data-photo");
  });
  it("uses decorative blank alt and confines the photo to the main card", () => {
    const { container } = render(<ExperienceCard exp={exp} ctx={ctx} />);
    const img = container.querySelector("img"); expect(img).toHaveAttribute("alt", ""); expect(img?.closest(".scene-main")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dinner" })); expect(container.querySelector(".scene-expansion img")).toBeNull();
  });
});
describe("photo persistence", () => {
  it("clamps focal point to 0–100 and zoom to 1–3", () => { expect(normalizeExperiencePhoto({ photo_path: "x", photo_focal_x: -5, photo_focal_y: 110, photo_zoom: 4 })).toEqual({ photo_path: "x", photo_alt: "", photo_focal_x: 0, photo_focal_y: 100, photo_zoom: 3 }); expect(normalizeExperiencePhoto({ photo_path: "x", photo_zoom: 0 }).photo_zoom).toBe(1); });
  it("Replace uploads, saves crop values, then deletes the old file", async () => {
    const persist = vi.fn(async () => undefined);
    await saveExperiencePhoto("e1", normalizeExperiencePhoto(exp), new Blob(["photo"], { type: "image/jpeg" }), exp.photo_path ?? null, persist);
    expect(state.upload.mock.calls[0]?.[0]).toMatch(/^experiences\/e1\/[\w-]+\.jpg$/);
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ photo_focal_x: 23, photo_focal_y: 71, photo_zoom: 1.5 })); expect(state.remove).toHaveBeenCalledWith([exp.photo_path]);
  });
  it("Remove clears all five fields and deletes the old file", async () => {
    const persist = vi.fn(async () => undefined); await saveExperiencePhoto("e1", EMPTY_EXPERIENCE_PHOTO, null, exp.photo_path ?? null, persist);
    expect(persist).toHaveBeenCalledWith({ photo_path: null, photo_alt: "", photo_focal_x: 50, photo_focal_y: 50, photo_zoom: 1 }); expect(state.remove).toHaveBeenCalledWith([exp.photo_path]); expect(state.upload).not.toHaveBeenCalled();
  });
  it("failed saves retain the old file and remove only the new upload", async () => { await expect(saveExperiencePhoto("e1", normalizeExperiencePhoto(exp), new Blob(["x"], { type: "image/jpeg" }), exp.photo_path ?? null, async () => { throw new Error("save"); })).rejects.toThrow("save"); expect(state.remove).toHaveBeenCalledWith([state.upload.mock.calls[0]?.[0]]); expect(state.remove).not.toHaveBeenCalledWith([exp.photo_path]); });
  it("title-matched CSV leaves every photo column out of its update and export", () => {
    const csv = exportExperiencesCsv([exp], new Map(), []); const parsed = parseExperiencesCsv(csv, [exp], []); expect(parsed.errors).toEqual([]); expect(parsed.rows[0]?.id).toBe("e1");
    const row = parsed.rows[0]; if (!row) throw new Error("Missing row");
    for (const key of Object.keys(EMPTY_EXPERIENCE_PHOTO)) { expect(row).not.toHaveProperty(key); expect(csv.split("\n")[0]).not.toContain(key); }
    expect({ ...exp, ...row }).toMatchObject({ photo_path: exp.photo_path, photo_alt: "", photo_focal_x: 23, photo_focal_y: 71, photo_zoom: 1.5 });
  });
});
describe("signed photo URLs", () => {
  it("batches visible paths once, deduplicating and excluding hidden rows", async () => { renderHook(() => useExperiencePhotoUrls([exp, exp, { ...exp, id: "e2", photo_path: "second" }, { ...exp, id: "e3", visible: false, photo_path: "hidden" }]), { wrapper }); await vi.waitFor(() => expect(state.signed).toHaveBeenCalledTimes(1)); expect(state.signed).toHaveBeenCalledWith([exp.photo_path, "second"], 3600); });
  it.each([[], ["unassigned"]])("does not request for roles without Purse access %j", roles => { state.roles = roles; renderHook(() => useExperiencePhotoUrls([exp]), { wrapper }); expect(state.signed).not.toHaveBeenCalled(); });
  it("does not request signed-out", () => { state.session = null; renderHook(() => useExperiencePhotoUrls([exp]), { wrapper }); expect(state.signed).not.toHaveBeenCalled(); });
  it("requests for friends afar", async () => { state.roles = ["friend_afar"]; renderHook(() => useExperiencePhotoUrls([exp]), { wrapper }); await vi.waitFor(() => expect(state.signed).toHaveBeenCalledTimes(1)); });
});