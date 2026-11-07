import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RSVP_DRAFT_PREFIX, type Experience } from "@/lib/purse";

const state = vi.hoisted(() => ({
  roles: ["trip_guest"] as string[],
  session: true as boolean,
  myGuest: "g1" as string | null,
  experiences: [] as Experience[],
  rsvps: [] as { experience_id: string; guest_id: string; status: string; choice: string | null }[],
  settings: {
    zar_per_usd: "16.5",
    rsvp_show_names: "true",
    rsvp_global_lock: "false",
    rsvp_show_total: "false",
  } as Record<string, string>,
  upserts: [] as { experience_id: string; guest_id: string; status: string; choice: string | null }[][],
  upsertError: false,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        if (table === "settings") {
          const rows = Object.entries(state.settings).map(([key, value]) => ({ key, value }));
          return {
            in: async () => ({ data: rows, error: null }),
            eq: () => ({ maybeSingle: async () => ({ data: { value: state.settings["rsvp_global_lock"] }, error: null }) }),
            then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
          };
        }
        const result = { data: table === "experiences" ? state.experiences : state.rsvps, error: null };
        return {
          order: async () => result,
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
        };
      },
      upsert: async (rows: never) => {
        state.upserts.push(rows);
        return { error: state.upsertError ? { message: "failed" } : null };
      },
    }),
    rpc: async (name: string) =>
      name === "my_guest" ? { data: state.myGuest, error: null } : { data: [], error: null },
  },
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    roles: state.roles,
    session: state.session ? { user: { id: "u1" } } : null,
    loading: false,
    isHost: state.roles.includes("host"),
    isFriend: true,
  }),
}));
vi.mock("@/lib/data", () => ({
  useContent: () => ({
    t: (key: string) =>
      ({ "home.rsvp_waiting_one": "1 RSVP to complete", "home.rsvp_waiting_other": "{n} RSVPs to complete" })[key] ?? key,
  }),
}));
vi.mock("@/lib/trip-clock", () => ({
  useTripClock: () => ({ now: new Date("2026-11-01T10:00:00Z"), phase: "before", settings: { timezone: "Africa/Johannesburg" } }),
}));
vi.mock("@/lib/scroll", () => ({ scrollToContent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}));

import { toast } from "sonner";
import { RsvpBanner } from "@/components/site/RsvpFlow";
import { SubTabs } from "@/components/site/Blocks";
import { PurseRsvpWaiting } from "@/routes/index";
import { Route as PurseRoute } from "@/routes/purse";

const mkExp = (id: string, over: Partial<Experience> = {}): Experience => ({
  id, rank: "", sort_order: Number(id.slice(1)), card: `Card ${id}`, level: "big", parent_id: null,
  rsvp_mode: "must_reply", default_status: "unconfirmed", choices: null, when_text: "", location: null,
  summary: "", details: null, price_zar: null, price_status: null, price_note: null,
  show_host_note: false, rsvp_deadline: null, visible: true, ...over,
});

const FIVE = [
  mkExp("e1"),
  mkExp("e2", { choices: "Early; Late" }),
  mkExp("e3", { rsvp_deadline: "2026-11-10 18:00" }),
  mkExp("e4", { rsvp_mode: "default_going", price_zar: 300 }),
  mkExp("e5", { price_zar: 1000 }),
];

