import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon, FriendsOnly, PageShell } from "@/components/site/Blocks";

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
  component: () => (
    <PageShell titleKey="travel.title" introKey="travel.intro">
      <FriendsOnly>
        <ComingSoon />
      </FriendsOnly>
    </PageShell>
  ),
});
