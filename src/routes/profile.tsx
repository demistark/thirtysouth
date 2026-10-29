import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageShell, FriendsGate } from "@/components/site/Blocks";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import { photoValidation, resizePhoto } from "@/lib/profile-photo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [
    { title: "My profile · 30° South" },
    { name: "description", content: "Your private profile photo for 30° South." },
    { property: "og:title", content: "My profile · 30° South" },
    { property: "og:description", content: "Your private profile photo for 30° South." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Profile,
});

function Profile() {
  const { session, roles, displayName, loading } = useAuth();
  const { t } = useContent();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const userId = session?.user.id;
  const eligible = roles.some((role) => ["host", "trip_guest", "friend_afar"].includes(role));
  const q = useQuery({
    queryKey: ["my-profile", userId, "photo"], enabled: !!userId && eligible,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_profile");
      if (error) throw error;
      const path = data?.[0]?.photo_url;
      if (!path) return { path: null, url: null };
      const { data: signed, error: signingError } = await supabase.storage.from("guest-photos").createSignedUrl(path, 3600);
      if (signingError) throw signingError;
      return { path, url: signed.signedUrl };
    },
    staleTime: 30 * 60_000,
  });
  const changePhoto = async (file?: File) => {
    if (!userId || busy) return;
    if (file) {
      const invalid = photoValidation(file);
      if (invalid) { toast.error(t(invalid === "type" ? "profile.invalid_type" : "profile.too_large")); return; }
    }
    setBusy(true);
    let uploaded: string | null = null;
    try {
      if (pendingDelete) {
        const { error } = await supabase.storage.from("guest-photos").remove([pendingDelete]);
        if (error) throw error;
        setPendingDelete(null);
      }
      if (file) {
        const blob = await resizePhoto(file);
        uploaded = `${userId}/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage.from("guest-photos").upload(uploaded, blob, { contentType: "image/webp" });
        if (error) throw error;
      }
      const { error } = await supabase.rpc("set_my_photo", uploaded ? { path: uploaded } : {});
      if (error) {
        if (uploaded) await supabase.storage.from("guest-photos").remove([uploaded]);
        throw error;
      }
      if (q.data?.path) {
        const oldPath = q.data.path;
        const { error: cleanup } = await supabase.storage.from("guest-photos").remove([oldPath]);
        if (cleanup) { setPendingDelete(oldPath); toast.error(t("profile.cleanup_error")); }
      }
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      await qc.invalidateQueries({ queryKey: ["admin", "guests"] });
      toast.success(t(file ? "profile.saved" : "profile.removed"));
    } catch { toast.error(t("profile.error")); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  return <PageShell titleKey="profile.title" introKey="profile.intro">
    {loading ? <div className="h-48 bg-paper" /> : !session || !eligible ? <FriendsGate /> : <div className="space-y-6">
      <p className="font-display-light text-2xl">{displayName}</p>
      {q.data?.url ? <img src={q.data.url} alt={t("profile.photo")} className="h-48 w-48 rounded-full border object-cover" /> : <div className="h-48 w-48 rounded-full border bg-paper" />}
      {(q.isError) && <p className="text-sm text-rust">{t("profile.error")}</p>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void changePhoto(file); }} />
      <div className="flex flex-wrap gap-3">
        <Button variant="pill" disabled={busy || q.isLoading || q.isError} onClick={() => input.current?.click()}>{t(q.data?.path ? "profile.replace" : "profile.upload")}</Button>
        {(q.data?.path || pendingDelete) && <Button variant="pill" disabled={busy || q.isLoading} onClick={() => void changePhoto()}>{t("profile.remove")}</Button>}
      </div>
    </div>}
  </PageShell>;
}