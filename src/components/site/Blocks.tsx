import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import { cn } from "@/lib/utils";
import { SignInLink } from "./Lockouts";

export function PhotoSlot({ className, caption }: { className?: string; caption?: string }) {
  const { t } = useContent();
  return (
    <div
      className={cn(
        "flex items-end justify-start border bg-paper p-3",
        className,
      )}
      role="img"
      aria-label={t("common.photo_slot")}
    >
      <span className="caption-serif text-xs">{caption ?? t("common.photo_slot")}</span>
    </div>
  );
}

export function ComingSoon() {
  const { t } = useContent();
  return (
    <div className="fade-in border bg-card px-6 py-16 text-center">
      <p className="caption-serif text-lg">{t("common.coming_soon")}</p>
    </div>
  );
}

export function FriendsGate() {
  const { t } = useContent();
  return (
    <div className="lockout-band bg-band-tan">
      <p className="font-display-light text-4xl">{t("lockout.friends")}</p>
      <SignInLink />
    </div>
  );
}

/** Renders children for friends, otherwise the in-page "Just for friends" panel. */
export function FriendsOnly({ children }: { children: ReactNode }) {
  const { isFriend, loading } = useAuth();
  if (loading) return <div className="h-48 border bg-card" />;
  return isFriend ? <>{children}</> : <FriendsGate />;
}

export function PageShell({ titleKey, introKey, children }: { titleKey: string; introKey: string; children: ReactNode }) {
  const { t } = useContent();
  return (
    <main className="mx-auto max-w-5xl px-5 pt-14 md:pt-20">
      <h1 className="font-display-light text-5xl text-deep-atlantic md:text-7xl">{t(titleKey)}</h1>
      <p className="caption-serif mt-3 text-lg">{t(introKey)}</p>
      <div className="mt-10">{children}</div>
    </main>
  );
}

export function SubTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-8 flex gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "label-caps whitespace-nowrap border-b-[2.5px] pb-4 pt-3 transition-colors",
            value === tab.id ? "border-ember text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
