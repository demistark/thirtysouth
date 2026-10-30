import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useContent, type ChapterBasic } from "@/lib/data";

export function ItineraryDays({ chapters, value, today, onChange }: { chapters: ChapterBasic[]; value: number; today?: number | undefined; onChange: (n: number) => void }) {
  const { t } = useContent();
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () => setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    const observer = new ResizeObserver(update); observer.observe(el);
    el.addEventListener("scroll", update); update();
    return () => { observer.disconnect(); el.removeEventListener("scroll", update); };
  }, [chapters.length]);
  useEffect(() => {
    const el = row.current;
    const selected = el?.querySelector<HTMLElement>(`[data-day="${value}"]`);
    if (!el || !selected) return;
    const left = selected.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft || left + 72 > el.scrollLeft + el.clientWidth) el.scrollTo({ left: Math.max(0, left - 20), behavior: "instant" });
  }, [value, chapters.length]);
  const scroll = (direction: number) => row.current?.scrollBy({ left: direction * 320, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  return <div className="itinerary-days">
    {edges.left && <Button variant="ghost" size="icon" className="day-arrow day-arrow-left" aria-label={t("itinerary.previous_days")} onClick={() => scroll(-1)}><ChevronLeft /></Button>}
    <div ref={row} className="day-scroll" aria-label={t("itinerary.chapter")}>
      {chapters.map((c, i) => {
        const date = new Date(`${c.date}T12:00:00Z`);
        return <div key={c.number} className="day-slot" data-day={c.number}>
          <Button variant="ghost" className="day-card" aria-current={value === c.number ? "date" : undefined} aria-label={`${t("itinerary.chapter")} ${c.number}, ${c.date}`} onClick={() => onChange(c.number)} onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault(); const next = chapters[i + (e.key === "ArrowRight" ? 1 : -1)];
            if (!next) return;
            onChange(next.number); row.current?.querySelector<HTMLButtonElement>(`[data-day="${next.number}"] button`)?.focus();
          }}>
            <span className="day-weekday">{new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date)}</span>
            <span className="day-number">{date.getUTCDate()}</span>
            <span className="day-chapter">{t("itinerary.chapter_short")} {c.number}</span>
          </Button>
          <span className="day-today-space">{today === c.number && <span className="day-today-dot" aria-label={t("itinerary.today")} />}</span>
        </div>;
      })}
    </div>
    {edges.right && <Button variant="ghost" size="icon" className="day-arrow day-arrow-right" aria-label={t("itinerary.next_days")} onClick={() => scroll(1)}><ChevronRight /></Button>}
  </div>;
}