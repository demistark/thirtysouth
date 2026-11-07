import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PhotoSlot } from "@/components/site/Blocks";
import { useAuth } from "@/lib/auth";
import { showHeroPlaceholder, useContent, useHomeImage } from "@/lib/data";
import { canEditPurse, canViewPurse, canViewTravel, isTripParticipant } from "@/lib/locked-areas";
import { needsReplyCount } from "@/lib/purse";
import { useExperienceRsvps, useExperiences, usePurseSettings } from "@/lib/purse-data";
import { formatLegDate, formatLegTime, missingFlightDirections, nextLeg } from "@/lib/travel";
import { useMyGuest, useTravelLegs } from "@/lib/travel-data";
import { useTripClock } from "@/lib/trip-clock";
import { heroSubKey, zonedDate, type Phase } from "@/lib/phase";
import { useScenes } from "@/lib/itinerary-data";
import { useDailyVerses, useWeather } from "@/lib/home-during-data";
import {
  datelineFor,
  highlightsForChapter,
  stripTranslation,
  toFahrenheit,
  verseForChapter,
  weatherKind,
  WEATHER_LABELS,
  type WeatherKind,
} from "@/lib/home-during";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { intro?: string } => ({
    ...(typeof search["intro"] === "string" ? { intro: search["intro"] } : {}),
  }),
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
  return phase === "before" ? <HomeBefore /> : phase === "during" ? <HomeDuring /> : <HomePhasePlaceholder />;
}

/* ---------- During: "Your Day" ---------- */

function WeatherIcon({ kind }: { kind: WeatherKind }) {
  const sun = (
    <g className="home-weather-sun">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </g>
  );
  const cloud = <path d="M7 18.5h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 12.2 3.75 3.75 0 0 0 7 18.5Z" />;
  return (
    <svg className="home-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {kind === "clear" && sun}
      {kind === "partly" && (
        <>
          <g className="home-weather-sun">
            <circle cx="8.5" cy="8.5" r="3.2" />
            <path d="M8.5 2.5v1.8M2.5 8.5h1.8M4.2 4.2l1.3 1.3M12.8 4.2l-1.3 1.3" />
          </g>
          <path d="M9.5 19.5h8a3.4 3.4 0 0 0 .5-6.77 4.7 4.7 0 0 0-8.95 1.4 3.2 3.2 0 0 0 .35 5.37Z" />
        </>
      )}
      {kind === "cloudy" && cloud}
      {kind === "fog" && (
        <>
          {cloud}
          <path d="M6 21.5h12M8.5 23.5h7" />
        </>
      )}
      {kind === "drizzle" && (
        <>
          {cloud}
          <path d="M8 21v.8M12 21v.8M16 21v.8" />
        </>
      )}
      {kind === "rain" && (
        <>
          {cloud}
          <path d="M8 20.5v2M12 20.5v2M16 20.5v2" />
        </>
      )}
      {kind === "showers" && (
        <>
          {cloud}
          <path d="M7 20.5v2.5M10.5 20.5v2.5M14 20.5v2.5M17.5 20.5v2.5" />
        </>
      )}
      {kind === "thunderstorm" && (
        <>
          {cloud}
          <path d="M12.5 19.5 10 23h3l-1.5 3" />
        </>
      )}
    </svg>
  );
}

