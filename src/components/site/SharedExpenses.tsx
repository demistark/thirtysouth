import { Button } from "@/components/ui/button";
import { useContent } from "@/lib/data";
import { ComingSoon } from "./Blocks";

export function SharedExpenses() {
  const { t } = useContent();
  const url = t("splitwise_url").trim();
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