import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { PageShell } from "@/components/site/Blocks";
import { TravelLockout } from "@/components/site/Lockouts";
import { useAuth } from "@/lib/auth";
import { canViewTravel, isTripParticipant } from "@/lib/locked-areas";
import { useContent, usePrivateContent } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import {
  TRAVEL_SLOTS, castName, castRole, type CastGuest, type PackingCategory, type PackingItem,
  type TravelImage, type TravelSlot,
} from "@/lib/travel";
import {
  useCast, useGuestDirectory, useMyGuest, usePackingCategories, usePackingChecks, usePackingItems,
  useRoomies, useTravelImages, useTravelLegs,
} from "@/lib/travel-data";
import { lookNumber } from "@/lib/itinerary-display";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TravelFlights } from "@/components/site/TravelFlights";
import { TravelSliverChevron } from "@/components/site/TravelSliverChevron";

export const Route = createFileRoute("/travel")({
  validateSearch: (search: Record<string, unknown>): { flight?: "arrival" | "departure" | "add" } => {
    const f = search.flight;
    return f === "arrival" || f === "departure" || f === "add" ? { flight: f } : {};
  },
  head: () => ({
    meta: [
      { title: "Travel · 30° South" },
      { name: "description", content: "The cast, the villa, Roomies, flights, and what to pack." },
      { property: "og:title", content: "Travel · 30° South" },
      { property: "og:description", content: "The cast, the villa, Roomies, flights, and what to pack." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Travel,
});

function Travel() {
  const { roles, loading } = useAuth();
  if (loading) return <main className="pt-20"><div className="min-h-80 bg-band-sage" /></main>;
  if (!canViewTravel(roles))
    return (
      <PageShell titleKey="travel.title" introKey="travel.intro">
        <TravelLockout />
      </PageShell>
    );
  return <TravelPage />;
}

/* ---------- Page shell ---------- */

function TravelPage() {
  const { t } = useContent();
  const { roles, session } = useAuth();
  const participant = isTripParticipant(roles);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { flight: flightParam } = Route.useSearch();

  const imagesQ = useTravelImages(true);
  const castQ = useCast(true);
  const myGuestQ = useMyGuest(!!session);
  const directoryQ = useGuestDirectory(true);
  const roomiesQ = useRoomies(true);
  const legsQ = useTravelLegs(true);

  const categoriesQ = usePackingCategories(true);
  const itemsQ = usePackingItems(true);
  const checksQ = usePackingChecks(!!session && participant);

  // Assign the random cast order once, the first time anyone sees it missing.
  useEffect(() => {
    if (!castQ.data?.some((g) => g.cast_order == null)) return;
    void supabase.rpc("ensure_cast_order").then(() => qc.invalidateQueries({ queryKey: ["travel", "cast"] }));
  }, [castQ.data, qc]);

  const [active, setActive] = useState<TravelSlot>("cast");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id as TravelSlot)),
      { rootMargin: "-25% 0px -65% 0px" },
    );
    TRAVEL_SLOTS.forEach((s) => { const el = document.getElementById(s); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if ((TRAVEL_SLOTS as string[]).includes(hash))
      jumpToTravel(hash);
  }, []);

  const images = imagesQ.data?.images ?? [];
  const urls = imagesQ.data?.urls ?? {};
  const imageFor = (slot: TravelSlot) => {
    const image = images.find((i) => i.slot === slot);
    return { image, url: image ? urls[image.storage_path] : undefined };
  };

  const legs = legsQ.data ?? [];

  const directory = directoryQ.data ?? [];

  return (
    <main className="travel-page pt-14 md:pt-20">
      <header className="mx-auto max-w-5xl px-5">
        <h1 className="font-display-light text-5xl text-deep-atlantic md:text-7xl">{t("travel.title")}</h1>
        <p className="caption-serif mt-3 text-lg">{t("travel_subtitle")}</p>
      </header>
      <JumpBar active={active} />
      <div className="travel-sections">
        <TravelSection slot="cast" deck="" media={imageFor("cast")} eager
          intro={<CastRoll cast={castQ.data ?? []} loading={castQ.isPending} />} />
        <TravelSection slot="villa" deck="" media={imageFor("villa")} intro={<VillaIntro />} />
        <TravelSection slot="roomies" deck="" media={imageFor("roomies")} intro={<div className="travel-roomies-grid">{(roomiesQ.data ?? []).map(r => <article key={r.id} className="travel-roomie"><p className="travel-roomie-names">{r.names}</p><p className="travel-roomie-floor">{r.floor_room}</p>{r.note && <p className="travel-roomie-note">{r.note}</p>}</article>)}</div>} below={!roomiesQ.isPending && !roomiesQ.data?.length ? <p className="caption-serif mt-6 text-sm">{t("travel.roomies.empty")}</p> : undefined} />
        <TravelSection slot="flights" deck="" media={imageFor("flights")} intro={<TravelFlights legs={legs} directory={directory} myGuestId={myGuestQ.data ?? null} editable={participant} initialOpen={initialOpen} />} />
        <TravelSection slot="packing" deck={t("packing_deck")} media={imageFor("packing")}
          intro={<PackingCount items={itemsQ.data ?? []} checks={checksQ.data ?? new Set()} />}
          below={<PackingList categories={categoriesQ.data ?? []} items={itemsQ.data ?? []} checks={checksQ.data ?? new Set()} userId={participant ? session?.user.id : undefined} />} />
      </div>
    </main>
  );
}

function travelHeaderBottom() {
  return Math.max(0,document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0);
}
function jumpToTravel(slot: string) {
  const target=document.getElementById(slot);if(!target)return;
  const desktop=window.matchMedia("(min-width: 768px)").matches;
  const tabs=document.querySelector<HTMLElement>(".travel-jumpbar");
  const destination=()=>{
    const offset=travelHeaderBottom()+(desktop ? tabs?.getBoundingClientRect().height ?? 0 : 6)+5;
    return Math.max(0,target.getBoundingClientRect().top+window.scrollY-offset);
  };
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduced){window.scrollTo({top:destination(),behavior:"instant"});requestAnimationFrame(()=>window.scrollTo({top:destination(),behavior:"instant"}));return;}
  const start=window.scrollY;let began:number | undefined;
  const step=(time:number)=>{began ??= time;const progress=Math.min(1,(time-began)/300);window.scrollTo({top:start+(destination()-start)*(1-(1-progress)**3),behavior:"instant"});if(progress<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
function JumpBar({ active }: { active: TravelSlot }) {
  const { t } = useContent();const bar=useRef<HTMLElement>(null);const panel=useRef<HTMLDivElement>(null);
  const [out,setOut]=useState(false);const [open,setOpen]=useState(false);
  useEffect(()=>{
    let frame=0;
    let followUntil=0;
    const update=()=>{const page=document.querySelector<HTMLElement>(".travel-page");const bottom=travelHeaderBottom();page?.style.setProperty("--travel-header-bottom",`${bottom}px`);page?.style.setProperty("--travel-tabs-bottom",`${bottom+(bar.current?.getBoundingClientRect().height ?? 0)}px`);if(bar.current)setOut(bar.current.getBoundingClientRect().bottom<=bottom);};
    const follow=(now:number)=>{update();if(now<followUntil)frame=requestAnimationFrame(follow);else frame=0;};
    const track=()=>{update();followUntil=performance.now()+300;if(!frame)frame=requestAnimationFrame(follow);};
    const scroll=()=>{track();setOpen(false);};
    const toggle=()=>setOpen(value=>!value);
    const outside=(e:PointerEvent)=>{if(panel.current && e.target instanceof Element && !panel.current.contains(e.target) && !e.target.closest(".site-header-bar"))setOpen(false);};
    update();const header=document.querySelector(".site-header");const observer=new ResizeObserver(update);if(header)observer.observe(header);if(bar.current)observer.observe(bar.current);
    window.addEventListener("scroll",scroll,{passive:true});window.addEventListener("resize",track);window.addEventListener("travel-toggle-tabs",toggle);document.addEventListener("pointerdown",outside);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener("scroll",scroll);window.removeEventListener("resize",track);window.removeEventListener("travel-toggle-tabs",toggle);document.removeEventListener("pointerdown",outside);};
  },[]);
  const go=(slot:TravelSlot)=>{setOpen(false);jumpToTravel(slot);history.replaceState(null,"",`#${slot}`);};
  const tabs=<>{TRAVEL_SLOTS.map(s=><Button key={s} variant="ghost" onClick={()=>go(s)} aria-current={active===s ? "true" : undefined} className={cn("section-tab rounded-none",active===s ? "border-ember text-foreground" : "border-transparent text-muted-foreground")}>{t(`travel.section.${s}`)}</Button>)}</>;
  return <>
    <nav ref={bar} className="travel-jumpbar" aria-label={t("travel.title")}><div className="travel-tab-row">{tabs}</div></nav>
    {out && <div ref={panel} className="travel-phone-nav"><Button variant="ghost" className="travel-tab-line" aria-label={t("travel.title")} aria-expanded={open} onClick={()=>setOpen(!open)}><span className="travel-tab-track">{TRAVEL_SLOTS.map((s,index)=><span key={s} className={s===active ? "bg-ember" : "bg-border"}>{index===2 && <TravelSliverChevron active={s===active} open={open} />}</span>)}</span></Button>{open && <nav className="travel-tab-panel" aria-label={t("travel.title")}>{tabs}</nav>}</div>}
  </>;
}

function TravelSection({ slot, deck, media, intro, below, eager }: {
  slot: TravelSlot; deck: string;
  media: { image: TravelImage | undefined; url: string | undefined };
  intro: React.ReactNode; below?: React.ReactNode; eager?: boolean;
}) {
  const { t } = useContent();
  return (
    <section id={slot} className="travel-section" data-slot={slot}>
      <div className="travel-split">
        <div className="travel-split-media"><SectionMedia slot={slot} media={media} eager={eager} /></div>
        <div className="travel-split-text">
          <h2 className="travel-heading">{t(`travel.section.${slot}`)}</h2>
          {deck && <p className="caption-serif mt-3 text-lg text-muted-foreground">{deck}</p>}
          {intro}
          {below}
        </div>
      </div>
    </section>
  );
}

function SectionMedia({ slot, media, eager }: { slot: TravelSlot; media: { image: TravelImage | undefined; url: string | undefined }; eager?: boolean | undefined }) {
  const { t } = useContent();
  const { image, url } = media;
  if (image && url)
    return (
      <figure className="travel-media">
        <img src={url} alt={image.alt} loading={eager ? "eager" : "lazy"}
          className="travel-media-img" style={{ objectPosition: `${image.focal_x}% ${image.focal_y}%` }} />
        {image.caption && <figcaption className="travel-media-caption">{image.caption}</figcaption>}
      </figure>
    );
  return (
    <div className="travel-media travel-media-empty" data-slot={slot} role="img" aria-label={t(`travel.section.${slot}`)}>
      <span>{t(`travel.section.${slot}`)}</span>
    </div>
  );
}

function LabelledText({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-6">
      <p className="travel-label">{label}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{text}</p>
    </div>
  );
}

/* ---------- Cast ---------- */

function CastRoll({ cast, loading }: { cast: CastGuest[]; loading: boolean }) {
  const { t } = useContent();
  if (loading) return <div className="mt-6 h-40 border bg-card" />;
  if (!cast.length) return <p className="caption-serif mt-6 text-lg italic">{t("travel.cast.empty")}</p>;
  return (
    <div className="cast-roll mt-8">
      <p className="cast-roll-sub">({t("cast_subheading")})</p>
      <ul className="cast-roll-list">
        {cast.map((g) => (
          <li key={g.id} className="cast-row">
            <span className="cast-name"><span>{castName(g)}</span><span className="cast-dots" aria-hidden="true">{"·".repeat(160)}</span></span>
            <span className="cast-role">{castRole(g)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Villa ---------- */

export function VillaIntro() {
  const { t } = useContent();
  const { roles } = useAuth();
  const privateContent = usePrivateContent();
  const participant = isTripParticipant(roles);
  const pt = privateContent.t;
  return (
    <div className="mt-8">
      <h3 className="font-display text-[26px] text-deep-atlantic">{t("villa_name")}</h3>
      {pt("villa_address") && <p className="mt-2 flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-slate" aria-hidden="true" />{pt("villa_address")}</p>}
      {t("villa_stay") && <p className="mt-1 text-sm text-muted-foreground">{t("villa_stay")}</p>}
      {!participant && <p className="caption-serif mt-6">{t("travel.villa_private_note")}</p>}
      {participant && privateContent.ready && <>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div><p className="travel-label">{t("travel.checkin")}</p><p className="mt-1 text-sm">{pt("villa_checkin")}</p></div>
        <div><p className="travel-label">{t("travel.checkout")}</p><p className="mt-1 text-sm">{pt("villa_checkout")}</p></div>
      </div>
      <VillaFunLine />
      {pt("villa_about") && <LabelledText label={t("travel.about")} text={pt("villa_about")} />}
      {pt("villa_amenities") && <LabelledText label={t("travel.amenities")} text={pt("villa_amenities")} />}
      {pt("villa_house_rules") && <LabelledText label={t("travel.house_rules")} text={pt("villa_house_rules")} />}
      {pt("villa_power_note") && <LabelledText label={t("travel.power_note")} text={pt("villa_power_note")} />}
      {pt("villa_after_checkout") && <p className="caption-serif mt-6">{pt("villa_after_checkout")}</p>}
      </>}
    </div>
  );
}

function VillaFunLine() {
  const {t}=useContent();
  const { t: pt, ready }=usePrivateContent();
  if (!ready || (!pt("villa_vrbo_url") && !pt("villa_website_url"))) return null;
  const parts=t("villa_fun_line").split(/(\[[^\]]+\]\((?:vrbo|website)\))/);
  return <p className="mt-6 text-sm leading-relaxed">{parts.map((part,i)=>{const match=/^\[([^\]]+)\]\((vrbo|website)\)$/.exec(part);return match ? <a key={i} href={pt(match[2]==="vrbo" ? "villa_vrbo_url" : "villa_website_url")} target="_blank" rel="noopener noreferrer" className="underline decoration-ember underline-offset-2">{match[1]}</a> : part;})}</p>;
}

/* ---------- Packing ---------- */

function PackingCount({ items, checks }: { items: PackingItem[]; checks: Set<string> }) {
  const { t } = useContent();
  if (!items.length) return null;
  const done = items.filter((i) => checks.has(i.id)).length;
  return <p className="mt-6 text-right text-xs font-medium uppercase tracking-[0.14em] text-ember-deep">{done} {t("travel.of")} {items.length} {t("travel.packed")}</p>;
}

function PackingList({ categories, items, checks, userId }: {
  categories: PackingCategory[]; items: PackingItem[]; checks: Set<string>; userId: string | undefined;
}) {
  const qc = useQueryClient();
  const [local, setLocal] = useState<Set<string>>(checks);
  useEffect(() => setLocal(checks), [checks]);
  if (!items.length) return null;

  const toggle = async (itemId: string) => {
    if (!userId) return;
    const wasChecked = local.has(itemId);
    const next = new Set(local);
    if (wasChecked) next.delete(itemId); else next.add(itemId);
    setLocal(next);
    const { error } = wasChecked
      ? await supabase.from("packing_checks").delete().eq("item_id", itemId)
      : await supabase.from("packing_checks").insert({ item_id: itemId, user_id: userId });
    if (error) setLocal(local);
    else void qc.invalidateQueries({ queryKey: ["travel", "packing-checks"] });
  };

  return (
    <div className="packing-list">
      {categories.map((c) => {
        const catItems = items.filter((i) => i.category_id === c.id);
        if (!catItems.length) return null;
        return (
          <div key={c.id} className="packing-category">
            <h3 className="packing-cat-heading">{c.name}</h3>
            <ul>
              {catItems.map((item) => (
                <li key={item.id} className="packing-item">
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
                    <input type="checkbox" className="packing-checkbox" disabled={!userId} checked={local.has(item.id)} onChange={() => void toggle(item.id)} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", local.has(item.id) && "text-muted-foreground line-through decoration-slate/60")}>{item.name}</span>
                      {item.note && <span className="block text-xs text-muted-foreground">{item.note}</span>}
                    </span>
                    {item.chapter_number != null && item.look_order != null ? (
                      <Link className="look-tag packing-tag" to="/itinerary" search={{ tab: "wardrobe", day: item.chapter_number }}>
                        <span>LOOK {lookNumber(item.chapter_number, item.look_order)}</span>
                      </Link>
                    ) : item.chapter_number != null ? (
                      <Link className="look-tag packing-tag" to="/itinerary" search={{ tab: "scenes", day: item.chapter_number }}>
                        <span>CHP {item.chapter_number}</span>
                      </Link>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
