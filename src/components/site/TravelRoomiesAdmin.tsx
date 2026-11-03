import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRoomies } from "@/lib/travel-data";
import { useContent } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import type { Roomie } from "@/lib/travel";
export function TravelRoomiesAdmin(){
 const {t}=useContent();const q=useRoomies(true);const qc=useQueryClient();
 const refresh=()=>qc.invalidateQueries({queryKey:["travel","roomies"]});
 return <div className="space-y-4">{(q.data ?? []).map(r=><RoomieRow key={r.id} roomie={r} refresh={refresh}/>)}<Button variant="outline" onClick={async()=>{const {error}=await supabase.from("travel_roomies").insert({sort_order:Math.max(0,...(q.data ?? []).map(r=>r.sort_order))+1});if(error)toast.error(t("admin.itin.error"));else await refresh();}}>{t("admin.itin.add")}</Button></div>;
}
function RoomieRow({roomie,refresh}:{roomie:Roomie;refresh:()=>Promise<unknown>}){
 const {t}=useContent();const [f,setF]=useState(roomie);useEffect(()=>setF(roomie),[roomie]);
 return <div className="grid gap-3 border bg-card p-4 md:grid-cols-2">{(["names","floor_room","note"] as const).map(k=><label className="block text-sm" key={k}>{t(`travel.roomies.${k}`)}<input className="field mt-1" value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/></label>)}<label className="block text-sm">{t("travel.roomies.order")}<input className="field mt-1" type="number" value={f.sort_order} onChange={e=>setF({...f,sort_order:Number(e.target.value)})}/></label><div className="flex gap-3"><Button onClick={async()=>{const {id,...row}=f;const {error}=await supabase.from("travel_roomies").update(row).eq("id",id);if(error)toast.error(t("admin.itin.error"));else {toast.success(t("admin.itin.saved"));await refresh();}}}>{t("admin.itin.save")}</Button><Button variant="outline" onClick={async()=>{const {error}=await supabase.from("travel_roomies").delete().eq("id",roomie.id);if(error)toast.error(t("admin.itin.error"));else await refresh();}}>{t("admin.itin.delete")}</Button></div></div>;
}
