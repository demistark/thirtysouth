import { describe,it,expect } from "vitest";
import { displaySettings, expandable, lookNumber, railDots, tagsForScene } from "@/lib/itinerary-display";
import { exportScenesCsv, parseScenesCsv, type Scene, type WardrobeLook } from "@/lib/itinerary";
const scene = (order:number): Scene => ({chapter_number:7,scene_order:order,title:"Scene",location:"",kind:"core",call_time:null,start_time:null,end_time:null,summary:"",details:"",experience_card:null,wardrobe_look:1,visible:true});
const look = (order:number): WardrobeLook => ({chapter_number:7,look_order:order,title:"Live title",date_label:"",look_label:"",description:"",palette:[],photos:[],visible:true});
describe("itinerary refinements", () => {
  it("expands only details, call time or wrap time, not an experience link", () => {
    expect(expandable({...scene(1),experience_card:"https://example.com"})).toBe(false);
    expect(expandable({...scene(1),details:"Details"})).toBe(true);
    expect(expandable({...scene(1),call_time:"12:00 PM"})).toBe(true);
    expect(expandable({...scene(1),wrap_time:"3:45 PM"})).toBe(true);
  });
  it("formats chapter-based look numbers and suffixes", () => {
    expect(lookNumber(1,1)).toBe("01"); expect(lookNumber(10,1)).toBe("10"); expect(lookNumber(8,2)).toBe("08-b"); expect(lookNumber(8,3)).toBe("08-c");
  });
  it("places live looks once at first scene and first matching second look, with show/hide overrides", () => {
    const scenes=[scene(1),{...scene(2),wardrobe_look:2}, {...scene(3),wardrobe_look:2}];
    expect(tagsForScene(scenes,[look(1),look(2)],0)).toEqual([look(1)]);
    expect(tagsForScene(scenes,[look(1),look(2)],1)).toEqual([look(2)]);
    expect(tagsForScene(scenes,[look(1),look(2)],2)).toEqual([]);
    expect(tagsForScene([{...scene(1),look_tag:"hide"}],[look(1)],0)).toEqual([]);
    expect(tagsForScene([{...scene(1),look_tag:"show",wardrobe_look:2}],[look(2)],0)).toEqual([look(2)]);
  });
  for(const count of [1,2,3,4,5,6,7,10]) it(`resolves stable non-first non-adjacent treatments for ${count} cards`, () => {
    const scenes=Array.from({length:count},(_,i) => scene(i+1));
    for(let chapter=1;chapter<=10;chapter++) {
      const dots=railDots(chapter,scenes); const changed=dots.flatMap((d,i) => d.color !== "atlantic" || d.shape !== "circle" ? [i] : []);
      expect(changed.length).toBe(count<=3 ? 0 : count<=5 ? 1 : 2);
      expect(changed).not.toContain(0);
      expect(changed.every((i,k) => k===0 || Math.abs(i-(changed[k-1] ?? -10))>1)).toBe(true);
      expect(dots).toEqual(railDots(chapter,scenes));
      if(count>=6) { expect(dots.filter(d => d.color!=="atlantic")).toHaveLength(1); expect(dots.filter(d => d.shape!=="circle")).toHaveLength(1); }
    }
  });
  it("counts explicit overrides before adding automatic treatments", () => {
    const scenes=Array.from({length:6},(_,i) => scene(i+1)); scenes[1]={...scene(2),dot_color:"olive"};
    const dots=railDots(7,scenes); expect(dots[1]?.color).toBe("olive"); expect(dots.filter(d => d.shape!=="circle")).toHaveLength(1);
  });
  it("defaults all cards to heavy edge, midpoint shadow and grain", () => {
    expect(displaySettings({})).toEqual({indicator:"edge",shadow:3,grain:true});
    expect(displaySettings({itinerary_indicator:"both",itinerary_shadow:"5",itinerary_grain:"false"})).toEqual({indicator:"both",shadow:5,grain:false});
  });
  it("round-trips call/wrap and optional controls while accepting leave_at alias", () => {
    const row={...scene(1),call_time:"12:00 PM",wrap_time:"3:45 PM",look_tag:"show" as const,dot_shape:"triangle" as const,dot_color:"olive" as const};
    expect(parseScenesCsv(exportScenesCsv([row]),[],[7]).rows).toEqual([row]);
    expect(parseScenesCsv("chapter,scene_order,title,location,kind,leave_at,start,end,summary,details,experience_card,wardrobe_look\n7,1,Picnic,,core,12:00 PM,,,,,,1",[],[7]).rows[0]?.call_time).toBe("12:00 PM");
  });
});