function mount(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  state.roles = ["trip_guest"];
  state.session = true;
  state.myGuest = "g1";
  state.experiences = FIVE;
  state.rsvps = [];
  state.settings = { zar_per_usd: "16.5", rsvp_show_names: "true", rsvp_global_lock: "false", rsvp_show_total: "false" };
  state.upserts = [];
  state.upsertError = false;
  window.localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("RSVP banner", () => {
  it("shows only for trip participants with a guest record and replies waiting", async () => {
    mount(<RsvpBanner currency="zar" />);
    expect(await screen.findByText("purse.banner.title")).toBeInTheDocument();
    expect(screen.getByText("purse.banner.label_other")).toBeInTheDocument(); // 4 waiting
    expect(screen.getByRole("button", { name: "purse.banner.start" })).toBeInTheDocument();
  });
  it("shows nothing for friends afar and friends afar", () => {
    state.roles = ["friend_afar"];
    mount(<RsvpBanner currency="zar" />);
    expect(screen.queryByText("purse.banner.title")).toBeNull();
    cleanup();
    state.roles = ["friend_afar"];
    mount(<RsvpBanner currency="zar" />);
    expect(screen.queryByText("purse.banner.title")).toBeNull();
  });
  it("shows the no-guest note when the invitation is missing", async () => {
    state.myGuest = null;
    mount(<RsvpBanner currency="zar" />);
    expect(await screen.findByText("purse.banner.no_guest")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "purse.banner.start" })).toBeNull();
  });
  it("disappears when every must-reply card is answered", async () => {
    state.rsvps = ["e1", "e2", "e3", "e5"].map((id) => ({ experience_id: id, guest_id: "g1", status: "going", choice: null }));
    mount(<RsvpBanner currency="zar" />);
    await vi.waitFor(() => expect(screen.queryByText("purse.banner.title")).toBeNull());
  });
  it("reads Continue when a draft with answers exists on this device", async () => {
    window.localStorage.setItem(
      RSVP_DRAFT_PREFIX + "g1",
      JSON.stringify({ answers: { e1: { status: "going", choice: null } }, step: 0, savedAt: Date.now() }),
    );
    mount(<RsvpBanner currency="zar" />);
    expect(await screen.findByRole("button", { name: "purse.banner.continue" })).toBeInTheDocument();
  });
  it("shows the closed state under the global lock for non-editors only", async () => {
    state.settings["rsvp_global_lock"] = "true";
    mount(<RsvpBanner currency="zar" />);
    expect(await screen.findByText("purse.banner.closed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "purse.banner.start" })).toBeNull();
    cleanup();
    state.roles = ["host"];
    mount(<RsvpBanner currency="zar" />);
    expect(await screen.findByRole("button", { name: "purse.banner.start" })).toBeInTheDocument();
  });
});

describe("RSVP flow", () => {
  async function openFlow() {
    mount(<RsvpBanner currency="zar" />);
    fireEvent.click(await screen.findByRole("button", { name: "purse.banner.start" }));
    return await screen.findByRole("dialog");
  }
  const answer = (status: "going" | "not_going") =>
    fireEvent.click(screen.getByRole("button", { name: `purse.status.${status}` }));
  const next = () => fireEvent.click(screen.getByRole("button", { name: /purse.flow.(next|review)/ }));

  it("opens full-screen as a modal dialog with progress and the first card", async () => {
    const dialog = await openFlow();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("purse.flow.of")).toBeInTheDocument();
    expect(within(dialog).getByText("Card e1")).toBeInTheDocument();
  });
  it("keeps Next disabled until the step is answered", async () => {
    await openFlow();
    const nextBtn = screen.getByRole("button", { name: "purse.flow.next" });
    expect(nextBtn).toBeDisabled();
    answer("going");
    expect(nextBtn).toBeEnabled();
  });
  it("requires a choice when the experience has choices and Going is selected", async () => {
    await openFlow();
    answer("going"); next(); // step 2 has choices
    expect(screen.getByText("Card e2")).toBeInTheDocument();
    answer("going");
    expect(screen.getByRole("button", { name: "purse.flow.next" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Early" } });
    expect(screen.getByRole("button", { name: "purse.flow.next" })).toBeEnabled();
  });
  it("hides and clears the choice on Not going", async () => {
    await openFlow();
    answer("going"); next();
    answer("going");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Early" } });
    answer("not_going");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: "purse.flow.next" })).toBeEnabled();
  });
  it("Back keeps every answer", async () => {
    await openFlow();
    answer("not_going"); next();
    answer("going");
    fireEvent.click(screen.getByRole("button", { name: "purse.flow.back" }));
    expect(screen.getByText("Card e1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "purse.status.not_going" })).toHaveAttribute("aria-pressed", "true");
  });
  it("Change returns to the step and then straight back to Review", async () => {
    await openFlow();
    answer("going"); next(); answer("not_going"); next(); answer("going"); next(); answer("not_going"); next();
    expect(screen.getByText("purse.flow.review_title")).toBeInTheDocument();
    const row = screen.getByText("Card e3").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "purse.flow.change" }));
    expect(screen.getByText("Card e3")).toBeInTheDocument();
    answer("not_going");
    fireEvent.click(screen.getByRole("button", { name: "purse.flow.next" }));
    expect(screen.getByText("purse.flow.review_title")).toBeInTheDocument();
  });
  it("saves every answer in one request, with choice null on Not going", async () => {
    await openFlow();
    answer("going"); next();
    answer("going"); fireEvent.change(screen.getByRole("combobox"), { target: { value: "Late" } }); next();
    answer("not_going"); next();
    answer("going"); next();
    fireEvent.click(screen.getByRole("button", { name: "purse.flow.save" }));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("purse.flow.saved"));
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0]).toEqual([
      { experience_id: "e1", guest_id: "g1", status: "going", choice: null },
      { experience_id: "e2", guest_id: "g1", status: "going", choice: "Late" },
      { experience_id: "e3", guest_id: "g1", status: "not_going", choice: null },
      { experience_id: "e5", guest_id: "g1", status: "going", choice: null },
    ]);
    expect(window.localStorage.getItem(RSVP_DRAFT_PREFIX + "g1")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps answers and offers Try again when the save fails", async () => {
    state.upsertError = true;
    await openFlow();
    answer("going"); next(); answer("not_going"); next(); answer("going"); next(); answer("going"); next();
    fireEvent.click(screen.getByRole("button", { name: "purse.flow.save" }));
    expect(await screen.findByText("purse.flow.save_failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "purse.flow.retry" })).toBeInTheDocument();
    expect(screen.getByText("Card e1")).toBeInTheDocument(); // answers still listed
  });
  it("shows the closed message when the global lock turns on while the flow is open", async () => {
    state.upsertError = true;
    await openFlow();
    answer("going"); next(); answer("not_going"); next(); answer("going"); next(); answer("going"); next();
    state.settings["rsvp_global_lock"] = "true"; // the host locks replies mid-flow
    fireEvent.click(screen.getByRole("button", { name: "purse.flow.save" }));
    expect(await screen.findByText("purse.banner.closed")).toBeInTheDocument();
  });
  it("Close with unsaved answers asks Stay / Leave, and Leave keeps the draft", async () => {
    await openFlow();
    answer("going");
    fireEvent.click(screen.getByRole("button", { name: "purse.flow.close" }));
    expect(await screen.findByText("purse.flow.leave_title")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "purse.flow.stay" }));
    expect(screen.queryByText("purse.flow.leave_title")).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "purse.flow.close" }));
    fireEvent.click(await screen.findByRole("button", { name: "purse.flow.leave" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const draft = window.localStorage.getItem(RSVP_DRAFT_PREFIX + "g1");
    expect(draft).toBeTruthy();
    expect(JSON.parse(draft!).answers.e1).toEqual({ status: "going", choice: null });
  });
  it("Close with no answers just closes", async () => {
    await openFlow();
    fireEvent.click(screen.getByRole("button", { name: "purse.flow.close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Home RSVP line", () => {
  it("shows the plural line with the count for participants who owe replies", async () => {
    mount(<PurseRsvpWaiting />);
    expect(await screen.findByText("4 RSVPs to complete")).toBeInTheDocument();
  });
  it("shows the singular line for one reply", async () => {
    state.rsvps = ["e1", "e2", "e3"].map((id) => ({ experience_id: id, guest_id: "g1", status: "going", choice: null }));
    mount(<PurseRsvpWaiting />);
    expect(await screen.findByText("1 RSVP to complete")).toBeInTheDocument();
  });
  it("stays hidden for non-participants, guests without a record and the closed state", async () => {
    state.roles = ["friend_afar"];
    mount(<PurseRsvpWaiting />);
    await vi.waitFor(() => expect(screen.queryByText(/RSVP/)).toBeNull());
    cleanup();
    state.roles = ["trip_guest"];
    state.myGuest = null;
    mount(<PurseRsvpWaiting />);
    await vi.waitFor(() => expect(screen.queryByText(/RSVP/)).toBeNull());
    cleanup();
    state.myGuest = "g1";
    state.settings["rsvp_global_lock"] = "true";
    mount(<PurseRsvpWaiting />);
    await vi.waitFor(() => expect(screen.queryByText(/RSVP/)).toBeNull());
  });
});

describe("currency toggle row", () => {
  it("sits in its own row outside the tab row on Purse", async () => {
    state.session = true;
    const Purse = (PurseRoute as unknown as { options: { component: React.ComponentType } }).options.component;
    mount(<Purse />);
    const row = await screen.findByLabelText("Price currency");
    expect(row.closest(".purse-currency-row")).not.toBeNull();
    expect(row.closest('[role="tablist"]')).toBeNull();
    expect(document.querySelector('[role="tablist"]')?.className).toContain("mb-0");
  });
  it("SubTabs keeps its usual spacing unless flush is passed", () => {
    const client = new QueryClient();
    const tabs = [{ id: "a", label: "A" }, { id: "b", label: "B" }];
    const { container, unmount } = render(
      <QueryClientProvider client={client}><SubTabs tabs={tabs} value="a" onChange={() => {}} /></QueryClientProvider>,
    );
    expect(container.querySelector('[role="tablist"]')?.className).toContain("mb-8");
    unmount();
    render(
      <QueryClientProvider client={client}><SubTabs tabs={tabs} value="a" onChange={() => {}} flush /></QueryClientProvider>,
    );
    expect(document.querySelector('[role="tablist"]')?.className).toContain("mb-0");
  });
});
