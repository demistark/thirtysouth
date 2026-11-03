import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BACK_TO_TOP_IDLE_MS, backToTopVisible, bubbleBottom } from "@/lib/site-shell";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import { canViewPurse, canViewTravel } from "@/lib/locked-areas";

const NAV = [
  { to: "/", key: "nav.home" },
  { to: "/itinerary", key: "nav.itinerary" },
  { to: "/travel", key: "nav.travel" },
  { to: "/purse", key: "nav.purse" },
  { to: "/journal", key: "nav.journal" },
] as const;

export function SiteHeader() {
  const { t } = useContent();
  const { session, displayName, signOut, isHost, roles } = useAuth();
  // Signed-out visitors keep every entry (locked pages show their sign-in panel);
  // signed-in friends afar lose the areas they cannot open.
  const nav = NAV.filter((n) =>
    (n.to !== "/travel" || !session || canViewTravel(roles)) &&
    (n.to !== "/purse" || !session || canViewPurse(roles)));
  const [open, setOpen] = useState(false);
  const touchMenu = useRef(false);
  const menuContent = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [homeHeaderReturned, setHomeHeaderReturned] = useState(false);
  const { pathname } = useLocation();
  const home = pathname === "/";
  useEffect(() => {
    const update = () => {
      setCompact(window.scrollY > 24);
      const firstCard = document.querySelector("[data-home-first-card]");
      setHomeHeaderReturned(home && !!firstCard && firstCard.getBoundingClientRect().top <= 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [pathname, home]);

  const linkCls =
    "label-caps pt-1 pb-2 border-b-[2.5px] border-transparent text-muted-foreground transition-colors hover:text-foreground";
  const activeCls = "!text-foreground !border-ember";

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
    <header className="site-header band-ink border-b bg-seafoam" data-scroll-obstruction data-compact={compact} data-home-returned={homeHeaderReturned}>
      <div className="site-header-bar mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Link to="/" className="site-wordmark wordmark min-w-0 whitespace-nowrap text-base text-foreground">
          <span>30° South</span>
        </Link>
        <nav className="site-nav hidden items-center gap-5 md:flex lg:gap-8">
          {nav.map((n) => (
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
          <SheetTrigger className="site-menu shrink-0 md:hidden" aria-label={t("nav.open_menu")} onPointerDown={e => { touchMenu.current = e.pointerType !== "mouse"; }} onKeyDown={() => { touchMenu.current = false; }}>
            <Menu className="h-5 w-5" strokeWidth={1.25} />
          </SheetTrigger>
          <SheetContent
            ref={menuContent}
            tabIndex={-1}
            onOpenAutoFocus={e => { if (touchMenu.current) { e.preventDefault(); menuContent.current?.focus(); } }}
            side="top"
            className="band-ink h-full w-full border-0 bg-seafoam px-8 pb-10 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] data-[state=closed]:!duration-250 data-[state=open]:!duration-250 [&>button]:right-6 [&>button]:top-[calc(env(safe-area-inset-top,0px)+1.25rem)] [&>button_svg]:h-6 [&>button_svg]:w-6"
          >
            <SheetTitle className="wordmark text-sm">30° South</SheetTitle>
            <nav className="mt-14 flex flex-col gap-8">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="font-display-light text-3xl text-foreground"
                  activeProps={{ className: "underline underline-offset-[10px] decoration-[2.5px] decoration-ember" }}
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
              <div className="min-w-0 pt-6" onClick={() => setOpen(false)}>
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
  const footer = useRef<HTMLElement>(null);
  const bubble = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const position = () => {
      if (!footer.current || !bubble.current) return;
      const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      bubble.current.style.setProperty("--bubble-footer-bottom", `${bubbleBottom(window.innerHeight, footer.current.getBoundingClientRect().top, size)}px`);
      setVisible(backToTopVisible(window.scrollY));
    };
    const scrolling = () => {
      position(); setIdle(false); clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), BACK_TO_TOP_IDLE_MS);
    };
    scrolling();
    const observer = new ResizeObserver(position);
    if (footer.current) observer.observe(footer.current);
    window.addEventListener("scroll", scrolling, { passive: true });
    window.addEventListener("resize", position);
    return () => { clearTimeout(timer); observer.disconnect(); window.removeEventListener("scroll", scrolling); window.removeEventListener("resize", position); };
  }, []);
  return (
    <footer ref={footer} className="band-ink footer-glow relative mt-24 border-t">
      <Button ref={bubble} variant="ghost" size="icon" className="back-to-top-bubble" data-visible={visible} data-idle={idle} tabIndex={visible ? 0 : -1} aria-hidden={!visible} aria-label={t("common.back_to_top")} onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}>
        <svg viewBox="0 0 24 28" aria-hidden="true" className="h-7 w-6"><path fill="currentColor" d="M10 24a2 2 0 0 0 4 0V9.8l3.6 3.6a2 2 0 0 0 2.8-2.8l-7-7a2 2 0 0 0-2.8 0l-7 7a2 2 0 0 0 2.8 2.8L10 9.8Z" /></svg>
      </Button>
      <div className="footer-text mx-auto max-w-6xl px-5 py-[1.875rem] text-center sm:py-8">
        <p className="label-caps text-foreground">{t("footer.wordmark")}</p>
        <div className="mt-3 flex items-center justify-center gap-3 sm:gap-6">
          {["footer.brand", "footer.place", "footer.date"].map((key) => <span key={key} className="label-caps text-foreground">{t(key)}</span>)}
        </div>
      </div>
    </footer>
  );
}
