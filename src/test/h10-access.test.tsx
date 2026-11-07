import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { Experience } from "@/lib/purse";

const state = vi.hoisted(() => ({ roles: ["trip_guest"], session: { user: { id: "one" } } as object | null, otpError: null as unknown, prefill: undefined as string | undefined, signIn: vi.fn(), from: vi.fn(), rpc: vi.fn(), otp: vi.fn(), reflections: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ roles: state.roles, session: state.session, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: state.from, rpc: state.rpc, auth: { signInWithOtp: state.otp, verifyOtp: vi.fn(async () => ({error:null})) } } }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => state.signIn, createServerFn: () => { const b = { inputValidator: () => b, middleware: () => b, handler: () => vi.fn() }; return b; } }));
vi.mock("@tanstack/react-start/server", () => ({getRequest:()=>new Request("https://example.test")}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({requireSupabaseAuth:{}}));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({options,useSearch:()=>({code:state.prefill})}), useNavigate:()=>vi.fn(), Link: ({children,to}: {children:React.ReactNode;to:string})=><a href={to}>{children}</a> }));
vi.mock("@/lib/journal-data", () => ({ useJournalSettings:()=>({data:{}}), useReflectionEntries:state.reflections }));
vi.mock("@/lib/travel-data",()=>({}));
vi.mock("@/components/site/TravelFlights",()=>({TravelFlights:()=>null}));
vi.mock("@/components/site/TravelSliverChevron",()=>({TravelSliverChevron:()=>null}));
vi.mock("@/components/site/Lockouts",()=>({TravelLockout:()=>null}));
vi.mock("@/components/site/Blocks",()=>({PageShell:()=>null}));
vi.mock("@/lib/itinerary-data",()=>({}));
vi.mock("@/lib/itinerary-display-data",()=>({}));
vi.mock("@/lib/trip-clock",()=>({useTripClock:()=>({phase:"during"})}));

import { usePrivateContent } from "@/lib/data";
import { VillaIntro } from "@/routes/travel";
import { PriceLine } from "@/components/site/Experiences";
import { NonParticipantComposerHint } from "@/components/site/JournalCommons";
import { JournalReflections } from "@/components/site/JournalReflections";
import { EnterCode } from "@/routes/enter";
import { Route as AuthRoute } from "@/routes/auth";

