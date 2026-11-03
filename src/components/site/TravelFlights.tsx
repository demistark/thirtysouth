import { Fragment, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useContent } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { flightAirportsValid, flightNumberValid, flightDate, flightTime, flightRouteCodes, sortFlights, hasFlightDirection, type TravelLeg, type LegDirection } from "@/lib/travel";

export function TravelFlights({ legs, directory, myGuestId, editable }: { legs: TravelLeg[]; directory: {id: string; display_name: string}[]; myGuestId: string | null; editable: boolean }) {
  const { t } = useContent();
  const [direction, setDirection] = useState<LegDirection>("arrival");
  const [open,setOpen] = useState(false);
  const [phone,setPhone] = useState(false);
  useEffect(() => { const mq=window.matchMedia("(max-width: 767px)"); const update=()=>setPhone(mq.matches); update(); mq.addEventListener("change",update); return ()=>mq.removeEventListener("change",update); },[]);
  const mine = legs.find(l => l.guest_id === myGuestId && l.direction === direction);
  const title=t(mine ? "travel.flight.edit" : "travel.flight.add");
  const form=myGuestId ? <FlightForm key={`${direction}-${mine?.id ?? "new"}`} leg={mine} guestId={myGuestId} direction={direction} legs={legs} onDone={()=>setOpen(false)} /> : null;
  return <div className="mt-6 min-w-0">
    <div className="flex gap-5" role="tablist" aria-label={t("travel.section.flights")}>
      {(["arrival","departure"] as const).map(d=><Button key={d} variant="ghost" role="tab" aria-selected={direction===d} onClick={()=>setDirection(d)} className={cn("section-tab rounded-none",direction===d ? "border-ember" : "border-transparent")}>{t(d==="arrival" ? "travel.arrivals" : "travel.departures")}</Button>)}
    </div>
    <ul className="travel-flight-list">
      {sortFlights(legs.filter(l=>l.direction===direction)).map(l=><FlightRow key={l.id} leg={l} name={directory.find(d=>d.id===l.guest_id)?.display_name ?? ""} />)}
    </ul>
    {!legs.some(l=>l.direction===direction) && <p className="caption-serif my-6 text-sm">{t("travel.flights.empty")}</p>}
    {editable && myGuestId && <Button variant="link" className="px-0 text-deep-atlantic" onClick={()=>setOpen(true)}>{title}</Button>}
    {phone ? <Sheet open={open} onOpenChange={setOpen}><SheetContent side="bottom" className="travel-flight-sheet"><SheetTitle>{title}</SheetTitle>{form}</SheetContent></Sheet> : <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md"><DialogTitle>{title}</DialogTitle>{form}</DialogContent></Dialog>}
  </div>;
}
export function FlightRow({ leg, name }: { leg: TravelLeg; name: string }) {
  return <li className="travel-flight-row"><div className="travel-flight-wrap">
    <span className="travel-flight-half"><span className="travel-flight-date">{flightDate(leg.cpt_time)}</span><span className="travel-flight-separator" aria-hidden="true">//</span><span className="travel-flight-name">{name}</span></span>
    <span className="travel-flight-half travel-flight-route-group"><span className="travel-flight-route">{flightRouteCodes(leg).map((code,i)=><Fragment key={i}>{i>0 && <span className="travel-flight-arrow">→</span>}{code}</Fragment>)}</span><span className="travel-flight-separator" aria-hidden="true">//</span><span className="travel-flight-time">{flightTime(leg.cpt_time)}</span>{leg.flight_number && <><span className="travel-flight-separator" aria-hidden="true">//</span><span className="travel-flight-number">{leg.flight_number}</span></>}</span>
  </div></li>;
}
function FlightForm({leg,guestId,direction,legs,onDone}:{leg?:TravelLeg | undefined; guestId:string; direction:LegDirection; legs:TravelLeg[]; onDone:()=>void}) {
  const {t}=useContent(); const qc=useQueryClient();
  const [dir,setDir]=useState(direction); const [airport,setAirport]=useState(leg?.other_airport ?? "");
  const [connections,setConnections]=useState(Array.from({length:3},(_,i)=>leg?.connections?.[i] ?? ""));
  const [datetime,setDatetime]=useState(leg?.cpt_time ?? ""); const [busy,setBusy]=useState(false);
  const [flightNumber,setFlightNumber]=useState(leg?.flight_number ?? "");
  const finish=async()=>{await qc.invalidateQueries({queryKey:["travel","legs"]}); await qc.invalidateQueries({queryKey:["admin","travel-legs"]}); onDone();};
  const save=async(e:React.FormEvent)=>{
    e.preventDefault(); const codes=connections.map(c=>c.trim().toUpperCase()).filter(Boolean);
    if(!flightAirportsValid(airport,codes)){toast.error(t("travel.flight.invalid"));return;}
    if(!flightNumberValid(flightNumber)){toast.error(t("travel.flight.number.invalid"));return;}
    if(hasFlightDirection(legs,guestId,dir,leg?.id)){toast.error(t("travel.flight.duplicate"));return;}
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(datetime)) return;
    setBusy(true);
    const row={guest_id:guestId,direction:dir,other_airport:airport.trim().toUpperCase(),connections:codes,cpt_time:datetime,flight_number:flightNumber.toUpperCase()};
    const {error}=leg?.id ? await supabase.from("travel_legs").update(row).eq("id",leg.id) : await supabase.from("travel_legs").insert(row);
    setBusy(false); if(error){toast.error(t("admin.itin.error"));return;} await finish();
  };
  const del=async()=>{if(!leg?.id)return;setBusy(true);const {error}=await supabase.from("travel_legs").delete().eq("id",leg.id);setBusy(false);if(error)toast.error(t("admin.itin.error"));else await finish();};
  return <form className="travel-flight-form mt-4 space-y-3" onSubmit={save}>
    <label className="block text-sm">{t("travel.flight.direction")}<select className="field mt-1" value={dir} onChange={e=>setDir(e.target.value as LegDirection)}><option value="arrival">{t("travel.arrivals")}</option><option value="departure">{t("travel.departures")}</option></select></label>
    <label className="block text-sm">{t(dir==="arrival" ? "travel.flight.origin" : "travel.flight.final")}<input className="field mt-1 uppercase" required pattern="[A-Za-z]{3}" maxLength={3} value={airport} onChange={e=>setAirport(e.target.value.toUpperCase())} /></label>
    <fieldset><legend className="text-sm">{t("travel.flight.connections")}</legend><div className="mt-1 grid grid-cols-3 gap-2">{connections.map((c,i)=><input key={i} className="field min-w-0 uppercase" aria-label={`${t("travel.flight.connections")} ${i+1}`} pattern="[A-Za-z]{3}" maxLength={3} value={c} onChange={e=>setConnections(connections.map((v,j)=>i===j ? e.target.value.toUpperCase() : v))} />)}</div></fieldset>
    <label className="block">{t("travel.flight.date")}<input type="date" className="field mt-1" required value={datetime.slice(0,10)} onChange={e=>setDatetime(`${e.target.value}T${datetime.slice(11,16) || "00:00"}`)} /></label>
    <label className="block">{t("travel.flight.time")}<input type="time" className="field mt-1" required value={datetime.slice(11,16)} onChange={e=>setDatetime(`${datetime.slice(0,10)}T${e.target.value}`)} /></label>
    <label className="block">{t(dir==="arrival" ? "travel.flight.number.arrival" : "travel.flight.number.departure")}<input className="field mt-1 uppercase" pattern="[A-Za-z0-9]{0,8}" maxLength={8} value={flightNumber} onChange={e=>setFlightNumber(e.target.value.toUpperCase())} /></label>
    <div className="flex justify-between gap-3"><Button disabled={busy || !datetime} type="submit">{t("admin.itin.save")}</Button>{leg?.id && <Button disabled={busy} variant="outline" type="button" onClick={()=>void del()}>{t("admin.itin.delete")}</Button>}</div>
  </form>;
}
