import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { formatPreviewLabel } from "@/lib/phase";
import { useTripClock } from "@/lib/trip-clock";

// Johannesburg has no daylight saving: a fixed +02:00 offset is exact.
const at = (local: string) => new Date(`${local}:00+02:00`);

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
  const { isHost } = useAuth();
  const { setPreview, settings } = useTripClock();
  const [value, setValue] = useState("");
  if (!isHost) return null;

  const presets = [
    { label: "Before", d: at("2026-11-10T09:00") },
    { label: "Nov 24", d: at("2026-11-24T09:00") },
    { label: "After", d: at(`${settings.after_trip_start}T10:00`) },
  ];

  return (
    <Popover>
      <PopoverTrigger className="btn-pill fixed bottom-5 right-5 z-40 bg-card">Preview as…</PopoverTrigger>
      <PopoverContent align="end" className="w-72 bg-card">
        <p className="label-caps text-muted-foreground">Preview as (Cape Town time)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.label} className="btn-pill !px-3 !py-1.5" onClick={() => setPreview(p.d)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            type="datetime-local"
            className="field !py-1.5 text-sm"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="btn-pill !px-3 !py-1.5" disabled={!value} onClick={() => setPreview(at(value))}>
            Go
          </button>
        </div>
        <button className="label-caps mt-4 text-muted-foreground underline" onClick={() => setPreview(null)}>
          Reset to now
        </button>
      </PopoverContent>
    </Popover>
  );
}
