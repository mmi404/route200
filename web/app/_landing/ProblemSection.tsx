import { SectionLabel, StatCallout } from "@/app/components";

/**
 * "The problem" (DESIGN_SPEC.md 7a#2). Copy is verbatim from
 * .design-research/landing-copy.md section 2, split across the three
 * source paragraphs with the three stat figures inserted between
 * paragraphs two and three, then the closing sentence repeated as a
 * pulled quote, newspaper style.
 */
export function ProblemSection() {
  return (
    <section className="frame flex flex-col py-section">
      <div className="grid grid-cols-4 gap-x-gutter sm:grid-cols-12">
        <div className="reveal col-span-4 flex flex-col gap-4 sm:col-span-8 sm:col-start-2">
          <SectionLabel index={1}>The problem</SectionLabel>
          <h2 className="type-h2 max-w-column">
            The science exists, and it already works.
          </h2>
        </div>

        <div className="col-span-4 mt-8 flex flex-col gap-5 sm:col-span-8 sm:col-start-2">
          <p className="type-body max-w-column text-ink-muted">
            NASA and ISRO&apos;s NISAR mission watches Bangladesh&apos;s rivers and
            hillsides from space. Bangladesh&apos;s own CEGIS has tracked the
            Jamuna&apos;s erosion every year since 2004. None of this is
            hypothetical. The science exists, and it already works.
          </p>
          <p className="type-body max-w-column text-ink-muted">
            What doesn&apos;t exist is the route from that data to the person
            standing on the riverbank when it gives way. A UNICEF-Gallup survey
            from December 2023 found only 37% of Bangladeshi youth could
            correctly identify the definition of climate change, in one of the
            most climate-exposed countries on earth.
          </p>
        </div>

        <div className="reveal col-span-4 mt-10 sm:col-span-12 sm:col-start-1">
          <div className="grid grid-cols-1 gap-x-gutter gap-y-8 sm:grid-cols-3">
            <StatCallout
              value={2004}
              grouping={false}
              countUp={false}
              label="The year CEGIS began tracking Jamuna erosion every year"
              source="CEGIS"
            />
            <StatCallout
              value={37}
              suffix="%"
              label="of Bangladeshi youth could correctly define climate change"
              source="UNICEF-Gallup, Dec 2023"
            />
            <StatCallout
              value={50}
              suffix="+"
              accent="severe"
              label="deaths in the July 2026 Chattogram Hill Tracts landslides"
              source="News reporting, Jul 2026"
            />
          </div>
        </div>

        <div className="col-span-4 mt-10 flex flex-col gap-5 sm:col-span-8 sm:col-start-2">
          <p className="type-body max-w-column text-ink-muted">
            The July 2026 monsoon landslides across the Chattogram Hill Tracts
            killed more than fifty people. The data wasn&apos;t the surprise.
            The silence around it was. That gap, between what satellites
            already see and who gets told, is what Route200 closes.
          </p>
        </div>

        <div className="reveal col-span-4 mt-10 border-t-2 border-ink pt-6 sm:col-span-10 sm:col-start-2">
          <p className="type-h2 max-w-wide">
            That gap, between what satellites already see and who gets told,
            is what Route200 closes.
          </p>
        </div>
      </div>
    </section>
  );
}
