import { SectionLabel } from "@/app/components";
import { AlertSignupForm } from "@/app/alerts/_components/AlertSignupForm";

/**
 * "Get alerts" (DESIGN_SPEC.md 7a#5). The actual signup form, not a link
 * to /alerts: AlertSignupForm is owned by the alerts build (section 8) and
 * imported directly here with no props, per its own module doc comment.
 */
export function AlertsSection() {
  return (
    <section id="alerts" className="frame py-section">
      <div className="grid grid-cols-1 gap-x-gutter gap-y-10 lg:grid-cols-12">
        <div className="reveal col-span-1 flex flex-col gap-4 lg:col-span-6">
          <SectionLabel index={4}>Get alerts</SectionLabel>
          <h2 className="type-h2 max-w-column">Get alerts for your area</h2>
          <p className="type-body max-w-column text-ink-muted">
            If you live in a zone we&apos;re tracking, you don&apos;t need a
            smartphone, an app, or a data plan to find out when the ground
            under you starts changing. Give us a phone number and your area,
            and when our engine flags real risk there, we send a text and
            place a Bangla voice call, the same way an ordinary phone call
            already reaches you. No install, no login, no catch.
          </p>
        </div>

        <div className="col-span-1 flex lg:col-span-6 lg:justify-end">
          <AlertSignupForm />
        </div>
      </div>
    </section>
  );
}
