import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useContent } from "@/lib/data";
import { isTripParticipant } from "@/lib/locked-areas";

export type GateKind = "rsvp" | "commons" | "expense" | "default";

/**
 * Accessible dialog shown when a non-participant
 * taps a control that only friends on the trip may use. The control keeps its
 * normal look; the dialog explains instead of acting. Focus is trapped,
 * Escape closes, and focus returns to the triggering control.
 */
export function ActionGateDialog({ kind, open, onClose }: { kind: GateKind; open: boolean; onClose: () => void }) {
  const { t } = useContent();
  const boxRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const box = boxRef.current;
    const focusables = () => Array.from(box?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0]!, last = items.at(-1)!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="gate-overlay" onClick={onClose}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-heading"
        className="gate-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="gate-heading" className="font-display-light text-3xl text-deep-atlantic">{t("gate_heading")}</h2>
        <p className="mt-4 text-sm leading-relaxed">{t(`gate_message_${kind}`) || t("gate_message_default")}</p>
        <button className="btn-pill btn-pill-solid mt-6" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

/**
 * Wraps an action so only trip participants perform it; everyone else gets the
 * explanatory dialog. Usage:
 *   const gate = useActionGate("rsvp");
 *   <button onClick={gate.wrap(doRsvp)}>…</button>{gate.dialog}
 */
export function useActionGate(kind: GateKind) {
  const { roles } = useAuth();
  const participant = isTripParticipant(roles);
  const [open, setOpen] = useState(false);
  const wrap = useCallback(
    (action: () => void) => () => { if (participant) action(); else setOpen(true); },
    [participant],
  );
  const dialog: ReactNode = <ActionGateDialog kind={kind} open={open} onClose={() => setOpen(false)} />;
  return { participant, wrap, dialog };
}
