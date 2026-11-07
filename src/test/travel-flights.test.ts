import { readFileSync } from "node:fs";
const migration=readFileSync("drizzle/migrations/0021_travel_roomies_and_own_flights.sql","utf8");
import {describe,it,expect} from "vitest";
import { copyFlightOptions,normalizeIata,flightAirportsValid,flightNumberValid,flightDate,flightTime,flightRouteCodes,sortFlights,hasFlightDirection,type TravelLeg } from "@/lib/travel";
import {canViewTravel} from "@/lib/locked-areas";
const leg=(over:Partial<TravelLeg>={}):TravelLeg=>({id:"a",guest_id:"me",direction:"arrival",airline:"",flight_number:"",other_airport:"ATL",cpt_time:"2026-11-20T18:35:00",terminal:null,notes:null,transfer_id:null,visible:true,...over});
describe("Travel flight list",()=>{
 it("copy choices include other guests only in the selected direction",()=>{
   const rows=[leg(),leg({id:"b",guest_id:"demi",other_airport:"LGA",connections:["ATL"],cpt_time:"2026-11-21T18:35:00",flight_number:"DL0210"}),leg({id:"c",guest_id:"demi",direction:"departure"}),leg({id:"d",guest_id:"friend",flight_number:""})];
   const directory=[{id:"me",display_name:"Me"},{id:"demi",display_name:"Demi"},{id:"friend",display_name:"Friend"}];
   const options=copyFlightOptions(rows,directory,"me","arrival");
   expect(options.map(o=>o.leg.id)).toEqual(["d","b"]);
   expect(options[1]?.label).toBe("Demi: LGA→ATL→CPT, 11.21 6:35 P, DL0210");
   expect(options[0]?.label).toBe("Friend: ATL→CPT, 11.20 6:35 P");
   expect(copyFlightOptions(rows,directory,"me","departure").map(o=>o.leg.id)).toEqual(["c"]);
   expect(copyFlightOptions([leg()],directory,"me","arrival")).toEqual([]);
 });
 it("allows optional flight numbers",()=>{expect(flightNumberValid("")).toBe(true);});
 it("accepts only letters and digits",()=>{expect(flightNumberValid("dl0210")).toBe(true);for(const value of ["DL-210","DL 210","DL.210","é210"])expect(flightNumberValid(value)).toBe(false);});
 it("limits flight numbers to eight characters",()=>{expect(flightNumberValid("AB123456")).toBe(true);expect(flightNumberValid("AB1234567")).toBe(false);});
 it("sorts by CPT date then time without changing input",()=>{const rows=[leg({id:"b",cpt_time:"2026-11-21T01:00:00"}),leg(),leg({id:"c",cpt_time:"2026-11-20T11:00:00"})];expect(sortFlights(rows).map(l=>l.id)).toEqual(["c","a","b"]);expect(rows[0]?.id).toBe("b");});
 it("formats CPT date MM.DD",()=>expect(flightDate("2026-11-20T18:35:00")).toBe("11.20"));
 it("formats times with A/P and drops zero minutes",()=>{expect(flightTime("2026-11-20T18:35:00")).toBe("6:35 P");expect(flightTime("2026-11-20T11:00:00")).toBe("11 A");expect(flightTime("2026-11-20T00:00:00")).toBe("12 A");expect(flightTime("2026-11-20T12:00:00")).toBe("12 P");});
 it("uppercases exactly three-letter IATA codes",()=>{expect(normalizeIata(" lga ")).toBe("LGA");for(const invalid of ["LG","LGAA","123","L1A",""])expect(normalizeIata(invalid)).toBeNull();});
 it("allows zero to three connections only",()=>{expect(flightAirportsValid("ATL",[])).toBe(true);expect(flightAirportsValid("ATL",["LOS","DOH","JNB"])).toBe(true);expect(flightAirportsValid("ATL",["LOS","DOH","JNB","LHR"])).toBe(false);expect(flightAirportsValid("ATL",["LO"])).toBe(false);});
 it("orders routes around CPT for both directions",()=>{expect(flightRouteCodes(leg({connections:["LOS"]}))).toEqual(["ATL","LOS","CPT"]);expect(flightRouteCodes(leg({direction:"departure",connections:["LOS"]}))).toEqual(["CPT","LOS","ATL"]);});
 it("allows one flight per guest per direction, excluding edited row",()=>{expect(hasFlightDirection([leg()],"me","arrival")).toBe(true);expect(hasFlightDirection([leg()],"me","departure")).toBe(false);expect(hasFlightDirection([leg()],"other","arrival")).toBe(false);expect(hasFlightDirection([leg()],"me","arrival","a")).toBe(false);});
 it("Roomies follows resolved Travel visibility roles",()=>{for(const role of ["host","schedule_manager","trip_guest","friend_afar"] as const)expect(canViewTravel([role])).toBe(true);expect(canViewTravel(["friend_afar"])).toBe(true);expect(canViewTravel([])).toBe(false);});
});

describe("Travel database rules",()=>{
 it("enforces one arrival and departure per friend in the migration",()=>{
   expect(migration).toMatch(/UNIQUE \(guest_id,direction\)/);
 });
 it.each(["INSERT","UPDATE","DELETE"])("scopes participant %s to my_guest rather than another friend",command=>{
   const policy=migration.split(";\n").find(s=>s.includes('"Participants') && s.includes(`FOR ${command} `));
   expect(policy).toBeDefined();
   expect(policy).toContain("public.is_trip_participant(auth.uid()) AND guest_id=public.my_guest()");
   if(command==="UPDATE")expect(policy?.match(/guest_id=public.my_guest\(\)/g)).toHaveLength(2);
 });
 it("Roomies read policy uses the shared Travel view helper",()=>{
   const current=readFileSync("drizzle/migrations/0026_h10_access_private_content_and_signin.sql","utf8");
   const read=current.split(";\n").find(s=>s.startsWith('CREATE POLICY "Travel friends read Roomies"'));
   expect(read).toContain("public.can_view_travel(auth.uid())");
 });
});
