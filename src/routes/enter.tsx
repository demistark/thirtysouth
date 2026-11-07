import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { afarSignIn } from "@/lib/afar.functions";
import { useContent } from "@/lib/data";
import { isValidAfarCodeFormat, normalizeAfarCode } from "@/lib/afar-codes";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/enter")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search["code"] === "string" ? (search["code"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Personal code · 30° South" },
      { name: "description", content: "Enter your personal code for 30° South." },
      { property: "og:title", content: "Personal code · 30° South" },
      { property: "og:description", content: "Enter your personal code for 30° South." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EnterCode,
});

export function EnterCode() {
  const { t } = useContent();
  const [step, setStep] = useState<"code" | "name">("code");
  const [name, setName] = useState("");
  const { code: prefilled } = Route.useSearch();
  const { session } = useAuth();
  const navigate = useNavigate();
  const signIn = useServerFn(afarSignIn);
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "bad" | "locked">("idle");

  // Pre-fill from the one-tap link, then strip the code from the address bar
  // so it never stays in history or gets shared.
  useEffect(() => {
    if (prefilled) {
      setCode(prefilled);
      setStep("name");
      window.history.replaceState({}, "", "/enter");
    }
  }, [prefilled]);

  useEffect(() => {
    if (session) void navigate({ to: "/" });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "code") {
      if (isValidAfarCodeFormat(normalizeAfarCode(code))) { setState("idle"); setStep("name"); } else setState("bad");
      return;
    }
    if (!name.trim()) return;
    setState("checking");
    try {
      const result = await signIn({ data: { code, name } });
      if (!result.ok) {
        setState(result.locked ? "locked" : "bad");
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: "magiclink" });
      setState(error ? "bad" : "idle");
    } catch {
      setState("bad");
    }
  };

  return (
    <main className="mx-auto max-w-md px-5 pt-20 md:pt-28">
      <h1 className="font-display-light text-5xl">{t(step === "code" ? "enter.code_title" : "enter.name_title")}</h1>
      <p className="caption-serif mt-3">{t(step === "code" ? "enter.code_intro" : "enter.name_intro")}</p>
      <form onSubmit={submit} className="mt-10 space-y-4">
        <label className="label-caps block text-muted-foreground" htmlFor={step === "code" ? "personal-code" : "personal-name"}>
          {t(step === "code" ? "enter.code_label" : "enter.name_label")}
        </label>
        {step === "code" ? <input
          id="personal-code"
          autoComplete="off"
          autoCapitalize="characters"
          required
          className="field tracking-[0.2em] uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("enter.code_placeholder")}
        /> : <input id="personal-name" className="field" autoComplete="off" required value={name} onChange={e=>setName(e.target.value)} />}
        {state === "bad" && <p className="text-sm text-ember-deep">{t("enter.error")}</p>}
        {state === "locked" && (
          <p className="text-sm text-ember-deep">{t("enter.locked")}</p>
        )}
        <Button variant="pill" className="btn-pill-solid w-full" disabled={state === "checking"}>
          {t(step === "code" ? "enter.continue" : "enter.come_in")}
        </Button>
        {step === "name" && <Button type="button" variant="link" disabled={state === "checking"} onClick={()=>{setStep("code");setState("idle");}}>{t("enter.back")}</Button>}
      </form>
    </main>
  );
}
