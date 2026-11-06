import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ loading: false, isHost: true, phase: "during" }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => "/",
  useSearch: () => ({ intro: "replay" }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => state }));
vi.mock("@/lib/trip-clock", () => ({ useTripClock: () => ({ phase: state.phase }) }));
vi.mock("@/lib/data", () => ({
  useSettings: () => ({ isFetched: true }),
  useChapters: () => ({ isFetched: true }),
}));

import { HomeIntro } from "@/components/site/HomeIntro";

beforeEach(() => {
  vi.useFakeTimers();
  state.loading = false;
  state.isHost = true;
  state.phase = "during";
  window.__30sIntro = true;
  document.documentElement.setAttribute("data-intro", "pending");
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const link = document.createElement("a");
  link.setAttribute("data-intro-wordmark", "");
  link.appendChild(document.createElement("span"));
  document.body.appendChild(link);
});

afterEach(() => {
  cleanup();
  document.querySelector("[data-intro-wordmark]")?.remove();
  document.documentElement.removeAttribute("data-intro");
  delete window.__30sIntro;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Home replay decision", () => {
  it("plays for a host during the trip without day-flag access", () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    render(<HomeIntro />);
    expect(document.documentElement.getAttribute("data-intro")).toBe("playing");
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    read.mockRestore();
    write.mockRestore();
  });

  it.each([
    { isHost: false, phase: "during" },
    { isHost: true, phase: "before" },
    { isHost: true, phase: "after" },
  ])("clears the veil without playing for $isHost / $phase", (decision) => {
    Object.assign(state, decision);
    const { container } = render(<HomeIntro />);
    expect(document.documentElement.hasAttribute("data-intro")).toBe(false);
    expect(container.childElementCount).toBe(0);
  });

  it("waits for auth even after the normal timeout before deciding", () => {
    state.loading = true;
    const { rerender } = render(<HomeIntro />);
    act(() => { vi.advanceTimersByTime(1600); });
    expect(document.documentElement.getAttribute("data-intro")).toBe("pending");
    state.loading = false;
    rerender(<HomeIntro />);
    expect(document.documentElement.getAttribute("data-intro")).toBe("playing");
  });
});