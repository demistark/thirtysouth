import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS, type TripSettings } from "./phase";

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

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<TripSettings> => {
      const { data, error } = await supabase.from("settings").select("key,value");
      if (error) throw error;
      const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      return { ...DEFAULT_SETTINGS, ...m } as TripSettings;
    },
    staleTime: 60_000,
  });
}

export interface ChapterBasic {
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
        .select("number,date,title,summary,sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function formatChapterDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, day)));
}
