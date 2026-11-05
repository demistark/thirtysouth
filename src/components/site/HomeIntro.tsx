import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useChapters, useSettings } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useTripClock } from "@/lib/trip-clock";
import { isCleanTap, shouldPlayIntro, type PointerMark } from "@/lib/intro";

// Opening animation on Home (During), once per Cape Town day.
// The inline bootstrap in __root.tsx claims the day and sets html[data-intro="pending"]
// (veil drawn by CSS) before hydration; this component decides and plays.

const HOLD = 400;
const FLIGHT = 1500;
const REVEAL_AT = 1300;
const FLY_EASE = "cubic-bezier(0.45, 0.05, 0.15, 1)";
const VEIL_EASE = "cubic-bezier(0.35, 0, 0.65, 1)";

declare global {
  interface Window {
    __30sIntro?: boolean;
  }
}

function setIntroAttr(v: string | null) {
  const el = document.documentElement;
  if (v) el.dataset["intro"] = v;
  else delete el.dataset["intro"];
}

export function HomeIntro() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { phase } = useTripClock();
  const settingsQ = useSettings();
  const chaptersQ = useChapters();
  const { loading: authLoading } = useAuth();
  const [state, setState] = useState<"idle" | "waiting" | "playing" | "done">("idle");
  const [timedOut, setTimedOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const down = useRef<PointerMark | null>(null);

  // Pick up the bootstrap's verdict once.
  useEffect(() => {
    if (window.__30sIntro && document.documentElement.dataset["intro"] === "pending") {
      setState("waiting");
      const id = setTimeout(() => setTimedOut(true), 1500);
      return () => clearTimeout(id);
    }
    setState("done");
    return undefined;
  }, []);

  const ready = timedOut || ((settingsQ.isFetched && chaptersQ.isFetched && !authLoading));

  useEffect(() => {
    if (state !== "waiting" || !ready) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!shouldPlayIntro({ pathname, phase, firstOfDay: true, reducedMotion: reduced })) {
      setIntroAttr(null);
      setState("done");
      return;
    }
    setState("playing");
  }, [state, ready, pathname, phase]);

  useEffect(() => {
    if (state !== "playing") return;
    const realLink = document.querySelector<HTMLElement>("[data-intro-wordmark]");
    const real = realLink?.querySelector<HTMLElement>(":scope > span");
    const mark = markRef.current;
    const span = spanRef.current;
    const veil = veilRef.current;
    if (!realLink || !real || !mark || !span || !veil) {
      setIntroAttr(null);
      setState("done");
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let finished = false;
    const phone = window.matchMedia("(max-width: 767px)").matches;
    const cs = getComputedStyle(real);
    const fontSize = parseFloat(cs.fontSize);
    const realLs = cs.letterSpacing;
    const realPad = cs.paddingLeft;

    Object.assign(span.style, {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      textTransform: cs.textTransform,
      lineHeight: cs.lineHeight,
      color: cs.color,
      letterSpacing: phone ? `${0.05 * fontSize}px` : realLs,
      paddingLeft: phone ? `${0.05 * fontSize}px` : realPad,
    });
    realLink.style.visibility = "hidden";
    setIntroAttr("playing");

    // Start state: real font-size, scaled up and centred.
    const w0 = span.offsetWidth;
    const h0 = span.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = phone ? (0.88 * vw) / w0 : Math.min(104, Math.max(30, 0.084 * vw)) / fontSize;
    mark.style.transform = `translate(${vw / 2 - (w0 * s) / 2}px, ${vh / 2 - (h0 * s) / 2}px) scale(${s})`;

    const finish = (instant: boolean) => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      realLink.style.visibility = "";
      if (rootRef.current) rootRef.current.style.display = "none";
      if (instant) setIntroAttr(null);
      else timers.push(setTimeout(() => setIntroAttr(null), 1800));
      finishRef.current = null;
      setState("done");
      window.removeEventListener("keydown", onKey);
    };
    finishRef.current = () => finish(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") finish(true);
    };
    window.addEventListener("keydown", onKey);

    timers.push(
      setTimeout(() => {
        // Measure at the moment the flight begins.
        const r = real.getBoundingClientRect();
        mark.style.transition = `transform ${FLIGHT}ms ${FLY_EASE}`;
        if (phone) {
          span.style.transition = `letter-spacing ${FLIGHT}ms ${FLY_EASE}, padding-left ${FLIGHT}ms ${FLY_EASE}`;
          span.style.letterSpacing = realLs;
          span.style.paddingLeft = realPad;
        }
        mark.style.transform = `translate(${r.left}px, ${r.top}px) scale(1)`;
        veil.style.transition = `opacity ${FLIGHT}ms ${VEIL_EASE}`;
        veil.style.opacity = "0";
        mark.addEventListener("transitionend", (e) => {
          if (e.target === mark && e.propertyName === "transform") finish(false);
        });
        timers.push(setTimeout(() => setIntroAttr("reveal"), REVEAL_AT));
        timers.push(setTimeout(() => finish(false), FLIGHT + 200));
      }, HOLD),
    );

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
    };
  }, [state]);

  if (state !== "waiting" && state !== "playing") return null;

  return (
    <div
      ref={rootRef}
      className="home-intro"
      aria-hidden
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      }}
      onPointerUp={(e) => {
        if (isCleanTap(down.current, { x: e.clientX, y: e.clientY, t: e.timeStamp })) finishRef.current?.();
        down.current = null;
      }}
    >
      <div ref={veilRef} className="home-intro-veil" />
      {state === "playing" && (
        <div ref={markRef} className="home-intro-mark">
          <span ref={spanRef}>30° South</span>
        </div>
      )}
    </div>
  );
}
