import { SectionLabel } from "@/app/components";
import { PALETTE } from "@/lib/design-tokens";

/**
 * "How it works" (DESIGN_SPEC.md 7a#3). Full-bleed `well` band. The first
 * sentence of the copy's section-3 paragraph ("One engine, two tracks.")
 * is used as the h2, exactly as the spec's own layout direction describes;
 * the remainder of that paragraph plus the second paragraph are unchanged.
 *
 * The right column is a ruled schematic in inline SVG, not an icon
 * illustration: two satellite sources converge on one change engine, which
 * forks into the map door (river) and the alert door (ink).
 */
export function HowItWorksSchematic() {
  return (
    <section className="w-full bg-well py-section-tight">
      <div className="frame">
        <div className="grid grid-cols-1 gap-x-gutter gap-y-12 lg:grid-cols-12">
          <div className="reveal col-span-1 flex flex-col gap-4 lg:col-span-5">
            <SectionLabel index={2}>How it works</SectionLabel>
            <h2 className="type-h2">One engine, two tracks.</h2>
            <p className="type-body text-ink-muted">
              Satellites like NISAR and Sentinel-1 scan the same riverbank or
              hillside on repeat passes, in cloud and in clear sky alike, since
              radar sees through monsoon weather the way an ordinary camera
              can&apos;t. Comparing passes over time reveals where land is
              eroding or shifting, before it becomes a headline.
            </p>
            <p className="type-body text-ink-muted">
              That single stream of change data feeds two front doors. One is a
              public map, for anyone curious or affected, showing the change
              visually. The other is a direct line to risk-zone households:
              automated SMS and Bangla voice calls, triggered the moment a zone
              crosses a risk threshold, no map or app needed on the receiving
              end.
            </p>
          </div>

          <div className="col-span-1 flex items-center justify-center lg:col-span-7">
            <EngineSchematic />
          </div>
        </div>
      </div>
    </section>
  );
}

function EngineSchematic() {
  const stroke = PALETTE.ink;
  const river = PALETTE.river;
  const ink = PALETTE.ink;

  return (
    <svg
      viewBox="0 0 480 300"
      className="h-auto w-full max-w-[30rem]"
      role="img"
      aria-label="NISAR GCOV and Sentinel-1 GRD feed the change engine, which forks into the public map and SMS plus Bangla voice call."
    >
      {/* Inputs */}
      <Node x={30} y={20} width={180} height={48} label="NISAR GCOV" stroke={stroke} />
      <Node x={270} y={20} width={180} height={48} label="Sentinel-1 GRD" stroke={stroke} />

      {/* Converging lines to the engine */}
      <line x1={120} y1={68} x2={240} y2={128} stroke={stroke} strokeWidth={1.5} />
      <line x1={360} y1={68} x2={240} y2={128} stroke={stroke} strokeWidth={1.5} />

      {/* Engine */}
      <Node x={150} y={128} width={180} height={48} label="Change engine" stroke={stroke} />

      {/* Forking lines */}
      <line x1={190} y1={176} x2={110} y2={232} stroke={stroke} strokeWidth={1.5} />
      <line x1={290} y1={176} x2={370} y2={232} stroke={stroke} strokeWidth={1.5} />

      {/* Outputs: the two front doors */}
      <Node x={20} y={232} width={180} height={48} label="Public map" stroke={river} textColor={river} />
      <Node
        x={280}
        y={232}
        width={180}
        height={48}
        label="SMS + Bangla voice call"
        stroke={ink}
        textColor={ink}
      />
    </svg>
  );
}

function Node({
  x,
  y,
  width,
  height,
  label,
  stroke,
  textColor,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  stroke: string;
  textColor?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-mono)"
        fontSize={13}
        fill={textColor ?? stroke}
      >
        {label}
      </text>
    </g>
  );
}
