import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS, type TripSettings } from "./phase";
import { useAuth } from "./auth";
import { isTripParticipant } from "./locked-areas";
import { scriptAlignment, type ScriptFields } from "./itinerary";

export function useContent() {
  const q = useQuery({
    queryKey: ["site_content"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_content").select("key,value");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
    staleTime: 60_000,
  });
  const map = q.data ?? {};
  const t = (key: string) => map[key] ?? "";
  return { t, ready: !!q.data };
}

export const PRIVATE_CONTENT_KEYS = ["villa_address", "villa_vrbo_url", "villa_website_url", "villa_checkin", "villa_checkout", "villa_house_rules", "villa_amenities", "villa_power_note", "villa_about", "villa_after_checkout", "flights_getting_to_villa", "splitwise_url"] as const;

export function usePrivateContent() {
  const { roles, session, loading } = useAuth();
  const allowed = !loading && !!session && isTripParticipant(roles);
  const q = useQuery({
    queryKey: ["private_content", session?.user.id, allowed], enabled: allowed, staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("private_content").select("key,value");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map(row => [row.key, row.value])) as Record<string,string>;
    },
  });
  return { t: (key: string) => allowed ? q.data?.[key] ?? "" : "", ready: allowed && !!q.data };
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<TripSettings & { otp_enabled?: string }> => {
      const { data, error } = await supabase.from("settings").select("key,value");
      if (error) throw error;
      const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      return { ...DEFAULT_SETTINGS, ...m } as TripSettings;
    },
    staleTime: 60_000,
  });
}

export interface ChapterBasic extends ScriptFields {
  number: number;
  date: string;
  title: string;
  summary: string;
  sort_order: number;
}

export function useChapters() {
  return useQuery({
    queryKey: ["chapters"],
    queryFn: async (): Promise<ChapterBasic[]> => {
      const { data, error } = await supabase
        .from("chapters")
        .select("number,date,title,summary,sort_order,layout,heading_before,heading_before_align,transition_after,transition_after_align")
        .eq("visible", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((c) => ({ ...c, layout: scriptAlignment(c.layout), heading_before_align: scriptAlignment(c.heading_before_align), transition_after_align: scriptAlignment(c.transition_after_align) }));
    },
    staleTime: 60_000,
  });
}

export interface HomeImage {
  slot: string;
  storage_path: string;
  alt: string;
  focal_x: number;
  focal_y: number;
}

export const HOME_BUCKET = "home-images";

/** Empty hero slot: only the host sees the "Add in Admin › Home" placeholder. */
export function showHeroPlaceholder(isHost: boolean, hasImage: boolean): boolean {
  return !hasImage && isHost;
}

/** Home hero image with a short-lived signed URL (private bucket, public read). */
export function useHomeImage(slot: string) {
  return useQuery({
    queryKey: ["home-image", slot],
    staleTime: 50 * 60_000,
    queryFn: async (): Promise<{ image: HomeImage | null; url: string | null }> => {
      const { data, error } = await supabase.from("home_images").select("*").eq("slot", slot).maybeSingle();
      if (error) throw error;
      if (!data) return { image: null, url: null };
      const { data: signed } = await supabase.storage.from(HOME_BUCKET).createSignedUrl(data.storage_path, 3600);
      return { image: data as HomeImage, url: signed?.signedUrl ?? null };
    },
  });
}

export function formatChapterDate(d: string) {
  const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, day)));
}
