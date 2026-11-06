import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as object | null,
  roles: [] as string[],
  loading: false,
  pathname: "/journal",
  facts: [{ id: "f1", text: "A Cape Town fact." }] as { id: string; text: string }[],
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ session: state.session, roles: state.roles, loading: state.loading, isHost: state.roles.includes("host") }),
}));
vi.mock("@/lib/data", () => ({
  useContent: () => ({ t: (key: string) => key }),
  useChapters: () => ({ data: [], isLoading: false, isPending: false }),
  useSettings: () => ({ isFetched: true }),
  formatChapterDate: () => "",
}));
vi.mock("@/lib/trip-clock", () => ({ useTripClock: () => ({ now: new Date("2026-11-05T12:00:00Z"), phase: "before", settings: { timezone: "Africa/Johannesburg" } }) }));
vi.mock("@/lib/facts", () => ({
  factsOptions: { queryKey: ["fun_facts", "active"], queryFn: async () => state.facts },
  parseFactsCsv: () => [],
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => ({ options: opts, useSearch: () => ({}), useNavigate: () => vi.fn() }),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useLocation: (arg?: { select?: (l: { pathname: string; hash: string }) => unknown }) => {
    const loc = { pathname: state.pathname, hash: "" };
    return arg?.select ? arg.select(loc) : loc;
  },
  Outlet: () => null,
}));
vi.mock("@/components/site/Experiences", () => ({ Experiences: () => <div>experiences-content</div> }));
vi.mock("@/components/site/SharedExpenses", () => ({ SharedExpenses: () => <div>expenses-content</div> }));
vi.mock("@/components/site/JournalCommons", () => ({ JournalCommons: () => <div>commons-content</div> }));
vi.mock("@/components/site/JournalHeart", () => ({ JournalHeart: () => <div>heart-content</div> }));
vi.mock("@/components/site/JournalReflections", () => ({ JournalReflections: () => <div>reflections-content</div> }));
vi.mock("@/components/site/ItineraryDays", () => ({ ItineraryDays: () => <div>days-content</div> }));
vi.mock("@/components/site/ItineraryScript", () => ({ ItineraryScript: () => <div>script-content</div> }));
vi.mock("@/lib/purse-data", () => ({ useExperiences: () => ({ data: [] }), useExperienceScenes: () => ({ data: [] }), useExperienceRsvps: () => ({ data: [] }) }));
vi.mock("@/lib/itinerary-data", () => ({ useScenes: () => ({ data: [], isPending: false }), useLooks: () => ({ data: [], isPending: false }), usePhotoUrls: () => ({ data: {} }) }));
vi.mock("@/lib/itinerary-display-data", () => ({ useItineraryDisplay: () => ({ data: undefined, isPending: false }) }));
vi.mock("@/lib/journal-data", () => ({ useMyGuestId: () => ({ data: null }) }));

import { Route as PurseRoute } from "@/routes/purse";
import { Route as JournalRoute } from "@/routes/journal";
import { Route as ReflectionsRoute } from "@/routes/journal.reflections";
import { Route as ItineraryRoute } from "@/routes/itinerary";

type AnyRoute = { options: { component: React.ComponentType } };
const Purse = (PurseRoute as unknown as AnyRoute).options.component;
const Journal = (JournalRoute as unknown as AnyRoute).options.component;
const Reflections = (ReflectionsRoute as unknown as AnyRoute).options.component;
const Itinerary = (ItineraryRoute as unknown as AnyRoute).options.component;

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  state.session = null;
  state.roles = [];
  state.loading = false;
  state.pathname = "/journal";
  state.facts = [{ id: "f1", text: "A Cape Town fact." }];
});

