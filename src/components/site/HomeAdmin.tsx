import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useContent } from "@/lib/data";
import { HOME_BUCKET, type HomeImage } from "@/lib/data";
import { preparePhoto, photoExtension } from "@/lib/image-resize";

/** Admin › Home: the hero image slot (upload, replace, focus point, alt text). */
export function HomeAdmin() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "home-images"],
    queryFn: async () => {
      const { data, error } = await supabase.from("home_images").select("*");
      if (error) throw error;
      const rows = (data ?? []) as HomeImage[];
      let urls: Record<string, string> = {};
      if (rows.length) {
        const { data: signed } = await supabase.storage.from(HOME_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600);
        urls = Object.fromEntries((signed ?? []).filter((d) => d.signedUrl).map((d) => [d.path ?? "", d.signedUrl!]));
      }
      return { rows, urls };
    },
  });
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "home-images"] });
    await qc.invalidateQueries({ queryKey: ["home-image"] });
  };
  if (q.isPending) return <div className="h-64 border bg-card" />;
  const hero = q.data?.rows.find((r) => r.slot === "hero");
  return (
    <div className="max-w-xl space-y-8">
      <HomeImageSlot image={hero} url={hero ? q.data?.urls[hero.storage_path] : undefined} onDone={refresh} />
      <VersesAdmin />
    </div>
  );
}

/** Admin › Home › Verses: one row per chapter plus the fallback. */
function VersesAdmin() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "daily-verses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_verses").select("chapter_number,text,reference").order("chapter_number");
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = q.data ?? [];
  const chapters = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0];
  return (
    <div>
      <p className="label-caps text-muted-foreground">Verses</p>
      <ul className="mt-3 space-y-4">
        {chapters.map((n) => (
          <VerseRow key={`${n}-${rows.find((r) => r.chapter_number === n)?.text ?? ""}`} chapter={n} row={rows.find((r) => r.chapter_number === n)} onDone={() => qc.invalidateQueries({ queryKey: ["admin", "daily-verses"] })} />
        ))}
      </ul>
    </div>
  );
}

function VerseRow({ chapter, row, onDone }: { chapter: number; row?: { chapter_number: number; text: string; reference: string } | undefined; onDone: () => Promise<void> }) {
  const { t } = useContent();
  const [text, setText] = useState(row?.text ?? "");
  const [reference, setReference] = useState(row?.reference ?? "");
  const save = async () => {
    const { error } = await supabase.from("daily_verses").upsert({ chapter_number: chapter, text: text.trim(), reference: reference.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin.itin.saved"));
    await onDone();
  };
  return (
    <li className="border bg-card p-4">
      <p className="label-caps text-muted-foreground">{chapter === 0 ? "Fallback" : `Chapter ${chapter}`}</p>
      <textarea className="field mt-3 min-h-20" placeholder="Verse text" value={text} onChange={(e) => setText(e.target.value)} aria-label={`Verse text, ${chapter === 0 ? "fallback" : `chapter ${chapter}`}`} />
      <input className="field mt-2" placeholder="Psalm 121:8" value={reference} onChange={(e) => setReference(e.target.value)} aria-label={`Verse reference, ${chapter === 0 ? "fallback" : `chapter ${chapter}`}`} />
      <p className="caption-serif mt-1 text-sm text-muted-foreground">Book, chapter and verse only (for example Psalm 121:8). No translation.</p>
      <button className="btn-pill mt-3" onClick={() => void save()}>{t("admin.itin.save")}</button>
    </li>
  );
}

function HomeImageSlot({ image, url, onDone }: { image?: HomeImage | undefined; url?: string | undefined; onDone: () => Promise<void> }) {
  const { t } = useContent();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [alt, setAlt] = useState(image?.alt ?? "");
  useEffect(() => { setAlt(image?.alt ?? ""); }, [image]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const blob = await preparePhoto(file);
      const path = `hero/${crypto.randomUUID()}.${photoExtension(blob.type)}`;
      const { error } = await supabase.storage.from(HOME_BUCKET).upload(path, blob, { contentType: blob.type });
      if (error) throw error;
      if (image?.storage_path) await supabase.storage.from(HOME_BUCKET).remove([image.storage_path]);
      const { error: uErr } = await supabase.from("home_images").upsert({ slot: "hero", storage_path: path, alt });
      if (uErr) throw uErr;
      toast.success(t("admin.itin.saved"));
      await onDone();
    } catch {
      toast.error(t("admin.itin.photo_error"));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const setFocal = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!image) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const focal_x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const focal_y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const { error } = await supabase.from("home_images").update({ focal_x, focal_y }).eq("slot", "hero");
    if (error) toast.error(error.message); else await onDone();
  };

  const saveAlt = async () => {
    if (!image) return;
    const { error } = await supabase.from("home_images").update({ alt }).eq("slot", "hero");
    if (error) toast.error(error.message); else { toast.success(t("admin.itin.saved")); await onDone(); }
  };

  return (
    <div className="border bg-card p-4">
      <p className="label-caps text-muted-foreground">Hero</p>
      {image && url ? (
        <img
          src={url}
          alt={image.alt}
          onClick={(e) => void setFocal(e)}
          className="mt-3 aspect-[3/2] w-full cursor-crosshair border object-cover"
          style={{ objectPosition: `${image.focal_x}% ${image.focal_y}%` }}
          title="Tap to set the focal point"
        />
      ) : (
        <div className="mt-3 flex aspect-[3/2] items-center justify-center border bg-paper text-xs text-muted-foreground">No image yet</div>
      )}
      <div className="mt-3">
        <input className="field" placeholder="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} aria-label="Alt text" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-pill" disabled={uploading} onClick={() => input.current?.click()}>{uploading ? "…" : t("admin.itin.upload")}</button>
        {image && <button className="btn-pill" onClick={saveAlt}>{t("admin.itin.save")}</button>}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          className="hidden"
          aria-label={t("admin.itin.upload")}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
        />
      </div>
    </div>
  );
}
