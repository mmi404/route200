import { ButtonLink } from "@/app/components";

/**
 * Footer (DESIGN_SPEC.md 7a#6). Full-bleed ink band, unnumbered. The
 * closing copy's two sentences from .design-research/landing-copy.md
 * section 6, then the repeated hero CTAs in their inverse tone, then a
 * ruled credits block naming data sources and the team.
 */
export function Footer() {
  return (
    <footer className="w-full bg-ink py-section-tight">
      <div className="frame flex flex-col gap-10">
        <div className="reveal flex flex-col gap-4">
          <h2 className="type-h2 max-w-wide text-paper">
            A 404 means the road was never built, not that the destination
            doesn&apos;t exist.
          </h2>
          <p className="type-lede max-w-column text-paper-muted">
            Route200 is that road: from the data already orbiting above
            Bangladesh to the people standing on the ground it&apos;s about.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <ButtonLink href="/map" size="lg" tone="inverse">
            See the risk map
          </ButtonLink>
          <ButtonLink href="#alerts" variant="secondary" size="lg" tone="inverse">
            Get alerts for your area
          </ButtonLink>
        </div>

        <div className="flex flex-col gap-2 border-t border-paper-muted/40 pt-6">
          <p className="type-meta text-paper-muted">
            Data: NASA/ISRO NISAR, ESA Copernicus Sentinel-1, CEGIS, OpenStreetMap
            contributors via OpenFreeMap.
          </p>
          <p className="type-meta text-paper-muted">
            Built by team CUET_404 for NASA Space Apps Challenge 2026.
          </p>
        </div>
      </div>
    </footer>
  );
}
