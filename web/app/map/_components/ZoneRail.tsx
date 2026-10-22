import { formatCitationDate } from "@/app/components";
import type { ChangeEvent, ZoneFeature } from "@/lib/types";
import type {
  DateWindow,
  KindFilter,
  ZoneListEntry,
  ZoneStatus,
} from "../_lib/severity";
import { InspectPanel } from "./InspectPanel";
import { ZoneListPanel } from "./ZoneListPanel";

type SeverityCounts = Partial<Record<"low" | "moderate" | "high" | "severe", number>>;

type ZoneRailProps = {
  freshness: string | null;
  kindFilter: KindFilter;
  onKindFilterChangeAction: (value: KindFilter) => void;
  dataRange: DateWindow;
  dateWindow: DateWindow;
  onDateWindowChangeAction: (window: DateWindow) => void;
  counts: SeverityCounts;
  entries: ZoneListEntry[];
  hoveredZoneId: string | null;
  onHoverZoneAction: (id: string | null) => void;
  onSelectZoneAction: (id: string) => void;
  selectedZone: ZoneFeature | null;
  selectedStatus: ZoneStatus | null;
  selectedHistory: ChangeEvent[];
  onBackAction: () => void;
  className?: string;
};

/**
 * Desktop (>=1024px) left rail. Holds the filters/list by default; when a
 * zone is selected, the inspect panel replaces the list inside the same
 * rail chrome (DESIGN_SPEC.md 7b), with a back control rather than a popup.
 */
export function ZoneRail({
  freshness,
  kindFilter,
  onKindFilterChangeAction,
  dataRange,
  dateWindow,
  onDateWindowChangeAction,
  counts,
  entries,
  hoveredZoneId,
  onHoverZoneAction,
  onSelectZoneAction,
  selectedZone,
  selectedStatus,
  selectedHistory,
  onBackAction,
  className = "",
}: ZoneRailProps) {
  return (
    <aside
      className={`w-rail shrink-0 flex-col overflow-y-auto border-r border-rule bg-surface px-5 py-6 ${className}`}
    >
      {selectedZone && selectedStatus ? (
        <InspectPanel
          zone={selectedZone}
          status={selectedStatus}
          history={selectedHistory}
          onBack={onBackAction}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="type-h1">Risk map</h1>
            {freshness && (
              <p className="type-meta text-ink-subtle">
                Latest pass {formatCitationDate(freshness)}
              </p>
            )}
          </div>
          <ZoneListPanel
            kindFilter={kindFilter}
            onKindFilterChangeAction={onKindFilterChangeAction}
            dataRange={dataRange}
            dateWindow={dateWindow}
            onDateWindowChangeAction={onDateWindowChangeAction}
            counts={counts}
            entries={entries}
            hoveredZoneId={hoveredZoneId}
            onHoverZoneAction={onHoverZoneAction}
            onSelectZoneAction={onSelectZoneAction}
          />
        </div>
      )}
    </aside>
  );
}
