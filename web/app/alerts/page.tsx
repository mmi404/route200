import { Suspense } from "react";
import type { Metadata } from "next";
import { ButtonLink, SectionLabel } from "@/app/components";
import { AlertSignupForm } from "./_components/AlertSignupForm";

export const metadata: Metadata = {
  title: "Get alerts",
  description:
    "Sign up for SMS and Bangla voice alerts when Route200's engine flags real risk in your area.",
};

// Reading searchParams at the top of the page would opt the whole route
// into runtime rendering (Cache Components). Pushing that read into its
// own component, wrapped in Suspense below, keeps the copy column (and
// the rest of the static shell) prerenderable; only the zone pre-fill
// streams in at request time, same as the "push dynamic access down"
// pattern in Next's Cache Components guide.
async function ZonePrefilledForm({
  searchParams,
}: Pick<PageProps<"/alerts">, "searchParams">) {
  const params = await searchParams;
  const zoneParam = params?.zone;
  const defaultZoneId = Array.isArray(zoneParam) ? zoneParam[0] : zoneParam;
  return <AlertSignupForm defaultZoneId={defaultZoneId} />;
}

export default function AlertsPage(props: PageProps<"/alerts">) {
  return (
    <main className="frame flex flex-col py-section-tight">
      <div className="grid grid-cols-1 gap-x-gutter gap-y-12 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-6">
          <SectionLabel>Get alerts</SectionLabel>
          <h1 className="type-h1 max-w-column">Get alerts for your area</h1>
          <p className="type-lede max-w-column text-ink-muted">
            If you live in a zone we are tracking, you do not need a
            smartphone, an app, or a data plan to find out when the ground
            under you starts changing.
          </p>
          <p className="type-body max-w-column text-ink-muted">
            Give us a phone number and your area. When our engine flags real
            risk there, the same threshold that marks a zone severe on the
            public map, we send a text and place a Bangla voice call, the
            same way an ordinary phone call already reaches you.
          </p>
          <p className="type-body max-w-column text-ink-muted">
            There is no install, no login, and no cost beyond your own phone
            plan. One signup covers both channels by default: a text to
            read and a voice call to hear, in Bangla or English, whichever
            reaches you better. Add a second area later, for example a
            family home in a different zone.
          </p>
          <p className="type-meta text-ink-subtle">
            Covers all 12 zones we track: the Jamuna corridor and the
            Chattogram Hill Tracts.
          </p>
          <div>
            <ButtonLink href="/map" variant="secondary" size="lg">
              See the risk map first
            </ButtonLink>
          </div>
        </div>

        <div className="flex lg:col-span-6 lg:justify-end">
          <Suspense fallback={<AlertSignupForm />}>
            <ZonePrefilledForm searchParams={props.searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
