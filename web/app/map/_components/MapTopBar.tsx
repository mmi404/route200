import Link from "next/link";

/**
 * A minimal stand-in for the site header on /map.
 *
 * DESIGN_SPEC.md section 8 assigns the real global header (wordmark, nav,
 * language toggle, sticky on /map) to the landing build, placed in
 * app/layout.tsx. That build hasn't landed yet (app/page.tsx is still the
 * framework scaffold as of this module), so /map would otherwise have no
 * header at all even though its layout spec assumes one is there
 * (`h-[calc(100dvh-var(--spacing-header))]`). This fills that gap with the
 * same 56px bar described in the spec, scoped to this page only.
 *
 * Remove this file and render MapExperience directly under the shared
 * header once app/layout.tsx grows one; nothing else in this module
 * depends on the header living here.
 */
export function MapTopBar() {
  return (
    <header className="flex h-header shrink-0 items-center justify-between border-b border-rule bg-paper px-gutter">
      <Link href="/" className="type-h3 whitespace-nowrap">
        Route<span className="text-ok">200</span>
      </Link>
      <nav className="flex items-center gap-6">
        <span className="type-small font-medium text-river">Map</span>
        <Link href="/alerts" className="type-small link-inline">
          Get alerts
        </Link>
        <span className="type-meta text-ink-subtle" aria-hidden="true">
          বাংলা / EN
        </span>
      </nav>
    </header>
  );
}
