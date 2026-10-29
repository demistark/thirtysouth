import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const { session, displayName, signOut, isHost } = useAuth();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const { pathname } = useLocation();
  const home = pathname === "/";
  useEffect(() => {
    const update = () => setCompact(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [pathname]);

  const linkCls =
    "label-caps py-1 border-b border-transparent text-muted-foreground transition-colors hover:text-foreground";
  const activeCls = "!text-foreground !border-apricot";

  const authControl = session ? (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <span className="truncate text-sm" title={displayName}>{displayName}</span>
      <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => void signOut()} aria-label={t("nav.sign_out")}><LogOut strokeWidth={1.25} /></Button>
      </TooltipTrigger><TooltipContent>{t("nav.sign_out")}</TooltipContent></Tooltip></TooltipProvider>
    </div>
  ) : (
    <Link to="/auth" className="btn-pill">
      {t("nav.sign_in")}
    </Link>
  );

  return (
    <div className={home ? "site-header-space" : "site-header-space sticky top-0 z-40"}>
    <header className="site-header band-ink border-b bg-seafoam" data-compact={compact}>
      <div className="site-header-bar mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Link to="/" className="site-wordmark wordmark min-w-0 whitespace-nowrap text-base text-foreground">
          30° South
        </Link>
        <nav className="site-nav hidden items-center gap-5 md:flex lg:gap-8">
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
        <div className="site-auth hidden min-w-0 items-center justify-end gap-2 md:flex">
          {isHost && (
            <Link to="/admin" className="label-caps text-muted-foreground hover:text-foreground">
              {t("nav.admin")}
            </Link>
          )}
          <div className="min-w-0 max-w-full">{authControl}</div>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="site-menu shrink-0 md:hidden" aria-label={t("nav.open_menu")}>
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
                  activeProps={{ className: "!text-foreground underline underline-offset-8 decoration-1 decoration-apricot" }}
                  activeOptions={{ exact: n.to === "/" }}
                >
                  {t(n.key)}
                </Link>
              ))}
              {isHost && (
                <Link to="/admin" onClick={() => setOpen(false)} className="label-caps text-muted-foreground">
                  {t("nav.admin")}
                </Link>
              )}
              <div className="min-w-0 pt-4" onClick={() => setOpen(false)}>
                {authControl}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
    </div>
  );
}

export function SiteFooter() {
  const { t } = useContent();
  return (
    <footer className="band-ink mt-24 border-t bg-band-tan">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 py-10 text-center">
        <span className="wordmark text-sm">30° South</span>
        <span className="label-caps text-muted-foreground">{t("footer.line")}</span>
        <Button variant="pill" className="mt-5 !px-4 !py-2" aria-label={t("common.back_to_top")} title={t("common.back_to_top")} onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}><span aria-hidden="true">↑</span></Button>
      </div>
    </footer>
  );
}
