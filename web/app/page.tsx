import { Hero } from "./_landing/Hero";
import { ProblemSection } from "./_landing/ProblemSection";
import { HowItWorksSchematic } from "./_landing/HowItWorksSchematic";
import { MapTeaser } from "./_landing/MapTeaser";
import { AlertsSection } from "./_landing/AlertsSection";
import { Footer } from "./_landing/Footer";
import { getLocale } from "@/lib/locale";

export default async function Home() {
  const locale = await getLocale();

  return (
    <main className="flex flex-1 flex-col">
      <Hero locale={locale} />
      <ProblemSection locale={locale} />
      <HowItWorksSchematic locale={locale} />
      <MapTeaser locale={locale} />
      <AlertsSection locale={locale} />
      <Footer locale={locale} />
    </main>
  );
}
