import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as { id: string; card: string; parent_id: string | null; visible: boolean; rsvp_mode?: string }[],
  rsvps: [] as { experience_id: string; guest_id: string; status: string; choice: string | null }[],
  participants: [] as { id: string; display_name: string }[],
  requests: [] as string[][],
  clearRequests: 0,
  failure: false,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => ({
    select: () => {
      const result = { data: table === "experiences" ? state.rows : table === "experience_rsvps" ? state.rsvps : [], error: null };
      const ordered = { ...result, order: async () => result };
      return { then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve), order: () => ordered };
    },
    delete: () => ({
      in: async (_column: string, ids: string[]) => {
        state.requests.push(ids);
        if (state.failure) return { error: { message: "failed" } };
        state.rows = state.rows.filter((row) => !ids.includes(row.id)).map((row) => ({ ...row, parent_id: row.parent_id && ids.includes(row.parent_id) ? null : row.parent_id }));
        return { error: null };
      },
      not: async () => {
        state.clearRequests += 1;
        if (state.failure) return { error: { message: "failed" } };
        state.rsvps = [];
        return { error: null };
      },
    }),
  }),
  rpc: async (name: string) => (name === "participant_directory" ? { data: state.participants, error: null } : { data: [], error: null }),
} }));
vi.mock("@/lib/data", () => ({ useContent: () => ({ t: (key: string) => key === "purse.admin.select" ? "Select {card}" : key }) }));
vi.mock("@/components/site/TripTimeInput", () => ({ TripTimeInput: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from "sonner";
import { PurseAdmin } from "@/components/site/PurseAdmin";

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(<QueryClientProvider client={client}><PurseAdmin /></QueryClientProvider>);
  return invalidate;
}
function checkbox(card: string) { return screen.getByRole("checkbox", { name: `Select ${card}` }); }
function row(card: string) {
  const element = checkbox(card).closest("li");
  if (!element) throw new Error("Missing experience row");
  return within(element);
}
beforeEach(() => {
  state.rows = [
    { id: "parent", card: "Parent", parent_id: null, visible: true, rsvp_mode: "must_reply" },
    { id: "child", card: "Child", parent_id: "parent", visible: true, rsvp_mode: "default_going" },
    { id: "hidden", card: "Hidden", parent_id: null, visible: false, rsvp_mode: "none" },
  ];
  state.rsvps = [];
  state.participants = [];
  state.requests = []; state.clearRequests = 0; state.failure = false; vi.clearAllMocks();
});
afterEach(cleanup);

describe("Experiences selection", () => {
  it("only offers bulk deletion with ticks and removes the offer when cleared", async () => {
    mount(); await screen.findByRole("checkbox", { name: "Select Parent" });
    expect(screen.queryByRole("button", { name: /purse.admin.delete_selected/ })).toBeNull();
    fireEvent.click(checkbox("Parent"));
    expect(screen.getByRole("button", { name: "purse.admin.delete_selected (1)" })).toBeInTheDocument();
    fireEvent.click(checkbox("Parent"));
    expect(screen.queryByRole("button", { name: /purse.admin.delete_selected/ })).toBeNull();
  });
  it("selects every row including hidden rows, then clears every tick", async () => {
    mount(); await screen.findByRole("checkbox", { name: "Select Parent" });
    const all = screen.getByRole("checkbox", { name: "purse.admin.select_all" });
    fireEvent.click(all);
    for (const card of ["Parent", "Child", "Hidden"]) expect(checkbox(card)).toBeChecked();
    fireEvent.click(all);
    for (const card of ["Parent", "Child", "Hidden"]) expect(checkbox(card)).not.toBeChecked();
  });
  it("Keep cancels bulk confirmation without changing ticks or sending a request", async () => {
    mount(); await screen.findByRole("checkbox", { name: "Select Parent" });
    fireEvent.click(checkbox("Parent")); fireEvent.click(checkbox("Hidden"));
    fireEvent.click(screen.getByRole("button", { name: "purse.admin.delete_selected (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "purse.admin.keep" }));
    expect(checkbox("Parent")).toBeChecked(); expect(checkbox("Hidden")).toBeChecked();
    expect(state.requests).toEqual([]);
  });
  it("deletes precisely the ticked ids in one request and refreshes all experience consumers", async () => {
    const invalidate = mount(); await screen.findByRole("checkbox", { name: "Select Parent" });
    fireEvent.click(checkbox("Parent")); fireEvent.click(checkbox("Hidden"));
    fireEvent.click(screen.getByRole("button", { name: "purse.admin.delete_selected (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "purse.admin.delete" }));
    await vi.waitFor(() => expect(state.requests).toEqual([["parent", "hidden"]]));
    await vi.waitFor(() => expect(screen.queryByRole("checkbox", { name: "Select Parent" })).toBeNull());
    expect(checkbox("Child")).not.toBeChecked();
    expect(state.rows.map((r) => [r.id, r.parent_id])).toEqual([["child", null]]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["purse"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin"] });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("purse.admin.deleted"));
  });
  it("preserves ticks and rows on failure and uses the existing error toast", async () => {
    state.failure = true; mount(); await screen.findByRole("checkbox", { name: "Select Parent" });
    fireEvent.click(checkbox("Parent"));
    fireEvent.click(screen.getByRole("button", { name: "purse.admin.delete_selected (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "purse.admin.delete" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("admin.itin.error"));
    expect(checkbox("Parent")).toBeChecked(); expect(state.rows).toHaveLength(3);
  });
});

describe("Experiences single removal", () => {
  it("Keep cancels, then confirmed Remove sends only that id and preserves its child", async () => {
    mount(); await screen.findByRole("checkbox", { name: "Select Parent" });
    fireEvent.click(row("Parent").getByRole("button", { name: "purse.admin.remove" }));
    fireEvent.click(row("Parent").getByRole("button", { name: "purse.admin.keep" }));
    expect(state.requests).toEqual([]);
    fireEvent.click(row("Parent").getByRole("button", { name: "purse.admin.remove" }));
    fireEvent.click(row("Parent").getByRole("button", { name: "purse.admin.remove" }));
    await vi.waitFor(() => expect(state.requests).toEqual([["parent"]]));
    await vi.waitFor(() => expect(screen.queryByRole("checkbox", { name: "Select Parent" })).toBeNull());
    expect(state.rows.find((r) => r.id === "child")?.parent_id).toBeNull();
    expect(checkbox("Child")).toBeInTheDocument();
  });
});