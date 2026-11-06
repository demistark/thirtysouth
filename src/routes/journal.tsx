import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, SubTabs } from "@/components/site/Blocks";
import { JournalCommons } from "@/components/site/JournalCommons";
import { JournalHeart } from "@/components/site/JournalHeart";
import { FactLockout, JOURNAL_LOCKOUT_TONE } from "@/components/site/Lockouts";
import { useAuth } from "@/lib/auth";
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
  const { session, loading } = useAuth();
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
  if (loading) {
    return (
      <PageShell titleKey={isReflections ? "journal.reflections.title" : "journal.title"} introKey="journal.intro">
        <div className={`min-h-80 ${JOURNAL_LOCKOUT_TONE}`} />
      </PageShell>
    );
  }
  if (!session) {
    return (
      <PageShell titleKey={isReflections ? "journal.reflections.title" : "journal.title"} introKey="journal.intro">
        <FactLockout tone={JOURNAL_LOCKOUT_TONE} />
      </PageShell>
    );
  }
  return (
    <PageShell titleKey={isReflections ? "journal.reflections.title" : "journal.title"} introKey="journal.intro">
      <SubTabs tabs={ids.map((id) => ({ id, label: t(`journal.tab.${id}`) }))} value={current} onChange={changeTab} />
      {isReflections ? <Outlet /> : current === "commons" ? <JournalCommons /> : <JournalHeart />}
    </PageShell>
  );
}
