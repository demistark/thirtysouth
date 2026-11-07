import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import { useScenes } from "@/lib/itinerary-data";
import { useItineraryDisplay } from "@/lib/itinerary-display-data";
import { canEditPurse, isTripParticipant } from "@/lib/locked-areas";
import {
  capeTownNow, choiceList, deadlineUpcoming, effectiveStatus, experienceExpandable, formatDeadline,
  formatWhenList, priceLineParts, rsvpCounts, rsvpOpen,
  type Experience, type ExperienceRsvp, type PurseCurrency, type RsvpStatus,
} from "@/lib/purse";
import {
  queueRsvpSave, useExperienceRsvps, useExperienceScenes, useExperiences, useParticipantDirectory, usePurseSettings,
  useExperiencePhotoUrls,
  type PurseSettings,
} from "@/lib/purse-data";
import { useMyGuest } from "@/lib/travel-data";
import { useTripClock } from "@/lib/trip-clock";
import type { Scene } from "@/lib/itinerary";
import { useActionGate } from "./ActionGate";
import { Button } from "@/components/ui/button";
import { scrollToContent } from "@/lib/scroll";
import { experiencePhotoStyle } from "@/lib/experience-photo";

interface CardContext {
  scenes: Scene[];
  related: { experience_id: string; scene_id: string }[];
  rsvps: ExperienceRsvp[];
  participants: { id: string; display_name: string }[];
  settings: PurseSettings;
  myGuestId: string | null;
  participant: boolean;
  editor: boolean;
  nowCpt: string;
  currency: PurseCurrency;
  photoUrls?: Record<string, string | undefined> | undefined;
}

export function Experiences({ currency }: { currency: PurseCurrency }) {
  const { t } = useContent();
  const { roles } = useAuth();
  const { now } = useTripClock();
  const expsQ = useExperiences(true);
  const relatedQ = useExperienceScenes(true);
  const rsvpsQ = useExperienceRsvps(true);
  const partsQ = useParticipantDirectory(true);
  const settingsQ = usePurseSettings(true);
  const scenesQ = useScenes(true);
  const myGuestQ = useMyGuest(true);
  const display = useItineraryDisplay().data ?? { indicator: "edge" as const, shadow: 3, grain: true };

  const pending = expsQ.isPending || relatedQ.isPending || rsvpsQ.isPending || partsQ.isPending || settingsQ.isPending;
  const visible = useMemo(() => (expsQ.data ?? []).filter((e) => e.visible), [expsQ.data]);
  const photoUrls = useExperiencePhotoUrls(visible);
  const top = visible.filter((e) => e.level !== "sub");
  const childrenOf = (id: string) => visible.filter((e) => e.level === "sub" && e.parent_id === id);

  // Deep links: /purse#experience-<id> scrolls to the card and highlights it briefly.
  useEffect(() => {
    if (pending) return;
    const hash = window.location.hash.slice(1);
    if (!hash.startsWith("experience-")) return;
    const el = document.getElementById(hash);
    if (!el) return;
    scrollToContent(el);
    el.classList.add("exp-anchor-highlight");
    const timer = setTimeout(() => el.classList.remove("exp-anchor-highlight"), 2500);
    return () => clearTimeout(timer);
  }, [pending, expsQ.data]);

  if (pending) return <div className="min-h-80 bg-tint-ember" />;
  if (!top.length) return <p className="caption-serif py-16 text-center text-lg">{t("purse.empty")}</p>;

  const ctx: CardContext = {
    scenes: scenesQ.data ?? [],
    related: relatedQ.data ?? [],
    rsvps: rsvpsQ.data ?? [],
    participants: partsQ.data ?? [],
    settings: settingsQ.data ?? { zarPerUsd: 16.5, showNames: true, globalLock: false, showTotal: false },
    myGuestId: myGuestQ.data ?? null,
    participant: isTripParticipant(roles),
    editor: canEditPurse(roles),
    nowCpt: capeTownNow(now),
    currency,
    photoUrls: photoUrls.data,
  };

  return (
    <div className="exp-list fade-in" data-shadow={display.shadow} data-indicator={display.indicator} data-grain={display.grain}>
      {top.map((e) => {
        const children = e.level === "group" ? childrenOf(e.id ?? "") : [];
        if (e.level === "group" && children.length > 0) {
          return (
            <div key={e.id}>
              <ExperienceCard exp={e} ctx={ctx} />
              <div className="exp-sub-rail mt-4">
                {children.map((c) => <ExperienceCard key={c.id} exp={c} ctx={ctx} />)}
              </div>
            </div>
          );
        }
        return <ExperienceCard key={e.id} exp={e} ctx={ctx} />;
      })}
    </div>
  );
}

