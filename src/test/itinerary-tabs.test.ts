import { expect, it } from "vitest";
import { itineraryTabs } from "@/lib/itinerary-tabs";

it("keeps Script, Scenes, Wardrobe order before, during and after the trip", () => {
  for (const phase of ["before", "during", "after"] as const) {
    expect(itineraryTabs(phase)).toEqual(["script", "scenes", "wardrobe"]);
  }
});