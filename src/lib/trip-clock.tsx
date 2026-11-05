import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { useChapters, useSettings, type ChapterBasic } from "./data";
import { currentChapterFor, DEFAULT_SETTINGS, daysToGo, getPhase, zonedDate, type Phase, type TripSettings } from "./phase";

const STORAGE_KEY = "30s-preview-at";

interface TripClock {
  now: Date;
  phase: Phase;
  currentChapter: ChapterBasic | null;
  daysToGo: number;
  isPreview: boolean;
  settings: TripSettings;
  setPreview: (d: Date | null) => void;
}

const Ctx = createContext<TripClock | null>(null);

export function TripClockProvider({ children }: { children: ReactNode }) {
  const { isHost } = useAuth();
  const settings = useSettings().data ?? DEFAULT_SETTINGS;
  const chapters = useChapters().data ?? [];
  const [realNow, setRealNow] = useState(() => new Date());
  const [override, setOverride] = useState<Date | null>(null);

  useEffect(() => {
    const id = setInterval(() => setRealNow(new Date()), 60_000);
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) setOverride(new Date(stored));
    return () => clearInterval(id);
  }, []);

  const setPreview = (d: Date | null) => {
    if (d) sessionStorage.setItem(STORAGE_KEY, d.toISOString());
    else sessionStorage.removeItem(STORAGE_KEY);
    setOverride(d);
  };

  // Preview only applies for the host.
  const isPreview = isHost && !!override;
  const now = isPreview ? override! : realNow;

  const value = useMemo<TripClock>(() => {
    const phase = getPhase(now, settings);
    const today = zonedDate(now, settings.timezone);
    return {
      now,
      phase,
      currentChapter: phase === "during" ? currentChapterFor(chapters, today) : null,
      daysToGo: daysToGo(now, settings),
      isPreview,
      settings,
      setPreview,
    };
  }, [now, settings, chapters, isPreview]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTripClock() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTripClock must be used within TripClockProvider");
  return ctx;
}
