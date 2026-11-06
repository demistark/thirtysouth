import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import { canEditPurse, isTripParticipant } from "@/lib/locked-areas";
import {
  alsoGoingList, capeTownNow, choiceList, clearRsvpDraft, deadlineUpcoming, flowSteps,
  formatDeadline, needsReplyCount, priceLineParts, readRsvpDraft, runningTotalZar, writeRsvpDraft,
  type Experience, type PurseCurrency, type RsvpAnswer,
} from "@/lib/purse";
import { useExperienceRsvps, useExperiences, usePurseSettings } from "@/lib/purse-data";
import { useMyGuest } from "@/lib/travel-data";
import { useTripClock } from "@/lib/trip-clock";
import { scrollToContent } from "@/lib/scroll";
import { PriceLine } from "./Experiences";

/**
 * The "Come to everything!" banner on Shared Experiences. Shown only to trip
 * participants: the full banner while replies are waiting, the closed note under
 * the global lock (non-editors), or the no-guest note when the invitation is missing.
 */
export function RsvpBanner({ currency }: { currency: PurseCurrency }) {
  const { t } = useContent();
  const { roles } = useAuth();
  const participant = isTripParticipant(roles);
  const editor = canEditPurse(roles);
  const myGuestQ = useMyGuest(participant);
  const expsQ = useExperiences(participant);
  const rsvpsQ = useExperienceRsvps(participant);
  const settingsQ = usePurseSettings(participant);
  const [flowOpen, setFlowOpen] = useState(false);

  if (!participant) return null;
  if (myGuestQ.isPending || expsQ.isPending || rsvpsQ.isPending || settingsQ.isPending) return null;

  const myGuestId = myGuestQ.data ?? null;
  const experiences = expsQ.data ?? [];
  const rsvps = rsvpsQ.data ?? [];
  const settings = settingsQ.data ?? { zarPerUsd: 16.5, showNames: true, globalLock: false, showTotal: false };

  if (!myGuestId) {
    return (
      <div className="rsvp-banner" data-state="no-guest">
        <p className="caption-serif text-slate">{t("purse.banner.no_guest")}</p>
      </div>
    );
  }

  if (settings.globalLock && !editor) {
    return (
      <div className="rsvp-banner" data-state="closed">
        <h2 className="rsvp-banner-title">{t("purse.banner.closed")}</h2>
      </div>
    );
  }

  const count = needsReplyCount(experiences, rsvps, myGuestId);
  if (count === 0 && !flowOpen) return null;

  const draft = readRsvpDraft(null, myGuestId, experiences, rsvps, Date.now());
  const hasDraft = !!draft && Object.keys(draft.answers).length > 0;

  return (
    <div className="rsvp-banner" data-state="open">
      <p className="rsvp-banner-label">
        {t(count === 1 ? "purse.banner.label_one" : "purse.banner.label_other").replace("{n}", String(count))}
      </p>
      <h2 className="rsvp-banner-title">{t("purse.banner.title")}</h2>
      <p className="caption-serif mt-2 text-slate">{t("purse.banner.line")}</p>
      <button type="button" className="btn-pill-ember mt-5" onClick={() => setFlowOpen(true)}>
        {t(hasDraft ? "purse.banner.continue" : "purse.banner.start")}
      </button>
      {flowOpen && <RsvpFlow currency={currency} onClose={() => setFlowOpen(false)} />}
    </div>
  );
}

