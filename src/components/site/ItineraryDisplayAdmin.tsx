import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useContent } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useItineraryDisplay } from "@/lib/itinerary-display-data";
import { type ItineraryDisplay } from "@/lib/itinerary-display";

export function ItineraryDisplayAdmin() {
  const {t} = useContent(); const q = useItineraryDisplay(); const qc = useQueryClient(); const [busy,setBusy] = useState(false);
  const value = q.data ?? {indicator:"edge",shadow:3,grain:true};
  const save = async (next: ItineraryDisplay) => {
    setBusy(true);
    try {
      const {error} = await supabase.rpc("save_itinerary_display", {_indicator:next.indicator,_shadow:next.shadow,_grain:next.grain});
      if(error) throw error;
      qc.setQueryData(["itinerary-display"],next); toast.success(t("admin.itin.saved"));
    } catch { toast.error(t("admin.itin.error")); } finally {setBusy(false);}
  };
  return <fieldset disabled={busy || q.isPending} className="grid max-w-lg gap-7">
    <label className="grid gap-2"><span className="label-caps">{t("admin.itin.indicator")}</span><select className="field" value={value.indicator} onChange={e => void save({...value,indicator:e.target.value as ItineraryDisplay["indicator"]})}>{(["edge","arrow","both"] as const).map(v => <option key={v} value={v}>{t(`admin.itin.${v}`)}</option>)}</select></label>
    <label className="grid gap-2"><span className="label-caps">{t("admin.itin.shadow")} · {value.shadow}</span><input type="range" min={1} max={5} step={1} value={value.shadow} onChange={e => void save({...value,shadow:Number(e.target.value)})} /></label>
    <label className="flex items-center gap-3"><input type="checkbox" checked={value.grain} onChange={e => void save({...value,grain:e.target.checked})} /><span className="label-caps">{t("admin.itin.grain")}</span></label>
  </fieldset>;
}