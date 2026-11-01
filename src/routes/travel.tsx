import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BedDouble, MapPin } from "lucide-react";
import { PageShell } from "@/components/site/Blocks";
import { TravelLockout } from "@/components/site/Lockouts";
import { useAuth } from "@/lib/auth";
import { canViewTravel, isTripParticipant } from "@/lib/locked-areas";
import { useChapters, useContent } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import {
  TRAVEL_SLOTS, castName, castRole, formatLegDate, formatLegTime, groupLegsByDate, legRoute,
  packingColumnCount, type CastGuest, type PackingCategory, type PackingItem, type Transfer,
  type TravelImage, type TravelLeg, type TravelSlot, type VillaRoom, type RoomAssignment,
} from "@/lib/travel";
import {
  useCast, useGuestDirectory, useMyGuest, usePackingCategories, usePackingChecks, usePackingItems,
  useRoomAssignments, useTransfers, useTravelImages, useTravelLegs, useVillaRooms,
} from "@/lib/travel-data";
import { lookNumber } from "@/lib/itinerary-display";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/travel")({
  head: () => ({
    meta: [
      { title: "Travel · 30° South" },
      { name: "description", content: "The cast, the villa, flights, and what to pack." },
      { property: "og:title", content: "Travel · 30° South" },
      { property: "og:description", content: "The cast, the villa, flights, and what to pack." },
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

  const imagesQ = useTravelImages(true);
  const castQ = useCast(true);
  const myGuestQ = useMyGuest(!!session);
  const directoryQ = useGuestDirectory(true);
  const roomsQ = useVillaRooms(true);
  const assignmentsQ = useRoomAssignments(true);
  const legsQ = useTravelLegs(true);
  const transfersQ = useTransfers(true);
  const categoriesQ = usePackingCategories(true);
  const itemsQ = usePackingItems(true);
  const checksQ = usePackingChecks(!!session);
  const chaptersQ = useChapters();

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
      document.getElementById(hash)?.scrollIntoView({ block: "start", behavior: "instant" });
  }, []);

  const images = imagesQ.data?.images ?? [];
  const urls = imagesQ.data?.urls ?? {};
  const imageFor = (slot: TravelSlot) => {
    const image = images.find((i) => i.slot === slot);
    return { image, url: image ? urls[image.storage_path] : undefined };
  };

  const legs = legsQ.data ?? [];
  const transfers = transfersQ.data ?? [];
  const directory = directoryQ.data ?? [];
  const chapters = chaptersQ.data ?? [];

  return (
    <main className="pt-14 md:pt-20">
      <header className="mx-auto max-w-5xl px-5">
        <h1 className="font-display-light text-[56px] uppercase leading-none text-deep-atlantic">{t("travel.title")}</h1>
        <p className="caption-serif mt-3 text-lg">{t("travel_subtitle")}</p>
      </header>
      <JumpBar active={active} />
      <div className="travel-sections">
        <TravelSection slot="cast" deck={t("cast_deck")} media={imageFor("cast")} eager
          intro={<CastRoll cast={castQ.data ?? []} loading={castQ.isPending} />} />
        <TravelSection slot="villa" deck="" media={imageFor("villa")}
          intro={<VillaIntro />}
          below={<>
            <RoomsGrid rooms={roomsQ.data ?? []} assignments={assignmentsQ.data ?? []} directory={directory} />
            {t("villa_after_checkout") && (
              <div className="travel-card mt-6">
                <p className="travel-label">{t("travel.after_checkout")}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{t("villa_after_checkout")}</p>
              </div>
            )}
          </>} />
        <TravelSection slot="flights" deck={t("flights_deck")} media={imageFor("flights")}
          intro={<>
            {participant && <YourFlight legs={legs.filter((l) => l.guest_id === myGuestQ.data)} />}
            {t("flights_getting_to_villa") && <LabelledText label={t("travel.getting_to_villa")} text={t("flights_getting_to_villa")} />}
            {t("flights_power_and_time") && <LabelledText label={t("travel.power_time")} text={t("flights_power_and_time")} />}
          </>}
          below={<FlightLists legs={legs} transfers={transfers} directory={directory} chapters={chapters} loading={legsQ.isPending} />} />
        <TravelSection slot="packing" deck={t("packing_deck")} media={imageFor("packing")}
          intro={<PackingCount items={itemsQ.data ?? []} checks={checksQ.data ?? new Set()} />}
          below={<PackingList categories={categoriesQ.data ?? []} items={itemsQ.data ?? []} checks={checksQ.data ?? new Set()} userId={session?.user.id} />} />
      </div>
    </main>
  );
}

