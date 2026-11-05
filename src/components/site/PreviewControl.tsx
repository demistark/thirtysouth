import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { formatPreviewLabel } from "@/lib/phase";
import { useTripClock } from "@/lib/trip-clock";
import { useContent } from "@/lib/data";
import { localTimeDate, tripTimeZone, CPT_ZONE, type TripTimeZone } from "@/lib/trip-time";
import { TripTimeZoneSelect } from "./TripTimeInput";
import { Button } from "@/components/ui/button";


export function PreviewBanner() {
  const { isHost } = useAuth();
  const { isPreview, now, settings, setPreview } = useTripClock();
  if (!isHost || !isPreview) return null;
  return (
    <div className="flex items-center justify-center gap-4 bg-primary px-4 py-2 text-primary-foreground">
      <span className="label-caps">Previewing {formatPreviewLabel(now, settings.timezone)}</span>
      <button onClick={() => setPreview(null)} className="label-caps underline underline-offset-4">
        Reset
      </button>
    </div>
  );
}

export function PreviewControl() {
  const { t } = useContent();
  const { isHost } = useAuth();
  const { setPreview, settings } = useTripClock();
  const [value, setValue] = useState("");
  const [zone, setZone] = useState<TripTimeZone>(CPT_ZONE);
  const at = (local: string) => localTimeDate(local, zone);
  if (!isHost) return null;

  const phaseZone = tripTimeZone(settings.phase_timezone);
  const afterStart = localTimeDate(settings.phase_after_start, phaseZone);
  const presets = [
    { label: "Before", d: at("2026-11-10T09:00") },
    { label: "Nov 24", d: localTimeDate("2026-11-24T09:00", CPT_ZONE) },
    { label: "After", d: new Date(afterStart.getTime() + 3 * 3_600_000) },
  ];

  return (
    <Popover>
      <PopoverTrigger className="btn-pill fixed bottom-5 right-5 z-40 bg-card">Preview as…</PopoverTrigger>
      <PopoverContent align="end" className="w-72 bg-card">
        <TripTimeZoneSelect label={t("time.preview.label")} value={zone} onChange={setZone} />
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.label} className="btn-pill !px-3 !py-1.5" onClick={() => setPreview(p.d)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="datetime-local"
            className="field min-w-0 !py-1.5 text-sm"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button variant="pill" className="!px-3 !py-1.5" disabled={!value} onClick={() => setPreview(at(value))}>
            Go
          </Button>
        </div>
        <button className="label-caps mt-4 text-muted-foreground underline" onClick={() => setPreview(null)}>
          Reset to now
        </button>
      </PopoverContent>
    </Popover>
  );
}
