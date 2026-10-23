"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/lib/locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function isLocale(value: FormDataEntryValue | null): value is Locale {
  return value === "bn" || value === "en";
}

/**
 * Sets the route200-locale cookie from the header's language toggle form
 * (SiteHeader.tsx). Invoked as a Server Action from a plain <form>, so it
 * works with zero client JS: the browser POSTs the form, this runs on the
 * server, and setting the cookie here makes Next.js re-render the current
 * route in the same response (see next/headers' cookies() docs), so the
 * whole page, including client-rendered sections like the map teaser and
 * the embedded alert form, reflects the new language in one round trip
 * with no redirect needed.
 */
export async function setLocale(formData: FormData): Promise<void> {
  const requested = formData.get("locale");
  if (!isLocale(requested)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, requested, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
}
