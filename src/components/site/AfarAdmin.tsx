import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { afarAdminList, afarGenerateAll, afarGenerateCode, afarSetDisabled } from "@/lib/afar.functions";
import { AFAR_DEFAULT_TEMPLATE, buildAfarMessage } from "@/lib/afar-codes";
import { Button } from "@/components/ui/button";

interface FriendAfar {
  id: string;
  displayName: string;
  fullName: string;
  hasCode: boolean;
  disabled: boolean;
  issuedAt: string | null;
  lastSignedInAt: string | null;
}

interface IssuedCode {
  displayName: string;
  code: string;
}

function statusOf(f: FriendAfar): string {
  if (!f.hasCode) return "No code";
  if (f.lastSignedInAt) return `Signed in ${new Date(f.lastSignedInAt).toLocaleDateString()}`;
  return "Code issued";
}

export function AfarAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(afarAdminList);
  const generateFn = useServerFn(afarGenerateCode);
  const generateAllFn = useServerFn(afarGenerateAll);
  const setDisabledFn = useServerFn(afarSetDisabled);

  const friendsQ = useQuery({ queryKey: ["admin", "afar"], queryFn: () => listFn() });
  const settingsQ = useQuery({
    queryKey: ["admin", "afar-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key,value").in("key", ["afar_enabled", "afar_message_template"]);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });

  const [enabled, setEnabled] = useState(true);
  const [template, setTemplate] = useState(AFAR_DEFAULT_TEMPLATE);
  useEffect(() => {
    if (settingsQ.data) {
      setEnabled(settingsQ.data["afar_enabled"] !== "false");
      setTemplate(settingsQ.data["afar_message_template"] || AFAR_DEFAULT_TEMPLATE);
    }
  }, [settingsQ.data]);

  // Shown exactly once after generation; cleared when the dialog closes.
  const [shown, setShown] = useState<IssuedCode[] | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "afar"] });

  const linkFor = (code: string) => `${window.location.origin}/enter?code=${encodeURIComponent(code)}`;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.");
    }
  };

  const generate = async (f: FriendAfar) => {
    try {
      const r = await generateFn({ data: { guestId: f.id } });
      setShown([{ displayName: r.displayName, code: r.code }]);
      refresh();
    } catch {
      toast.error("Couldn't generate a code. Try again.");
    }
  };

  const generateAll = async () => {
    try {
      const r = await generateAllFn();
      if (!r.issued.length) {
        toast.success("Everyone afar already has a code");
        return;
      }
      setShown(r.issued);
      refresh();
    } catch {
      toast.error("Couldn't generate codes. Try again.");
    }
  };

  const toggleDisabled = async (f: FriendAfar) => {
    try {
      await setDisabledFn({ data: { guestId: f.id, disabled: !f.disabled } });
      toast.success(f.disabled ? "Code enabled again" : "Code disabled and signed out");
      refresh();
    } catch {
      toast.error("Couldn't update the code. Try again.");
    }
  };

  const saveSettings = async () => {
    const { error } = await supabase.from("settings").upsert([
      { key: "afar_enabled", value: enabled ? "true" : "false" },
      { key: "afar_message_template", value: template },
    ]);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["admin", "afar-settings"] });
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const friends = friendsQ.data?.friends ?? [];

  return (
    <section className="space-y-6 border-t pt-10">
      <div>
        <h2 className="font-display-light text-3xl">Friends afar</h2>
        <p className="caption-serif mt-1 text-sm">
          Friends afar sign in with a personal code instead of an email. Generate a code, send it, and their phone
          remembers them.
        </p>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Friends afar can sign in with their codes
      </label>

      <div className="flex justify-end">
        <button type="button" className="btn-pill" onClick={generateAll}>
          Generate for everyone without a code
        </button>
      </div>

      <ul className="divide-y border-y">
        {friends.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-display-light text-xl">
                {f.displayName} <span className="text-sm text-muted-foreground">· {f.fullName}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {statusOf(f)}
                {f.disabled ? " · disabled" : ""}
                {f.lastSignedInAt ? ` · last sign-in ${new Date(f.lastSignedInAt).toLocaleString()}` : ""}
              </p>
            </div>
            <button className="btn-pill !px-3 !py-1.5" onClick={() => generate(f)}>
              {f.hasCode ? "Regenerate" : "Generate code"}
            </button>
            {f.hasCode && (
              <button className="btn-pill !px-3 !py-1.5" onClick={() => toggleDisabled(f)}>
                {f.disabled ? "Enable" : "Disable"}
              </button>
            )}
          </li>
        ))}
        {!friends.length && <li className="py-6 text-sm text-muted-foreground">No friends afar on the list yet.</li>}
      </ul>

      <div className="grid gap-3 border bg-card p-5">
        <p className="label-caps">Message template</p>
        <textarea
          className="field min-h-24"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          aria-label="Message template"
        />
        <p className="text-xs text-muted-foreground">
          {"{name}"}, {"{code}"} and {"{link}"} are filled in for each person.
        </p>
        <div>
          <Button variant="pill" className="btn-pill-solid" onClick={saveSettings}>
            Save
          </Button>
        </div>
      </div>

      {shown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-5" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 border bg-card p-6">
            <p className="font-display-light text-2xl">{shown.length === 1 ? `Code for ${shown[0]?.displayName ?? ""}` : "New codes"}</p>
            <p className="text-xs text-muted-foreground">
              Shown once. Copy what you need now — after you close this, the codes can't be shown again.
            </p>
            <ul className="space-y-3">
              {shown.map((s) => (
                <li key={s.code} className="border p-3">
                  <p className="text-sm">{s.displayName}</p>
                  <p className="font-mono text-lg tracking-[0.2em]">{s.code}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="btn-pill !px-3 !py-1" onClick={() => copy(s.code, "Code")}>
                      Copy code
                    </button>
                    <button className="btn-pill !px-3 !py-1" onClick={() => copy(linkFor(s.code), "Link")}>
                      Copy link
                    </button>
                    <button
                      className="btn-pill !px-3 !py-1"
                      onClick={() => copy(buildAfarMessage(template, s.displayName, s.code, linkFor(s.code)), "Message")}
                    >
                      Copy message
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="pill" className="btn-pill-solid w-full" onClick={() => setShown(null)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