describe("Purse signed out", () => {
  it("shows only title, intro, one fact and Sign in — no tabs, no toggle", async () => {
    renderWithClient(<Purse />);
    expect(screen.getByText("purse.title")).toBeInTheDocument();
    expect(screen.getByText("purse.intro")).toBeInTheDocument();
    expect(await screen.findByText("A Cape Town fact.")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/auth");
    expect(screen.queryByText("purse.tab.experiences")).toBeNull();
    expect(screen.queryByText("purse.tab.expenses")).toBeNull();
    expect(screen.queryByRole("group", { name: "Price currency" })).toBeNull();
    expect(screen.queryByText("lockout.friends")).toBeNull();
  });

  it("shows only Sign in when there are no active facts", () => {
    state.facts = [];
    renderWithClient(<Purse />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/auth");
    expect(screen.queryByText("purse.tab.experiences")).toBeNull();
  });

  it("shows no tabs while auth is loading", () => {
    state.loading = true;
    renderWithClient(<Purse />);
    expect(screen.queryByText("purse.tab.experiences")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("signed-in friends still get the tabs and content", () => {
    state.session = { user: { id: "friend" } };
    state.roles = ["trip_guest"];
    renderWithClient(<Purse />);
    expect(screen.getByText("purse.tab.experiences")).toBeInTheDocument();
    expect(screen.getByText("experiences-content")).toBeInTheDocument();
  });
});

describe("Journal signed out", () => {
  it("shows only title, intro, one fact and Sign in — no tabs", async () => {
    renderWithClient(<Journal />);
    expect(screen.getByText("journal.title")).toBeInTheDocument();
    expect(await screen.findByText("A Cape Town fact.")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/auth");
    expect(screen.queryByText("journal.tab.commons")).toBeNull();
    expect(screen.queryByText("journal.tab.reflections")).toBeNull();
    expect(screen.queryByText("journal.tab.heart")).toBeNull();
  });

  it("a direct visit to /journal/reflections signed out shows the same band, no tabs", async () => {
    state.pathname = "/journal/reflections";
    renderWithClient(<Journal />);
    expect(screen.getByText("journal.reflections.title")).toBeInTheDocument();
    expect(await screen.findByText("A Cape Town fact.")).toBeInTheDocument();
    expect(screen.queryByText("journal.tab.commons")).toBeNull();
  });

  it("the reflections child route signed out shows the fact band", async () => {
    state.pathname = "/journal/reflections";
    renderWithClient(<Reflections />);
    expect(await screen.findByText("A Cape Town fact.")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/auth");
  });

  it("signed-in friends still get the tabs and content", () => {
    state.session = { user: { id: "friend" } };
    state.roles = ["trip_guest"];
    renderWithClient(<Journal />);
    expect(screen.getByText("journal.tab.commons")).toBeInTheDocument();
    expect(screen.getByText("commons-content")).toBeInTheDocument();
  });
});

describe("Itinerary signed out", () => {
  it("keeps navigation and content unavailable until auth finishes loading", () => {
    state.loading = true;
    renderWithClient(<Itinerary />);
    expect(screen.getByText("itinerary.title")).toBeInTheDocument();
    expect(screen.getByText("itinerary.intro")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText("days-content")).toBeNull();
    expect(screen.queryByText("script-content")).toBeNull();
    expect(screen.queryByText("lockout.recording")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows only title, intro and the recording lockout — no tab row", () => {
    renderWithClient(<Itinerary />);
    expect(screen.getByText("itinerary.title")).toBeInTheDocument();
    expect(screen.getByText("itinerary.intro")).toBeInTheDocument();
    expect(screen.getByText("lockout.recording")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/auth");
    expect(screen.queryByText("itinerary.tab.script")).toBeNull();
    expect(screen.queryByText("itinerary.tab.scenes")).toBeNull();
    expect(screen.queryByText("itinerary.tab.wardrobe")).toBeNull();
  });

  it("signed-in friends still get the tab row and the Script tab", () => {
    state.session = { user: { id: "friend" } };
    state.roles = ["trip_guest"];
    renderWithClient(<Itinerary />);
    expect(screen.getByText("itinerary.tab.script")).toBeInTheDocument();
    expect(screen.getByText("script-content")).toBeInTheDocument();
  });
});
