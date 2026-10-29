import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ComingSoon, PageShell, SubTabs } from "@/components/site/Blocks";
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

type Tab = "commons" | "reflections" | "heart";

function Journal() {
  const { t } = useContent();
  const [tab, setTab] = useState<Tab>("commons");
  const navigate = useNavigate();
  const location = useLocation();
  const isReflections = location.pathname === "/journal/reflections";
  const current = isReflections ? "reflections" : tab;
  const ids: Tab[] = ["commons", "reflections", "heart"];
  const changeTab = (next: Tab) => {
    if (next === "reflections") void navigate({ to: "/journal/reflections" });
    else { setTab(next); void navigate({ to: "/journal" }); }
  };
  return (
    <PageShell titleKey="journal.title" introKey="journal.intro">
      <SubTabs tabs={ids.map((id) => ({ id, label: t(`journal.tab.${id}`) }))} value={current} onChange={changeTab} />
      {isReflections ? <Outlet /> : <ComingSoon />}
    </PageShell>
  );
}
