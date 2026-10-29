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

  const open = (n: number) => { setChapter(n); setTab("scenes"); };
  const wear = (look: WardrobeLook) => { setFocusLook(look.id); setTab("wardrobe"); };

  return (
    <PageShell titleKey="itinerary.title" introKey="itinerary.intro">
      <SubTabs tabs={itineraryTabs().map((id) => ({ id, label: t(`itinerary.tab.${id}`) }))} value={tab} onChange={setTab} />
      {tab === "script" ? (
        <Script chapters={chapters} loading={chaptersQ.isLoading} onOpen={open} />
      ) : loading ? (
        <div className="min-h-80 bg-band-sage" />
      ) : !allowed ? (
        <RecordingLockout />
      ) : (
        <>
          <ChapterStrip chapters={chapters} value={chapter} today={todayChapter} onChange={setChapter} />
          {tab === "scenes" ? <Scenes chapter={chapter} onWear={wear} /> : <Wardrobe chapter={chapter} focus={focusLook} />}
        </>
      )}
    </PageShell>
  );
}

function Script({ chapters, loading, onOpen }: { chapters: ChapterBasic[]; loading: boolean; onOpen: (n: number) => void }) {
  if (loading) return <div className="h-64 border bg-card" />;
  return (
    <ol className="fade-in divide-y border-y">
      {chapters.map((c) => (
        <li key={c.number} className="band-ink bg-background odd:bg-olive-wash">
          <button onClick={() => onOpen(c.number)} className="grid w-full gap-2 px-4 py-6 text-left md:grid-cols-[8rem_1fr] md:gap-8 md:px-6">
            <div>
              <p className="eyebrow">Chapter {c.number}</p>
              <p className="label-caps mt-1 text-muted-foreground">{formatChapterDate(c.date)}</p>
            </div>
            <div>
              <h3 className="font-display-light text-2xl text-deep-atlantic md:text-3xl">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.summary}</p>
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
}

function shortDate(d: string) {
  const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, day)));
}

function ChapterStrip({ chapters, value, today, onChange }: { chapters: ChapterBasic[]; value: number; today?: number | undefined; onChange: (n: number) => void }) {
  const { t } = useContent();
  return (
    <div className="-mx-5 mb-8 flex gap-2 overflow-x-auto px-5 pb-2" role="tablist" aria-label={t("itinerary.chapter")}>
      {chapters.map((c) => (
        <button key={c.number} role="tab" aria-selected={value === c.number} onClick={() => onChange(c.number)}
          className={cn("shrink-0 border px-3 py-2 text-left transition-colors", value === c.number ? "border-ember bg-card" : "border-border bg-background hover:bg-card")}>
          <span className="label-caps block whitespace-nowrap">{t("itinerary.chapter")} {c.number}</span>
          <span className="caption-serif block whitespace-nowrap text-xs">{shortDate(c.date)}{today === c.number && <span className="label-caps ml-2 text-ember-deep">{t("itinerary.today")}</span>}</span>
        </button>
      ))}
    </div>
  );
}

function Scenes({ chapter, onWear }: { chapter: number; onWear: (l: WardrobeLook) => void }) {
  const { t } = useContent();
  const scenesQ = useScenes(true);
  const looksQ = useLooks(true);
  const [openId, setOpenId] = useState<string>();
  const scenes = (scenesQ.data ?? []).filter((s) => s.chapter_number === chapter);
  if (scenesQ.isLoading) return <div className="h-64 border bg-card" />;
  if (!scenes.length) return <p className="caption-serif border bg-card px-6 py-12 text-center text-lg">{t("itinerary.scenes_empty")}</p>;
  return (
    <ul className="fade-in space-y-3">
      {scenes.map((s) => (
        <SceneCard key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? undefined : s.id)}
          look={s.wardrobe_look != null ? (looksQ.data ?? []).find((l) => l.chapter_number === chapter && l.look_order === s.wardrobe_look) : undefined}
          onWear={onWear} />
      ))}
    </ul>
  );
}

function SceneCard({ s, open, onToggle, look, onWear }: { s: Scene; open: boolean; onToggle: () => void; look?: WardrobeLook | undefined; onWear: (l: WardrobeLook) => void }) {
  const { t } = useContent();
  const time = [s.start_time, s.end_time].filter(Boolean).join(" – ");
  return (
    <li className="border bg-card">
      <button onClick={onToggle} aria-expanded={open} className="block w-full px-4 py-5 text-left md:px-6">
        <div className="flex items-center gap-3">
          {time && <p className="label-caps text-muted-foreground">{time}</p>}
          {s.kind !== "core" && <span className="label-caps border px-2 py-0.5 text-[0.625rem] text-muted-foreground">{t(`itinerary.kind.${s.kind}`)}</span>}
        </div>
        <h3 className="font-display-light mt-2 text-2xl text-deep-atlantic">{s.title}</h3>
        {s.location && <p className="caption-serif text-sm">{s.location}</p>}
        {s.summary && <p className="mt-2 text-sm text-muted-foreground">{s.summary}</p>}
      </button>
      {open && (
        <div className="fade-in space-y-3 border-t px-4 py-5 md:px-6">
          {s.details && <p className="whitespace-pre-line text-sm leading-relaxed">{s.details}</p>}
          {s.leave_at && <p className="label-caps text-ember-deep">{t("itinerary.leave_at")} {s.leave_at}</p>}
          {look && <button onClick={() => onWear(look)} className="btn-pill !px-3 !py-1.5">{t("itinerary.wear")} {look.title}</button>}
        </div>
      )}
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
