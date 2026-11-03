import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import { isTripParticipant } from "@/lib/locked-areas";
import { Button } from "@/components/ui/button";
import { useTripClock } from "@/lib/trip-clock";
import {
  formatEntryDate,
  earlierReflectionPages,
  localEntryDate,
  phaseFromSettings,
  type ReflectionEntry,
  type JournalSettings,
} from "@/lib/journal";
import {
  journalErrorMessage,
  saveReflectionEntry,
  useJournalSettings,
  useMyGuestId,
  useReflectionEntries,
} from "@/lib/journal-data";

export function JournalReflections() {
  const { roles, loading } = useAuth();
  const settingsQ = useJournalSettings(!loading);
  if (loading || !settingsQ.data) return <div className="min-h-80 bg-paper" />;
  const participant = isTripParticipant(roles);
  if (!participant) return <NonParticipantMessage />;
  return <Notebook settings={settingsQ.data} />;
}

/** Honorary guests and friends afar: a quiet message card, no data requests. */
function NonParticipantMessage() {
  const { t } = useContent();
  return (
    <section className="mx-auto max-w-[720px]">
      <div className="journal-message-card">
        <h2 className="font-display-light text-[28px] text-deep-atlantic">Reflections</h2>
        <p className="caption-serif mt-4 text-[19px] leading-[36px] text-slate italic">
          {t("reflections_message_non_participant")}
        </p>
      </div>
    </section>
  );
}

function Notebook({ settings }: { settings: JournalSettings }) {
  const { t } = useContent();
  const queryClient = useQueryClient();
  const myGuestQ = useMyGuestId(true);
  const entriesQ = useReflectionEntries(true);
  const entries = useMemo(() => entriesQ.data ?? [], [entriesQ.data]);
  const { now } = useTripClock();
  const phase = phaseFromSettings(now, settings);

  const [openDate, setOpenDate] = useState<string>(() => localEntryDate());
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedFor = useRef<string | null>(null);
  const notebookDate = useRef<HTMLParagraphElement>(null);
  const today = localEntryDate();
  const earlier = earlierReflectionPages(entries, today);
  const jumpPending = useRef(false);

  // Load the open page's text once entries arrive or the date changes.
  useEffect(() => {
    if (entriesQ.isPending) return;
    if (loadedFor.current === openDate) return;
    const existing = entries.find((e) => e.entry_date === openDate);
    setBody(existing?.body ?? "");
    loadedFor.current = openDate;
    setStatus("idle");
  }, [openDate, entries, entriesQ.isPending]);

  useEffect(() => {
    if (!jumpPending.current) return;
    jumpPending.current = false;
    const jump = () => {
      if (!notebookDate.current) return;
      const bottom = Math.max(0, document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0);
      window.scrollTo({ top: Math.max(0, notebookDate.current.getBoundingClientRect().top + window.scrollY - bottom - 8), behavior: "instant" });
    };
    jump();
    let frame = 0;
    const until = performance.now() + 300;
    const follow = () => { jump(); if (performance.now() < until) frame = requestAnimationFrame(follow); };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [openDate]);

  const save = async (text: string, date: string) => {
    if (!myGuestQ.data) return;
    if (!text.trim() && !entries.some((e) => e.entry_date === date)) return;
    setStatus("saving");
    try {
      await saveReflectionEntry(myGuestQ.data, date, text);
      setStatus("saved");
      await queryClient.invalidateQueries({ queryKey: ["journal", "reflections"] });
    } catch (err) {
      setStatus("error");
      toast.error(journalErrorMessage(err));
    }
  };

  const onChange = (text: string) => {
    setBody(text);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(text, openDate), 1200);
  };

  const openPage = (date: string) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; if (settings.reflectionsOpen) void save(body, openDate); }
    jumpPending.current = true;
    setOpenDate(date);
  };
  const backToToday = openDate !== today && <div className="mx-auto mb-2 max-w-[720px]"><Button variant="link" className="h-auto px-0 py-0 text-sm text-slate" onClick={() => openPage(today)}>{t("reflections.back_today")}</Button></div>;

  if (!settings.reflectionsOpen) {
    return (
      <section>
        <div className="journal-notice mx-auto max-w-[720px]">
          <p className="journal-notice-body">{t("reflections_closed_message")}</p>
        </div>
        {backToToday}
          <div className="journal-notebook mx-auto mt-6 max-w-[720px]">
            <p ref={notebookDate} className="journal-notebook-eyebrow">{formatEntryDate(openDate).toUpperCase()}</p>
            <p className="journal-ruled-read mt-4 whitespace-pre-wrap">{body}</p>
          </div>
        <EarlierPages entries={earlier} openDate={openDate} onOpen={openPage} readOnly />
      </section>
    );
  }

  return (
    <section>
      {phase === "before" && (
        <div className="journal-notice mb-4">
          <h2 className="journal-notice-title">{t("reflections_before_title")}</h2>
          <p className="journal-notice-body">{t("reflections_before_body")}</p>
        </div>
      )}
      <div className="journal-notice mb-8">
        <h2 className="journal-notice-title">{t("reflections_notice_title")}</h2>
        <p className="journal-notice-body">{t("reflections_notice_body")}</p>
      </div>

      {backToToday}
      <div className="journal-notebook mx-auto max-w-[720px]">
        <p ref={notebookDate} className="journal-notebook-eyebrow">{formatEntryDate(openDate).toUpperCase()}</p>
        <h2 className="caption-serif mt-1 text-[34px] text-deep-atlantic italic">Dear Journal,</h2>
        <p className="caption-serif mt-2 text-base text-slate">
          A quiet space for the moments, the feelings and the memories you want to carry home.
        </p>
        <textarea
          className="journal-ruled mt-5"
          value={body}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => void save(body, openDate)}
          aria-label="Today's journal entry"
        />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate" role="status">
            {status === "saving" && "Saving…"}
            {status === "saved" && "Saved just now"}
            {status === "error" && "Couldn't save — try again."}
          </span>
          <button className="btn-pill btn-pill-solid" onClick={() => void save(body, openDate)}>Save entry</button>
        </div>
      </div>

      <EarlierPages entries={earlier} openDate={openDate} onOpen={openPage} />
    </section>
  );
}

function EarlierPages({ entries, openDate, onOpen, readOnly }: { entries: ReflectionEntry[]; openDate: string; onOpen: (d: string) => void; readOnly?: boolean }) {
  const past = entries;
  if (!past.length) return null;
  return (
    <div className="mx-auto mt-10 max-w-[720px]">
      <p className="journal-composer-label">EARLIER PAGES</p>
      <ul className="mt-3 space-y-2">
        {past.map((e) => (
          <li key={e.id}>
            <Button variant="ghost"
              className="journal-earlier-page"
              aria-current={e.entry_date === openDate ? "page" : undefined}
              onClick={() => onOpen(e.entry_date)}
              aria-label={readOnly ? `Read entry from ${formatEntryDate(e.entry_date)}` : `Open entry from ${formatEntryDate(e.entry_date)}`}
            >
              <span className="text-sm font-medium text-deep-atlantic">{formatEntryDate(e.entry_date)}</span>
              <span className="journal-earlier-preview">{e.body}</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
