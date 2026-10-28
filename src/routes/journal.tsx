import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ComingSoon, FriendsOnly, PageShell, SubTabs } from "@/components/site/Blocks";
import { useContent } from "@/lib/data";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Journal · 30° South" },
      { name: "description", content: "The stories in between: photographs, shared stories and words sent with love." },
      { property: "og:title", content: "Journal · 30° South" },
      { property: "og:description", content: "The stories in between." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Journal,
});

type Tab = "commons" | "personal" | "heart";

function Journal() {
  const { t } = useContent();
  const [tab, setTab] = useState<Tab>("commons");
  const ids: Tab[] = ["commons", "personal", "heart"];
  return (
    <PageShell titleKey="journal.title" introKey="journal.intro">
      <SubTabs tabs={ids.map((id) => ({ id, label: t(`journal.tab.${id}`) }))} value={tab} onChange={setTab} />
      {tab === "personal" ? (
        <FriendsOnly>
          <ComingSoon />
        </FriendsOnly>
      ) : (
        <ComingSoon />
      )}
    </PageShell>
  );
}