const text: Record<string,string> = { "signin.sent_title":"Your link is on its way.","signin.sent_body":"It can take a minute.","signin.button":"Send","enter.code_label":"Code","enter.continue":"Continue","enter.name_label":"Name","enter.come_in":"Come in","enter.back":"Back","commons.pin":"Pin it","gate_message_commons":"Trip friends only" };
function wrapper({children}:{children:React.ReactNode}) { return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{children}</QueryClientProvider>; }
function mount(node:React.ReactNode) { const client=new QueryClient({defaultOptions:{queries:{retry:false}}}); return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>); }
beforeEach(()=>{
  vi.clearAllMocks(); state.roles=["trip_guest"];state.session={user:{id:"one"}};state.prefill=undefined;
  state.otp.mockResolvedValue({error:null}); state.signIn.mockResolvedValue({ok:false});
  state.from.mockImplementation((table:string)=>({select:()=>{
    const rows=table==="private_content" ? [{key:"villa_address",value:"PRIVATE ADDRESS"},{key:"splitwise_url",value:"https://splitwise.test"}] : table==="settings" ? [] : Object.entries({...text,villa_name:"Villa",villa_stay:"Dates"}).map(([key,value])=>({key,value}));
    return Promise.resolve({data:rows,error:null});
  }}));
});
afterEach(cleanup);
describe("H10 private content",()=>{
  it.each(["host","schedule_manager","trip_guest"])("fetches for %s",async role=>{ state.roles=[role];const {result}=renderHook(()=>usePrivateContent(),{wrapper});await vi.waitFor(()=>expect(result.current.t("villa_address")).toBe("PRIVATE ADDRESS")); });
  it("does not fetch for friends afar or signed-out visitors",()=>{state.roles=["friend_afar"];renderHook(()=>usePrivateContent(),{wrapper});expect(state.from).not.toHaveBeenCalled();cleanup();state.session=null;state.roles=[];renderHook(()=>usePrivateContent(),{wrapper});expect(state.from).not.toHaveBeenCalled();});
  it("renders villa details for participants",async()=>{mount(<VillaIntro/>);expect(await screen.findByText("PRIVATE ADDRESS")).toBeInTheDocument();});
  it("does not render or request private villa details for afar",async()=>{state.roles=["friend_afar"];mount(<VillaIntro/>);expect(await screen.findByText("Villa")).toBeInTheDocument();expect(screen.queryByText("PRIVATE ADDRESS")).toBeNull();expect(state.from.mock.calls.some(([table])=>table==="private_content")).toBe(false);});
  it("copies private rows before removing public originals",()=>{const sql=readFileSync("drizzle/migrations/0026_h10_access_private_content_and_signin.sql","utf8");expect(sql.indexOf("INSERT INTO public.private_content(key,value,updated_at)")).toBeLessThan(sql.indexOf("DELETE FROM public.site_content WHERE key IN"));});
});
describe("H10 non-participant controls",()=>{
  const exp={price_zar:2895,show_host_note:false} as Experience;
  it("hides prices for afar",()=>{state.roles=["friend_afar"];mount(<PriceLine exp={exp} settings={{zarPerUsd:16.5,showNames:true,globalLock:false,showTotal:false}} currency="zar"/>);expect(screen.queryByText(/2,895/)).toBeNull();});
  it("keeps participant prices",async()=>{mount(<PriceLine exp={exp} settings={{zarPerUsd:16.5,showNames:true,globalLock:false,showTotal:false}} currency="zar"/>);expect(await screen.findByText(/2,895/)).toBeInTheDocument();});
  it("afar Commons pin opens the participant dialog",async()=>{state.roles=["friend_afar"];mount(<NonParticipantComposerHint/>);fireEvent.click(await screen.findByRole("button",{name:"Pin it"}));expect(await screen.findByRole("dialog")).toBeInTheDocument();expect(state.rpc).not.toHaveBeenCalled();});
  it("afar Reflections never requests entries",()=>{state.roles=["friend_afar"];mount(<JournalReflections/>);expect(state.reflections).not.toHaveBeenCalled();});
});
describe("H10 uniform email sign-in",()=>{
  it.each([null,{name:"AuthApiError",status:422}])("listed and unlisted responses show the same sent state",async error=>{
    state.session=null;state.otp.mockResolvedValue({error});const Auth=AuthRoute.options.component; if(!Auth) throw new Error("Missing auth page"); mount(<Auth/>);
    fireEvent.change(await screen.findByLabelText("Email"),{target:{value:"friend@example.test"}});fireEvent.click(screen.getByRole("button",{name:"Send"}));
    expect(await screen.findByText("Your link is on its way.")).toBeInTheDocument();expect(state.rpc).not.toHaveBeenCalled();expect(state.otp.mock.calls[0]?.[0].options.shouldCreateUser).toBe(false);
  });
});
describe("H10 two-step entry",()=>{
  it("Continue sends nothing and Back keeps the code",async()=>{state.session=null;mount(<EnterCode/>);fireEvent.change(await screen.findByLabelText("Code"),{target:{value:"COAST-7K4M2"}});fireEvent.click(screen.getByRole("button",{name:"Continue"}));expect(await screen.findByLabelText("Name")).toBeInTheDocument();expect(state.signIn).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Back"}));expect(screen.getByLabelText("Code")).toHaveValue("COAST-7K4M2");});
  it("one-tap link opens name step and submits both credentials",async()=>{state.session=null;state.prefill="COAST-7K4M2";mount(<EnterCode/>);fireEvent.change(await screen.findByLabelText("Name"),{target:{value:"Ada"}});fireEvent.click(screen.getByRole("button",{name:"Come in"}));await vi.waitFor(()=>expect(state.signIn).toHaveBeenCalledWith({data:{code:"COAST-7K4M2",name:"Ada"}}));expect(window.location.search).toBe("");});
});