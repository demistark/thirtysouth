import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [
    { id: "f1", text: "Fact one", active: true },
    { id: "f2", text: "Fact two", active: true },
    { id: "f3", text: "Fact three", active: false },
  ] as { id: string; text: string; active: boolean }[],
  deleted: [] as string[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: async () => ({ data: state.rows, error: null }) }),
      delete: () => ({ in: async (_col: string, ids: string[]) => { state.deleted = ids; return { error: null }; } }),
      update: () => ({ eq: async () => ({ error: null }) }),
      insert: async () => ({ error: null }),
    }),
  },
}));
vi.mock("@/lib/data", () => ({ useContent: () => ({ t: (key: string) => key }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FactsAdmin } from "@/components/site/FactsAdmin";

function renderAdmin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><FactsAdmin /></QueryClientProvider>);
}

function rowOf(text: string) {
  const checkbox = screen.getByRole("checkbox", { name: text });
  const row = checkbox.closest("li");
  if (!row) throw new Error("row not found");
  return { row: within(row), checkbox };
}

afterEach(() => {
  cleanup();
  state.deleted = [];
});

describe("FactsAdmin single delete", () => {
  it("asks inline, Keep cancels, Delete removes the row", async () => {
    renderAdmin();
    await screen.findByText("Fact one");
    const { row } = rowOf("Fact one");
    fireEvent.click(row.getByText("facts.delete"));
    expect(row.getByText("facts.delete_confirm")).toBeInTheDocument();
    fireEvent.click(row.getByText("facts.keep"));
    expect(row.queryByText("facts.delete_confirm")).toBeNull();
    expect(state.deleted).toEqual([]);
    fireEvent.click(row.getByText("facts.delete"));
    row.getByText("facts.delete_confirm");
    const confirmButtons = row.getAllByText("facts.delete");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
    await vi.waitFor(() => expect(state.deleted).toEqual(["f1"]));
  });

  it("edit and hide still render alongside delete", async () => {
    renderAdmin();
    await screen.findByText("Fact two");
    const { row } = rowOf("Fact two");
    expect(row.getByText("facts.edit")).toBeInTheDocument();
    expect(row.getByText("facts.hide")).toBeInTheDocument();
    expect(row.getByText("facts.delete")).toBeInTheDocument();
  });
});

describe("FactsAdmin bulk delete", () => {
  it("ticks, the confirm step, and Keep cancels", async () => {
    renderAdmin();
    await screen.findByText("Fact one");
    expect(screen.queryByText(/facts.delete_selected/)).toBeNull();
    fireEvent.click(rowOf("Fact one").checkbox);
    fireEvent.click(rowOf("Fact three").checkbox);
    const bulk = screen.getByText(/facts.delete_selected/);
    expect(bulk.textContent).toContain("(2)");
    fireEvent.click(bulk);
    expect(screen.getByText("facts.delete_selected_confirm")).toBeInTheDocument();
    fireEvent.click(screen.getByText("facts.keep"));
    expect(screen.queryByText("facts.delete_selected_confirm")).toBeNull();
    expect(state.deleted).toEqual([]);
  });

  it("select all ticks every row and Delete removes them in one request", async () => {
    renderAdmin();
    await screen.findByText("Fact one");
    fireEvent.click(screen.getByRole("checkbox", { name: "facts.select_all" }));
    expect(rowOf("Fact one").checkbox).toBeChecked();
    expect(rowOf("Fact two").checkbox).toBeChecked();
    expect(rowOf("Fact three").checkbox).toBeChecked();
    fireEvent.click(screen.getByText(/facts.delete_selected/));
    screen.getByText("facts.delete_selected_confirm");
    const confirm = screen.getAllByText("facts.delete");
    fireEvent.click(confirm[confirm.length - 1]!);
    await vi.waitFor(() => expect(state.deleted).toEqual(["f1", "f2", "f3"]));
  });
});
