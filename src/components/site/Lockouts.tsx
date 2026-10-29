import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useContent } from "@/lib/data";
import { factsOptions } from "@/lib/facts";
import { FACT_ROTATION_MS, nextFactIndex, shouldRotateFacts } from "@/lib/locked-areas";

const EMPTY_FACTS: { id: string; text: string }[] = [];

export function SignInLink() {
  const { t } = useContent();
  return <Button variant="pill" asChild><Link to="/auth">{t("gate.link")}</Link></Button>;
}

export function RecordingLockout() {
  const { t } = useContent();
  return <section className="lockout-band bg-band-sage">
    <p className="font-display-light flex items-center justify-center gap-3 text-3xl md:text-4xl"><span className="recording-dot h-2 w-2 shrink-0 rounded-full bg-rust" aria-hidden="true" />{t("lockout.recording")}</p>
    <SignInLink />
  </section>;
}

export function PurseLockout() {
  const { t } = useContent();
  return <section className="lockout-band bg-band-tan"><p className="font-display-light text-4xl md:text-5xl">{t("lockout.friends")}</p><SignInLink /></section>;
}

export function ReflectionsDescription() {
  const { t } = useContent();
  return <><p className="font-serif text-2xl italic md:text-3xl">{t("journal.reflections.description")}</p><p className="label-caps">{t("journal.reflections.privacy")}</p></>;
}

export function ReflectionsLockout() {
  return <section className="lockout-band bg-paper"><div className="mx-auto flex w-full max-w-sm rotate-[-2deg] flex-col items-center gap-6 bg-ochre px-6 py-14"><ReflectionsDescription /><SignInLink /></div></section>;
}

export function TravelLockout() {
  const { data = EMPTY_FACTS } = useQuery(factsOptions);
  const [currentId, setCurrentId] = useState<string>();
  const [previousId, setPreviousId] = useState<string>();
  useEffect(() => {
    if (!data.length) return;
    setCurrentId(data[Math.floor(Math.random() * data.length)]?.id);
    setPreviousId(undefined);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    const restart = () => {
      if (timer) clearInterval(timer);
      if (!shouldRotateFacts(data.length, document.hidden, motion.matches)) return;
      timer = setInterval(() => setCurrentId((id) => {
        const index = Math.max(0, data.findIndex((fact) => fact.id === id));
        setPreviousId(id);
        return data[nextFactIndex(data.length, index)]?.id;
      }), FACT_ROTATION_MS);
    };
    restart();
    document.addEventListener("visibilitychange", restart);
    motion.addEventListener("change", restart);
    return () => { if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", restart); motion.removeEventListener("change", restart); };
  }, [data]);
  const fact = data.find((item) => item.id === currentId);
  const previous = data.find((item) => item.id === previousId);
  return <section className="lockout-band bg-band-sage">
    {fact && <div className="w-full max-w-2xl"><div className="grid items-center font-serif text-3xl italic leading-relaxed md:text-4xl">
      {previous && <p key={`out-${currentId}`} aria-hidden="true" className="fact-out col-start-1 row-start-1">{previous.text}</p>}
      <p key={currentId} className="fact-in col-start-1 row-start-1">{fact.text}</p>
    </div><div className="mx-auto mt-8 h-px w-20 bg-border" /></div>}
    <SignInLink />
  </section>;
}