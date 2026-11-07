import { beforeEach, describe, expect, it, vi } from "vitest";
import { afarNameMatches, hashAfarCode, normalizeAfarCode } from "@/lib/afar-codes";

const state=vi.hoisted(()=>({guests:[] as Record<string,unknown>[], codes:[] as Record<string,unknown>[], attempts:[] as unknown[], roles:[] as Record<string,unknown>[], host:true}));
vi.mock("@tanstack/react-start",()=>({createServerFn:()=>{let validate=(v:unknown)=>v;const builder={middleware:()=>builder,inputValidator:(fn:typeof validate)=>{validate=fn;return builder;},handler:(fn:(v:unknown)=>unknown)=>(args:{data:unknown;context?:unknown})=>fn({data:validate(args.data),context:args.context})};return builder;}}));
vi.mock("@tanstack/react-start/server",()=>({getRequest:()=>new Request("https://example.test",{headers:{"x-forwarded-for":"test-address"}})}));
vi.mock("@/integrations/supabase/auth-middleware",()=>({requireSupabaseAuth:{}}));
vi.mock("@/integrations/supabase/client.server",()=>({supabaseAdmin:{
  from:(table:string)=>{
    let operation="select";let payload:Record<string,unknown>={};const filters: [string,unknown][]=[];
    const run=()=>{
      const rows=table==="guests" ? state.guests : table==="afar_codes" ? state.codes : table==="user_roles" ? state.roles : [];
      if(operation==="insert" || operation==="upsert") {
        if(table==="afar_attempts")state.attempts.push(payload);
        if(table==="guests")state.guests.push({id:"new-guest",user_id:null,...payload});
        if(table==="afar_codes")state.codes.push(payload);
        if(table==="user_roles")state.roles.push(payload);
      }
      const data=rows.filter(row=>filters.every(([key,value])=>row[key]===value));
      if(operation==="update")data.forEach(row=>Object.assign(row,payload));
      return {data,error:null,count:0};
    };
    const b={select:()=>b,eq:(k:string,v:unknown)=>{filters.push([k,v]);return b;},gte:()=>b,in:()=>b,insert:(v:Record<string,unknown>)=>{operation="insert";payload=v;return b;},upsert:(v:Record<string,unknown>)=>{operation="upsert";payload=v;return b;},update:(v:Record<string,unknown>)=>{operation="update";payload=v;return b;},delete:()=>b,maybeSingle:async()=>{const r=run();return {...r,data:r.data[0]??null};},single:async()=>{const r=run();return {...r,data:r.data[0]??null};},then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(run()).then(resolve)};return b;
  },
  auth:{admin:{createUser:async()=>({data:{user:{id:"new-user"}},error:null}),generateLink:async()=>({data:{properties:{hashed_token:"test-token"}},error:null}),getUserById:async()=>({data:{user:{email:"guest-new-guest@codes.invalid"}},error:null})}}
}}));
import { afarAddFriend, afarSignIn } from "@/lib/afar.functions";
const context={supabase:{rpc:async()=>({data:state.host})},userId:"host"};
beforeEach(()=>{state.guests=[];state.codes=[];state.roles=[];state.attempts=[];state.host=true;});
describe("H10 server code and name",()=>{
  it("wrong name and wrong code return identical failures and record attempts",async()=>{
    state.guests=[{id:"g",user_id:null,email:"",pending_role:"friend_afar",display_name:"Ada",full_name:"Ada Lovelace"}];
    state.codes=[{guest_id:"g",salt:"salt",code_hash:await hashAfarCode("salt",normalizeAfarCode("COAST-7K4M2")),disabled:false}];
    const wrongName=await afarSignIn({data:{code:"COAST-7K4M2",name:"Bo"}});
    const wrongCode=await afarSignIn({data:{code:"TIDE-22AAA",name:"Ada"}});
    expect(wrongName).toEqual(wrongCode);expect(wrongName.ok).toBe(false);expect(state.attempts).toHaveLength(2);
  });
  it("creates a blank-email confirmed friend and a usable hashed code",async()=>{
    const add=afarAddFriend as unknown as (input:{data:{name:string};context:typeof context})=>Promise<{displayName:string;code:string}>;
    const result=await add({data:{name:"  Ada  "},context});
    expect(state.guests[0]).toMatchObject({full_name:"Ada",display_name:"Ada",email:"",status:"confirmed",pending_role:"friend_afar"});
    expect(state.codes[0]?.['code_hash']).toBe(await hashAfarCode(String(state.codes[0]?.['salt']),normalizeAfarCode(result.code)));
    expect(afarNameMatches("ADA",result.displayName,"Ada")).toBe(true);
    const signedIn=await afarSignIn({data:{code:result.code,name:"ADA"}});expect(signedIn.ok).toBe(true);
  });
  it("rejects a non-host",async()=>{state.host=false;const add=afarAddFriend as unknown as (input:{data:{name:string};context:typeof context})=>Promise<unknown>;await expect(add({data:{name:"Ada"},context})).rejects.toThrow("Forbidden");expect(state.guests).toHaveLength(0);});
});