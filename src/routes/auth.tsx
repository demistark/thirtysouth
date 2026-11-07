import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useContent, useSettings } from "@/lib/data";
import { isOtpEnabled } from "@/lib/otp";
import { Button } from "@/components/ui/button";
import { normalizeEmail } from "@/lib/email";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · 30° South" },
      { name: "description", content: "Sign in with the email on the guest list." },
      { property: "og:title", content: "Sign in · 30° South" },
      { property: "og:description", content: "Sign in with the email on the guest list." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const { t } = useContent();
  const { session } = useAuth();
  const { data: settings } = useSettings();
  const otpEnabled = isOtpEnabled(settings);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [codeState, setCodeState] = useState<"idle" | "checking" | "bad">("idle");

  const send = async () => {
    setState("sending");
    const clean = normalizeEmail(email);
    try {
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    });
    const network = error?.name === "AuthRetryableFetchError" || error instanceof TypeError;
    setState(network ? "error" : "sent");
    } catch (error) { setState(error instanceof TypeError || (error instanceof Error && error.name === "AuthRetryableFetchError") ? "error" : "sent"); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await send();
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeState("checking");
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code.replace(/\s/g, ""),
      type: "email",
    });
    setCodeState(error ? "bad" : "idle");
  };

  if (session) {
    return (
      <main className="mx-auto max-w-md px-5 pt-24 text-center">
        <p className="caption-serif text-lg">You’re signed in as {session.user.email}.</p>
        <Link to="/" className="btn-pill mt-8">
          {t("nav.home")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 pt-20 md:pt-28">
      <h1 className="font-display-light text-5xl">{t("signin.title")}</h1>
      <p className="caption-serif mt-3">{t("signin.intro")}</p>
      {state === "sent" ? (
        <div className="fade-in mt-10 space-y-6 border bg-card p-6">
          <h2 className="font-display-light text-2xl">{t("signin.sent_title")}</h2><p className="text-sm">{t("signin.sent_body")}</p>
          {otpEnabled && <form onSubmit={verify} className="space-y-3">
            <label className="label-caps block text-muted-foreground" htmlFor="code">
              {t("signin.code_label")}
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={10}
              className="field tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {codeState === "bad" && <p className="text-sm text-ember-deep">{t("signin.code_bad")}</p>}
            <Button variant="pill" className="btn-pill-solid w-full" disabled={codeState === "checking"}>
              {t("signin.code_button")}
            </Button>
          </form>}
          <Button variant="link" type="button" className="label-caps text-muted-foreground underline" onClick={send}>
            {t("signin.resend")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-10 space-y-4">
          <label className="label-caps block text-muted-foreground" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {state === "not_found" && <p className="text-sm text-ember-deep">{t("signin.not_found")}</p>}
          {state === "error" && <p className="text-sm text-destructive">Something went wrong. Please try again.</p>}
          <button className="btn-pill btn-pill-solid w-full" disabled={state === "sending"}>
            {t("signin.button")}
          </button>
          <p className="pt-2 text-center">
            <Link to="/enter" search={{ code: undefined }} className="label-caps text-muted-foreground underline">
              Have a personal code?
            </Link>
          </p>
        </form>
      )}
    </main>
  );
}
