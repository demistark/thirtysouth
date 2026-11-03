import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { displaySettings } from "./itinerary-display";

export function useItineraryDisplay() {
  return useQuery({ queryKey: ["itinerary-display"], refetchInterval: 3000, queryFn: async () => {
    const {data,error} = await supabase.from("settings").select("key,value").in("key",["itinerary_indicator","itinerary_shadow","itinerary_grain","wardrobe_visible"]);
    if(error) throw error;
    return displaySettings(Object.fromEntries((data ?? []).map(r => [r.key,r.value])));
  }});
}