import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Experience } from "@/lib/purse";
const state = vi.hoisted(() => ({ rows: [] as Experience[], update: vi.fn(), upload: vi.fn(), remove: vi.fn(), prepare: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ roles: ["host"], session: { user: { id: "host" } }, loading: false }) }));
vi.mock("@/lib/data", () => ({ useContent: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/site/TripTimeInput", () => ({ TripTimeInput: () => null }));
vi.mock("@/lib/image-resize", () => ({ preparePhoto: state.prepare, photoExtension: () => "jpg" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => ({
    select: () => { const result = { data: table === "experiences" ? state.rows : [], error: null }; const chain = { order: () => chain, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }; return chain; },
    update: (payload: unknown) => ({ eq: async (_column: string, id: string) => { state.update(payload, id); return { error: null }; } }),
  }),
  storage: { from: () => ({ createSignedUrls: async (paths: string[]) => ({ data: paths.map(path => ({ path, signedUrl: "https://photo.test/signed" })), error: null }), upload: state.upload, remove: state.remove }) },
} }));
import { PurseAdmin } from "@/components/site/PurseAdmin";
beforeEach(() => {
  vi.clearAllMocks();
  state.rows = [{ id: "e1", card: "Dinner", rank: "", sort_order: 1, level: "group", parent_id: null, rsvp_mode: "none", default_status: null, choices: null, when_text: "", location: null, summary: "", details: null, price_zar: null, price_status: null, price_note: null, show_host_note: false, rsvp_deadline: null, visible: true, photo_path: "experiences/e1/old.jpg", photo_alt: "Old", photo_focal_x: 50, photo_focal_y: 50, photo_zoom: 1 }];
  state.upload.mockResolvedValue({ error: null }); state.remove.mockResolvedValue({ error: null }); state.prepare.mockResolvedValue(new Blob(["photo"], { type: "image/jpeg" }));
  vi.stubGlobal("crypto", { randomUUID: () => "new-photo" });
  URL.createObjectURL = vi.fn(() => "blob:photo"); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function open() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PurseAdmin /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Edit", exact: true }));
  const save = screen.getByRole("button", { name: "Save", exact: true }); const form = save.closest("form"); if (!form) throw new Error("Missing form");
  return { save, form, view: within(form) };
}
it("group card crop and zoom update both previews and save with the existing form", async () => {
  const { save, view } = await open();
  const preview = view.getByRole("button", { name: "admin.purse.photo_phone: admin.purse.photo_focal" });
  await vi.waitFor(() => expect(preview).not.toBeDisabled());
  vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.click(preview, { clientX: 25, clientY: 75 });
  fireEvent.change(view.getByRole("slider"), { target: { value: "2.05" } });
  expect(view.getAllByRole("img")).toHaveLength(2);
  for (const img of view.getAllByRole("img")) expect(img.style.objectPosition).toBe("25% 75%");
  expect(state.update).not.toHaveBeenCalled(); fireEvent.click(save);
  await vi.waitFor(() => expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ photo_focal_x: 25, photo_focal_y: 75, photo_zoom: 2.05, photo_path: "experiences/e1/old.jpg" }), "e1"));
});
it("Remove saves all five defaults and deletes the old photo", async () => {
  const { save, view } = await open(); fireEvent.click(view.getByRole("button", { name: "admin.purse.photo_remove" }));
  expect(state.remove).not.toHaveBeenCalled(); fireEvent.click(save);
  await vi.waitFor(() => expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ photo_path: null, photo_alt: "", photo_focal_x: 50, photo_focal_y: 50, photo_zoom: 1 }), "e1"));
  expect(state.remove).toHaveBeenCalledWith(["experiences/e1/old.jpg"]);
});
it("Replace prepares at 1600, uploads on Save and deletes the old photo", async () => {
  const { save, view } = await open();
  fireEvent.change(view.getByLabelText("admin.purse.photo_add"), { target: { files: [new File(["original"], "photo.jpg", { type: "image/jpeg" })] } });
  await vi.waitFor(() => expect(state.prepare).toHaveBeenCalledWith(expect.any(File), { maxEdge: 1600 }));
  await vi.waitFor(() => expect(save).not.toBeDisabled()); expect(state.upload).not.toHaveBeenCalled(); fireEvent.click(save);
  await vi.waitFor(() => expect(state.remove).toHaveBeenCalledWith(["experiences/e1/old.jpg"]));
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ photo_path: "experiences/e1/new-photo.jpg", photo_focal_x: 50, photo_focal_y: 50, photo_zoom: 1 }), "e1");
});