function JumpBar({ active }: { active: TravelSlot }) {
  const { t } = useContent();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > last + 4 && y > 140);
      if (y < last - 4 || y <= 140) setHidden(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const go = (slot: TravelSlot) => (e: React.MouseEvent) => {
    e.preventDefault();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(slot)?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    history.replaceState(null, "", `#${slot}`);
  };
  return (
    <nav className={cn("travel-jumpbar", hidden && "travel-jumpbar-hidden")} aria-label="Travel sections">
      <div className="mx-auto flex max-w-5xl gap-6 overflow-x-auto px-5 shadow-[inset_0_-1px_0_var(--color-border)]">
        {TRAVEL_SLOTS.map((s) => (
          <a key={s} href={`#${s}`} onClick={go(s)} aria-current={active === s ? "true" : undefined}
            className={cn("label-caps whitespace-nowrap border-b-[2.5px] pb-4 pt-3 transition-colors",
              active === s ? "border-ember text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t(`travel.section.${s}`)}
          </a>
        ))}
      </div>
    </nav>
  );
}

function TravelSection({ slot, deck, media, intro, below, eager }: {
  slot: TravelSlot; deck: string;
  media: { image: TravelImage | undefined; url: string | undefined };
  intro: React.ReactNode; below?: React.ReactNode; eager?: boolean;
}) {
  const { t } = useContent();
  return (
    <section id={slot} className="travel-section scroll-mt-36" data-slot={slot}>
      <div className="travel-split">
        <div className="travel-split-media"><SectionMedia slot={slot} media={media} eager={eager} /></div>
        <div className="travel-split-text">
          <p className="travel-eyebrow">{t("travel.title")}</p>
          <h2 className="travel-heading">{t(`travel.section.${slot}`)}</h2>
          {deck && <p className="caption-serif mt-3 text-lg text-muted-foreground">{deck}</p>}
          {intro}
        </div>
      </div>
      {below && <div className="travel-below">{below}</div>}
    </section>
  );
}

function SectionMedia({ slot, media, eager }: { slot: TravelSlot; media: { image: TravelImage | undefined; url: string | undefined }; eager?: boolean }) {
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
      <p className="cast-roll-head">
        <strong>{t("cast_heading")}</strong> <span className="cast-roll-sub">{t("cast_subheading")}</span>
      </p>
      <ul className="cast-roll-list">
        {cast.map((g) => (
          <li key={g.id} className="cast-row">
            <span className="cast-name">{castName(g)}</span>
            <span className="cast-dots" aria-hidden="true">······</span>
            <span className="cast-role">{castRole(g)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Villa ---------- */

function VillaIntro() {
  const { t } = useContent();
  return (
    <div className="mt-8">
      <h3 className="font-display text-[26px] text-deep-atlantic">{t("villa_name")}</h3>
      {t("villa_address") && <p className="mt-2 flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-slate" aria-hidden="true" />{t("villa_address")}</p>}
      {t("villa_stay") && <p className="mt-1 text-sm text-muted-foreground">{t("villa_stay")}</p>}
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div><p className="travel-label">{t("travel.checkin")}</p><p className="mt-1 text-sm">{t("villa_checkin")}</p></div>
        <div><p className="travel-label">{t("travel.checkout")}</p><p className="mt-1 text-sm">{t("villa_checkout")}</p></div>
      </div>
      {t("villa_about") && <LabelledText label={t("travel.about")} text={t("villa_about")} />}
      {t("villa_amenities") && <LabelledText label={t("travel.amenities")} text={t("villa_amenities")} />}
      {t("villa_house_rules") && <LabelledText label={t("travel.house_rules")} text={t("villa_house_rules")} />}
      {t("villa_power_note") && <LabelledText label={t("travel.power_note")} text={t("villa_power_note")} />}
    </div>
  );
}

function RoomsGrid({ rooms, assignments, directory }: { rooms: VillaRoom[]; assignments: RoomAssignment[]; directory: { id: string; display_name: string }[] }) {
  const { t } = useContent();
  const byRoom = useMemo(() => {
    const map = new Map<string, string[]>();
    assignments.forEach((a) => {
      const name = directory.find((d) => d.id === a.guest_id)?.display_name;
      if (name) map.set(a.room_id, [...(map.get(a.room_id) ?? []), name]);
    });
    return map;
  }, [assignments, directory]);
  if (!rooms.length) return null;
  return (
    <div>
      <p className="travel-label">{t("travel.rooms")}</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <li key={r.id} className="travel-card">
            <h3 className="font-display text-[23px] text-deep-atlantic">{r.label}</h3>
            <p className="mt-2 flex items-center gap-2 text-sm"><BedDouble className="h-4 w-4 shrink-0 text-slate" aria-hidden="true" />{r.bed_config}{r.sleeps ? ` · ${r.sleeps}` : ""}</p>
            {r.notes && <p className="mt-2 text-xs text-muted-foreground">{r.notes}</p>}
            <p className="mt-3 border-t pt-3 text-sm">
              {byRoom.get(r.id)?.length ? byRoom.get(r.id)!.join(", ") : <span className="italic text-muted-foreground">{t("travel.not_assigned")}</span>}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Flights ---------- */

function YourFlight({ legs }: { legs: TravelLeg[] }) {
  const { t } = useContent();
  if (!legs.length) return null;
  return (
    <div className="mt-8">
      <p className="travel-label flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-ember" aria-hidden="true" />{t(legs.length > 1 ? "travel.your_flights" : "travel.your_flight")}</p>
      <ul className="mt-3 space-y-3">
        {legs.map((l) => (
          <li key={l.id} className="travel-card">
            <p className="scene-time">{formatLegDate(l.cpt_time)} · {formatLegTime(l.cpt_time)}</p>
            <p className="mt-1 text-sm">{legRoute(l)}</p>
            {l.terminal && <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{l.terminal}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlightLists({ legs, transfers, directory, chapters, loading }: {
  legs: TravelLeg[]; transfers: Transfer[]; directory: { id: string; display_name: string }[];
  chapters: { number: number; date: string }[]; loading: boolean;
}) {
  const { t } = useContent();
  if (loading) return <div className="h-64 border bg-card" />;
  if (!legs.length) return <p className="caption-serif py-8 text-lg italic">{t("travel.flights.empty")}</p>;
  const chapterFor = (date: string) => chapters.find((c) => c.date === date)?.number;
  const nameFor = (id: string) => directory.find((d) => d.id === id)?.display_name ?? "";
  const list = (direction: "arrival" | "departure", label: string) => {
    const groups = groupLegsByDate(legs.filter((l) => l.direction === direction));
    return (
      <div>
        <p className="travel-label">{label}</p>
        {groups.map((g) => (
          <div key={g.date} className="mt-6">
            <p className="travel-date-head">{formatLegDate(g.date)}{chapterFor(g.date) ? ` · CHP ${chapterFor(g.date)}` : ""}</p>
            <ul className="scene-timeline mt-4">
              {g.legs.map((l) => {
                const transfer = transfers.find((tr) => tr.id === l.transfer_id);
                return (
                  <li key={l.id} className="scene-timeline-item">
                    <article id={`leg-${l.id}`} className="scene-card">
                      <div className="scene-main">
                        <p className="scene-time">{formatLegTime(l.cpt_time)}</p>
                        <div className="scene-title-row">
                          <span className="scene-timeline-dot" data-shape="circle" data-color="atlantic" aria-hidden="true"><span /></span>
                          <h3 className="scene-title">{nameFor(l.guest_id)}</h3>
                        </div>
                        <p className="scene-summary">{legRoute(l)}</p>
                        {l.terminal && <p className="scene-location"><MapPin aria-hidden="true" />{l.terminal}</p>}
                        {l.notes && <p className="mt-1 text-sm text-muted-foreground">{l.notes}</p>}
                        {transfer && (
                          <a className="look-tag" href={`#transfer-${transfer.id}`}>
                            <span>{transfer.label} //</span>
                            <span className="text-deep-atlantic">{transfer.meet_time ? formatLegTime(transfer.meet_time) : ""}</span>
                          </a>
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    );
  };
  return (
    <div>
      <div className="grid gap-10 lg:grid-cols-2">
        {list("arrival", t("travel.arrivals"))}
        {list("departure", t("travel.departures"))}
      </div>
      {transfers.length > 0 && (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {transfers.map((tr) => (
            <li key={tr.id} id={`transfer-${tr.id}`} className="travel-card scroll-mt-36">
              <h3 className="font-display text-[23px] text-deep-atlantic">{tr.label}</h3>
              {tr.meet_time && <p className="scene-time mt-2">{formatLegDate(tr.meet_time)} · {formatLegTime(tr.meet_time)}</p>}
              {tr.meeting_point && <p className="mt-1 flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-slate" aria-hidden="true" />{tr.meeting_point}</p>}
              {tr.provider && <p className="mt-1 text-sm">{tr.provider}{tr.driver_contact ? ` · ${tr.driver_contact}` : ""}</p>}
              {tr.included_with_villa && <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-ember-deep">{t("travel.included_villa")}</p>}
              {tr.notes && <p className="mt-2 text-xs text-muted-foreground">{tr.notes}</p>}
              <p className="mt-3 border-t pt-3 text-sm">
                {legs.filter((l) => l.transfer_id === tr.id).map((l) => nameFor(l.guest_id)).filter(Boolean).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Packing ---------- */

function PackingCount({ items, checks }: { items: PackingItem[]; checks: Set<string> }) {
  const { t } = useContent();
  if (!items.length) return null;
  const done = items.filter((i) => checks.has(i.id)).length;
  return <p className="mt-6 text-right text-xs font-medium uppercase tracking-[0.14em] text-ember-deep">{done} {t("travel.of")} {items.length} {t("travel.packed")}</p>;
}

function useColumnCap() {
  const [cap, setCap] = useState(4);
  useEffect(() => {
    const update = () => setCap(window.innerWidth < 640 ? 2 : window.innerWidth < 1024 ? 3 : 4);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cap;
}

function PackingList({ categories, items, checks, userId }: {
  categories: PackingCategory[]; items: PackingItem[]; checks: Set<string>; userId: string | undefined;
}) {
  const qc = useQueryClient();
  const [local, setLocal] = useState<Set<string>>(checks);
  useEffect(() => setLocal(checks), [checks]);
  const cap = useColumnCap();
  const cols = packingColumnCount(categories.length + items.length, cap);
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
    <div className="packing-list" style={{ columnCount: cols }}>
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
                    <input type="checkbox" className="packing-checkbox" checked={local.has(item.id)} onChange={() => void toggle(item.id)} />
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