/** Full-screen, one-question-at-a-time reply sheet. */
export function RsvpFlow({ currency, onClose }: { currency: PurseCurrency; onClose: () => void }) {
  const { t } = useContent();
  const { roles } = useAuth();
  const { now } = useTripClock();
  const qc = useQueryClient();
  const editor = canEditPurse(roles);
  const myGuestQ = useMyGuest(true);
  const expsQ = useExperiences(true);
  const rsvpsQ = useExperienceRsvps(true);
  const settingsQ = usePurseSettings(true);

  const myGuestId = myGuestQ.data ?? null;
  const experiences = useMemo(() => expsQ.data ?? [], [expsQ.data]);
  const rsvps = useMemo(() => rsvpsQ.data ?? [], [rsvpsQ.data]);
  const settings = settingsQ.data ?? { zarPerUsd: 16.5, showNames: true, globalLock: false, showTotal: false };
  const steps = useMemo(() => flowSteps(experiences, rsvps, myGuestId), [experiences, rsvps, myGuestId]);
  const byId = useMemo(() => new Map(experiences.map((e) => [e.id, e])), [experiences]);

  const [answers, setAnswers] = useState<Record<string, RsvpAnswer>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [review, setReview] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const changeReturn = useRef(false);
  const restored = useRef(false);
  const popped = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Restore the on-device draft once the data is in.
  useEffect(() => {
    if (restored.current || !myGuestId || expsQ.isPending || rsvpsQ.isPending) return;
    restored.current = true;
    const draft = readRsvpDraft(null, myGuestId, experiences, rsvps, Date.now());
    if (!draft) return;
    setAnswers(draft.answers);
    const valid = draft.step >= 0 && draft.step < steps.length;
    setStepIndex(valid ? draft.step : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGuestId, expsQ.isPending, rsvpsQ.isPending]);

  // Persist the draft on every change; the flow works with storage blocked.
  useEffect(() => {
    if (!myGuestId || !restored.current) return;
    writeRsvpDraft(null, myGuestId, { answers, step: stepIndex, savedAt: Date.now() });
  }, [answers, stepIndex, myGuestId]);

  // Lock body scroll, hand Escape and the browser Back gesture to the leave check.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.history.pushState({ rsvpFlow: true }, "");
    const onPop = () => { popped.current = true; requestClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move focus to the step title on each step.
  useEffect(() => {
    titleRef.current?.focus();
  }, [stepIndex, review]);

  const hasAnswers = Object.keys(answers).length > 0;

  function requestClose() {
    if (confirmLeave) { setConfirmLeave(false); return; }
    if (hasAnswers) setConfirmLeave(true);
    else close();
  }

  function close() {
    if (!popped.current) window.history.back();
    onClose();
  }

  const currentId = steps[stepIndex];
  const current = currentId ? byId.get(currentId) : undefined;
  const total = steps.length;
  const answeredCount = steps.filter((id) => answers[id]).length;

  const answer = (id: string, next: RsvpAnswer) => {
    setAnswers((prev) => ({ ...prev, [id]: next }));
    setSaveError(null);
  };

  const goNext = () => {
    if (changeReturn.current) {
      changeReturn.current = false;
      setReview(true);
      return;
    }
    if (stepIndex >= total - 1) setReview(true);
    else { setStepIndex(stepIndex + 1); setMoreOpen(false); }
  };

  const goBack = () => {
    if (review) { setReview(false); return; }
    if (stepIndex > 0) { setStepIndex(stepIndex - 1); setMoreOpen(false); }
  };

  const changeStep = (i: number) => {
    changeReturn.current = true;
    setReview(false);
    setStepIndex(i);
    setMoreOpen(false);
  };

  const save = async () => {
    if (!myGuestId || saving) return;
    setSaving(true);
    setSaveError(null);
    const rows = steps.filter((id) => answers[id]).map((id) => ({
      experience_id: id,
      guest_id: myGuestId,
      status: answers[id]!.status,
      choice: answers[id]!.status === "going" ? answers[id]!.choice : null,
    }));
    const { error } = await supabase.from("experience_rsvps").upsert(rows, { onConflict: "experience_id,guest_id" });
    if (error) {
      const { data: lockRow } = await supabase.from("settings").select("value").eq("key", "rsvp_global_lock").maybeSingle();
      const lockedNow = lockRow?.value === "true" && !editor;
      setSaveError(t(lockedNow ? "purse.banner.closed" : "purse.flow.save_failed"));
      setSaving(false);
      return;
    }
    clearRsvpDraft(null, myGuestId);
    await qc.invalidateQueries({ queryKey: ["purse", "rsvps"] });
    toast.success(t("purse.flow.saved"));
    close();
    scrollToContent(document.getElementById("purse-experiences"));
  };

  if (total === 0) return null;

  const of = (i: number) => t("purse.flow.of").replace("{i}", String(i)).replace("{n}", String(total));
  const alsoGoing = alsoGoingList(experiences, rsvps, myGuestId);
  const totalZar = runningTotalZar(experiences, answers, rsvps, myGuestId);
  const totalParts = totalZar > 0 ? priceLineParts(totalZar, settings.zarPerUsd, currency) : null;
  const nowCpt = capeTownNow(now);

  return (
    <div
      ref={dialogRef}
      className="rsvp-flow"
      role="dialog"
      aria-modal="true"
      aria-label={t("purse.banner.title")}
      tabIndex={-1}
    >
      <div className="rsvp-flow-col">
        <div className="rsvp-flow-top">
          {review ? (
            <button type="button" className="rsvp-flow-close" onClick={goBack}>{t("purse.flow.back")}</button>
          ) : (
            <button type="button" className="rsvp-flow-close" onClick={requestClose}>{t("purse.flow.close")}</button>
          )}
          <span className="rsvp-flow-of" aria-live="polite">{review ? t("purse.flow.review") : of(stepIndex + 1)}</span>
        </div>
        <div className="rsvp-flow-progress" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} data-filled={review || i <= stepIndex} />
          ))}
        </div>

        {!review && current && (
          <div key={currentId} className="rsvp-flow-step">
            {deadlineUpcoming(current.rsvp_deadline, nowCpt) && (
              <p className="rsvp-flow-replyby">
                <span className="text-ember-deep">{t("purse.flow.reply_by")}</span>{" "}
                <span className="text-ember">{formatDeadline(current.rsvp_deadline!)}</span>
              </p>
            )}
            <h2 ref={titleRef} tabIndex={-1} className="rsvp-flow-title">{current.card}</h2>
            {current.summary && <p className="mt-3 text-sm leading-relaxed">{current.summary}</p>}
            {current.location && <p className="scene-location mt-2"><MapPin aria-hidden="true" />{current.location}</p>}
            <PriceLine exp={current} settings={settings} currency={currency} />
            {(current.details?.trim() || current.price_note?.trim()) && (
              <div className="mt-4">
                <button type="button" className="rsvp-flow-more" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
                  {t(moreOpen ? "purse.flow.less" : "purse.flow.more")}
                </button>
                {moreOpen && (
                  <div className="mt-3 space-y-3">
                    {current.details?.trim() && <p className="whitespace-pre-line text-sm leading-relaxed">{current.details.trim()}</p>}
                    {current.price_note?.trim() && (
                      <div>
                        <p className="label-caps text-ember-deep">{t("purse.good_to_know")}</p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{current.price_note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="rsvp-flow-answers">
              {(["going", "not_going"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rsvp-flow-answer"
                  data-status={s}
                  aria-pressed={answers[currentId!]?.status === s}
                  onClick={() => answer(currentId!, { status: s, choice: s === "going" ? answers[currentId!]?.choice ?? null : null })}
                >
                  {t(`purse.status.${s}`)}
                </button>
              ))}
            </div>
            {choiceList(current.choices).length > 0 && answers[currentId!]?.status === "going" && (
              <label className="mt-4 block space-y-1">
                <span className="label-caps text-muted-foreground">{t("purse.flow.choice_prompt")}</span>
                <select
                  className="field"
                  value={answers[currentId!]?.choice ?? ""}
                  onChange={(e) => answer(currentId!, { status: "going", choice: e.target.value || null })}
                >
                  <option value="">—</option>
                  {choiceList(current.choices).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        {review && (
          <div className="rsvp-flow-step">
            <h2 ref={titleRef} tabIndex={-1} className="rsvp-flow-title">{t("purse.flow.review_title")}</h2>
            <ul className="rsvp-flow-review">
              {steps.map((id, i) => {
                const a = answers[id];
                if (!a) return null;
                return (
                  <li key={id}>
                    <div>
                      <p className="rsvp-flow-review-title">{byId.get(id)?.card}</p>
                      {a.choice && <p className="text-xs text-muted-foreground">{a.choice}</p>}
                    </div>
                    <div className="text-right">
                      <p className="rsvp-flow-review-status" data-status={a.status}>{t(`purse.status.${a.status}`)}</p>
                      <button type="button" className="rsvp-flow-change" onClick={() => changeStep(i)}>{t("purse.flow.change")}</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {alsoGoing.length > 0 && (
              <div className="mt-6">
                <p className="label-caps text-ember-deep">{t("purse.flow.also_going_label")}</p>
                <p className="caption-serif mt-1">{alsoGoing.join(", ")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("purse.flow.also_going_note")}</p>
              </div>
            )}
            {settings.showTotal && totalParts && (
              <div className="mt-6">
                <p className="label-caps text-muted-foreground">{t("purse.flow.total_label")}</p>
                <p className="mt-1 text-sm">
                  {totalParts.primary} {t("purse.per_person")}
                  {totalParts.secondary != null && <span className="text-muted-foreground"> · {t("purse.about")} {totalParts.secondary}</span>}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t("purse.flow.total_note")}</p>
              </div>
            )}
          </div>
        )}

        <div className="rsvp-flow-footer">
          {saveError && <p className="rsvp-flow-error">{saveError}</p>}
          <div className="rsvp-flow-footer-row">
            {!review && stepIndex > 0 ? (
              <button type="button" className="rsvp-flow-close" onClick={goBack}>{t("purse.flow.back")}</button>
            ) : review ? (
              <button type="button" className="rsvp-flow-close" onClick={goBack}>{t("purse.flow.back")}</button>
            ) : <span />}
            {review ? (
              <button type="button" className="btn-pill btn-pill-solid" disabled={saving || answeredCount === 0} onClick={() => void save()}>
                {saving ? t("purse.flow.saving") : saveError ? t("purse.flow.retry") : t("purse.flow.save")}
              </button>
            ) : (
              <button
                type="button"
                className="btn-pill btn-pill-solid"
                disabled={!answers[currentId!] || (choiceList(current?.choices).length > 0 && answers[currentId!]?.status === "going" && !answers[currentId!]?.choice)}
                onClick={goNext}
              >
                {stepIndex >= total - 1 ? t("purse.flow.review") : t("purse.flow.next")}
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmLeave && (
        <div className="rsvp-flow-leave" role="alertdialog" aria-label={t("purse.flow.leave_title")}>
          <div className="rsvp-flow-leave-card">
            <h3 className="font-display-light text-2xl">{t("purse.flow.leave_title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("purse.flow.leave_body")}</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-pill" onClick={() => setConfirmLeave(false)}>{t("purse.flow.stay")}</button>
              <button type="button" className="btn-pill btn-pill-solid" onClick={close}>{t("purse.flow.leave")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
