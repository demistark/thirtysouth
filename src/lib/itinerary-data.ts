import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Chapter, PaletteItem, Scene, WardrobeLook } from "./itinerary";

export const toScene = (r: Record<string, unknown>) => r as unknown as Scene;
export const toLook = (r: Record<string, unknown>): WardrobeLook => ({
  ...(r as unknown as WardrobeLook),
  palette: Array.isArray(r["palette"]) ? (r["palette"] as PaletteItem[]) : [],
  photos: Array.isArray(r["photos"]) ? (r["photos"] as string[]) : [],
});

export function useScenes(enabled: boolean) {
  return useQuery({
    queryKey: ["scenes"], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("scenes").select("*").eq("visible", true).order("chapter_number").order("scene_order");
      if (error) throw error;
      return (data ?? []).map(toScene);
    },
  });
}

export function useLooks(enabled: boolean) {
  return useQuery({
    queryKey: ["wardrobe_looks"], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("wardrobe_looks").select("*").eq("visible", true).order("chapter_number").order("look_order");
      if (error) throw error;
      return (data ?? []).map(toLook);
    },
  });
}

export function usePhotoUrls(paths: string[]) {
  return useQuery({
    queryKey: ["wardrobe-photo-urls", paths], enabled: paths.length > 0, staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("wardrobe-photos").createSignedUrls(paths, 3600);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((d) => [d.path ?? "", d.signedUrl]));
    },
  });
}

export async function fetchAllChapters(): Promise<Chapter[]> {
  const { data, error } = await supabase.from("chapters").select("number,date,title,summary,visible,sort_order").order("sort_order");
  if (error) throw error;
  return data ?? [];
}
