import type { Scene, WardrobeLook } from "./itinerary";

export type Dot = { shape: "circle" | "square" | "triangle"; color: "atlantic" | "olive" | "apricot" };
export function expandable(scene: Scene) { return Boolean(scene.details.trim() || scene.call_time || scene.wrap_time); }
export function lookNumber(chapter: number, order: number) { return `${String(chapter).padStart(2, "0")}${order > 1 ? `-${String.fromCharCode(96 + order)}` : ""}`; }
export function tagsForScene(scenes: Scene[], looks: WardrobeLook[], index: number) {
  const scene = scenes[index]; if (!scene || scene.look_tag === "hide") return [];
  if (scene.look_tag === "show") return looks.filter(l => l.look_order === (scene.wardrobe_look ?? 1));
  return looks.filter(l => l.look_order === 1 ? index === 0 : scene.wardrobe_look === l.look_order && !scenes.slice(0, index).some(s => s.wardrobe_look === l.look_order));
}
export function railDots(chapter: number, scenes: Scene[]): Dot[] {
  const dots: Dot[] = scenes.map(s => ({shape: s.dot_shape ?? "circle", color: s.dot_color ?? "atlantic"}));
  const changed = () => dots.flatMap((d,i) => d.shape !== "circle" || d.color !== "atlantic" ? [i] : []);
  const target = scenes.length <= 3 ? 0 : scenes.length <= 5 ? 1 : 2;
  const candidates = scenes.map((s,i) => ({i, rank: ((chapter * 73856093) ^ (s.scene_order * 19349663)) >>> 0})).filter(({i}) => i > 0).sort((a,b) => a.rank - b.rank);
  // Explicit overrides win; automatic choices fill only unmet treatments.
  for (const {i} of candidates) {
    if (changed().length >= target) break;
    const s = scenes[i], d = dots[i]; if (!s || !d || s.dot_shape || s.dot_color || changed().some(j => Math.abs(j-i) <= 1)) continue;
    const hasColor = dots.some(dot => dot.color !== "atlantic");
    if (target === 2 && hasColor) d.shape = (chapter + s.scene_order) % 2 ? "square" : "triangle";
    else d.color = (chapter + s.scene_order) % 2 ? "olive" : "apricot";
  }
  return dots;
}
export interface ItineraryDisplay { indicator: "edge" | "arrow" | "both"; shadow: number; grain: boolean; wardrobeVisible?: boolean }
export function displaySettings(values: Record<string,string>): ItineraryDisplay {
  const indicator = values["itinerary_indicator"];
  const shadow = Number(values["itinerary_shadow"] ?? 3);
  return {indicator: indicator === "arrow" || indicator === "both" ? indicator : "edge", shadow: Number.isInteger(shadow) && shadow >= 1 && shadow <= 5 ? shadow : 3, grain: values["itinerary_grain"] !== "false", wardrobeVisible: values["wardrobe_visible"] !== "false"};
}