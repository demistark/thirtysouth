import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useContent } from "@/lib/data";
import { preparePhoto } from "@/lib/image-resize";
import { EMPTY_EXPERIENCE_PHOTO, experiencePhotoStyle, normalizeExperiencePhoto, type ExperiencePhoto } from "@/lib/experience-photo";
import { toast } from "sonner";

export function ExperiencePhotoEditor({ photo, url, onChange, onBusy }: { photo: ExperiencePhoto; url?: string; onChange: (photo: ExperiencePhoto, blob?: Blob | null) => void; onBusy: (busy: boolean) => void }) {
  const { t } = useContent();
  const input = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  const upload = async (file: File) => {
    setBusy(true); onBusy(true);
    try {
      const blob = await preparePhoto(file, { maxEdge: 1600 });
      setLocalUrl(URL.createObjectURL(blob));
      onChange({ ...photo, photo_path: "pending", photo_focal_x: 50, photo_focal_y: 50, photo_zoom: 1 }, blob);
    } catch { toast.error(t("admin.itin.photo_error")); }
    finally { setBusy(false); onBusy(false); if (input.current) input.current.value = ""; }
  };
  const source = photo.photo_path ? localUrl ?? url : undefined;
  return <div className="md:col-span-2 space-y-3">
    <p className="label-caps text-muted-foreground">{t("admin.purse.photo")}</p>
    <div className="grid grid-cols-2 items-start gap-3">
      {(["phone", "desktop"] as const).map((shape) => <div key={shape} className="min-w-0 space-y-1">
        <p className="label-caps text-muted-foreground">{t(`admin.purse.photo_${shape}`)}</p>
        <Button type="button" variant="ghost" disabled={!source || busy} className={`exp-photo-preview exp-photo-preview-${shape}`} title={t("admin.purse.photo_focal")} aria-label={`${t(`admin.purse.photo_${shape}`)}: ${t("admin.purse.photo_focal")}`} onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onChange(normalizeExperiencePhoto({ ...photo, photo_focal_x: (event.clientX - rect.left) / rect.width * 100, photo_focal_y: (event.clientY - rect.top) / rect.height * 100 }));
        }}>
          {source ? <img src={source} alt={photo.photo_alt} style={experiencePhotoStyle(photo)} /> : <span>{t("admin.purse.photo_empty")}</span>}
        </Button>
      </div>)}
    </div>
    <label className="block space-y-1"><span className="label-caps text-muted-foreground">{t("admin.purse.photo_alt")}</span><input className="field" value={photo.photo_alt} onChange={(event) => onChange({ ...photo, photo_alt: event.target.value })} /></label>
    <label className="flex items-center gap-3"><span className="label-caps text-muted-foreground">{t("admin.purse.photo_zoom")}</span><input className="min-w-0 flex-1" type="range" min={1} max={3} step={0.05} value={photo.photo_zoom} disabled={!photo.photo_path} onChange={(event) => onChange(normalizeExperiencePhoto({ ...photo, photo_zoom: Number(event.target.value) }))} /><output className="text-sm">{photo.photo_zoom.toFixed(2)}×</output></label>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="pill" disabled={busy} onClick={() => input.current?.click()}>{busy ? "…" : t(photo.photo_path ? "admin.purse.photo_replace" : "admin.purse.photo_add")}</Button>
      {photo.photo_path && <Button type="button" variant="pill" disabled={busy} onClick={() => { setLocalUrl(undefined); onChange({ ...EMPTY_EXPERIENCE_PHOTO }, null); }}>{t("admin.purse.photo_remove")}</Button>}
      <input ref={input} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" aria-label={t("admin.purse.photo_add")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    </div>
  </div>;
}