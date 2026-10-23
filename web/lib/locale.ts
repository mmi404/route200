/**
 * Server-only locale resolution for Route200's "বাংলা / EN" toggle.
 *
 * The active language lives in a single cookie, read once per request by
 * a server component (the root layout, or a page) and threaded down as a
 * plain `locale` prop from there, per DESIGN_SPEC.md's server-rendered,
 * no-flash architecture. Client Components that need the locale always
 * receive it this way; they never call cookies() themselves.
 */
import { cookies } from "next/headers";

export type Locale = "bn" | "en";

export const LOCALE_COOKIE = "route200-locale";

// Bangla-first, per docs/ARCHITECTURE.md's own stated design: an absent
// cookie (a first visit) resolves to "bn", not "en".
const DEFAULT_LOCALE: Locale = "bn";

function isLocale(value: string | undefined): value is Locale {
  return value === "bn" || value === "en";
}

/**
 * Reads the active UI locale from the route200-locale cookie. Calling
 * this (directly or through a parent that already did) is what makes a
 * route request-bound instead of static: see PROGRESS.md for why that is
 * the expected trade-off here, not a regression.
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
