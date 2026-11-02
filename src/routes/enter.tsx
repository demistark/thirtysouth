import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { afarSignIn } from "@/lib/afar.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/enter")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
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

function EnterCode() {
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
      window.history.replaceState({}, "", "/enter");
    }
  }, [prefilled]);

  useEffect(() => {
    if (session) void navigate({ to: "/" });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setState("checking");
    try {
      const result = await signIn({ data: { code } });
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
      <h1 className="font-display-light text-5xl">Your personal code</h1>
      <p className="caption-serif mt-3">Type the code you were sent. This phone will remember you.</p>
      <form onSubmit={submit} className="mt-10 space-y-4">
        <label className="label-caps block text-muted-foreground" htmlFor="personal-code">
          Your personal code
        </label>
        <input
          id="personal-code"
          autoComplete="off"
          autoCapitalize="characters"
          required
          className="field tracking-[0.2em] uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="COAST-7K4M2"
        />
        {state === "bad" && <p className="text-sm text-ember-deep">That code didn't work.</p>}
        {state === "locked" && (
          <p className="text-sm text-ember-deep">Too many tries just now. Take a breath and try again in a little while.</p>
        )}
        <Button variant="pill" className="btn-pill-solid w-full" disabled={state === "checking"}>
          Continue
        </Button>
      </form>
    </main>
  );
}
