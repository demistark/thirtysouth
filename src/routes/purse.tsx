import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ComingSoon, PageShell, SubTabs } from "@/components/site/Blocks";
import { Experiences } from "@/components/site/Experiences";
import { SharedExpenses } from "@/components/site/SharedExpenses";
import { FactLockout, PurseLockout, PURSE_LOCKOUT_TONE } from "@/components/site/Lockouts";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import { canViewPurse } from "@/lib/locked-areas";
import { readPurseCurrency, showCurrencyToggle, storePurseCurrency, type PurseCurrency } from "@/lib/purse";
import { useTripClock } from "@/lib/trip-clock";

export const Route = createFileRoute("/purse")({
  head: () => ({
    meta: [
      { title: "Purse · 30° South" },
      { name: "description", content: "Shared experiences and shared expenses, made pretty." },
      { property: "og:title", content: "Purse · 30° South" },
      { property: "og:description", content: "Shared experiences and shared expenses, made pretty." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Purse,
});

type Tab = "experiences" | "expenses" | "sum";

function Purse() {
  const { t } = useContent();
  const { phase } = useTripClock();
  const { session, roles, loading } = useAuth();
  const allowed = !!session && canViewPurse(roles);
  const ids: Tab[] = phase === "after" ? ["experiences", "expenses", "sum"] : ["experiences", "expenses"];
  const [tab, setTab] = useState<Tab>("experiences");
  const current = ids.includes(tab) ? tab : "experiences";
  // Read after mount so the server render and first client render agree.
  const [currency, setCurrency] = useState<PurseCurrency>("zar");
  useEffect(() => { setCurrency(readPurseCurrency(null)); }, []);
  const pickCurrency = (c: PurseCurrency) => {
    setCurrency(c);
    storePurseCurrency(c, null);
  };
  if (loading) {
    return (
      <PageShell titleKey="purse.title" introKey="purse.intro">
        <div className={`min-h-80 ${PURSE_LOCKOUT_TONE}`} />
      </PageShell>
    );
  }
  if (!session) {
    return (
      <PageShell titleKey="purse.title" introKey="purse.intro">
        <FactLockout tone={PURSE_LOCKOUT_TONE} />
      </PageShell>
    );
  }
  return (
    <PageShell titleKey="purse.title" introKey="purse.intro">
      <SubTabs
        tabs={ids.map((id) => ({ id, label: t(`purse.tab.${id}`) }))}
        value={current}
        onChange={setTab}
        trailing={showCurrencyToggle(current) ? <CurrencyToggle value={currency} onChange={pickCurrency} /> : null}
      />
      {!allowed ? (
        <PurseLockout />
      ) : current === "experiences" ? (
        <>
          {t("purse_experiences_deck") && <p className="caption-serif mb-8 text-lg">{t("purse_experiences_deck")}</p>}
          <Experiences currency={currency} />
        </>
      ) : current === "expenses" ? (
        <SharedExpenses />
      ) : (
        <ComingSoon />
      )}
    </PageShell>
  );
}

/** ZAR | USD switch for experience prices only; the stored amount is always ZAR. */
function CurrencyToggle({ value, onChange }: { value: PurseCurrency; onChange: (c: PurseCurrency) => void }) {
  return (
    <div className="currency-toggle" role="group" aria-label="Price currency">
      {(["zar", "usd"] as const).map((c) => (
        <button key={c} type="button" aria-pressed={value === c} onClick={() => onChange(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}
