import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ComingSoon, PageShell, SubTabs } from "@/components/site/Blocks";
import { scrollToContent, stickyBottom } from "@/lib/scroll";
import { wardrobeVisible } from "@/lib/site-shell";
import { RecordingLockout } from "@/components/site/Lockouts";
import { useAuth } from "@/lib/auth";
import { canViewScenes, isTripParticipant } from "@/lib/locked-areas";
import { formatChapterDate, useChapters, useContent } from "@/lib/data";
import { itineraryTabs } from "@/lib/itinerary-tabs";
import { initialItineraryView, type Scene, type WardrobeLook } from "@/lib/itinerary";
import { useExperienceRsvps, useExperienceScenes, useExperiences } from "@/lib/purse-data";
import { sceneExperienceTags, type Experience, type ExperienceRsvp } from "@/lib/purse";
import { useMyGuestId } from "@/lib/journal-data";
import { useLooks, usePhotoUrls, useScenes } from "@/lib/itinerary-data";
import { useTripClock } from "@/lib/trip-clock";
import { zonedDate } from "@/lib/phase";
import { cn } from "@/lib/utils";
import { ItineraryDays } from "@/components/site/ItineraryDays";
import { ItineraryScript } from "@/components/site/ItineraryScript";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, MapPin, ArrowLeft } from "lucide-react";
import { expandable, lookNumber, railDots, tagsForScene, type Dot } from "@/lib/itinerary-display";
import { useItineraryDisplay } from "@/lib/itinerary-display-data";

