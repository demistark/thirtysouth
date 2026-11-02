import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PhotoSlot } from "@/components/site/Blocks";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import { canViewPurse, canViewTravel, isTripParticipant } from "@/lib/locked-areas";
import { needsReplyCount } from "@/lib/purse";
import { useExperienceRsvps, useExperiences } from "@/lib/purse-data";
import { formatLegDate, formatLegTime, nextLeg } from "@/lib/travel";
import { useMyGuest, useTravelLegs } from "@/lib/travel-data";
import { useTripClock } from "@/lib/trip-clock";
import { zonedDate, type Phase } from "@/lib/phase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "30° South · Demilade’s 30th in Cape Town" },
      { name: "description", content: "The trip companion for Demilade’s 30th birthday in Cape Town, November 2026." },
      { property: "og:title", content: "30° South · Demilade’s 30th in Cape Town" },
      { property: "og:description", content: "The trip companion for Demilade’s 30th birthday in Cape Town." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const { phase } = useTripClock();
  return phase === "before" ? <HomeBefore /> : <HomePhasePlaceholder />;
}

function HomePhasePlaceholder() {
  const { t } = useContent();
  const { phase, currentChapter } = useTripClock();
  return (
    <main className="mx-auto max-w-4xl px-5 pt-20">
      <div className="fade-in border bg-card px-6 py-20 text-center">
        <p className="eyebrow">{phase === "during" ? "During" : "After"}</p>
        <h1 className="font-display-light mt-4 text-5xl text-deep-atlantic">
          {t(phase === "during" ? "home.during.title" : "home.after.title")}
        </h1>
        {currentChapter && (
          <p className="caption-serif mt-4 text-lg">
            Chapter {currentChapter.number} · {currentChapter.title}
          </p>
        )}
        <p className="label-caps mt-8 text-muted-foreground">{t("common.coming_soon")}</p>
      </div>
    </main>
  );
}

function HomeBefore() {
  const { t } = useContent();
  const { daysToGo } = useTripClock();
  const { session, roles } = useAuth();
  const showTravel = !session || canViewTravel(roles);
  const showPurse = !session || canViewPurse(roles);
  return (
    <main>
      <section className="hero-sky relative pb-16 md:pb-20">
        <PhotoSlot className="h-[62vh] min-h-[420px] w-full items-start border-0 bg-transparent" />
        <div className="mx-auto -mt-28 max-w-5xl px-5 md:-mt-36">
          <div className="fade-in border bg-card px-6 py-10 text-center md:px-16 md:py-14">
            <p className="label-caps text-muted-foreground">{t("home.hero.welcome")}</p>
            <h1 className="home-hero-wordmark wordmark mt-3 whitespace-nowrap text-[3rem] !tracking-[0] sm:mt-5 sm:text-7xl sm:!tracking-[0.18em] md:text-8xl">30° South</h1>
            <p className="label-caps mt-4 text-foreground sm:mt-6">
              <span className="hidden sm:inline">{t("home.hero.place")}</span>
              <span className="sm:hidden">{t("home.hero.place").split(/\s*·\s*/).map((line, i) => <span key={i} className="block">{line}</span>)}</span>
            </p>
            <div className="mx-auto mt-5 h-px sm:mt-8 w-16 bg-border" />
            <p className="mt-4 font-display-light text-3xl sm:mt-6">
              <span className="text-ember">{daysToGo}</span>{" "}
              {t(daysToGo === 1 ? "home.hero.day_to_go" : "home.hero.days_to_go")}
            </p>
          </div>
        </div>
      </section>

      <div data-home-first-card className="mx-auto mt-20 flex max-w-6xl flex-col gap-6 px-5">
        <MomentsCard />
        <SectionCard n={2} to="/itinerary" tint="bg-sandstone" />
        {showTravel && <SectionCard n={3} to="/travel" tint="bg-tint-ember" hash="flights" live={<TravelLiveLine />} />}
        {showPurse && <SectionCard n={4} to="/purse" tint="bg-tint-ember" live={<PurseLiveLine />} />}
        <SectionCard n={5} to="/journal" tint="bg-tint-teal" polaroid />
      </div>
    </main>
  );
}