export function ExperienceCard({ exp, ctx }: { exp: Experience; ctx: CardContext }) {
  const { t } = useContent();
  const [open, setOpen] = useState(false);
  const photoUrl = exp.photo_path ? ctx.photoUrls?.[exp.photo_path] : undefined;
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const hasPhoto = !!photoUrl && loadedUrl === photoUrl;
  const relatedScenes = ctx.related.filter((r) => r.experience_id === exp.id)
    .map((r) => ctx.scenes.find((s) => s.id === r.scene_id)).filter((s): s is Scene => !!s);
  const myRsvp = ctx.rsvps.find((r) => r.experience_id === exp.id && r.guest_id === ctx.myGuestId);
  const status = effectiveStatus(exp, myRsvp);
  const isGroup = exp.level === "group";
  const showRsvp = !isGroup && exp.rsvp_mode !== "none";
  const showPrice = !isGroup && ctx.participant;
  const counts = rsvpCounts(exp, ctx.rsvps, ctx.participants.map((p) => p.id));
  const canExpand = experienceExpandable(exp, relatedScenes.length, ctx.settings.showNames);
  const needsReply = ctx.participant && exp.rsvp_mode === "must_reply" && !myRsvp;
  const location = exp.location || relatedScenes[0]?.location || "";

  return (
    <article id={`experience-${exp.id}`} className="scene-card" data-photo={hasPhoto ? "true" : undefined} data-expandable={canExpand} data-open={open}>
      <div className="scene-main">
        {photoUrl && <img key={photoUrl} className="exp-card-photo" src={photoUrl} alt={exp.photo_alt ?? ""} style={experiencePhotoStyle(exp)} loading="lazy" decoding="async" onLoad={() => setLoadedUrl(photoUrl)} onError={() => setLoadedUrl(undefined)} />}
        {hasPhoto && <div className="exp-photo-scrim" aria-hidden="true" />}
        <div className="exp-photo-copy">
        {(exp.when_text || needsReply) && (
          <p className="exp-when">
            <span>{formatWhenList(exp.when_text)}</span>
            {needsReply && <span className="exp-needs-reply">{t("purse.needs_reply")}</span>}
          </p>
        )}
        <div className="scene-title-row">
          <h3 className="scene-title">
            {canExpand ? (
              <Button variant="ghost" className="scene-toggle" aria-label={exp.card} aria-expanded={open} aria-controls={`exp-details-${exp.id}`} onClick={() => setOpen(!open)}>
                {exp.card}
              </Button>
            ) : exp.card}
          </h3>
          {canExpand && <span className="scene-chevron" aria-hidden="true">{open ? <ChevronUp /> : <ChevronDown />}</span>}
        </div>
        {exp.summary && <p className="scene-summary">{exp.summary}</p>}
        {location && <p className="scene-location"><MapPin aria-hidden="true" />{location}</p>}
        </div>
        <div className="exp-photo-bottom">
          {showPrice && (!hasPhoto || !showRsvp) && <PriceLine exp={exp} settings={ctx.settings} currency={ctx.currency} />}
          {showRsvp && <RsvpBlock exp={exp} ctx={ctx} myRsvp={myRsvp} status={status} counts={counts} photoPrice={hasPhoto ? showPrice ? <PriceLine exp={exp} settings={ctx.settings} currency={ctx.currency} /> : null : undefined} />}
        </div>
      </div>
      {canExpand && (
        <div id={`exp-details-${exp.id}`} className="scene-expansion" data-open={open} inert={!open} aria-hidden={!open}>
          <div className="scene-expansion-inner"><div className="scene-details">
            {(exp.details?.trim() || relatedScenes[0]?.details) && (
              <p className="whitespace-pre-line text-sm leading-relaxed">{exp.details?.trim() || relatedScenes[0]?.details}</p>
            )}
            {ctx.participant && exp.price_note && (
              <div>
                <p className="label-caps text-ember-deep">{t("purse.good_to_know")}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{exp.price_note}</p>
              </div>
            )}
            {relatedScenes.map((s) => (
              <Link key={s.id} className="look-tag !m-0" to="/itinerary" search={{ tab: "scenes", day: s.chapter_number }} hash={`scene-${s.id}`}>
                <span>{t("purse.scene_tag")} //</span><span className="text-deep-atlantic">{s.title}</span>
              </Link>
            ))}
            {showRsvp && ctx.settings.showNames && <RsvpNames exp={exp} ctx={ctx} />}
          </div></div>
        </div>
      )}
    </article>
  );
}

