import { Link } from "@tanstack/react-router";
import { useContent, type ChapterBasic } from "@/lib/data";
import type { ScriptAlignment } from "@/lib/itinerary";

const alignment = (value: ScriptAlignment | null | undefined, fallback: ScriptAlignment = "left") => ({ left: "text-left", center: "text-center", right: "text-right" })[value ?? fallback];
export function ItineraryScript({ chapters, loading }: { chapters: ChapterBasic[]; loading: boolean }) {
  const { t } = useContent();
  if (loading) return <div className="h-64 border bg-card" />;
  return <article className="script-sheet fade-in">
    <p className="text-right font-bold">{t("itinerary.script.draft")}</p>
    <p className="mt-4 text-xs text-slate">{t("itinerary.script.insert_title")}</p>
    <ol className="mt-12 space-y-12">
      {chapters.map((c) => <li key={c.number}>
        {c.heading_before && <p className={`script-heading mb-5 ${alignment(c.heading_before_align, "center")}`}>{c.heading_before}</p>}
        <div className="script-chapter">
          <span className="script-margin script-margin-left">{c.number}</span><span className="script-margin script-margin-right">{c.number}</span>
          <Link to="/itinerary" search={{tab:"scenes",day:c.number}} hash={`day-${c.number}`} resetScroll={false} hashScrollIntoView={false} className={`block ${alignment(c.layout)}`}>
            <p className="script-label">{t("itinerary.chapter")} {c.number} — {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "2-digit", timeZone: "UTC" }).format(new Date(`${c.date}T12:00:00Z`))}</p>
            <h3 className="script-title">{c.title}</h3>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{c.summary}</p>
          </Link>
        </div>
        {c.transition_after && <p className={`mt-6 text-sm text-slate ${alignment(c.transition_after_align, "right")}`}>{c.transition_after}</p>}
      </li>)}
    </ol>
    <p className="mt-14 text-right font-bold">{t("itinerary.script.end")}</p>
  </article>;
}