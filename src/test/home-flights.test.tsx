import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { missingFlightDirections, type TravelLeg } from "@/lib/travel";

const state = vi.hoisted(() => ({
  roles: ["trip_guest"] as string[],
  session: true as boolean,
  myGuest: "g1" as string | null,
  phase: "before" as string,
  legs: [] as Pick<TravelLeg, "guest_id" | "direction">[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: async () => ({ data: table === "travel_legs" ? state.legs : [], error: null }),
      }),
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
      ({
        "home.flights_add_both": "Add your flights",
        "home.flights_add_arrival": "Add your arrival flight",
        "home.flights_add_departure": "Add your departure flight",
        "home.look.heading": "A look around",
        "nav.itinerary": "Itinerary",
        "nav.travel": "Travel",
        "nav.purse": "Purse",
        "nav.journal": "Journal",
        "home.look.itinerary": "The plan",
        "home.look.travel": "From everywhere to Cape Town.",
        "home.look.purse": "Shared things",
        "home.look.journal": "Notes",
      })[key] ?? key,
  }),
  usePrivateContent: () => ({ t: () => "", ready: false }),
}));
vi.mock("@/lib/purse-data", () => ({
  useExperiences: () => ({ data: [] }),
  useExperienceRsvps: () => ({ data: [] }),
  usePurseSettings: () => ({ data: { globalLock: false } }),
}));
vi.mock("@/lib/trip-clock", () => ({
  useTripClock: () => ({ now: new Date("2026-11-01T10:00:00Z"), phase: state.phase, settings: { timezone: "Africa/Johannesburg" } }),
}));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ to, search, children, ...rest }: { to: string; search?: { flight?: string }; children?: React.ReactNode }) => (
    <a href={to + (search?.flight ? `?flight=${search.flight}` : "")} {...rest}>{children}</a>
  ),
}));

import { LookAround, TravelFlightNudge } from "@/routes/index";
import { TravelFlights } from "@/components/site/TravelFlights";
import { Route as TravelRoute } from "@/routes/travel";

const leg = (guest_id: string, direction: "arrival" | "departure"): TravelLeg =>
  ({ id: `${guest_id}-${direction}`, guest_id, direction, airline: "", flight_number: "", other_airport: "LHR", cpt_time: "2026-11-20T10:00", connections: [] }) as unknown as TravelLeg;

function renderNudge() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TravelFlightNudge />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.roles = ["trip_guest"];
  state.session = true;
  state.myGuest = "g1";
  state.phase = "before";
  state.legs = [];
});
afterEach(cleanup);

describe("missingFlightDirections", () => {
  it("reports both when neither direction is saved", () => {
    expect(missingFlightDirections([], "g1")).toBe("both");
  });
  it("reports departure when only the arrival is saved", () => {
    expect(missingFlightDirections([leg("g1", "arrival")], "g1")).toBe("departure");
  });
  it("reports arrival when only the departure is saved", () => {
    expect(missingFlightDirections([leg("g1", "departure")], "g1")).toBe("arrival");
  });
  it("reports nothing when both legs exist", () => {
    expect(missingFlightDirections([leg("g1", "arrival"), leg("g1", "departure")], "g1")).toBeNull();
  });
  it("ignores other guests' legs", () => {
    expect(missingFlightDirections([leg("g2", "arrival"), leg("g2", "departure")], "g1")).toBe("both");
  });
});

describe("TravelFlightNudge", () => {
  it("shows 'Add your flights' linking to flight=add when neither leg is saved", async () => {
    renderNudge();
    const link = await screen.findByRole("link", { name: /add your flights/i });
    expect(link).toHaveAttribute("href", "/travel?flight=add");
  });
  it("shows 'Add your arrival flight' when only the arrival is missing", async () => {
    state.legs = [leg("g1", "departure")];
    renderNudge();
    const link = await screen.findByRole("link", { name: /add your arrival flight/i });
    expect(link).toHaveAttribute("href", "/travel?flight=arrival");
  });
  it("shows 'Add your departure flight' when only the departure is missing", async () => {
    state.legs = [leg("g1", "arrival")];
    renderNudge();
    const link = await screen.findByRole("link", { name: /add your departure flight/i });
    expect(link).toHaveAttribute("href", "/travel?flight=departure");
  });
  it("shows nothing when both legs exist", async () => {
    state.legs = [leg("g1", "arrival"), leg("g1", "departure")];
    const { container } = renderNudge();
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
  it("shows nothing for friends afar and non-participants", async () => {
    state.roles = ["friend_afar"];
    const { container, unmount } = renderNudge();
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
    unmount();
    state.roles = [];
    const again = renderNudge();
    await new Promise((r) => setTimeout(r, 20));
    expect(again.container).toBeEmptyDOMElement();
  });
  it("shows nothing with no guest record or in the after phase", async () => {
    state.myGuest = null;
    const { container, unmount } = renderNudge();
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
    unmount();
    state.myGuest = "g1";
    state.phase = "after";
    const again = renderNudge();
    await new Promise((r) => setTimeout(r, 20));
    expect(again.container).toBeEmptyDOMElement();
  });
  it("shows during the during phase", async () => {
    state.phase = "during";
    renderNudge();
    expect(await screen.findByRole("link", { name: /add your flights/i })).toBeInTheDocument();
  });
});

describe("LookAround Travel bar", () => {
  it("keeps the bar link and the flight nudge as separate sibling links", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <LookAround />
      </QueryClientProvider>,
    );
    const nudge = await screen.findByRole("link", { name: /add your flights/i });
    expect(nudge).toHaveAttribute("href", "/travel?flight=add");
    const barLink = screen.getByRole("link", { name: "Travel" });
    expect(barLink).toHaveAttribute("href", "/travel");
    expect(barLink).not.toContainElement(nudge);
    expect(nudge).not.toContainElement(barLink);
  });
});

describe("Travel route flight search parameter", () => {
  const validate = (TravelRoute.options as { validateSearch?: (s: Record<string, unknown>) => unknown }).validateSearch!;
  it("accepts arrival, departure and add", () => {
    expect(validate({ flight: "arrival" })).toEqual({ flight: "arrival" });
    expect(validate({ flight: "departure" })).toEqual({ flight: "departure" });
    expect(validate({ flight: "add" })).toEqual({ flight: "add" });
  });
  it("ignores anything else", () => {
    expect(validate({ flight: "nonsense" })).toEqual({});
    expect(validate({ flight: 42 })).toEqual({});
    expect(validate({})).toEqual({});
  });
});

describe("TravelFlights initialOpen", () => {
  const directory = [{ id: "g1", display_name: "Demi" }];
  const renderFlights = (ui: React.ReactElement) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  };
  it("opens the add sheet on the departure tab for initialOpen=departure", async () => {
    renderFlights(
      <TravelFlights legs={[leg("g1", "arrival")]} directory={directory} myGuestId="g1" editable initialOpen="departure" />,
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    const departureTab = screen.getByRole("tab", { name: /departures/i, hidden: true });
    expect(departureTab).toHaveAttribute("aria-selected", "true");
  });
  it("opens in edit mode when a leg for that direction already exists", async () => {
    renderFlights(
      <TravelFlights legs={[leg("g1", "arrival")]} directory={directory} myGuestId="g1" editable initialOpen="arrival" />,
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });
  it("stays closed for people who cannot edit", () => {
    renderFlights(
      <TravelFlights legs={[]} directory={directory} myGuestId={null} editable={false} initialOpen="arrival" />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
