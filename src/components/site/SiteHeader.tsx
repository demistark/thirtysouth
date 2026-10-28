import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";

const NAV = [
  { to: "/", key: "nav.home" },
  { to: "/itinerary", key: "nav.itinerary" },
  { to: "/travel", key: "nav.travel" },
  { to: "/purse", key: "nav.purse" },
  { to: "/journal", key: "nav.journal" },
] as const;

export function SiteHeader() {
  const { t } = useContent();
  const { session, initial, signOut, isHost } = useAuth();
  const [open, setOpen] = useState(false);

  const linkCls =
    "label-caps py-1 border-b border-transparent text-muted-foreground transition-colors hover:text-foreground";
  const activeCls = "!text-foreground !border-primary";

  const authControl = session ? (
    <button onClick={signOut} className="btn-pill !px-2 !py-1.5 !pr-4" aria-label="Sign out">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[0.7rem] text-primary-foreground">
        {initial}
      </span>
      {t("nav.sign_out")}
    </button>
  ) : (
    <Link to="/auth" className="btn-pill">
      {t("nav.sign_in")}
    </Link>
  );

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link to="/" className="wordmark text-base text-foreground">
          30° South
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={linkCls}
              activeProps={{ className: activeCls }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {isHost && (
            <Link to="/admin" className="label-caps text-muted-foreground hover:text-foreground">
              Admin
            </Link>
          )}
          {authControl}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="md:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" strokeWidth={1.25} />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-background">
            <SheetTitle className="wordmark text-sm">30° South</SheetTitle>
            <nav className="mt-10 flex flex-col gap-6">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="font-display-light text-2xl text-muted-foreground"
                  activeProps={{ className: "!text-primary underline underline-offset-8 decoration-1" }}
                  activeOptions={{ exact: n.to === "/" }}
                >
                  {t(n.key)}
                </Link>
              ))}
              {isHost && (
                <Link to="/admin" onClick={() => setOpen(false)} className="label-caps text-muted-foreground">
                  Admin
                </Link>
              )}
              <div className="pt-4" onClick={() => setOpen(false)}>
                {authControl}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useContent();
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 py-10 text-center">
        <span className="wordmark text-sm">30° South</span>
        <span className="label-caps text-muted-foreground">{t("footer.line")}</span>
      </div>
    </footer>
  );
}
