import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PhotoSlot } from "@/components/site/Blocks";
import { useContent } from "@/lib/data";
import { useTripClock } from "@/lib/trip-clock";
import type { Phase } from "@/lib/phase";
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
        <h1 className="font-display-light mt-4 text-5xl">
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
  return (
    <main>
      <section className="relative">
        <PhotoSlot className="h-[62vh] min-h-[420px] w-full items-start border-x-0 border-t-0" />
        <div className="mx-auto -mt-28 max-w-5xl px-5 md:-mt-36">
          <div className="fade-in border bg-card px-6 py-10 text-center md:px-16 md:py-14">
            <p className="label-caps text-muted-foreground">{t("home.hero.welcome")}</p>
            <h1 className="wordmark mt-5 text-5xl !tracking-[0.18em] sm:text-7xl md:text-8xl">30° South</h1>
            <p className="label-caps mt-6 text-foreground">{t("home.hero.place")}</p>
            <div className="mx-auto mt-8 h-px w-16 bg-border" />
            <p className="mt-6 font-display-light text-3xl">
              <span className="text-primary">{daysToGo}</span>{" "}
              {t(daysToGo === 1 ? "home.hero.day_to_go" : "home.hero.days_to_go")}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-20 flex max-w-6xl flex-col gap-6 px-5">
        <MomentsCard />
        <SectionCard n={2} to="/itinerary" band="tan" />
        <SectionCard n={3} to="/travel" band="sage" />
        <SectionCard n={4} to="/purse" band="tan" />
        <SectionCard n={5} to="/journal" band="sage" polaroid />
      </div>
    </main>
  );
}

function CardFrame({ band, children }: { band: "sage" | "tan"; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "grid gap-8 border p-6 md:grid-cols-[1.1fr_1fr] md:items-center md:p-12",
        band === "sage" ? "bg-band-sage" : "bg-band-tan",
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
    <CardFrame band="sage">
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
                "label-caps -mb-px border-b py-2 transition-colors",
                tab === p ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
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

function SectionCard({
  n,
  to,
  band,
  polaroid,
}: {
  n: number;
  to: "/itinerary" | "/travel" | "/purse" | "/journal";
  band: "sage" | "tan";
  polaroid?: boolean;
}) {
  const { t } = useContent();
  const k = (s: string) => t(`home.card${n}.${s}`);
  return (
    <CardFrame band={band}>
      <div>
        <p className="eyebrow">{k("eyebrow")}</p>
        <h2 className="font-display-light mt-4 text-4xl md:text-5xl">{k("headline")}</h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{k("sentence")}</p>
        <Link to={to} className="btn-pill mt-8">
          {k("button")}
        </Link>
      </div>
      {polaroid ? (
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
