/**
 * Locale-agnostic translation helpers: safe to import from both Server and
 * Client Components (unlike lib/locale.ts's getLocale(), which reads the
 * request cookie and so only runs on the server). A component that needs
 * these always receives the resolved `locale` as a prop; it never resolves
 * one itself.
 */
import type { Bilingual } from "./translations";
import type { Locale } from "./locale";
import type { ZoneProperties } from "./types";

/**
 * Pulls the right-language string out of a translations.ts entry.
 *
 *   t(translations.hero.headline, locale)
 */
export function t<T extends Bilingual>(entry: T, locale: Locale): T[Locale] {
  return entry[locale];
}

/**
 * Interpolates plain "{name}" placeholders in a translated template, per
 * translations.ts's own documented convention: no runtime formatting
 * magic, so a data-driven number is formatted first (formatStatNumber /
 * CountUp's `locale` option) and the formatted string passed in here.
 *
 *   format(t(translations.hero.sectionLabelTracking, locale), { count: "১২" })
 */
export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  let result = template;
  for (const [name, value] of Object.entries(values)) {
    result = result.split(`{${name}}`).join(String(value));
  }
  return result;
}

/**
 * A zone's display name for the active locale: its natural Bangla name
 * when the locale is "bn" and the zone has one, its English `name`
 * otherwise. This is the fix for the QA-flagged issue where the Bangla
 * SMS preview and area select spliced a raw English zone name into a
 * Bangla sentence.
 */
export function zoneDisplayName(
  properties: Pick<ZoneProperties, "name" | "nameBn">,
  locale: Locale,
): string {
  return locale === "bn" && properties.nameBn ? properties.nameBn : properties.name;
}
