export const BACK_TO_TOP_THRESHOLD = 600;
export const BACK_TO_TOP_IDLE_MS = 1000;
export function backToTopVisible(scrollY: number): boolean { return scrollY > BACK_TO_TOP_THRESHOLD; }
/** Pixel bottom offset: default safe-area clearance, or footer top plus the existing 4rem gap. */
export function bubbleBottom(viewportHeight: number, footerTop: number, rootSize: number, safeBottom = 0): number {
  return Math.max(24 + safeBottom, viewportHeight - footerTop + 4 * rootSize);
}
export function wardrobeVisible(value: string | undefined, isHost: boolean): boolean { return value !== "false" || isHost; }