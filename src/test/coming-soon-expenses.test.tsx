import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComingSoon } from "@/components/site/Blocks";
import { SharedExpenses } from "@/components/site/SharedExpenses";

const state = vi.hoisted(() => ({ session: null as object | null, loading: false, url: "" }));
vi.mock("@/lib/auth", () => ({ useAuth: () => state }));
vi.mock("@/lib/data", () => ({ useContent: () => ({ t: (key: string) => key === "splitwise_url" ? state.url : key }) }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a> }));

afterEach(() => { cleanup(); state.session = null; state.url = ""; });

describe("Coming soon sign-in visibility", () => {
  it("offers sign-in when signed out", () => {
    render(<ComingSoon />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/auth");
  });
  it("does not offer sign-in when signed in", () => {
    state.session = { user: { id: "friend" } };
    render(<ComingSoon />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("Shared Expenses Splitwise availability", () => {
  it("offers the configured Splitwise link", () => {
    state.url = "https://www.splitwise.com/";
    render(<SharedExpenses />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(state.url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
  it("does not offer Splitwise when the URL is empty", () => {
    state.session = { user: { id: "friend" } };
    render(<SharedExpenses />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});