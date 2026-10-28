import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ComingSoon, FriendsOnly, PageShell, SubTabs } from "@/components/site/Blocks";
import { useContent } from "@/lib/data";
import { useTripClock } from "@/lib/trip-clock";

export const Route = createFileRoute("/purse")({
  head: () => ({
    meta: [
      { title: "Purse · 30° South" },
      { name: "description", content: "Shared experiences and shared expenses, made pretty." },
      { property: "og:title", content: "Purse · 30° South" },
      { property: "og:description", content: "Shared experiences and shared expenses, made pretty." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Purse,
});

type Tab = "experiences" | "expenses" | "sum";

function Purse() {
  const { t } = useContent();
  const { phase } = useTripClock();
  const ids: Tab[] = phase === "after" ? ["experiences", "expenses", "sum"] : ["experiences", "expenses"];
  const [tab, setTab] = useState<Tab>("experiences");
  const current = ids.includes(tab) ? tab : "experiences";
  return (
    <PageShell titleKey="purse.title" introKey="purse.intro">
      <SubTabs tabs={ids.map((id) => ({ id, label: t(`purse.tab.${id}`) }))} value={current} onChange={setTab} />
      <FriendsOnly>
        <ComingSoon />
      </FriendsOnly>
    </PageShell>
  );
}
