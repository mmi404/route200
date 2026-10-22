import {
  ButtonLink,
  SeverityBadge,
  SourceCitation,
  StatCallout,
} from "@/app/components";
import type { ZoneFeature } from "@/lib/types";
import { ZONE_KIND_LABEL } from "@/lib/design-tokens";
import type { ZoneStatus } from "../_lib/severity";
import { StripChart } from "./StripChart";
import type { ChangeEvent } from "@/lib/types";

type InspectPanelProps = {
  zone: ZoneFeature;
  /** Severity within the currently selected date window. */
  status: ZoneStatus;
  /** The zone's full event history, for the strip chart. */
  history: ChangeEvent[];
  onBack: () => void;
  className?: string;
};

export function InspectPanel({
  zone,
  status,
  history,
  onBack,
  className = "",
}: InspectPanelProps) {
  const { properties } = zone;
  const latest = status.event ?? history[history.length - 1];

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      <button
        type="button"
        onClick={onBack}
        className="type-small self-start text-ink-muted hover:text-river"
      >
        ← All zones
      </button>

      <div className="flex flex-col gap-2">
        <h2 className="type-h2">{properties.name}</h2>
        <p className="type-meta text-ink-subtle">
          {properties.upazila}, {properties.district} ·{" "}
          {ZONE_KIND_LABEL.en[properties.kind]}
        </p>
        {status.event ? (
          <SeverityBadge
            score={status.event.severity}
            variant="solid"
            showScore
          />
        ) : (
          <span className="type-meta inline-flex h-6 items-center gap-2 rounded-xs bg-nodata px-2 font-medium text-ink">
            No data in this window
          </span>
        )}
      </div>

      {status.event ? (
        <StatCallout
          size="md"
          value={status.event.areaSqKm}
          decimals={2}
          suffix=" km²"
          label="Area changed in this window"
          countUp={false}
        />
      ) : (
        <p className="type-small text-ink-subtle">
          No change event from this zone falls in the selected date window.
          Widen the window to see its recorded history.
        </p>
      )}

      <StripChart events={history} />

      <p className="type-small text-ink-muted">
        {properties.registeredAlertCount.toLocaleString("en-US")} registered
        for alerts in this zone.
      </p>

      {latest && (
        <SourceCitation
          source={latest.sourceScene}
          date={latest.dateRangeStart}
          dateEnd={latest.dateRangeEnd}
          note="Decision support, not a forecast."
        />
      )}

      <ButtonLink href={`/alerts?zone=${properties.id}`} size="md">
        Get alerts for this zone
      </ButtonLink>
    </div>
  );
}