export function PriceLine({ exp, settings, currency }: { exp: Experience; settings: PurseSettings; currency: PurseCurrency }) {
  const { t } = useContent();
  const { roles } = useAuth();
  if (!isTripParticipant(roles)) return null;
  if (exp.show_host_note) return <p className="exp-host-note">{t("host_note_instead_of_price")}</p>;
  if (exp.price_zar == null) return null;
  const parts = priceLineParts(exp.price_zar, settings.zarPerUsd, currency);
  return (
    <p className="exp-price">
      <span>{parts.primary} {t("purse.per_person")}</span>
      {parts.secondary != null && <span className="exp-price-usd">{t("purse.about")} {parts.secondary}</span>}
      {exp.price_status && <span className="exp-price-status">{exp.price_status}</span>}
    </p>
  );
}

function RsvpBlock({ exp, ctx, myRsvp, status, counts, photoPrice }: {
  exp: Experience; ctx: CardContext; myRsvp: ExperienceRsvp | undefined;
  status: RsvpStatus | "unconfirmed" | null; counts: ReturnType<typeof rsvpCounts>;
  photoPrice?: React.ReactNode;
}) {
  const { t } = useContent();
  const qc = useQueryClient();
  const gate = useActionGate("rsvp");
  const [choice, setChoice] = useState(myRsvp?.choice ?? "");
  const [pendingGoing, setPendingGoing] = useState(false);
  const choices = choiceList(exp.choices);
  const open = rsvpOpen(ctx.settings.globalLock);
  const locked = !open && !ctx.editor;
  const options: RsvpStatus[] = ["going", "not_going"];
  const shownStatus = pendingGoing ? "going" : status;

  const save = async (next: RsvpStatus, nextChoice: string | null) => {
    if (!exp.id) return;
    if (!ctx.myGuestId) { toast.error(t("purse.no_guest")); return; }
    const guestId = ctx.myGuestId;
    const key = ["purse", "rsvps"];
    qc.setQueryData<ExperienceRsvp[]>(key, (prev) => [
      ...(prev ?? []).filter((r) => !(r.experience_id === exp.id && r.guest_id === guestId)),
      { experience_id: exp.id!, guest_id: guestId, status: next, choice: nextChoice },
    ]);
    const { error } = await queueRsvpSave(exp.id, () =>
      supabase.from("experience_rsvps").upsert(
        { experience_id: exp.id!, guest_id: guestId, status: next, choice: nextChoice },
        { onConflict: "experience_id,guest_id" },
      ));
    if (error) {
      toast.error(t("purse.error_closed"));
    } else {
      toast.success(t("purse.saved"));
    }
    // Whether the save worked or failed, show the server's truth once the queue settles.
    await qc.invalidateQueries({ queryKey: key });
  };

  const pick = (next: RsvpStatus) => {
    if (locked || !ctx.participant) return;
    if (next === "not_going") setChoice("");
    if (next === "going" && choices.length > 0 && !choice) {
      setPendingGoing(true);
      toast.message(t("purse.choice_required"));
      return;
    }
    setPendingGoing(false);
    void save(next, next === "not_going" ? null : choices.length ? choice || null : null);
  };

  const pickChoice = (value: string) => {
    setChoice(value);
    if (locked || !ctx.participant) return;
    if (shownStatus === "going") {
      setPendingGoing(false);
      void save("going", value || null);
    }
  };

  const summaryParts = [
    counts.going > 0 ? `${counts.going} ${t("purse.rsvp_summary.going")}` : "",
    counts.not_going > 0 ? `${counts.not_going} ${t("purse.rsvp_summary.not_going")}` : "",
    counts.awaiting > 0 ? `${counts.awaiting} ${t("purse.rsvp_summary.awaiting")}` : "",
  ].filter(Boolean);

  return (
    <div className="exp-rsvp">
      {photoPrice !== undefined && <div className="exp-photo-price">{photoPrice}</div>}
      <div className="exp-rsvp-pill" data-locked={locked} role="group" aria-label={exp.card}>
        {options.map((o) => (
          <Button variant="ghost"
            key={o}
            type="button"
            data-status={o}
            aria-pressed={shownStatus === o}
            onClick={gate.wrap(() => pick(o))}
          >
            {t(`purse.status.${o}`)}
          </Button>
        ))}
      </div>
      {gate.dialog}
      {choices.length > 0 && shownStatus === "going" && (
        <select
          className="field exp-rsvp-choice !w-auto !py-1.5 text-sm"
          value={choice}
          onChange={(e) => pickChoice(e.target.value)}
          aria-label={t("purse.status.going")}
        >
          <option value="">—</option>
          {choices.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {exp.rsvp_mode === "default_going" && status === "going" && !myRsvp && (
        <p className="exp-rsvp-hint">{t("purse.youre_going")}</p>
      )}
      {deadlineUpcoming(exp.rsvp_deadline, ctx.nowCpt) && (
        <p className="exp-rsvp-deadline">{t("purse.reply_by")} <span className="text-ember">{formatDeadline(exp.rsvp_deadline!)}</span></p>
      )}
      {locked && <p className="exp-rsvp-deadline">{t("purse.closed")}</p>}
      {summaryParts.length > 0 && <p className="exp-rsvp-summary">{summaryParts.join(" · ")}</p>}
    </div>
  );
}

function RsvpNames({ exp, ctx }: { exp: Experience; ctx: CardContext }) {
  const { t } = useContent();
  const names = new Map(ctx.participants.map((p) => [p.id, p.display_name]));
  const mine = ctx.rsvps.filter((r) => r.experience_id === exp.id && names.has(r.guest_id));
  const groups: { status: RsvpStatus; rows: ExperienceRsvp[] }[] = (["going", "not_going"] as const)
    .map((s) => ({ status: s, rows: mine.filter((r) => r.status === s) }));
  const answered = new Set(mine.map((r) => r.guest_id));
  const awaiting = exp.rsvp_mode === "must_reply" ? ctx.participants.filter((p) => !answered.has(p.id)) : [];
  return (
    <div className="exp-names">
      {groups.filter((g) => g.rows.length > 0).map((g) => (
        <p key={g.status} className="exp-names-group">
          <span className="label-caps">{t(`purse.status.${g.status}`)}</span>
          {g.rows.map((r) => names.get(r.guest_id) + (r.choice ? ` (${r.choice})` : "")).join(", ")}
        </p>
      ))}
      {awaiting.length > 0 && (
        <p className="exp-names-group">
          <span className="label-caps">{t("purse.status.awaiting")}</span>
          {awaiting.map((p) => p.display_name).join(", ")}
        </p>
      )}
    </div>
  );
}
