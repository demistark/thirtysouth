import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { isTripParticipant } from "@/lib/locked-areas";
import { useContent, usePrivateContent } from "@/lib/data";
import { ComingSoon } from "./Blocks";

export function SharedExpenses() {
  const { t } = useContent();
  const { roles, session } = useAuth();
  const privateContent = usePrivateContent();
  if (session && !isTripParticipant(roles)) return <div className="journal-message-card"><h2 className="font-display-light text-3xl text-deep-atlantic">{t("gate_heading")}</h2><p className="caption-serif mt-4">{t("gate_message_expense")}</p></div>;
  if (session && !privateContent.ready) return null;
  const url = privateContent.t("splitwise_url").trim();
  if (!url) return <ComingSoon />;
  return (
    <div className="fade-in border bg-card px-6 py-16 text-center">
      <p className="caption-serif text-lg">{t("purse_expenses_text")}</p>
      <div className="mt-8 flex justify-center">
        <Button variant="pill" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">{t("purse_expenses_button")}</a>
        </Button>
      </div>
    </div>
  );
}