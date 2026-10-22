import type { Metadata } from "next";
import {
  Button,
  ButtonLink,
  SectionLabel,
  SeverityBadge,
  SeverityScale,
  SourceCitation,
  StatCallout,
} from "@/app/components";

export const metadata: Metadata = {
  title: "Design reference",
  robots: { index: false, follow: false },
};

const SWATCHES: { name: string; token: string; hex: string; use: string }[] = [
  { name: "paper", token: "bg-paper", hex: "#F5F0E6", use: "Page background" },
  { name: "surface", token: "bg-surface", hex: "#FBF8F1", use: "Raised panels" },
  { name: "well", token: "bg-well", hex: "#ECE5D8", use: "Alternate band" },
  { name: "rule", token: "bg-rule", hex: "#D9CFBE", use: "Hairlines" },
  { name: "ink", token: "bg-ink", hex: "#1C1A17", use: "Text, footer band" },
  { name: "ink-muted", token: "bg-ink-muted", hex: "#57514A", use: "Secondary text" },
  { name: "river", token: "bg-river", hex: "#1D5B78", use: "Primary accent" },
  { name: "ok", token: "bg-ok", hex: "#2E6B3E", use: "Secondary accent, 200" },
];

/**
 * Living reference for the shared foundation. Not linked from the site and
 * not indexed; it exists so anyone building a page can see every token and
 * primitive rendered with real Route200 content.
 */
export default function DesignReferencePage() {
  return (
    <main className="frame flex flex-col gap-section py-section-tight">
      <header className="flex max-w-column flex-col gap-4">
        <SectionLabel index={0}>Design reference</SectionLabel>
        <h1 className="type-display">
          From <span className="font-mono font-normal text-ink-subtle line-through decoration-2">404</span> to{" "}
          <span className="text-ok">200</span>
        </h1>
        <p className="type-lede text-ink-muted">
          Route200 turns satellite radar data into a warning that reaches your
          phone, not just a server.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-2">
          <ButtonLink href="/map" size="lg">
            See the risk map
          </ButtonLink>
          <ButtonLink href="#alerts" variant="secondary" size="lg">
            Get alerts for your area
          </ButtonLink>
        </div>
      </header>

      <section className="flex flex-col gap-6">
        <SectionLabel index={1}>Palette</SectionLabel>
        <ul className="grid grid-cols-2 gap-x-gutter gap-y-6 sm:grid-cols-4">
          {SWATCHES.map((swatch) => (
            <li key={swatch.name} className="flex flex-col gap-2">
              <span className={`h-16 ring-1 ring-ink/15 ring-inset ${swatch.token}`} />
              <span className="type-meta">
                <span className="font-medium text-ink">{swatch.name}</span>{" "}
                <span className="text-ink-subtle">{swatch.hex}</span>
                <span className="block text-ink-muted">{swatch.use}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-6">
        <SectionLabel index={2}>Severity</SectionLabel>
        <SeverityScale
          title="Change severity, engine score 0–100"
          markAlertThreshold
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <SeverityBadge score={12} showScore />
          <SeverityBadge score={38} showScore />
          <SeverityBadge score={64} showScore />
          <SeverityBadge score={88} showScore />
          <SeverityBadge score={88} variant="solid" showScore />
          <SeverityBadge band="high" variant="solid" />
          <SeverityBadge band="moderate" variant="solid" />
          <SeverityBadge band="low" variant="solid" />
          <span lang="bn">
            <SeverityBadge score={88} lang="bn" />
          </span>
        </div>
        <div className="max-w-[20rem] bg-surface p-4 ring-1 ring-rule">
          <SeverityScale
            orientation="vertical"
            title="Zones by current severity"
            counts={{ low: 4, moderate: 3, high: 3, severe: 2 }}
            markAlertThreshold
          />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionLabel index={3}>Type</SectionLabel>
        <div className="flex max-w-column flex-col gap-5">
          <p className="type-h1">One engine, two tracks.</p>
          <p className="type-h2">The data wasn&apos;t the surprise. The silence around it was.</p>
          <p className="type-h3">Jamuna char, Kazipur</p>
          <p className="type-body">
            NASA and ISRO&apos;s NISAR mission watches Bangladesh&apos;s rivers and
            hillsides from space. Bangladesh&apos;s own CEGIS has tracked the
            Jamuna&apos;s erosion every year since 2004.{" "}
            <a className="link-inline" href="#alerts">
              None of this is hypothetical.
            </a>
          </p>
          <p className="type-body" lang="bn">
            নাসা ও ইসরোর নিসার মিশন মহাকাশ থেকে বাংলাদেশের নদী আর পাহাড়ের ঢাল
            পর্যবেক্ষণ করে। যমুনার চরে কিংবা চট্টগ্রামের পাহাড়ে, ঝুঁকির খবর
            পৌঁছাবে আপনার ফোনে।
          </p>
          <p className="type-h2" lang="bn">
            ৪০৪ থেকে ২০০: জলবায়ুর তথ্য এবার আপনার কাছে
          </p>
          <p className="type-meta text-ink-subtle">
            24.77°N 89.66°E · Sentinel-1 GRD · pass 21 Oct 2026
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionLabel index={4}>Stat callouts</SectionLabel>
        <div className="grid gap-x-gutter gap-y-10 sm:grid-cols-3">
          <StatCallout
            value={2004}
            grouping={false}
            countUp={false}
            label="The year CEGIS began tracking Jamuna erosion annually"
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
            source="Reported fatalities, July 2026"
          />
        </div>
        <div className="grid max-w-[24rem] gap-6">
          <StatCallout
            value={1.84}
            decimals={2}
            suffix=" km²"
            size="md"
            accent="river"
            label="Bank area changed, 6 Jul to 24 Jul 2026"
          />
        </div>
      </section>

      <section id="alerts" className="flex flex-col gap-6">
        <SectionLabel index={5}>Buttons and citations</SectionLabel>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Button type="submit">Get alerts for my area</Button>
          <Button variant="secondary">Change area</Button>
          <Button disabled>Sending</Button>
        </div>
        <SourceCitation
          className="max-w-column"
          source="ESA Copernicus Sentinel-1 GRD"
          href="https://dataspace.copernicus.eu/"
          detail="ascending pass, VV polarisation"
          date="2026-07-06"
          dateEnd="2026-07-24"
          note="Change detected by amplitude differencing. Decision support, not a forecast."
        />
      </section>

      <section className="-mx-gutter flex flex-col gap-8 bg-ink px-gutter py-section-tight text-paper">
        <SectionLabel index={6} tone="inverse">
          Ink band
        </SectionLabel>
        <p className="type-h2 max-w-column">
          A 404 means the road was never built, not that the destination
          doesn&apos;t exist.
        </p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <ButtonLink href="/map" tone="inverse">
            See the risk map
          </ButtonLink>
          <ButtonLink href="#alerts" variant="secondary" tone="inverse">
            Get alerts for your area
          </ButtonLink>
        </div>
        <SourceCitation
          tone="inverse"
          label="Built by"
          source="team CUET_404 for NASA Space Apps Challenge 2026"
        />
      </section>
    </main>
  );
}
