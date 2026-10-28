import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ComingSoon, FriendsOnly, PageShell, SubTabs } from "@/components/site/Blocks";
import { formatChapterDate, useChapters, useContent } from "@/lib/data";
import { useTripClock } from "@/lib/trip-clock";

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
  const { phase } = useTripClock();
  const order: Tab[] = phase === "during" ? ["scenes", "wardrobe", "script"] : ["script", "scenes", "wardrobe"];
  const [tab, setTab] = useState<Tab>(order[0]!);
  useEffect(() => setTab(order[0]!), [phase]);

  return (
    <PageShell titleKey="itinerary.title" introKey="itinerary.intro">
      <SubTabs tabs={order.map((id) => ({ id, label: t(`itinerary.tab.${id}`) }))} value={tab} onChange={setTab} />
      {tab === "script" ? (
        <Script />
      ) : (
        <FriendsOnly>
          <ComingSoon />
        </FriendsOnly>
      )}
    </PageShell>
  );
}

function Script() {
  const { data, isLoading } = useChapters();
  if (isLoading) return <div className="h-64 border bg-card" />;
  return (
    <ol className="fade-in divide-y border-y">
      {(data ?? []).map((c) => (
        <li key={c.number} className="grid gap-2 py-6 md:grid-cols-[8rem_1fr] md:gap-8">
          <div>
            <p className="eyebrow">Chapter {c.number}</p>
            <p className="label-caps mt-1 text-muted-foreground">{formatChapterDate(c.date)}</p>
          </div>
          <div>
            <h3 className="font-display-light text-2xl md:text-3xl">{c.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.summary}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
