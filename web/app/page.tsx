import { Hero } from "./_landing/Hero";
import { ProblemSection } from "./_landing/ProblemSection";
import { HowItWorksSchematic } from "./_landing/HowItWorksSchematic";
import { MapTeaser } from "./_landing/MapTeaser";
import { AlertsSection } from "./_landing/AlertsSection";
import { Footer } from "./_landing/Footer";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <ProblemSection />
      <HowItWorksSchematic />
      <MapTeaser />
      <AlertsSection />
      <Footer />
    </main>
  );
}
