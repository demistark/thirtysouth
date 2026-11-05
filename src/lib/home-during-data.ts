import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DailyVerse } from "./home-during";

/** All daily verse rows (anyone can read; the host writes). */
export function useDailyVerses() {
  return useQuery({
    queryKey: ["daily-verses"],
    queryFn: async (): Promise<DailyVerse[]> => {
      const { data, error } = await supabase.from("daily_verses").select("chapter_number,text,reference").order("chapter_number");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export interface CapeTownWeather {
  celsius: number;
  code: number;
}

/** Live Cape Town conditions from Open-Meteo (no key), refreshed every 30 min. */
export function useWeather() {
  return useQuery({
    queryKey: ["cape-town-weather"],
    staleTime: 30 * 60_000,
    retry: false,
    queryFn: async (): Promise<CapeTownWeather> => {
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=-33.9249&longitude=18.4241&current=temperature_2m,weather_code",
      );
      if (!res.ok) throw new Error("weather unavailable");
      const json = (await res.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
      const celsius = json.current?.temperature_2m;
      const code = json.current?.weather_code;
      if (typeof celsius !== "number" || typeof code !== "number") throw new Error("weather unavailable");
      return { celsius, code };
    },
  });
}
