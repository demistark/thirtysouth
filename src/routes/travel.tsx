import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon, PageShell } from "@/components/site/Blocks";
import { TravelLockout } from "@/components/site/Lockouts";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/travel")({
  head: () => ({
    meta: [
      { title: "Travel · 30° South" },
      { name: "description", content: "Flights, the villa, what to pack, and who’s coming." },
      { property: "og:title", content: "Travel · 30° South" },
      { property: "og:description", content: "Flights, the villa, what to pack, and who’s coming." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Travel,
});

function Travel() {
  const { isFriend, loading } = useAuth();
  return (
    <PageShell titleKey="travel.title" introKey="travel.intro">
      {loading ? <div className="min-h-80 bg-band-sage" /> : isFriend ? <ComingSoon /> : <TravelLockout />}
    </PageShell>
  );
}