function CardFrame({ tint, children, textOnly = false }: { tint: string; children: React.ReactNode; textOnly?: boolean }) {
  return (
    <section
      className={cn(
        "band-ink grid gap-8 border p-6 md:items-center md:p-12",
        !textOnly && "md:grid-cols-[1.1fr_1fr]",
        tint,
      )}
    >
      {children}
    </section>
  );
}

function MomentsCard() {
  const { t } = useContent();
  const [tab, setTab] = useState<Phase>("before");
  return (
    <CardFrame tint="bg-seafoam">
      <div>
        <p className="eyebrow">{t("home.card1.eyebrow")}</p>
        <h2 className="font-display-light mt-4 text-4xl md:text-5xl">{t("home.card1.headline")}</h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{t("home.card1.sentence")}</p>
        <div className="mt-8 flex gap-5 border-b" role="tablist">
          {(["before", "during", "after"] as const).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={tab === p}
              onClick={() => setTab(p)}
              className={cn(
                "label-caps -mb-px border-b-[2.5px] pb-3 pt-2 transition-colors",
                tab === p ? "border-ember text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <div key={tab} className="fade-in mt-5">
          <p className="font-display-light text-2xl">{t(`home.card1.${tab}.heading`)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t(`home.card1.${tab}.sentence`)}</p>
        </div>
      </div>
      <PhotoSlot className="aspect-[4/3] w-full" />
    </CardFrame>
  );
}

function TravelLiveLine() {
  const { t } = useContent();
  const { session, roles } = useAuth();
  const { now, settings } = useTripClock();
  const allowed = !!session && canViewTravel(roles);
  const myGuest = useMyGuest(allowed);
  const legs = useTravelLegs(allowed);
  const leg = nextLeg(legs.data ?? [], myGuest.data, zonedDate(now, settings.timezone));
  if (!leg) return null;
  return (
    <p className="label-caps mt-4 text-ember-deep">
      {t(leg.direction === "arrival" ? "home.card3.live_arrival" : "home.card3.live_departure")}: {formatLegDate(leg.cpt_time)}, {formatLegTime(leg.cpt_time)}
    </p>
  );
}

function PurseLiveLine() {
  const { t } = useContent();
  const { session, roles } = useAuth();
  const allowed = !!session && isTripParticipant(roles);
  const myGuest = useMyGuest(allowed);
  const exps = useExperiences(allowed);
  const rsvps = useExperienceRsvps(allowed);
  const count = needsReplyCount(exps.data ?? [], rsvps.data ?? [], myGuest.data);
  if (!count) return null;
  return (
    <p className="label-caps mt-4 text-ember-deep">
      {count} {t(count === 1 ? "home.card4.live_reply_one" : "home.card4.live_reply")}
    </p>
  );
}

function SectionCard({
  n,
  to,
  tint,
  polaroid,
  hash,
  live,
}: {
  n: number;
  to: "/itinerary" | "/travel" | "/purse" | "/journal";
  tint: string;
  polaroid?: boolean;
  hash?: string;
  live?: React.ReactNode;
}) {
  const { t } = useContent();
  const k = (s: string) => t(`home.card${n}.${s}`);
  return (
    <CardFrame tint={tint} textOnly={n === 2 || n === 4}>
      <div>
        <p className="eyebrow">{k("eyebrow")}</p>
        <h2 className="font-display-light mt-4 text-4xl md:text-5xl">{k("headline")}</h2>
        <p className={cn("mt-4 text-sm leading-relaxed text-muted-foreground", n !== 2 && n !== 4 && "max-w-md")}>{k("sentence")}</p>
        {live}
        <Link to={to} {...(hash ? { hash } : {})} className="btn-pill mt-8">
          {k("button")}
        </Link>
      </div>
      {n === 2 || n === 4 ? null : polaroid ? (
        <div className="relative mx-auto w-full max-w-sm py-6">
          <figure className="rotate-[-3deg] bg-card p-3 pb-4 shadow-[var(--shadow-polaroid)]">
            <PhotoSlot className="aspect-square w-full" caption="" />
            <figcaption className="caption-serif mt-3 text-center text-sm">{k("caption")}</figcaption>
          </figure>
          <div className="absolute -right-2 -top-1 w-36 rotate-[4deg] bg-ochre p-3 md:-right-6">
            <p className="caption-serif text-sm !text-foreground">{k("note")}</p>
          </div>
        </div>
      ) : (
        <PhotoSlot className="aspect-[4/3] w-full" />
      )}
    </CardFrame>
  );
}
