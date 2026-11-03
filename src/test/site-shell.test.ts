import { afterEach, describe, expect, it, vi } from "vitest";
import { contentScrollTop, scrollToContent, stickyBottom } from "@/lib/scroll";
import { BACK_TO_TOP_IDLE_MS, backToTopVisible, bubbleBottom, wardrobeVisible } from "@/lib/site-shell";
import { displaySettings } from "@/lib/itinerary-display";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ""; });
describe("site shell behaviour", () => {
  it("reveals the bubble only after 600px and uses a one-second idle delay", () => {
    expect(backToTopVisible(600)).toBe(false);
    expect(backToTopVisible(601)).toBe(true);
    expect(backToTopVisible(0)).toBe(false);
    expect(BACK_TO_TOP_IDLE_MS).toBe(1000);
  });
  it("rests with its bottom four rem above the footer or keeps safe-area clearance", () => {
    expect(bubbleBottom(900, 780, 16)).toBe(184);
    expect(bubbleBottom(900, 1200, 16, 20)).toBe(44);
  });
  it("defaults Wardrobe on, hides it when off, and exempts only the host", () => {
    expect(displaySettings({}).wardrobeVisible).toBe(true);
    expect(displaySettings({wardrobe_visible:"false"}).wardrobeVisible).toBe(false);
    expect(wardrobeVisible("true",false)).toBe(true);
    expect(wardrobeVisible("false",false)).toBe(false);
    expect(wardrobeVisible("false",true)).toBe(true);
  });
  it("calculates content landing without a fixed header offset", () => {
    expect(contentScrollTop(500,200,104)).toBe(596);
    expect(contentScrollTop(500,200,46)).toBe(654);
    expect(contentScrollTop(0,0,104)).toBe(0);
  });
  it("measures the current header and sticky bar but ignores an unstuck bar", () => {
    const add = (position:string,top:number,bottom:number) => {
      const el=document.createElement("div"); el.dataset["scrollObstruction"]=""; el.style.position=position; el.style.top="0px";
      el.getBoundingClientRect=() => ({top,bottom,height:bottom-top,left:0,right:390,width:390,x:0,y:top,toJSON:() => ({})});
      document.body.append(el); return el;
    };
    const header=add("fixed",0,46);
    add("sticky",46,98).style.top="46px";
    add("sticky",300,350);
    expect(stickyBottom()).toBe(98);
    header.style.visibility="hidden";
    document.body.innerHTML="";
    expect(stickyBottom()).toBe(0);
  });
  it("lands instantly on the Wardrobe context under reduced motion", () => {
    const context=document.createElement("div"); document.body.append(context);
    context.getBoundingClientRect=() => ({top:300,bottom:348,left:0,right:390,height:48,width:390,x:0,y:300,toJSON:() => ({})});
    vi.spyOn(window,"matchMedia").mockReturnValue({matches:true} as MediaQueryList);
    const scroll=vi.spyOn(window,"scrollTo");
    scrollToContent(context);
    expect(scroll).toHaveBeenCalledWith({top:300,behavior:"instant"});
  });
  it("animates a content landing over 300ms otherwise", () => {
    const target=document.createElement("div"); document.body.append(target);
    target.getBoundingClientRect=() => ({top:600,bottom:648,left:0,right:390,height:48,width:390,x:0,y:600,toJSON:() => ({})});
    let next:FrameRequestCallback|undefined;
    vi.stubGlobal("requestAnimationFrame",(fn:FrameRequestCallback) => {next=fn;return 1;});
    vi.stubGlobal("cancelAnimationFrame",vi.fn());
    const scroll=vi.spyOn(window,"scrollTo");
    scrollToContent(target);
    next?.(0); next?.(150);
    expect(scroll).toHaveBeenLastCalledWith({top:525,behavior:"instant"});
    next?.(300);
    expect(scroll).toHaveBeenLastCalledWith({top:600,behavior:"instant"});
  });
});