import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { photoExtension } from "./image-resize";

export const EXPERIENCE_PHOTO_BUCKET = "experience-photos";
export const EMPTY_EXPERIENCE_PHOTO = { photo_path: null as string | null, photo_alt: "", photo_focal_x: 50, photo_focal_y: 50, photo_zoom: 1 };
export type ExperiencePhoto = typeof EMPTY_EXPERIENCE_PHOTO;
const clamp = (value: number, min: number, max: number, fallback: number) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export function normalizeExperiencePhoto(photo: Partial<ExperiencePhoto>): ExperiencePhoto {
  if (!photo.photo_path) return { ...EMPTY_EXPERIENCE_PHOTO };
  return { photo_path: photo.photo_path, photo_alt: photo.photo_alt ?? "", photo_focal_x: Math.round(clamp(photo.photo_focal_x ?? 50, 0, 100, 50)), photo_focal_y: Math.round(clamp(photo.photo_focal_y ?? 50, 0, 100, 50)), photo_zoom: clamp(photo.photo_zoom ?? 1, 1, 3, 1) };
}
export function experiencePhotoStyle(photo: Partial<ExperiencePhoto>): CSSProperties {
  const p = normalizeExperiencePhoto(photo);
  return { objectPosition: `${p.photo_focal_x}% ${p.photo_focal_y}%`, transformOrigin: `${p.photo_focal_x}% ${p.photo_focal_y}%`, transform: `scale(${p.photo_zoom})` };
}

/** Upload first, persist the form, then remove the previous file; a failed save keeps the old photo intact. */
export async function saveExperiencePhoto(id: string, photo: ExperiencePhoto, blob: Blob | null, oldPath: string | null, persist: (photo: ExperiencePhoto) => Promise<void>) {
  const bucket = supabase.storage.from(EXPERIENCE_PHOTO_BUCKET);
  let uploaded: string | null = null;
  let next = normalizeExperiencePhoto(photo);
  if (blob) {
    uploaded = `experiences/${id}/${crypto.randomUUID()}.${photoExtension(blob.type)}`;
    const { error } = await bucket.upload(uploaded, blob, { contentType: blob.type });
    if (error) throw error;
    next = normalizeExperiencePhoto({ ...photo, photo_path: uploaded });
  }
  try { await persist(next); }
  catch (error) { if (uploaded) await bucket.remove([uploaded]); throw error; }
  if (oldPath && oldPath !== next.photo_path) {
    const { error } = await bucket.remove([oldPath]);
    if (error) throw error;
  }
}