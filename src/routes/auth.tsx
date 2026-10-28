import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";

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
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "not_found" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const clean = email.trim().toLowerCase();
    const { data: invited, error: rpcErr } = await supabase.rpc("is_invited", { _email: clean });
    if (rpcErr) return setState("error");
    if (!invited) return setState("not_found");
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: window.location.origin },
    });
    setState(error ? "error" : "sent");
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
        <p className="fade-in mt-10 border bg-card p-6 text-sm">{t("signin.sent")}</p>
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
          {state === "not_found" && <p className="text-sm text-rust">{t("signin.not_found")}</p>}
          {state === "error" && <p className="text-sm text-destructive">Something went wrong. Please try again.</p>}
          <button className="btn-pill btn-pill-solid w-full" disabled={state === "sending"}>
            {t("signin.button")}
          </button>
        </form>
      )}
    </main>
  );
}
