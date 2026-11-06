import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TravelSliverChevron } from "@/components/site/TravelSliverChevron";

afterEach(cleanup);

it("uses paper only on the active middle segment and flips only while open", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const style = document.createElement("style");
  style.textContent = (css.match(/\.travel-sliver-chevron(?:\[data-(?:active|open)="true"\])?\s*\{[^}]*\}/g) ?? []).join("\n");
  document.head.appendChild(style);
  try {
    const { container, rerender } = render(<TravelSliverChevron active={false} open={false} />);
    for (const active of [false, true]) {
      for (const open of [false, true]) {
        rerender(<TravelSliverChevron active={active} open={open} />);
        const svg = container.querySelector("svg");
        expect(svg).not.toBeNull();
        const declarations: Record<string, string> = {};
        for (const rule of Array.from(style.sheet?.cssRules ?? [])) {
          if (!(rule instanceof CSSStyleRule) || !svg?.matches(rule.selectorText)) continue;
          for (const property of ["color", "transform"]) {
            const value = rule.style.getPropertyValue(property);
            if (value) declarations[property] = value;
          }
        }
        expect(declarations["color"]).toBe(active ? "var(--paper)" : "var(--ember)");
        expect(declarations["transform"]).toBe(open ? "rotate(180deg)" : "rotate(0deg)");
      }
    }
  } finally {
    style.remove();
  }
});