type Tab = "script" | "scenes" | "wardrobe";
type ItinerarySearch = { tab?: Tab; day?: number; look?: string; from?: "scenes"; anchor?: string };
export const Route = createFileRoute("/itinerary")({
  validateSearch: (s: Record<string,unknown>): ItinerarySearch => ({
    ...(s["tab"] === "script" || s["tab"] === "scenes" || s["tab"] === "wardrobe" ? {tab:s["tab"]} : {}),
    ...(Number.isInteger(Number(s["day"])) && Number(s["day"]) >= 1 && Number(s["day"]) <= 10 ? {day:Number(s["day"])} : {}),
    ...(typeof s["look"] === "string" ? {look:s["look"]} : {}),
    ...(s["from"] === "scenes" ? {from:"scenes" as const} : {}),
    ...(typeof s["anchor"] === "string" && /^(scene|tag)-[\w-]+$/.test(s["anchor"]) ? {anchor:s["anchor"]} : {}),
  }),
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


function Itinerary() {
  const {t} = useContent(); const {roles,loading,isHost} = useAuth(); const {now,phase,settings} = useTripClock();
  const displayQ = useItineraryDisplay();
  const wardrobeHidden = displayQ.data?.wardrobeVisible === false;
  const showWardrobe = wardrobeVisible(wardrobeHidden ? "false" : undefined,isHost);
  const chaptersQ = useChapters(); const chapters = chaptersQ.data ?? [];
  const allowed = canViewScenes(roles); const today = zonedDate(now,settings.timezone);
  const todayChapter = phase === "during" ? chapters.find(c => c.date === today)?.number : undefined;
  const search = Route.useSearch(); const navigate = Route.useNavigate(); const decided = useRef(false);
  const initial = initialItineraryView(allowed,today,chapters);
  const tab = search.tab ?? initial.tab; const chapter = search.day ?? initial.chapter;
  const selected = chapters.find(c => c.number === chapter);
  useEffect(() => {
    if(decided.current || loading || !chaptersQ.data) return;
    decided.current=true;
    if(!search.tab) void navigate({search:{tab:initial.tab,day:initial.chapter},replace:true});
  },[loading,chaptersQ.data,search.tab,initial.tab,initial.chapter,navigate]);
  const scenesQ = useScenes(allowed); const looksQ = useLooks(allowed);
  const hash = useLocation({select: location => location.hash});
  useEffect(() => {
    if (!hash || loading || displayQ.isPending || scenesQ.isPending || looksQ.isPending) return;
    const target = document.getElementById(hash);
    if (!target) return;
    if (hash === "wardrobe-context" || /^day-\d+$/.test(hash)) {
      const frame = requestAnimationFrame(() => window.scrollTo({top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - stickyBottom() - 8), behavior: "instant"}));
      return () => cancelAnimationFrame(frame);
    }
    if (tab === "scenes") scrollToContent(target);
    return undefined;
  },[hash,tab,loading,displayQ.isPending,scenesQ.isPending,looksQ.isPending]);
  return <PageShell titleKey="itinerary.title" introKey="itinerary.intro">
    <SubTabs tabs={itineraryTabs().map(id => ({id,label:t(`itinerary.tab.${id}`)}))} value={tab} onChange={next => void navigate({search:{tab:next,day:chapter},hash:""})} />
    {tab === "script" ? <ItineraryScript chapters={chapters} loading={chaptersQ.isLoading} /> : loading || (tab === "wardrobe" && displayQ.isPending) ? <div className="min-h-80 bg-card" /> : tab === "wardrobe" && !showWardrobe ? <div className="wardrobe-context-slot" data-hidden><ComingSoon /></div> : !allowed ? <div className="itinerary-recording"><RecordingLockout /></div> : <>
      <ItineraryDays chapters={chapters} value={chapter} today={todayChapter} onChange={day => void navigate({search:{tab,day},hash:"",resetScroll:false})} />
      {tab === "scenes" ? <>
        <header className="day-heading" id={`day-${chapter}`}>
          <p className="day-heading-line"><span className="day-heading-chapter">{t("itinerary.chapter")} {chapter}</span>{" — "}<span className="day-heading-date">{formatChapterDate(selected?.date ?? today)}</span></p>
          <h2 className="day-title"><span>{selected?.title}</span></h2>
        </header>
        <Scenes key={`${chapter}-${todayChapter}`} chapter={chapter} isToday={chapter === todayChapter} scenes={(scenesQ.data ?? []).filter(s => s.chapter_number === chapter)} looks={(looksQ.data ?? []).filter(l => l.chapter_number === chapter)} loading={scenesQ.isPending || looksQ.isPending} />
      </> : <>
        <div className="wardrobe-context-slot" id="wardrobe-context">
          {search.from === "scenes" ? <Link className="wardrobe-back" to="/itinerary" search={{tab:"scenes",day:chapter}} hash={`day-${chapter}`} resetScroll={false} hashScrollIntoView={false}><ArrowLeft aria-hidden="true" />{t("itinerary.chapter")} {chapter}</Link> : <p className="day-heading-date">{formatChapterDate(selected?.date ?? today)}</p>}
        </div>
        {wardrobeHidden && isHost && <p className="label-caps mb-4 text-muted-foreground">{t("itinerary.wardrobe_hidden")}</p>}
        <Wardrobe chapter={chapter} focus={search.from === "scenes" ? undefined : search.look} />
      </>}
    </>}
  </PageShell>;
}
function LookTag({look,anchor}: {look:WardrobeLook;anchor:string}) {
  const {t}=useContent();
  return <Link id={anchor} className="look-tag" to="/itinerary" search={{tab:"wardrobe",day:look.chapter_number,...(look.id ? {look:look.id} : {}),from:"scenes"}} hash="wardrobe-context" resetScroll={false} hashScrollIntoView={false}><span>{t("itinerary.look")} {lookNumber(look.chapter_number,look.look_order)} //</span><span className="text-deep-atlantic">{look.title}</span></Link>;
}
function Scenes({chapter,isToday,scenes,looks,loading}: {chapter:number;isToday:boolean;scenes:Scene[];looks:WardrobeLook[];loading:boolean}) {
  const {t}=useContent(); const [openId,setOpenId]=useState<string|null>(); const display=useItineraryDisplay().data ?? {indicator:"edge",shadow:3,grain:true};
  const {roles}=useAuth();
  const experiences=useExperiences(true).data ?? [];
  const expLinks=useExperienceScenes(true).data ?? [];
  const rsvps=useExperienceRsvps(true).data ?? [];
  const myGuestId=useMyGuestId(true).data ?? null;
  const participant=isTripParticipant(roles);
  const dots=railDots(chapter,scenes);
  const timeline = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = timeline.current;
    if (!list) return;
    const measure = () => {
      const cards = list.querySelectorAll(".scene-card");
      const first = cards[0]; const last = cards[cards.length - 1];
      if (!first || !last) return;
      const bounds = list.getBoundingClientRect();
      list.style.setProperty("--rail-top", `${first.getBoundingClientRect().top - bounds.top}px`);
      list.style.setProperty("--rail-bottom", `${bounds.bottom - last.getBoundingClientRect().bottom}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    list.querySelectorAll(".scene-card, .look-tag").forEach(el => observer.observe(el));
    measure();
    return () => observer.disconnect();
  }, [scenes, looks, loading]);
  if(loading) return <div className="h-64 border bg-card" />;
  if(!scenes.length) return <div>{looks.map(l => <LookTag key={l.id} look={l} anchor={`tag-${l.id}`} />)}<p className="py-12 text-center text-sm">{t("itinerary.scenes_empty")}</p></div>;
  return <ul ref={timeline} className="scene-timeline fade-in" data-shadow={display.shadow} data-indicator={display.indicator} data-grain={display.grain}>
    {scenes.map((s,i) => {
      const open = expandable(s) && (openId === undefined ? isToday && i === 0 : openId === s.id);
      return <li key={s.id} className="scene-timeline-item">
        {tagsForScene(scenes,looks,i).map(l => <LookTag key={l.id} look={l} anchor={`tag-${s.id}-${l.look_order}`} />)}
        <SceneCard s={s} open={open} dot={dots[i] ?? {shape:"circle",color:"atlantic"}} onToggle={() => setOpenId(open ? null : s.id)} experiences={experiences} expLinks={expLinks} rsvps={rsvps} myGuestId={myGuestId} participant={participant} />
      </li>;
    })}
  </ul>;
}
function SceneCard({s,open,onToggle,dot,experiences,expLinks,rsvps,myGuestId,participant}: {s:Scene;open:boolean;onToggle:()=>void;dot:Dot;experiences:Experience[];expLinks:{experience_id:string;scene_id:string}[];rsvps:ExperienceRsvp[];myGuestId:string|null;participant:boolean}) {
  const {t}=useContent(); const canExpand=expandable(s); const time=[s.start_time,s.end_time].filter(Boolean).join(" – ");
  const expTags=sceneExperienceTags(s,experiences,expLinks,rsvps,myGuestId,participant);
  return <article id={`scene-${s.id}`} className="scene-card" data-expandable={canExpand} data-open={open}>
    <div className="scene-main">
      {time && <p className="scene-time">{time}</p>}
      <div className="scene-title-row">
        <span className="scene-timeline-dot" data-shape={dot.shape} data-color={dot.color} aria-hidden="true"><span /></span>
        <h3 className="scene-title">{canExpand ? <Button variant="ghost" className="scene-toggle" aria-label={s.title} aria-expanded={open} aria-controls={`scene-details-${s.id}`} onClick={onToggle}>{s.title}</Button> : s.title}</h3>
        {canExpand && <span className="scene-chevron" aria-hidden="true">{open ? <ChevronUp /> : <ChevronDown />}</span>}
      </div>
      {s.summary && <p className="scene-summary">{s.summary}</p>}
      {s.location && <p className="scene-location"><MapPin aria-hidden="true" />{s.location}</p>}
    </div>
    {canExpand && <div id={`scene-details-${s.id}`} className="scene-expansion" data-open={open} inert={!open} aria-hidden={!open}><div className="scene-expansion-inner"><div className="scene-details">
      {s.details && <p className="whitespace-pre-line text-sm leading-relaxed">{s.details}</p>}
      {s.call_time && <p className="scene-call">{t("itinerary.call_time")} {s.call_time}</p>}
      {s.wrap_time && <p className="scene-call">{t("itinerary.wrap_time")} {s.wrap_time}</p>}
      {expTags.length > 0 && <div className="scene-exp-tags">{expTags.map(tag => <Link key={tag.id} className="look-tag !m-0" to="/purse" hash={`experience-${tag.id}`}><span>{t("purse.experience_tag")} //</span><span className="text-deep-atlantic">{tag.card}</span>{tag.status === "needs_reply" ? <span className="scene-exp-needs"><span className="scene-exp-dot" aria-hidden="true" />{t("purse.needs_reply")}</span> : tag.status ? <span className="scene-exp-status">· {t(`purse.status.${tag.status}`)}</span> : null}</Link>)}</div>}
    </div></div></div>}
  </article>;
}
function Wardrobe({chapter,focus}: {chapter:number;focus:string|undefined}) {
  const {t}=useContent(); const q=useLooks(true); const looks=(q.data ?? []).filter(l => l.chapter_number === chapter);
  useEffect(() => {if(focus && looks.some(l => l.id === focus)) scrollToContent(document.getElementById(`look-${focus}`));},[focus,q.data]);
  if(q.isPending) return <div className="h-64 border bg-card" />;
  if(!looks.length) return <p className="py-12 text-center text-sm">{t("itinerary.no_look")}</p>;
  return <div className="fade-in space-y-10">{looks.map(l => <LookCard key={l.id} look={l} />)}</div>;
}
function LookCard({ look }: { look: WardrobeLook }) {
  const { t } = useContent();
  const urls = usePhotoUrls(useMemo(() => look.photos, [look.photos])).data ?? {};
  return (
    <article id={`look-${look.id}`} className="wardrobe-look">
      <p className="look-label">{t("itinerary.look")} {lookNumber(look.chapter_number, look.look_order)} //</p>
      <h3 className="day-title mt-2">{look.title}</h3>
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
