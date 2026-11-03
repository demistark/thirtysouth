import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  useContent: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => <a className={className}>{children}</a>,
}));

import { ItineraryScript } from "@/components/site/ItineraryScript";

const styles = readFileSync(resolve(__dirname, "../styles.css"), "utf8");
const rule = (selector: string) => {
  const match = styles.match(new RegExp(`${selector.replace(/[.*:[\]()-]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
};

const chapters = [1, 2, 3].map(n => ({
  number: n,
  date: `2026-11-${19 + n}`,
  title: `Chapter ${n}`,
  summary: "…",
  sort_order: n,
  layout: null, heading_before: null, heading_before_align: null, transition_after: null, transition_after_align: null,
}));

describe("Scene look link size (item 1)", () => {
  it("gives the scene look link a 15px, 56px-tall, full-width modifier", () => {
    const body = rule(".look-tag-scene");
    expect(body).toContain("font-size: 15px");
    expect(body).toContain("min-height: 56px");
    expect(body).toContain("width: 100%");
  });
  it("keeps the base look-tag at 11px so experience tags and Flights are unchanged", () => {
    expect(rule(".look-tag")).toContain("font-size: 11px");
  });
  it("keeps 8px of room above the scene look link and none below it", () => {
    expect(rule(".look-tag-scene")).toContain("margin: 8px 0 0");
  });
});

describe("Rail starts at the first card (item 2)", () => {
  it("no longer draws a full-height rail on the timeline container", () => {
    expect(styles).not.toMatch(/\.scene-timeline::before/);
  });
  it("draws the first segment from the first card's top edge", () => {
    const body = rule(".scene-timeline-item:first-child .scene-card::after");
    expect(body).toContain("top: 0");
    expect(body).toContain("bottom: 0");
  });
  it("bridges the gap into each following item and ends at its card bottom", () => {
    const body = rule(".scene-timeline-item::before");
    expect(body).toContain("top: -14px");
    expect(body).toContain("bottom: 0");
  });
});

describe("Chapter and date on one line (item 4)", () => {
  it("lays the heading out as a wrapping flex line", () => {
    const body = rule(".day-heading-line");
    expect(body).toContain("display: flex");
    expect(body).toContain("flex-wrap: wrap");
  });
  it("keeps chapter and date as inline spans without stacked margins", () => {
    const body = rule(".day-heading-line .day-heading-chapter, .day-heading-line .day-heading-date");
    expect(body).toContain("display: inline");
    expect(body).toContain("margin: 0");
  });
});

describe("Script today marker (item 5)", () => {
  it("renders one ember dot beside each margin number of today's chapter only", () => {
    const { container } = render(<ItineraryScript chapters={chapters} loading={false} today={2} />);
    const dots = container.querySelectorAll(".script-today-dot");
    expect(dots).toHaveLength(2);
    expect(dots.item(0).closest(".script-margin-left")).not.toBeNull();
    expect(dots.item(1).closest(".script-margin-right")).not.toBeNull();
    expect(dots.item(0).parentElement?.textContent).toBe("2");
    for (const dot of dots) expect(dot.getAttribute("aria-hidden")).toBe("true");
  });
  it("renders no dots when no chapter is today", () => {
    const { container } = render(<ItineraryScript chapters={chapters} loading={false} />);
    expect(container.querySelectorAll(".script-today-dot")).toHaveLength(0);
  });
  it("fades over 2.4s in ember and goes static under reduced motion", () => {
    const body = rule(".script-today-dot");
    expect(body).toContain("background: var(--ember)");
    expect(body).toContain("2.4s");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.script-today-dot \{ animation: none; \} \}/);
  });
});
