/** Current visible sticky obstructions, including a compact/returning title bar. */
export function stickyBottom(): number {
  let bottom = 0;
  for (const el of document.querySelectorAll<HTMLElement>("[data-scroll-obstruction]")) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || rect.bottom <= 0) continue;
    const top = Number.parseFloat(style.top) || 0;
    const parent = el.parentElement;
    const parentStyle = parent ? getComputedStyle(parent) : undefined;
    const parentStuck = parent && parentStyle?.position === "sticky" && parent.getBoundingClientRect().top <= (Number.parseFloat(parentStyle.top) || 0) + 1;
    if (style.position === "fixed" || parentStuck || (style.position === "sticky" && rect.top <= top + 1)) bottom = Math.max(bottom, rect.bottom);
  }
  return bottom;
}

export function contentScrollTop(targetTop: number, scrollY: number, obstruction: number): number {
  return Math.max(0, targetTop + scrollY - obstruction);
}

let animation = 0;
export function scrollToContent(target: Element | null): void {
  if (!target) return;
  cancelAnimationFrame(animation);
  const start = window.scrollY;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const destination = () => contentScrollTop(target.getBoundingClientRect().top, window.scrollY, stickyBottom());
  if (reduced) { window.scrollTo({ top: destination(), behavior: "instant" }); return; }
  let began: number | undefined;
  const step = (time: number) => {
    began ??= time;
    const progress = Math.min(1, (time - began) / 300);
    const eased = 1 - (1 - progress) ** 3;
    window.scrollTo({ top: start + (destination() - start) * eased, behavior: "instant" });
    if (progress < 1) animation = requestAnimationFrame(step);
  };
  animation = requestAnimationFrame(step);
}