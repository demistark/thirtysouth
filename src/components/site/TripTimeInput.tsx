import { useState } from "react";
import { useContent } from "@/lib/data";
import { CPT_ZONE, EST_ZONE, convertTripTime, tripTimeZone, type TripTimeZone } from "@/lib/trip-time";

export function TripTimeZoneSelect({ value, onChange, label }: {
  value: string; onChange: (zone: TripTimeZone) => void; label?: string;
}) {
  const { t } = useContent();
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label || t("time.zone.label")}</span>
      <select className="field" aria-label={label || t("time.zone.label")} value={tripTimeZone(value)} onChange={(e) => onChange(tripTimeZone(e.target.value))}>
        <option value={EST_ZONE}>{t("time.zone.est")}</option>
        <option value={CPT_ZONE}>{t("time.zone.cpt")}</option>
      </select>
    </label>
  );
}

/** Entry-zone choices convert to canonical CPT storage; changing zones keeps the instant. */
export function TripTimeInput({ value, onChange, label }: {
  value: string; onChange: (value: string) => void; label: string;
}) {
  const [zone, setZone] = useState<TripTimeZone>(CPT_ZONE);
  const shown = convertTripTime(value, CPT_ZONE, zone).slice(0, 16);
  return (
    <div className="space-y-2">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{label}</span>
        <input type="datetime-local" className="field min-w-0" aria-label={label} value={shown}
          onChange={(e) => onChange(convertTripTime(e.target.value, zone, CPT_ZONE))} />
      </label>
      <TripTimeZoneSelect label={label} value={zone} onChange={setZone} />
    </div>
  );
}