"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The real global site header (DESIGN_SPEC.md section 7's intro), rendered
 * once from app/layout.tsx so every route gets it. 56px, paper background,
 * 1px rule bottom border, no blur. Sticky only on /map, where the canvas
 * below it is sized by `h-[calc(100dvh-var(--spacing-header))]` and relies
 * on this header staying pinned at the top; everywhere else (the landing
 * page included) it scrolls with the page.
 *
 * Replaces the provisional app/map/_components/MapTopBar.tsx, which was a
 * scoped stand-in for exactly this component before the landing build
 * landed.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const onMap = pathname?.startsWith("/map") ?? false;
  const onAlerts = pathname?.startsWith("/alerts") ?? false;

  return (
    <header
      className={`z-30 flex h-header shrink-0 items-center justify-between border-b border-rule bg-paper px-gutter ${
        onMap ? "sticky top-0" : ""
      }`}
    >
      <Link href="/" className="type-h3 whitespace-nowrap">
        Route<span className="text-ok">200</span>
      </Link>
      <nav className="flex items-center gap-6">
        <Link
          href="/map"
          className={`type-small font-medium transition-colors duration-(--duration-fast) ease-editorial ${
            onMap ? "text-river" : "text-ink hover:text-river"
          }`}
        >
          Map
        </Link>
        <Link
          href="/alerts"
          className={`type-small font-medium transition-colors duration-(--duration-fast) ease-editorial ${
            onAlerts ? "text-river" : "text-ink hover:text-river"
          }`}
        >
          Get alerts
        </Link>
        <span className="type-small text-ink-subtle" aria-hidden="true">
          বাংলা / EN
        </span>
      </nav>
    </header>
  );
}
