import { createFileRoute } from "@tanstack/react-router";
import { ReflectionsDescription, ReflectionsLockout } from "@/components/site/Lockouts";
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
  const { isFriend, roles, loading } = useAuth();
  if (loading) return <div className="min-h-80 bg-paper" />;
  const allowed = isFriend || roles.includes("honorary_guest");
  return allowed ? <section className="lockout-band bg-paper"><ReflectionsDescription /></section> : <ReflectionsLockout />;
}