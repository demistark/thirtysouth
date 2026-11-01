import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Experience, ExperienceRsvp } from "./purse";

export function useExperiences(enabled: boolean) {
  return useQuery({
    queryKey: ["purse", "experiences"], enabled,
    queryFn: async (): Promise<Experience[]> => {
      const { data, error } = await supabase.from("experiences").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Experience[];
    },
  });
}

export function useExperienceScenes(enabled: boolean) {
  return useQuery({
    queryKey: ["purse", "experience-scenes"], enabled,
    queryFn: async (): Promise<{ experience_id: string; scene_id: string }[]> => {
      const { data, error } = await supabase.from("experience_scenes").select("experience_id,scene_id");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useExperienceRsvps(enabled: boolean) {
  return useQuery({
    queryKey: ["purse", "rsvps"], enabled,
    queryFn: async (): Promise<ExperienceRsvp[]> => {
      const { data, error } = await supabase.from("experience_rsvps").select("experience_id,guest_id,status,choice");
      if (error) throw error;
      return (data ?? []) as ExperienceRsvp[];
    },
  });
}

export interface PurseSettings { zarPerUsd: number; showNames: boolean; globalLock: boolean }

export function usePurseSettings(enabled: boolean) {
  return useQuery({
    queryKey: ["purse", "settings"], enabled, staleTime: 30_000,
    queryFn: async (): Promise<PurseSettings> => {
      const { data, error } = await supabase.from("settings").select("key,value").in("key", ["zar_per_usd", "rsvp_show_names", "rsvp_global_lock"]);
      if (error) throw error;
      const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      const rate = Number(m["zar_per_usd"]);
      return {
        zarPerUsd: Number.isFinite(rate) && rate > 0 ? rate : 16.5,
        showNames: m["rsvp_show_names"] !== "false",
        globalLock: m["rsvp_global_lock"] === "true",
      };
    },
  });
}

/** Guests whose role makes them trip participants (host, schedule manager, trip guest). */
export function useParticipantDirectory(enabled: boolean) {
  return useQuery({
    queryKey: ["purse", "participants"], enabled, staleTime: 60_000,
    queryFn: async (): Promise<{ id: string; display_name: string }[]> => {
      const { data, error } = await supabase.rpc("participant_directory");
      if (error) throw error;
      return data ?? [];
    },
  });
}
