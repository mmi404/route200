"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { setLocale } from "@/app/actions/locale-actions";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";

type SiteHeaderProps = {
  locale: Locale;
};

/**
 * The real global site header (DESIGN_SPEC.md section 7's intro), rendered
 * once from app/layout.tsx so every route gets it. 56px, paper background,
 * 1px rule bottom border, no blur. Sticky only on /map, where the canvas
 * below it is sized by `h-[calc(100dvh-var(--spacing-header))]` and relies
 * on this header staying pinned at the top; everywhere else (the landing
 * page included) it scrolls with the page.
 *
 * `locale` is resolved once in app/layout.tsx (the cookie read) and passed
 * down as a plain prop, since this is a Client Component (usePathname())
 * and must not call cookies() itself.
 */
export function SiteHeader({ locale }: SiteHeaderProps) {
  const pathname = usePathname();
  const onMap = pathname?.startsWith("/map") ?? false;
  const onAlerts = pathname?.startsWith("/alerts") ?? false;
  const copy = translations.header;

  return (
    <header
      className={`z-30 flex h-header shrink-0 items-center justify-between border-b border-rule bg-paper px-gutter ${
        onMap ? "sticky top-0" : ""
      }`}
    >
      <Link href="/" className="type-h3 whitespace-nowrap">
        {t(copy.wordmarkPrefix, locale)}
        <span className="text-ok">{t(copy.wordmarkSuffix, locale)}</span>
      </Link>
      <nav className="flex items-center gap-6">
        <Link
          href="/map"
          className={`type-small font-medium transition-colors duration-(--duration-fast) ease-editorial ${
            onMap ? "text-river" : "text-ink hover:text-river"
          }`}
        >
          {t(copy.navMap, locale)}
        </Link>
        <Link
          href="/alerts"
          className={`type-small font-medium transition-colors duration-(--duration-fast) ease-editorial ${
            onAlerts ? "text-river" : "text-ink hover:text-river"
          }`}
        >
          {t(copy.navGetAlerts, locale)}
        </Link>
        <LocaleToggle locale={locale} />
      </nav>
    </header>
  );
}

/**
 * The real toggle, replacing the old static "বাংলা / EN" text: two plain
 * <form>s, each posting setLocale (a Server Action), so the switch works
 * with zero client JS. The active language renders as plain text (not a
 * link, nothing to click); only the inactive one is an actionable,
 * underlined submit button, per DESIGN_SPEC.md's restrained, no-button-
 * soup aesthetic.
 */
function LocaleToggle({ locale }: { locale: Locale }) {
  return (
    <div
      className="type-small flex items-center gap-1.5"
      role="group"
      aria-label={t(translations.header.langToggle, locale)}
    >
      <LocaleOption value="bn" label="বাংলা" active={locale === "bn"} />
      <span aria-hidden="true" className="text-ink-subtle">
        /
      </span>
      <LocaleOption value="en" label="EN" active={locale === "en"} />
    </div>
  );
}

function LocaleOption({
  value,
  label,
  active,
}: {
  value: Locale;
  label: string;
  active: boolean;
}) {
  if (active) {
    return (
      <span aria-current="true" className="font-medium text-ink">
        {label}
      </span>
    );
  }

  return (
    <form action={setLocale} className="contents">
      <input type="hidden" name="locale" value={value} />
      <button
        type="submit"
        className="border-b-[1.5px] border-ink-subtle pb-0.5 leading-tight text-ink-subtle transition-colors duration-(--duration-fast) ease-editorial hover:border-river hover:text-river"
      >
        {label}
      </button>
    </form>
  );
}
