import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CastGuest, PackingCategory, PackingItem, RoomAssignment, Transfer, TravelImage, TravelLeg, TravelSlot, VillaRoom } from "./travel";

export function useCast(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "cast"], enabled,
    queryFn: async (): Promise<CastGuest[]> => {
      const { data, error } = await supabase.rpc("cast_list");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyGuest(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "my-guest"], enabled, staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("my_guest");
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useGuestDirectory(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "directory"], enabled, staleTime: 60_000,
    queryFn: async (): Promise<{ id: string; display_name: string }[]> => {
      const { data, error } = await supabase.rpc("guest_directory");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTravelImages(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "images"], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("travel_images").select("*");
      if (error) throw error;
      const rows = (data ?? []) as TravelImage[];
      const paths = rows.map((r) => r.storage_path);
      let urls: Record<string, string> = {};
      if (paths.length) {
        const { data: signed, error: sErr } = await supabase.storage.from("travel-images").createSignedUrls(paths, 3600);
        if (sErr) throw sErr;
        urls = Object.fromEntries((signed ?? []).filter((d) => d.signedUrl).map((d) => [d.path ?? "", d.signedUrl!]));
      }
      return { images: rows, urls };
    },
  });
}

export function useVillaRooms(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "rooms"], enabled,
    queryFn: async (): Promise<VillaRoom[]> => {
      const { data, error } = await supabase.from("villa_rooms").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRoomAssignments(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "assignments"], enabled,
    queryFn: async (): Promise<RoomAssignment[]> => {
      const { data, error } = await supabase.from("room_assignments").select("room_id,guest_id");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTravelLegs(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "legs"], enabled,
    queryFn: async (): Promise<TravelLeg[]> => {
      const { data, error } = await supabase.from("travel_legs").select("*").order("cpt_time");
      if (error) throw error;
      return (data ?? []) as TravelLeg[];
    },
  });
}

export function useTransfers(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "transfers"], enabled,
    queryFn: async (): Promise<Transfer[]> => {
      const { data, error } = await supabase.from("transfers").select("*").order("sort_order").order("meet_time");
      if (error) throw error;
      return (data ?? []) as Transfer[];
    },
  });
}

export function usePackingCategories(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "packing-categories"], enabled,
    queryFn: async (): Promise<PackingCategory[]> => {
      const { data, error } = await supabase.from("packing_categories").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePackingItems(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "packing-items"], enabled,
    queryFn: async (): Promise<PackingItem[]> => {
      const { data, error } = await supabase.from("packing_items").select("*").eq("visible", true).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePackingChecks(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "packing-checks"], enabled,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from("packing_checks").select("item_id");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.item_id));
    },
  });
}

export function useTravelShareAll(enabled: boolean) {
  return useQuery({
    queryKey: ["travel", "share-all"], enabled, staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from("settings").select("value").eq("key", "travel_share_all").maybeSingle();
      if (error) throw error;
      return (data?.value ?? "true") === "true";
    },
  });
}

export type { TravelSlot };

export function useRoomies(enabled: boolean) {
  return useQuery({ queryKey: ["travel", "roomies"], enabled, queryFn: async () => {
    const {data,error} = await supabase.from("travel_roomies").select("*").order("sort_order").order("id");
    if(error) throw error;
    return data ?? [];
  }});
}
