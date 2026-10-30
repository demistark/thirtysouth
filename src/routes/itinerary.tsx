import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell, SubTabs } from "@/components/site/Blocks";
import { RecordingLockout } from "@/components/site/Lockouts";
import { useAuth } from "@/lib/auth";
import { canViewScenes } from "@/lib/locked-areas";
import { formatChapterDate, useChapters, useContent, type ChapterBasic } from "@/lib/data";
import { itineraryTabs } from "@/lib/itinerary-tabs";
import { initialItineraryView, type Scene, type WardrobeLook } from "@/lib/itinerary";
import { useLooks, usePhotoUrls, useScenes } from "@/lib/itinerary-data";
import { useTripClock } from "@/lib/trip-clock";
import { zonedDate } from "@/lib/phase";
import { cn } from "@/lib/utils";
import { ItineraryDays } from "@/components/site/ItineraryDays";
import { ItineraryScript } from "@/components/site/ItineraryScript";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, MapPin, Shirt } from "lucide-react";

export const Route = createFileRoute("/itinerary")({
  head: () => ({
    meta: [
      { title: "Itinerary · 30° South" },
      { name: "description", content: "Ten chapters, one story: the Cape Town itinerary." },
      { property: "og:title", content: "Itinerary · 30° South" },
      { property: "og:description", content: "Ten chapters, one story: the Cape Town itinerary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Itinerary,
});

type Tab = "script" | "scenes" | "wardrobe";

function Itinerary() {
  const { t } = useContent();
  const { roles, loading } = useAuth();
  const { now, phase, settings } = useTripClock();
  const chaptersQ = useChapters();
  const chapters = chaptersQ.data ?? [];
  const allowed = canViewScenes(roles);
  const today = zonedDate(now, settings.timezone);
  const todayChapter = phase === "during" ? chapters.find((c) => c.date === today)?.number : undefined;
  const [tab, setTab] = useState<Tab>("script");
  const [chapter, setChapter] = useState(1);
  const [focusLook, setFocusLook] = useState<string>();
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current || loading || !chaptersQ.data) return;
    decided.current = true;
    const v = initialItineraryView(allowed, today, chaptersQ.data);
    setTab(v.tab); setChapter(v.chapter);
  }, [loading, chaptersQ.data, allowed, today]);

  const wear = (look: WardrobeLook) => { setFocusLook(look.id); setTab("wardrobe"); };

  return (
    <PageShell titleKey="itinerary.title" introKey="itinerary.intro">
      <SubTabs tabs={itineraryTabs().map((id) => ({ id, label: t(`itinerary.tab.${id}`) }))} value={tab} onChange={setTab} />
      {tab === "script" ? (
        <ItineraryScript chapters={chapters} loading={chaptersQ.isLoading} />
      ) : loading ? (
        <div className="min-h-80 bg-band-sage" />
      ) : !allowed ? (
        <div className="itinerary-recording"><RecordingLockout /></div>
      ) : (
        <>
          <ItineraryDays chapters={chapters} value={chapter} today={todayChapter} onChange={setChapter} />
          {tab === "scenes" && <div className="mb-7"><p className="label-caps text-slate">{t("itinerary.chapter")} {chapter} · {formatChapterDate(chapters.find((c) => c.number === chapter)?.date ?? today)}</p><h2 className="font-display-light mt-2 text-3xl text-deep-atlantic md:text-4xl">{chapters.find((c) => c.number === chapter)?.title}</h2></div>}
          {tab === "scenes" ? <Scenes key={`${chapter}-${todayChapter}`} chapter={chapter} isToday={chapter === todayChapter} onWear={wear} /> : <Wardrobe chapter={chapter} focus={focusLook} />}
        </>
      )}
    </PageShell>
  );
}

function Scenes({ chapter, isToday, onWear }: { chapter: number; isToday: boolean; onWear: (l: WardrobeLook) => void }) {
  const { t } = useContent();
  const scenesQ = useScenes(true);
  const looksQ = useLooks(true);
  const [openId, setOpenId] = useState<string | null>();
  const scenes = (scenesQ.data ?? []).filter((s) => s.chapter_number === chapter);
  if (scenesQ.isLoading) return <div className="h-64 border bg-card" />;
  if (!scenes.length) return <p className="caption-serif border bg-card px-6 py-12 text-center text-lg">{t("itinerary.scenes_empty")}</p>;
  return (
    <ul className="scene-timeline fade-in">
      {scenes.map((s, i) => (
        <SceneCard key={s.id} s={s} open={openId === undefined ? isToday && i === 0 : openId === s.id} onToggle={() => setOpenId((openId === undefined ? isToday && i === 0 : openId === s.id) ? null : s.id)}
          look={s.wardrobe_look != null ? (looksQ.data ?? []).find((l) => l.chapter_number === chapter && l.look_order === s.wardrobe_look) : undefined}
          onWear={onWear} />
      ))}
    </ul>
  );
}

function SceneCard({ s, open, onToggle, look, onWear }: { s: Scene; open: boolean; onToggle: () => void; look?: WardrobeLook | undefined; onWear: (l: WardrobeLook) => void }) {
  const { t } = useContent();
  const time = [s.start_time, s.end_time].filter(Boolean).join(" – ");
  const experienceUrl = (() => { try { const url = new URL(s.experience_card ?? ""); return ["https:", "http:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; } })();
  return (
    <li className="scene-timeline-item">
      <article className="scene-card" onClick={onToggle}>
        {time && <p className="scene-time">{time}</p>}
        <div className="scene-title-row">
          <span className="scene-timeline-dot" aria-hidden="true" />
          <h3 className="scene-title">{s.title}</h3>
          <Button variant="ghost" size="icon" className="scene-chevron" aria-label={s.title} aria-expanded={open} aria-controls={`scene-details-${s.id}`} onClick={(e) => { e.stopPropagation(); onToggle(); }}>{open ? <ChevronUp /> : <ChevronDown />}</Button>
        </div>
        {s.location && <p className="scene-location"><MapPin aria-hidden="true" />{s.location}</p>}
        {look && <Button variant="ghost" className="scene-wardrobe" onClick={(e) => { e.stopPropagation(); onWear(look); }}><Shirt aria-hidden="true" /><span>{look.title}</span></Button>}
        {s.summary && <p className="scene-summary">{s.summary}</p>}
        <div id={`scene-details-${s.id}`} className="scene-expansion" data-open={open} inert={!open} aria-hidden={!open}>
          <div className="scene-expansion-inner"><div className="scene-details">
            {s.leave_at && <p className="scene-leave">{t("itinerary.leave_at")} {s.leave_at}</p>}
            {s.details && <p className="whitespace-pre-line text-sm leading-relaxed">{s.details}</p>}
            {experienceUrl && <a className="scene-experience" href={experienceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{t("itinerary.experience_card")}</a>}
          </div></div>
        </div>
      </article>
    </li>
  );
}

function Wardrobe({ chapter, focus }: { chapter: number; focus?: string | undefined }) {
  const { t } = useContent();
  const looksQ = useLooks(true);
  const looks = (looksQ.data ?? []).filter((l) => l.chapter_number === chapter);
  useEffect(() => {
    if (focus) document.getElementById(`look-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus, looksQ.data]);
  if (looksQ.isLoading) return <div className="h-64 border bg-card" />;
  if (!looks.length) return <p className="caption-serif border bg-card px-6 py-12 text-center text-lg">{t("itinerary.no_look")}</p>;
  return <div className="fade-in space-y-10">{looks.map((l) => <LookCard key={l.id} look={l} />)}</div>;
}

function LookCard({ look }: { look: WardrobeLook }) {
  const { t } = useContent();
  const urls = usePhotoUrls(useMemo(() => look.photos, [look.photos])).data ?? {};
  return (
    <article id={`look-${look.id}`} className="scroll-mt-24 border bg-card px-4 py-6 md:px-6">
      <p className="eyebrow">{[look.date_label, look.look_label].filter(Boolean).join(" · ")}</p>
      <h3 className="font-display-light mt-2 text-3xl text-deep-atlantic">{look.title}</h3>
      {look.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{look.description}</p>}
      {look.palette.length > 0 && (
        <div className="mt-5">
          <p className="label-caps text-muted-foreground">{t("itinerary.palette")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {look.palette.map((p, i) => (
              <li key={i} className="flex items-center gap-2 border px-2 py-1 text-xs">
                <span className={cn("h-4 w-4 rounded-full border", !p.hex && "bg-transparent")} style={p.hex ? { backgroundColor: p.hex } : undefined} aria-hidden="true" />
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {look.photos.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-3">
          {look.photos.map((p) => urls[p] ? <img key={p} src={urls[p]} alt={look.title} loading="lazy" className="aspect-[4/5] w-full border object-cover" /> : <div key={p} className="aspect-[4/5] border bg-paper" />)}
        </div>
      )}
    </article>
  );
}