function HomeDuring() {
  const { t } = useContent();
  const { now, currentChapter, settings } = useTripClock();
  const scenes = useScenes(true).data ?? [];
  const verses = useDailyVerses().data ?? [];
  const weather = useWeather();

  const chapterScenes = currentChapter ? scenes.filter((s) => s.chapter_number === currentChapter.number) : [];
  const highlights = highlightsForChapter(chapterScenes);
  const verse = verseForChapter(verses, currentChapter?.number ?? 0);
  const w = weather.data;
  const kind = w ? weatherKind(w.code) : null;

  return (
    <main className="home-during mx-auto max-w-5xl px-5">
      <p className="home-during-dateline label-caps">{datelineFor(now, settings.timezone)}</p>
      <hr className="home-during-rule" />
      <h1 className="home-during-heading">{t("home.during.heading")}</h1>

      {w && kind && (
        <div className="home-weather" aria-label={WEATHER_LABELS[kind]}>
          <p className="home-weather-place label-caps">Cape Town</p>
          <div className="home-weather-grid">
            <WeatherIcon kind={kind} />
            <div>
              <p className="home-weather-temp">
                <span className="home-weather-f">{toFahrenheit(w.celsius)}°F</span>
                <span className="home-weather-c label-caps">{Math.round(w.celsius)}°C</span>
              </p>
              <p className="home-weather-cond">{WEATHER_LABELS[kind]}</p>
            </div>
          </div>
        </div>
      )}

      {currentChapter && (
        <>
          <h2 className="home-during-title">{currentChapter.title}</h2>
          <p className="home-during-summary">{currentChapter.summary}</p>
          <hr className="home-during-rule home-during-rule-gap" />
          {chapterScenes.length === 0 ? (
            <p className="home-hl-rest">{t("home.during.rest")}</p>
          ) : (
            <p className="home-hl">
              {highlights.map((s) => (
                <span key={s.scene_order} className="home-hl-item">
                  <span className="home-hl-dot" aria-hidden />
                  <span className="home-hl-title">{s.title}</span>
                </span>
              ))}
            </p>
          )}
          <p className="home-hl-cta">
            <Link to="/itinerary" search={{ tab: "scenes", day: currentChapter.number }} className="btn-pill btn-pill-ember">
              {t("home.during.button")}
            </Link>
          </p>
          <hr className="home-during-rule" />
        </>
      )}

      {verse && (
        <div className="home-verse">
          <p className="home-verse-text">{verse.text}</p>
          <p className="home-verse-ref label-caps">{stripTranslation(verse.reference)}</p>
        </div>
      )}
    </main>
  );
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
  const { isHost } = useAuth();
  const hero = useHomeImage("hero").data;
  return (
    <main>
      <section className={cn("relative pb-7 md:pb-12", !hero?.url && "hero-sky")}>
        {hero?.url ? (
          <img
            src={hero.url}
            alt={hero.image?.alt ?? ""}
            className="h-[clamp(300px,50vw,640px)] w-full object-cover"
            style={{ objectPosition: `${hero.image?.focal_x ?? 50}% ${hero.image?.focal_y ?? 50}%` }}
          />
        ) : showHeroPlaceholder(isHost, false) ? (
          <PhotoSlot caption="Add in Admin › Home" className="h-[clamp(220px,34vw,420px)] w-full items-start border-0 bg-transparent" />
        ) : (
          <div className="h-[clamp(220px,34vw,420px)] w-full" aria-hidden />
        )}
        <div className={cn("home-hero-wrap mx-auto max-w-5xl px-5", hero?.url ? "-mt-28 md:-mt-36" : "-mt-[60px] md:-mt-[70px]")}>
          <div className="fade-in border bg-card p-[22px_20px] text-center sm:p-[31px_24px] md:p-[31px_64px]">
            <p className="label-caps whitespace-nowrap text-muted-foreground">{t("home.hero.place")}</p>
            <h1 className="home-hero-wordmark wordmark mt-4 whitespace-nowrap sm:mt-[13px]">30° South</h1>
            <p className="label-caps mt-3 text-foreground sm:mt-[11px]">{t("home.hero.dates")}</p>
            <div className="mx-auto mt-[19px] h-px w-16 bg-border sm:mt-4" />
            <p className="mb-0 mt-[15px] font-display-light text-3xl sm:mt-4">
              <span className="text-ember">{daysToGo}</span>{" "}
              {t(daysToGo === 1 ? "home.hero.day_to_go" : "home.hero.days_to_go")}
            </p>
            <p className="caption-serif mx-auto mt-1.5 hidden text-base sm:block sm:mt-2.5 sm:text-[17px]">{t(heroSubKey(daysToGo))}</p>
          </div>
        </div>
      </section>

      <LookAround />
    </main>
  );
}

const LOOK_LINKS = [
  { n: "01", to: "/itinerary", nameKey: "nav.itinerary", descKey: "home.look.itinerary" },
  { n: "02", to: "/travel", nameKey: "nav.travel", descKey: "home.look.travel" },
  { n: "03", to: "/purse", nameKey: "nav.purse", descKey: "home.look.purse" },
  { n: "04", to: "/journal", nameKey: "nav.journal", descKey: "home.look.journal" },
] as const;

function LookAround() {
  const { t } = useContent();
  return (
    <section data-home-first-card className="home-look mx-auto px-5 md:max-w-none md:px-[clamp(20px,6.5vw,120px)]">
      <p className="home-look-label label-caps">{t("home.look.heading")}</p>
      <div className="home-look-list">
        {LOOK_LINKS.map((l) => (
          <Link key={l.n} to={l.to} className="home-look-bar">
            <span className="home-look-num">{l.n}</span>
            <span>
              <span className="home-look-name block">{t(l.nameKey)}</span>
              <span className="home-look-desc mt-2 block md:mt-2.5">{t(l.descKey)}</span>
              {l.to === "/purse" && <PurseRsvpWaiting />}
            </span>
            <svg className="home-look-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </div>
    </section>
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

/** "• N RSVPs to complete" under the Purse bar — trip participants with replies owed only. */
export function PurseRsvpWaiting() {
  const { t } = useContent();
  const { session, roles } = useAuth();
  const allowed = !!session && isTripParticipant(roles);
  const myGuest = useMyGuest(allowed);
  const exps = useExperiences(allowed);
  const rsvps = useExperienceRsvps(allowed);
  const settings = usePurseSettings(allowed);
  if (!allowed || !myGuest.data) return null;
  const count = needsReplyCount(exps.data ?? [], rsvps.data ?? [], myGuest.data);
  const closed = (settings.data?.globalLock ?? false) && !canEditPurse(roles);
  if (!count || closed) return null;
  return (
    <span className="home-look-rsvp">
      <span className="home-look-rsvp-dot" aria-hidden="true" />
      {t(count === 1 ? "home.rsvp_waiting_one" : "home.rsvp_waiting_other").replace("{n}", String(count))}
    </span>
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
