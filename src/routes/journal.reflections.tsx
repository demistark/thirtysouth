import { createFileRoute } from "@tanstack/react-router";
import { JournalReflections } from "@/components/site/JournalReflections";
import { ReflectionsLockout } from "@/components/site/Lockouts";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/journal/reflections")({
  head: () => ({ meta: [
    { title: "Reflections · 30° South" },
    { name: "description", content: "A personal, private space for reflections on 30° South." },
    { property: "og:title", content: "Reflections · 30° South" },
    { property: "og:description", content: "A personal, private space for reflections on 30° South." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Reflections,
});

function Reflections() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-80 bg-paper" />;
  if (!session) return <ReflectionsLockout />;
  return <JournalReflections />;
}
